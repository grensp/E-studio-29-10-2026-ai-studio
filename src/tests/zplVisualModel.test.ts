import { describe, expect, it } from 'vitest';
import { parseZplSource } from '../utils/zplSourceDocument';
import { parseZplVisualModel, updateZplPageSize, updateZplVisualText } from '../utils/zplVisualModel';

describe('source-linked ZPL visual text model', () => {
  it('extracts normal-font text objects and label dimensions while preserving opaque content', () => {
    const source = '^XA\n^PW400\n^LL200\n^FXkeep^FS\n^FO20,30^A0N,24,18^FDHello^FS\n^ZZunknown\n^XZ';
    const document = parseZplSource(source);
    const model = parseZplVisualModel(document);

    expect(model).toMatchObject({
      widthDots: 400,
      heightDots: 200,
      objects: [{ xDots: 20, yDots: 30, text: 'Hello', editable: true }],
    });
    expect(document.segments.map(({ raw }) => raw).join('')).toBe(source);
  });

  it('edits only the object text and position ranges', () => {
    const source = '^XA\n^FXuntouched^FS\n^FO20,30^A0N,24,18^FH^FDHello^FS\n^ZZkeep\n^XZ';
    const object = parseZplVisualModel(parseZplSource(source)).objects[0];
    const updated = updateZplVisualText(source, object, { xDots: 25, yDots: 35, text: 'New ^ label' });

    expect(updated).toBe('^XA\n^FXuntouched^FS\n^FO25,35^A0N,24,18^FH^FDNew _5E label^FS\n^ZZkeep\n^XZ');
  });

  it('updates page dimensions in place without changing spacing or adjacent source', () => {
    const source = '^XA\n^PW 400  \n^LL200\n^FXkeep^FS^XZ';
    const model = parseZplVisualModel(parseZplSource(source));

    expect(updateZplPageSize(source, model, { widthDots: 500, heightDots: 250 }))
      .toBe('^XA\n^PW 500  \n^LL250\n^FXkeep^FS^XZ');
  });

  it('refuses ambiguous dimensions and validates page size values', () => {
    const duplicateSource = '^XA^PW400^PW500^LL200^XZ';
    const duplicateModel = parseZplVisualModel(parseZplSource(duplicateSource));
    expect(() => updateZplPageSize(duplicateSource, duplicateModel, { widthDots: 600 })).toThrow(/unique numeric command/);

    const source = '^XA^PW400^LL200^XZ';
    const model = parseZplVisualModel(parseZplSource(source));
    expect(() => updateZplPageSize(source, model, { heightDots: 0 })).toThrow(/positive whole number/);
  });

  it('rejects visual edits when their captured source spans are stale', () => {
    const source = '^XA^FO1,2^A0N,20,20^FH^FDbefore^FS^XZ';
    const object = parseZplVisualModel(parseZplSource(source)).objects[0];
    const changedTextSource = source.replace('before', 'altered');
    const changedPositionSource = source.replace('^FO1,2', '^FO5,2');

    expect(() => updateZplVisualText(changedTextSource, object, { text: 'after' })).toThrow(/changed since/);
    expect(() => updateZplVisualText(changedPositionSource, object, { xDots: 6 })).toThrow(/changed since/);
  });

  it('round-trips field-hex escapes and escapes literal underscores before writing', () => {
    const source = '^XA^FO1,2^A0N,20,20^FH^FDLot_5F1_5eA_7eB^FS^XZ';
    const object = parseZplVisualModel(parseZplSource(source)).objects[0];

    expect(object.text).toBe('Lot_1^A~B');
    expect(updateZplVisualText(source, object, { text: 'Lot_1^A~B' }))
      .toBe('^XA^FO1,2^A0N,20,20^FH^FDLot_5F1_5EA_7EB^FS^XZ');
  });

  it('supports quarter-turned text while keeping unsupported field commands read-only', () => {
    const rotated = parseZplVisualModel(parseZplSource('^XA^FO1,2^A0R,20,20^FDrotated^FS^XZ'));
    const unsupported = parseZplVisualModel(parseZplSource('^XA^FO1,2^A0N,20,20^FR^FDflipped^FS^XZ'));

    expect(rotated.objects[0]).toMatchObject({ editable: true, rotationDegrees: 90 });
    expect(updateZplVisualText('^XA^FO1,2^A0R,20,20^FDrotated^FS^XZ', rotated.objects[0], { text: 'edited' }))
      .toBe('^XA^FO1,2^A0R,20,20^FDedited^FS^XZ');
    expect(unsupported.objects[0].editable).toBe(false);
  });

  it('allows safe source edits for fields with block formatting while marking preview approximation', () => {
    const source = '^XA^FO1,2^A0N,20,20^FB120,2,0,C,0^FH^FDwrapped^FS^XZ';
    const model = parseZplVisualModel(parseZplSource(source));

    expect(model.objects[0].editable).toBe(true);
    expect(model.diagnostics.some((diagnostic) => diagnostic.includes('preview text wrapping/alignment is approximate'))).toBe(true);
    expect(updateZplVisualText(source, model.objects[0], { text: 'edited' }))
      .toBe('^XA^FO1,2^A0N,20,20^FB120,2,0,C,0^FH^FDedited^FS^XZ');
  });

  it('preserves custom field-hex escape conventions but disables visual edits', () => {
    const source = '^XA^FO1,2^A0N,20,20^FH!^FDtext^FS^XZ';
    const object = parseZplVisualModel(parseZplSource(source)).objects[0];

    expect(object.editable).toBe(false);
    expect(object.unsupportedReason).toMatch(/Custom \^FH/);
  });

  it('rejects control characters in visual edits', () => {
    const source = '^XA^FO1,2^A0N,20,20^FDsafe^FS^XZ';
    const object = parseZplVisualModel(parseZplSource(source)).objects[0];

    expect(() => updateZplVisualText(source, object, { text: 'bad\ntext' })).toThrow(/control characters/);
    expect(() => updateZplVisualText(source, object, { text: 'literal ^ character' })).toThrow(/\^FH/);
    expect(() => updateZplVisualText(source, object, { text: 'literal _ underscore' })).toThrow(/\^FH/);
  });
});
