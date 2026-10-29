import { LabelTemplate, TemplateItem } from '../types';
import { mmToDots, zplOrientationToDegrees } from '../render/drawZplItem';
import { parseZplSource, ZplSourceSegment } from './zplSourceDocument';

export interface ZplTemplateImportResult {
  template: LabelTemplate;
  diagnostics: string[];
}

function dotsToMm(dots: number, dpi: 203 | 300 | 600): number {
  const effectiveDpi = dpi === 203 ? 203.2 : dpi;
  return dots * 25.4 / effectiveDpi;
}

function parseNumbers(value: string, count: number): number[] | null {
  const values = value.split(',').map((part) => Number(part.trim()));
  return values.length >= count && values.slice(0, count).every(Number.isFinite) ? values : null;
}

function defaults(id: string, type: TemplateItem['type'], x: number, y: number, w: number, h: number, dpi: 203 | 300 | 600) {
  return {
    id,
    type,
    x_mm: dotsToMm(x, dpi),
    y_mm: dotsToMm(y, dpi),
    w_mm: dotsToMm(w, dpi),
    h_mm: dotsToMm(h, dpi),
    rotation: 0,
    z_index: 0,
    locked: false,
  };
}

function commandValue(segment: ZplSourceSegment): string {
  return segment.raw.slice(3);
}

function fieldData(raw: string): { value: string; start: number; end: number } | null {
  const match = raw.match(/^\^FD([\s\S]*)\^FS$/);
  if (!match) return null;
  return { value: match[1], start: 3, end: raw.length - 3 };
}

function unescapeFieldHex(value: string): string | null {
  if (/_(?!5E|5F|7E)/i.test(value)) return null;
  return value.replace(/_5E/gi, '^').replace(/_5F/gi, '_').replace(/_7E/gi, '~');
}

function findFieldEnd(segments: ZplSourceSegment[], startIndex: number): number {
  for (let index = startIndex; index < segments.length; index++) {
    if (['field-data', 'comment', 'graphic'].includes(segments[index].kind)) return segments[index].end;
    if (segments[index].command === '^FS') return segments[index].end;
    if (segments[index].command === '^XZ') return segments[index].start;
  }
  return segments[segments.length - 1]?.end ?? 0;
}

