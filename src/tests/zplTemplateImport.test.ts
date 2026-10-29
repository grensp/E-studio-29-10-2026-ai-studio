import { describe, expect, it } from 'vitest';
import { ZplExporter } from '../utils/zplExporter';
import { applyZplSourceToTemplate, importZplTemplate } from '../utils/zplTemplateImport';
import { migrateTemplateSchema, ProductRecord } from '../types';

const product: ProductRecord = { id: 'zpl-import-product', ITEMNAME: 'Imported label' };

describe('ZPL template import into the main canvas model', () => {
  it('imports supported text, graphic shapes, and barcode fields with source provenance', () => {
    const source = [
      '^XA',
      '^PW406',
      '^LL203',
      '^FX preserve operator note ^FS',
      '^FO10,20^A0N,24,18^FH^FDPrice _5E item^FS',
      '^FO30,60^GB80,30,3,B,0^FS',
      '^FO30,100^B3N,N,60,Y,N^FDABC-123^FS',
      '^XZ',
    ].join('\r\n');
    const result = importZplTemplate(source, 'retail-import.zpl');

    expect(result.template.name).toBe('retail-import');
    expect(result.template.items.map(({ type }) => type)).toEqual(['text', 'shape', 'barcode']);
    expect(result.template.items[0]).toMatchObject({ type: 'text', text: 'Price ^ item' });
    expect(result.template.items[1]).toMatchObject({ type: 'shape' });
    expect(result.template.items[2]).toMatchObject({ type: 'barcode', code: 'ABC-123', use_static_value: true, barcode_type: 'code39' });
    expect(result.template.zpl_source?.item_ranges).toHaveLength(3);
    expect(result.diagnostics.some((diagnostic) => diagnostic.includes('estimated canvas width'))).toBe(true);
  });

  it('imports and re-exports quarter-turned text as editable canvas text', () => {
    const source = '^XA^PW406^LL203^FO30,40^A0R,24,18^FH^FDRotated label^FS^XZ';
    const imported = importZplTemplate(source);
    const [text] = imported.template.items;

    expect(text).toMatchObject({ type: 'text', text: 'Rotated label', rotation: 90 });
    expect(ZplExporter.generateLabelZpl(imported.template, product, { dpi: 203 })).toBe(source);

    const edited = {
      ...imported.template,
      items: [{ ...text, text: 'Edited label' }, ...imported.template.items.slice(1)],
    };
    expect(ZplExporter.generateLabelZpl(edited, product, { dpi: 203 }))
      .toContain('^A0R,24,18^FB');
  });

  it('preserves ^FB line spacing and hanging indentation when edited on canvas', () => {
    const source = '^XA^PW406^LL203^FO30,40^A0N,24,18^FB180,3,4,C,12^FH^FDOriginal block^FS^XZ';
    const imported = importZplTemplate(source);
    const [text] = imported.template.items;

    expect(text).toMatchObject({
      type: 'text',
      zpl_field_block: { line_spacing: 4, hanging_indent: 12 },
    });
    expect(ZplExporter.generateLabelZpl(imported.template, product, { dpi: 203 })).toBe(source);

    const edited = {
      ...imported.template,
      items: [{ ...text, text: 'Edited block' }, ...imported.template.items.slice(1)],
    };
    expect(ZplExporter.generateLabelZpl(edited, product, { dpi: 203 }))
      .toContain('^FB180,');
    expect(ZplExporter.generateLabelZpl(edited, product, { dpi: 203 }))
      .toContain(',4,C,12^FH^FDEdited block^FS');
  });

  it.each([
    ['N', 0],
    ['R', 90],
    ['I', 180],
    ['B', 270],
  ] as const)('maps ^A0%s font orientation to canvas rotation %i', (orientation, rotation) => {
    const source = `^XA^PW406^LL203^FO30,40^A0${orientation},24,18^FH^FDRotated label^FS^XZ`;
    const imported = importZplTemplate(source);

    expect(imported.template.items[0]).toMatchObject({ rotation });
    expect(ZplExporter.generateLabelZpl(imported.template, product, { dpi: 203 })).toBe(source);
  });

  it('preserves the complete original source when imported objects are untouched', () => {
    const source = '\r\n^XA  \r\n^PW406\r\n^LL203\r\n^FX keep\r\n^FO10,20^A0N,24,18^FH^FDHello_5Fworld^FS\r\n^ZZopaque\r\n^XZ  ';
    const template = importZplTemplate(source).template;

    expect(ZplExporter.generateLabelZpl(template, product, { dpi: 300 })).toBe(source);
    expect(migrateTemplateSchema(template).zpl_source).toEqual(template.zpl_source);
  });

  it('regenerates only the edited item block, retaining comments, line endings, and unknown commands', () => {
    const source = '^XA\r\n^PW406\r\n^LL203\r\n^FXoperator note^FS\r\n^FO10,20^A0N,24,18^FH^FDOriginal^FS\r\n^ZZ vendor extension\r\n^XZ';
    const template = importZplTemplate(source).template;
    const [textItem] = template.items;
    const edited = {
      ...template,
      items: [{ ...textItem, text: 'Changed' }, ...template.items.slice(1)],
    };
    const output = ZplExporter.generateLabelZpl(edited, product, { dpi: 203 });

    expect(output).toContain('^FXoperator note^FS');
    expect(output).toContain('^ZZ vendor extension');
    expect(output).toContain('^FO10,20');
    expect(output).toContain('^FDChanged^FS');
    expect(output).not.toContain('Original');
    expect(output.startsWith('^XA\r\n')).toBe(true);
  });

  it('keeps unchanged source coordinates when editing imported items at 203 dpi', () => {
    const source = '^XA^PW812^LL406^FO501,303^A0N,24,18^FH^FDOriginal^FS^XZ';
    const template = importZplTemplate(source).template;
    const edited = {
      ...template,
      items: [{ ...template.items[0], text: 'Changed' }, ...template.items.slice(1)],
    };
    const output = ZplExporter.generateLabelZpl(edited, product, { dpi: 203 });

    expect(output).toContain('^FO501,303');
    expect(output).toContain('^FDChanged^FS');
  });

  it('deletes mapped source objects and appends new canvas objects before ^XZ', () => {
    const source = '^XA\n^PW406\n^LL203\n^FXkeep^FS\n^FO10,20^A0N,24,18^FH^FDRemove me^FS\n^XZ';
    const template = importZplTemplate(source).template;
    const newText = {
      ...template.items[0],
      id: 'new-canvas-text',
      x_mm: 3,
      y_mm: 5,
      text: 'Added',
    };
    expect(newText.type).toBe('text');
    const edited = { ...template, items: [newText] };
    const output = ZplExporter.generateLabelZpl(edited, product, { dpi: 203 });

    expect(output).toContain('^FXkeep');
    expect(output).not.toContain('Remove me');
    expect(output).toContain('^FDAdded^FS');
    expect(output.lastIndexOf('^XZ')).toBeGreaterThan(output.indexOf('^FDAdded^FS'));
  });

  it('imports rotated text while blocking ambiguous page edits', () => {
    const source = '^XA^PW400^PW450^LL200^FO10,20^A0R,24,18^FDrotated^FS^XZ';
    const result = importZplTemplate(source);
    const template = result.template;

    expect(template.items).toMatchObject([{ type: 'text', text: 'rotated', rotation: 90 }]);
    expect(result.diagnostics.some((diagnostic) => diagnostic.includes('Multiple ^PW'))).toBe(true);
    expect(ZplExporter.generateLabelZpl(template, product, { dpi: 203 })).toBe(source);
  });

  it('changes only unique page dimensions and refuses edits when the source range is unavailable', () => {
    const source = '^XA\r\n^PW406\r\n^LL203\r\n^FXkeep^FS\r\n^XZ';
    const template = importZplTemplate(source).template;
    const resized = { ...template, width_mm: template.width_mm * 2, height_mm: template.height_mm * 2 };
    const output = ZplExporter.generateLabelZpl(resized, product, { dpi: 203 });

    expect(output).toBe('^XA\r\n^PW812\r\n^LL406\r\n^FXkeep^FS\r\n^XZ');

    const noTerminator = importZplTemplate('^XA\n^PW406\n^LL203').template;
    const addedItem = {
      id: 'appended-without-terminator',
      type: 'text' as const,
      x_mm: 1,
      y_mm: 1,
      w_mm: 5,
      h_mm: 5,
      rotation: 0,
      z_index: 0,
      locked: false,
      text: 'Added',
      font_family: '0',
      font_size_pt: 10,
      font_weight: 'normal' as const,
      font_style: 'normal' as const,
      text_decoration: 'none' as const,
      text_color: '#000000',
      alignment: 'left' as const,
      valign: 'top' as const,
      wrap: false,
      overflow: 'overflow' as const,
    };
    expect(() => ZplExporter.generateLabelZpl({ ...noTerminator, items: [addedItem] }, product, { dpi: 203 }))
      .toThrow('no ^XZ label terminator');
  });

  it('applies source edits to an existing canvas template without changing project identity', () => {
    const current = importZplTemplate('^XA^PW406^LL203^FO10,20^A0N,24,18^FH^FDBefore^FS^XZ', 'Existing label').template;
    const source = '^XA^PW500^LL250^FO30,40^A0N,24,18^FH^FDUpdated^FS^ZZpreserved^XZ';

    const applied = applyZplSourceToTemplate(current, source);

    expect(applied.template).toMatchObject({
      id: current.id,
      name: current.name,
      width_mm: 500 * 25.4 / 203.2,
      height_mm: 250 * 25.4 / 203.2,
      items: [{ type: 'text', x_mm: 30 * 25.4 / 203.2, y_mm: 40 * 25.4 / 203.2, text: 'Updated' }],
    });
    expect(applied.template.zpl_source?.source).toBe(source);
    expect(applied.template.zpl_source?.item_ranges[0].item_id).toBe(applied.template.items[0].id);
    expect(ZplExporter.generateLabelZpl(applied.template, product, { dpi: 203 })).toBe(source);
  });

  it('refuses to replace canvas objects with an incomplete label draft', () => {
    const current = importZplTemplate('^XA^PW406^LL203^FO10,20^A0N,24,18^FH^FDBefore^FS^XZ').template;

    expect(() => applyZplSourceToTemplate(current, '^XA^FO10,20^A0N,24,18^FDMissing terminator'))
      .toThrow(/complete \^XA\.\.\.\^XZ label block/);
    expect(() => applyZplSourceToTemplate(current, '^XZ^XA^XZ'))
      .toThrow(/\^XZ before a \^XA/);
  });

  it('imports the barcode symbologies emitted by the ZPL renderer', () => {
    const barcodeFields = [
      ['^B1N,60,Y^FH^FD123456^FS', 'code11'],
      ['^B2N,60,Y,N,N^FD12345678901234^FS', 'gtin14'],
      ['^B3N,N,60,Y,N^FDABC-123^FS', 'code39'],
      ['^B7N,80,3,10,7,N^FD123^FS', 'pdf417'],
      ['^B8N,60,Y,N,N^FD1234567^FS', 'ean8'],
      ['^B9N,60,Y,N^FD1234567^FS', 'upce'],
      ['^B0N,4,0,0^FDABC^FS', 'azteccode'],
      ['^BAN,60,Y,N^FH^FDABC123^FS', 'code93'],
      ['^BCN,60,Y,N,N^FH^FD>;0101234567890128^FS', 'gs1_128'],
      ['^BDN,4,,,,^FDABC^FS', 'maxicode'],
      ['^BEN,60,Y,N^FD123456789012^FS', 'ean13'],
      ['^BFN,60,0,0,0^FDABC^FS', 'micropdf417'],
      ['^BKN,60,Y,N^FDABC^FS', 'codabar'],
      ['^BRN,60,2,1,1^FD123^FS', 'databar'],
      ['^BUN,60,Y,N^FD12345678901^FS', 'upca'],
      ['^BXN,6,200,,,,,^FH^FDABC^FS', 'datamatrix'],
      ['^BZN,20,,Y^FD12345^FS', 'postnet'],
      ['^B2N,60,Y,N,N^FD12345678^FS', 'interleaved2of5'],
    ] as const;
    const fields = barcodeFields.map(([command], index) =>
      `^FO${index * 10},0^BY2,3,60${command}`
    );
    const imported = importZplTemplate(`^XA^PW812^LL406${fields.join('')}^XZ`);

    expect(imported.template.items.map((item) => item.type)).toEqual(barcodeFields.map(() => 'barcode'));
    expect(imported.template.items.map((item) => item.type === 'barcode' ? item.barcode_type : null))
      .toEqual(barcodeFields.map(([, type]) => type));
    expect(imported.template.zpl_source?.item_ranges).toHaveLength(barcodeFields.length);
    expect(ZplExporter.generateLabelZpl(imported.template, product, { dpi: 203 }))
      .toBe(`^XA^PW812^LL406${fields.join('')}^XZ`);
  });

  it('imports circular ^GC graphics as editable ellipse objects', () => {
    const imported = importZplTemplate('^XA^PW406^LL203^FO10,20^GC40,4,B^FS^XZ');

    expect(imported.template.items).toMatchObject([
      { type: 'ellipse', w_mm: 40 * 25.4 / 203.2, h_mm: 40 * 25.4 / 203.2 },
    ]);
  });

  it('distinguishes renderer-generated horizontal lines from rectangles', () => {
    const imported = importZplTemplate('^XA^PW406^LL203^FO10,20^GB80,3,3,B,0^FS^XZ');

    expect(imported.template.items).toMatchObject([
      { type: 'line', w_mm: 80 * 25.4 / 203.2, h_mm: 3 * 25.4 / 203.2 },
    ]);
    expect(ZplExporter.generateLabelZpl(imported.template, product, { dpi: 203 }))
      .toBe('^XA^PW406^LL203^FO10,20^GB80,3,3,B,0^FS^XZ');
  });

  it('imports field-block width, wrapping, line count, and text justification', () => {
    const source = '^XA^PW812^LL406^FO20,30^A0N,24,16^FB240,3,0,C,0^FH^FDWrap this label^FS^XZ';
    const imported = importZplTemplate(source);

    expect(imported.template.items).toMatchObject([
      {
        type: 'text',
        w_mm: 240 * 25.4 / 203.2,
        h_mm: 72 * 25.4 / 203.2,
        alignment: 'center',
        wrap: true,
      },
    ]);
    expect(ZplExporter.generateLabelZpl(imported.template, product, { dpi: 203 })).toBe(source);
  });
});
