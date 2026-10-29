import { generateGs1Code128Bars } from './barcodeGenerator';

export interface Gs1AiValue {
  ai: string;
  value: string;
}

export const COMMON_GS1_AI_VALUES: readonly Gs1AiValue[] = [
  { ai: '01', value: '09506000134352' },
  { ai: '17', value: '250101' },
  { ai: '10', value: 'LOT-7' },
];

export function parseGs1ElementString(payload: string): Gs1AiValue[] | null {
  const segments = [...payload.matchAll(/\((\d{2,4})\)([^()]*)/g)];
  if (!segments.length || segments.map((segment) => segment[0]).join('') !== payload) return null;
  if (generateGs1Code128Bars(payload).error) return null;
  return segments.map((segment) => ({ ai: segment[1]!, value: segment[2]! }));
}

export function buildGs1ElementString(segments: readonly Gs1AiValue[]): string {
  if (segments.length === 0) throw new Error('Add at least one GS1 application identifier.');
  const payload = segments.map(({ ai, value }) => {
    const normalizedAi = ai.trim();
    if (!/^\d{2,4}$/.test(normalizedAi)) throw new Error(`Invalid application identifier: ${ai || '(empty)'}.`);
    if (!value) throw new Error(`Enter a value for application identifier ${normalizedAi}.`);
    if (/[()]/.test(value)) throw new Error(`The value for application identifier ${normalizedAi} cannot contain parentheses.`);
    return `(${normalizedAi})${value}`;
  }).join('');
  const validation = generateGs1Code128Bars(payload);
  if (validation.error) throw new Error(validation.error);
  return payload;
}