export function importZplTemplate(
  source: string,
  filename = 'Imported ZPL',
  dpi: 203 | 300 | 600 = 203
): ZplTemplateImportResult {
  const document = parseZplSource(source);
  const diagnostics = document.diagnostics.map(({ message }) => message);
  const segments = document.segments;
  let widthDots = 812;
  let heightDots = 406;
  let pageWidthRange: NonNullable<LabelTemplate['zpl_source']>['page_width_range'];
  let pageHeightRange: NonNullable<LabelTemplate['zpl_source']>['page_height_range'];

  const pageWidthCommands = segments.filter(({ command }) => command === '^PW');
  const pageHeightCommands = segments.filter(({ command }) => command === '^LL');
  for (const segment of segments) {
    if (segment.command === '^PW' || segment.command === '^LL') {
      const raw = commandValue(segment);
      const match = raw.match(/^(\s*)(\d+)(\s*)$/);
      if (!match || Number(match[2]) <= 0) {
        diagnostics.push(`${segment.command} is not a simple positive integer; dimensions use the default canvas size.`);
        continue;
      }
      const start = segment.start + 3 + match[1].length;
      const range = { start, end: start + match[2].length, expected: match[2] };
      if (segment.command === '^PW') {
        widthDots = Number(match[2]);
        pageWidthRange = range;
      } else {
        heightDots = Number(match[2]);
        pageHeightRange = range;
      }
    }
  }
  if (pageWidthCommands.length > 1) {
    pageWidthRange = undefined;
    diagnostics.push('Multiple ^PW commands are present; page width cannot be safely edited in the canvas.');
  }
  if (pageHeightCommands.length > 1) {
    pageHeightRange = undefined;
    diagnostics.push('Multiple ^LL commands are present; page height cannot be safely edited in the canvas.');
  }

  const items: TemplateItem[] = [];
  const ranges: NonNullable<LabelTemplate['zpl_source']>['item_ranges'] = [];
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (segment.command !== '^FO') continue;
    const position = parseNumbers(commandValue(segment), 2);
    if (!position || position[0] < 0 || position[1] < 0) {
      diagnostics.push(`Unsupported field position at offset ${segment.start}; source is preserved.`);
      continue;
    }
    const end = findFieldEnd(segments, index + 1);
    const related = segments.filter((candidate) => candidate.start >= segment.start && candidate.end <= end);
    const itemId = `zpl_${items.length + 1}`;
    const field = related.find(({ kind }) => kind === 'field-data');
    const data = field ? fieldData(field.raw) : null;
    const commands = related.filter(({ command }) => command);
    const unknownCommands = commands.filter(({ command }) =>
      ![
        '^FO', '^FS', '^GB', '^GE', '^GC', '^A0', '^FB', '^FH', '^FD', '^BY', '^B0', '^B1', '^B2',
        '^B3', '^B7', '^B8', '^B9', '^BA', '^BC', '^BD', '^BE', '^BF', '^BK', '^BQ', '^BR', '^BU', '^BX', '^BZ',
      ].includes(command || '')
    );
    let item: TemplateItem | null = null;

    const graphic = commands.find(({ command }) => command === '^GB' || command === '^GE' || command === '^GC');
    if (graphic && unknownCommands.length === 0) {
      const circle = graphic.command === '^GC'
        ? commandValue(graphic).match(/^(\d+),(\d+)(?:,([BW]))?/i)
        : null;
      const values = graphic.command === '^GC' && circle
        ? [Number(circle[1]), Number(circle[1]), Number(circle[2])]
        : parseNumbers(commandValue(graphic), 3);
      if (values && values[0] > 0 && values[1] > 0) {
        const [width, height, thickness] = values;
        const isEllipse = graphic.command === '^GE' || graphic.command === '^GC';
        const isLine = graphic.command === '^GB' && height === thickness;
        const base = defaults(
          itemId,
          isEllipse ? 'ellipse' : isLine ? 'line' : 'shape',
          position[0],
          position[1],
          width,
          height,
          dpi
        );
        item = isEllipse
          ? {
              ...base,
              type: 'ellipse',
              fill_color: thickness >= height ? '#000000' : '#ffffff',
              border_color: '#000000',
              border_width: dotsToMm(Math.max(1, thickness), dpi),
            }
          : isLine
            ? {
                ...base,
                type: 'line',
                thickness: dotsToMm(Math.max(1, thickness), dpi),
                color: '#000000',
                style: 'solid',
              }
          : {
              ...base,
              type: 'shape',
              fill_color: thickness >= height ? '#000000' : '#ffffff',
              border_color: '#000000',
              border_width: dotsToMm(Math.max(1, thickness), dpi),
              corner_radius: 0,
            };
      }
    }

    const barcode = commands.find(({ command }) =>
      ['^B0', '^B1', '^B2', '^B3', '^B7', '^B8', '^B9', '^BA', '^BC', '^BD', '^BE', '^BF', '^BK', '^BR', '^BU', '^BX', '^BZ'].includes(command || '')
    );
    if (!item && barcode && data && unknownCommands.length === 0) {
      const gs1Code128 = barcode.command === '^BC' && data.value.startsWith('>;');
      let barcodeType: Extract<TemplateItem, { type: 'barcode' }>['barcode_type'] = gs1Code128
        ? 'gs1_128'
        : barcode.command === '^B1' ? 'code11'
          : barcode.command === '^B3' ? 'code39'
            : barcode.command === '^B7' ? 'pdf417'
              : barcode.command === '^B9' ? 'upce'
                : barcode.command === '^B0' ? 'azteccode'
                  : barcode.command === '^BD' ? 'maxicode'
                    : barcode.command === '^BF' ? 'micropdf417'
                      : barcode.command === '^BK' ? 'codabar'
                        : barcode.command === '^BR' ? 'databar'
                          : barcode.command === '^BX' ? 'datamatrix'
                            : barcode.command === '^BZ' ? 'postnet'
                : barcode.command === '^BA' ? 'code93'
                  : barcode.command === '^BE' ? 'ean13'
                  : barcode.command === '^B8' ? 'ean8'
                    : barcode.command === '^BU' ? 'upca'
                      : barcode.command === '^B2' ? 'gtin14'
                        : 'code128';
      let rawCode = data.value.startsWith('>;') || data.value.startsWith('>:') ? data.value.slice(2) : data.value;
      if (gs1Code128) rawCode = rawCode.replace(/_1D/gi, '\x1d');
      const decodedCode = commands.some(({ command }) => command === '^FH')
        ? unescapeFieldHex(rawCode)
        : rawCode;
      if (barcode.command === '^B2') {
        barcodeType = /^\d{14}$/.test(decodedCode || '') ? 'gtin14' : 'interleaved2of5';
      }
      if (decodedCode === null) {
        diagnostics.push(`Barcode at offset ${segment.start}: unsupported field-hex escape; its source remains untouched.`);
      } else {
        const heights = commandValue(barcode).match(/^[A-Z],(\d+)/);
        const barcodeHeight = Number(heights?.[1] || 80);
        item = {
          ...defaults(itemId, 'barcode', position[0], position[1], Math.max(160, decodedCode.length * 24), barcodeHeight, dpi),
          type: 'barcode',
          code: decodedCode,
          use_static_value: true,
          barcode_type: barcodeType,
          show_text: /,Y(?:,|$)/.test(commandValue(barcode)),
          bar_color: '#000000',
        };
        diagnostics.push(`Barcode at offset ${segment.start}: estimated canvas width; the original source is retained unless edited.`);
      }
    }

    const qr = commands.find(({ command }) => command === '^BQ');
    if (!item && qr && data && unknownCommands.length === 0) {
      const content = data.value.replace(/^LA,/, '');
      const module = Number(commandValue(qr).split(',').pop() || 3);
      item = {
        ...defaults(itemId, 'qrcode', position[0], position[1], module * 21, module * 21, dpi),
        type: 'qrcode',
        content,
        module_color: '#000000',
        background_color: '#ffffff',
      };
    }

    const font = commands.find(({ command }) => command === '^A0');
    if (!item && font && data && unknownCommands.length === 0) {
      const params = font.raw.match(/^\^A0([NRIB]),(\d+),(\d+)/);
      if (params) {
        const decoded = commands.some(({ command }) => command === '^FH') ? unescapeFieldHex(data.value) : data.value;
        const decodedData = data.value.startsWith('>;') ? null : decoded;
        if (decodedData !== null) {
          const fontH = Number(params[2]);
          const fontW = Number(params[3]);
          const fieldBlock = commands.find(({ command }) => command === '^FB');
          const blockParams = fieldBlock?.raw.match(/^\^FB(\d+),(\d+),(-?\d+),([LCRJ]),(-?\d+)/);
          const blockWidth = blockParams ? Number(blockParams[1]) : undefined;
          const blockLines = blockParams ? Math.max(1, Number(blockParams[2])) : 1;
          const alignment = blockParams?.[4] === 'C'
            ? 'center'
            : blockParams?.[4] === 'R'
              ? 'right'
              : blockParams?.[4] === 'J'
                ? 'justify'
                : 'left';
          item = {
            ...defaults(
              itemId,
              'text',
              position[0],
              position[1],
              blockWidth ?? Math.max(fontW * decodedData.length, 80),
              Math.max(fontH * blockLines, fontH * 1.5),
              dpi
            ),
            type: 'text',
            text: decodedData,
            font_family: '0',
            font_size_pt: Math.max(5, fontH * 72 / dpi / 0.85),
            ...(fontW > 0 && fontH > 0 ? { zpl_font_width_ratio: fontW / fontH } : {}),
            ...(blockParams ? {
              zpl_field_block: {
                line_spacing: Number(blockParams[3]),
                hanging_indent: Number(blockParams[5]),
              },
            } : {}),
            font_weight: 'normal',
            font_style: 'normal',
            text_decoration: 'none',
            text_color: '#000000',
            alignment,
            rotation: zplOrientationToDegrees(params[1]),
            valign: 'top',
            wrap: Boolean(fieldBlock),
            overflow: 'overflow',
          };
        }
      }
    }

    if (!item) {
      diagnostics.push(`Unsupported or ambiguous field at offset ${segment.start}; its source remains untouched.`);
      continue;
    }
    const frozenItem = JSON.parse(JSON.stringify(item)) as TemplateItem;
    items.push(item);
    ranges.push({ item_id: item.id, start: segment.start, end, original_item: frozenItem });
  }

  const now = new Date().toISOString();
  const template: LabelTemplate = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `zpl_${Date.now()}`,
    name: filename.replace(/\.(zpl|txt)$/i, '') || 'Imported ZPL',
    revision: 1,
    schema_version: 1,
    created_at: now,
    updated_at: now,
    width_mm: dotsToMm(widthDots, dpi),
    height_mm: dotsToMm(heightDots, dpi),
    inner_margins_mm: { top: 0, bottom: 0, left: 0, right: 0 },
    outer_margins_mm: { top: 0, bottom: 0, left: 0, right: 0 },
    bg_color: '#ffffff',
    bg_opacity: 1,
    items,
    zpl_source: {
      source,
      dpi,
      original_width_mm: dotsToMm(widthDots, dpi),
      original_height_mm: dotsToMm(heightDots, dpi),
      page_width_range: pageWidthRange,
      page_height_range: pageHeightRange,
      item_ranges: ranges,
    },
  };
  return { template, diagnostics };
}

