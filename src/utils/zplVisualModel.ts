import { applyZplSourceEdits, ZplSourceDocument, ZplSourceEdit, ZplSourceSegment } from './zplSourceDocument';

export interface ZplVisualTextObject {
  id: string;
  xDots: number;
  yDots: number;
  fontHeightDots: number;
  fontWidthDots: number;
  rotationDegrees: number;
  text: string;
  sourceStart: number;
  sourceEnd: number;
  editable: boolean;
  hexEscaped: boolean;
  unsupportedReason?: string;
  textRange: { start: number; end: number };
  positionRange: { start: number; end: number };
  expectedText: string;
  expectedPosition: string;
}

export interface ZplVisualModel {
  widthDots: number;
  heightDots: number;
  widthRange?: { start: number; end: number; expected: string };
  heightRange?: { start: number; end: number; expected: string };
  objects: ZplVisualTextObject[];
  diagnostics: string[];
}

function commandPayload(segment: ZplSourceSegment): string {
  return segment.raw.slice(3);
}

function decodeFieldData(raw: string, hexEscaped: boolean): { text: string; editable: boolean; reason?: string } {
  const match = raw.match(/^\^FD([\s\S]*)\^FS$/);
  if (!match) return { text: '', editable: false, reason: 'Field data is not a complete ^FD...^FS block.' };
  const encoded = match[1];
  if (/[\^~]/.test(encoded)) {
    return { text: encoded, editable: false, reason: 'Embedded control characters prevent safe text editing.' };
  }
  if (!hexEscaped) return { text: encoded, editable: true };
  if (/_(?!5e|5f|7e)/i.test(encoded)) {
    return { text: encoded, editable: false, reason: 'Unsupported hexadecimal field escapes prevent visual editing.' };
  }
  const text = encoded.replace(/_5e/gi, '^').replace(/_5f/gi, '_').replace(/_7e/gi, '~');
  return { text, editable: true };
}

function findFieldData(segments: ZplSourceSegment[], fromIndex: number): { segment: ZplSourceSegment; index: number } | null {
  for (let index = fromIndex; index < segments.length; index++) {
    const segment = segments[index];
    if (segment.kind === 'field-data') return { segment, index };
    if (segment.command === '^FO' || segment.command === '^XZ' || segment.command === '^XA') return null;
    if (segment.kind === 'graphic') return null;
  }
  return null;
}

export function parseZplVisualModel(document: ZplSourceDocument): ZplVisualModel {
  let widthDots = 812;
  let heightDots = 406;
  let widthRange: ZplVisualModel['widthRange'];
  let heightRange: ZplVisualModel['heightRange'];
  const objects: ZplVisualTextObject[] = [];
  const diagnostics = document.diagnostics.map(({ message }) => message);
  const segments = document.segments;

  const pageWidthCommands = segments.filter(({ command }) => command === '^PW');
  const pageHeightCommands = segments.filter(({ command }) => command === '^LL');
  const readPageSize = (commands: ZplSourceSegment[], label: string): { value: number; range?: { start: number; end: number; expected: string } } => {
    if (commands.length > 1) {
      diagnostics.push(`Multiple ${label} commands are present; page-size editing is disabled to avoid ambiguous changes.`);
      return { value: label === '^PW' ? widthDots : heightDots };
    }
    const segment = commands[0];
    if (!segment) return { value: label === '^PW' ? widthDots : heightDots };
    const payload = commandPayload(segment);
    const match = payload.match(/^(\s*)(\d+)(\s*)$/);
    if (!match || Number(match[2]) < 1) {
      diagnostics.push(`${label} is not a simple positive integer; page-size editing is disabled.`);
      return { value: label === '^PW' ? widthDots : heightDots };
    }
    const start = segment.start + 3 + match[1].length;
    return {
      value: Number(match[2]),
      range: { start, end: start + match[2].length, expected: match[2] },
    };
  };
  const pageWidth = readPageSize(pageWidthCommands, '^PW');
  const pageHeight = readPageSize(pageHeightCommands, '^LL');
  widthDots = pageWidth.value;
  heightDots = pageHeight.value;
  widthRange = pageWidth.range;
  heightRange = pageHeight.range;

  segments.forEach((segment, index) => {
    if (segment.command !== '^FO') return;
    const position = commandPayload(segment).match(/^(-?\d+),(-?\d+)/);
    const field = findFieldData(segments, index + 1);
    if (!position || !field) {
      diagnostics.push(`Field at offset ${segment.start} is not a supported positioned text field.`);
      return;
    }

    const intervening = segments.slice(index + 1, field.index);
    const font = intervening.find(({ command }) => command === '^A0');
    const hexFieldCommand = intervening.find(({ command }) => command === '^FH');
    const hasCustomHexPrefix = Boolean(hexFieldCommand && commandPayload(hexFieldCommand) && commandPayload(hexFieldCommand) !== '_');
    const unsupported = intervening.find(({ kind, command }) =>
      kind !== 'raw' && command !== '^A0' && command !== '^FB' && command !== '^FH'
    );
    const fontParams = font?.raw.match(/^\^A0([NRIB]),(\d+),(\d+)/);
    const fieldData = decodeFieldData(field.segment.raw, intervening.some(({ command }) => command === '^FH'));
    let reason = fieldData.reason;
    if (unsupported) reason = `${unsupported.command || 'Unknown command'} in field is not supported for visual editing.`;
    else if (!fontParams) reason = 'Only ^A0 text fields with a supported orientation can be visually edited.';
    else if (hasCustomHexPrefix) reason = 'Custom ^FH escape prefixes are preserved but not supported for visual editing.';
    const editable = !reason;
    if (reason) diagnostics.push(`Field at offset ${segment.start}: ${reason}`);
    if (intervening.some(({ command }) => command === '^FB')) {
      diagnostics.push(`Field at offset ${segment.start} uses ^FB block layout; preview text wrapping/alignment is approximate.`);
    }

    const payloadStart = field.segment.start + 3;
    const payloadEnd = field.segment.end - 3;
    const positionStart = segment.start + 3;
    const xDigitsStart = positionStart;
    const xDigitsEnd = xDigitsStart + position[1].length;
    const yDigitsStart = xDigitsEnd + 1;
    const yDigitsEnd = yDigitsStart + position[2].length;

    objects.push({
      id: `zpl-object-${objects.length + 1}`,
      xDots: Number(position[1]),
      yDots: Number(position[2]),
      fontHeightDots: Number(fontParams?.[2] || 24),
      fontWidthDots: Number(fontParams?.[3] || 18),
      rotationDegrees: fontParams?.[1] === 'R' ? 90 : fontParams?.[1] === 'I' ? 180 : fontParams?.[1] === 'B' ? 270 : 0,
      text: fieldData.text,
      sourceStart: segment.start,
      sourceEnd: field.segment.end,
      editable,
      hexEscaped: Boolean(hexFieldCommand) && !hasCustomHexPrefix,
      unsupportedReason: reason,
      textRange: { start: payloadStart, end: payloadEnd },
      positionRange: { start: xDigitsStart, end: yDigitsEnd },
      expectedText: document.source.slice(payloadStart, payloadEnd),
      expectedPosition: document.source.slice(xDigitsStart, yDigitsEnd),
    });
  });

  return { widthDots, heightDots, widthRange, heightRange, objects, diagnostics };
}

