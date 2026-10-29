import { describe, expect, it } from 'vitest';
import {
  applyZplSourceEdits,
  parseZplSource,
  replaceZplSegment,
  serializeZplSource,
} from '../utils/zplSourceDocument';

describe('ZPL source document', () => {
  it('reconstructs untouched source including whitespace, comments, unknown commands, and line endings', () => {
    const source = '\r\n^XA  \n^FXkeep this comment^FS\n^FO10,20^A0N,20,20^FDhello^FS\n^ZZopaque\r\n^XZ  ';
    const document = parseZplSource(source);

    expect(serializeZplSource(document)).toBe(source);
    expect(document.diagnostics).toEqual([]);
    expect(document.segments.some((segment) => segment.kind === 'comment')).toBe(true);
    expect(document.segments.some((segment) => segment.command === '^ZZ')).toBe(true);
  });

  it('replaces just the selected command span and preserves all unrelated source text', () => {
    const source = '^XA\n^FO10,20^A0N,20,20^FDhello^FS\n^ZZ  keep  \n^XZ';
    const document = parseZplSource(source);
    const field = document.segments.findIndex((segment) => segment.kind === 'field-data');
    const changed = replaceZplSegment(document, field, '^FDupdated^FS');

    expect(changed).toBe('^XA\n^FO10,20^A0N,20,20^FDupdated^FS\n^ZZ  keep  \n^XZ');
  });

  it('keeps an unclosed opaque block and reports it without discarding source', () => {
    const source = '^XA^FDpartial ^FO1,2';
    const document = parseZplSource(source);

    expect(serializeZplSource(document)).toBe(source);
    expect(document.diagnostics).toEqual([expect.objectContaining({ code: 'unclosed-block', offset: 3 })]);
  });

  it('reports malformed and custom-prefix controls while preserving them', () => {
    const customPrefixSource = '^XA^CC!^FDtext^FS';
    const customPrefixDocument = parseZplSource(customPrefixSource);
    const malformedSource = '^XA^';
    const malformedDocument = parseZplSource(malformedSource);

    expect(serializeZplSource(customPrefixDocument)).toBe(customPrefixSource);
    expect(customPrefixDocument.diagnostics.map(({ code }) => code)).toEqual(['custom-control-prefix']);
    expect(serializeZplSource(malformedDocument)).toBe(malformedSource);
    expect(malformedDocument.diagnostics.map(({ code }) => code)).toEqual(['malformed-control']);
  });

  it('rejects stale, overlapping, and out-of-range edits', () => {
    expect(() => applyZplSourceEdits('^XA^XZ', [
      { start: 0, end: 3, expected: '^XB', replacement: '^XC' },
    ])).toThrow(/changed since/);
    expect(() => applyZplSourceEdits('abcdef', [
      { start: 1, end: 4, expected: 'bcd', replacement: '' },
      { start: 3, end: 5, expected: 'de', replacement: '' },
    ])).toThrow(/overlap/);
    expect(() => applyZplSourceEdits('abc', [
      { start: -1, end: 1, expected: '', replacement: '' },
    ])).toThrow(/invalid source range/);
  });

  it('applies multiple non-overlapping edits from the end to preserve offsets', () => {
    expect(applyZplSourceEdits('^XA^PW400^LL300^XZ', [
      { start: 3, end: 9, expected: '^PW400', replacement: '^PW500' },
      { start: 9, end: 15, expected: '^LL300', replacement: '^LL600' },
    ])).toBe('^XA^PW500^LL600^XZ');
  });
});