export function applyZplSourceToTemplate(
  currentTemplate: LabelTemplate,
  source: string
): ZplTemplateImportResult {
  const document = parseZplSource(source);
  let insideLabel = false;
  let labelCount = 0;
  for (const segment of document.segments) {
    if (segment.command === '^XA') {
      if (insideLabel) throw new Error('Cannot apply ZPL source with nested ^XA label starts.');
      insideLabel = true;
      labelCount++;
    } else if (segment.command === '^XZ') {
      if (!insideLabel) throw new Error('Cannot apply ZPL source with ^XZ before a ^XA label start.');
      insideLabel = false;
    }
  }
  if (labelCount === 0 || insideLabel) {
    throw new Error('Cannot apply ZPL source without a complete ^XA...^XZ label block.');
  }
  const imported = importZplTemplate(source, currentTemplate.name, currentTemplate.zpl_source?.dpi ?? 203);
  return {
    diagnostics: imported.diagnostics,
    template: {
      ...currentTemplate,
      width_mm: imported.template.width_mm,
      height_mm: imported.template.height_mm,
      items: imported.template.items,
      zpl_source: imported.template.zpl_source,
    },
  };
}

export function zplSourceDotsToMm(dots: number, dpi: 203 | 300 | 600): number {
  return dotsToMm(dots, dpi);
}

export function zplSourceMmToDots(mm: number, dpi: 203 | 300 | 600): number {
  return mmToDots(mm, dpi);
}