export function updateZplPageSize(
  source: string,
  model: ZplVisualModel,
  patch: { widthDots?: number; heightDots?: number }
): string {
  const edits: ZplSourceEdit[] = [];
  const dimensions: Array<{
    value: number | undefined;
    range: ZplVisualModel['widthRange'];
    label: string;
  }> = [
    { value: patch.widthDots, range: model.widthRange, label: 'width (^PW)' },
    { value: patch.heightDots, range: model.heightRange, label: 'height (^LL)' },
  ];
  for (const dimension of dimensions) {
    if (dimension.value === undefined) continue;
    if (!dimension.range) throw new Error(`Cannot safely edit page ${dimension.label}: a unique numeric command is required.`);
    if (!Number.isInteger(dimension.value) || dimension.value < 1) {
      throw new Error(`Page ${dimension.label} must be a positive whole number of printer dots.`);
    }
    edits.push({
      ...dimension.range,
      expected: dimension.range.expected,
      replacement: String(dimension.value),
    });
  }
  return applyZplSourceEdits(source, edits);
}

export function updateZplVisualText(
  source: string,
  object: ZplVisualTextObject,
  patch: { xDots?: number; yDots?: number; text?: string }
): string {
  if (!object.editable) throw new Error(object.unsupportedReason || 'This ZPL field cannot be safely edited visually.');
  const edits: ZplSourceEdit[] = [];

  if (patch.text !== undefined) {
    if (/[\u0000-\u001f\u007f]/.test(patch.text)) throw new Error('Text cannot contain control characters.');
    if (!object.hexEscaped && /[\^~_]/.test(patch.text)) {
      throw new Error('This field has no ^FH escape command; add it before editing underscores or ZPL control characters.');
    }
    const escaped = object.hexEscaped
      ? patch.text.replace(/_/g, '_5F').replace(/\^/g, '_5E').replace(/~/g, '_7E')
      : patch.text;
    edits.push({
      start: object.textRange.start,
      end: object.textRange.end,
      expected: object.expectedText,
      replacement: escaped,
    });
  }

  if (patch.xDots !== undefined || patch.yDots !== undefined) {
    const x = patch.xDots ?? object.xDots;
    const y = patch.yDots ?? object.yDots;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
      throw new Error('Visual coordinates must be non-negative whole printer dots.');
    }
    const expected = object.expectedPosition;
    if (!/^-?\d+,-?\d+$/.test(expected)) throw new Error('The field position is malformed.');
    edits.push({
      start: object.positionRange.start,
      end: object.positionRange.end,
      expected,
      replacement: `${x},${y}`,
    });
  }

  return applyZplSourceEdits(source, edits);
}
