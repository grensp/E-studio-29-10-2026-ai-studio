import { describe, expect, it } from 'vitest';
import { buildGs1ElementString, COMMON_GS1_AI_VALUES, parseGs1ElementString } from '../utils/gs1Payload';

describe('guided GS1 payload construction', () => {
  it('builds and parses a validated multi-AI element string', () => {
    const payload = buildGs1ElementString(COMMON_GS1_AI_VALUES);

    expect(payload).toBe('(01)09506000134352(17)250101(10)LOT-7');
    expect(parseGs1ElementString(payload)).toEqual(COMMON_GS1_AI_VALUES);
  });

  it('rejects empty values, duplicate or unsupported AIs, and invalid check digits', () => {
    expect(() => buildGs1ElementString([])).toThrow(/at least one/i);
    expect(() => buildGs1ElementString([{ ai: '10', value: '' }])).toThrow(/Enter a value/);
    expect(() => buildGs1ElementString([{ ai: '10', value: 'A' }, { ai: '10', value: 'B' }]))
      .toThrow(/mal formées/i);
    expect(() => buildGs1ElementString([{ ai: '88', value: '123' }])).toThrow(/mal formées/i);
    expect(() => buildGs1ElementString([{ ai: '01', value: '09506000134353' }])).toThrow(/mal formées/i);
  });

  it('does not interpret raw or malformed content as editable GS1 segments', () => {
    expect(parseGs1ElementString('0109506000134352')).toBeNull();
    expect(parseGs1ElementString('(01)09506000134352 trailing')).toBeNull();
  });
});
