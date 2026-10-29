export type PriceParseStatus = 'valid' | 'missing' | 'invalid';

export interface PriceParseResult {
  status: PriceParseStatus;
  amount?: number;
  raw?: unknown;
  reason?: string;
}

export function parsePriceValue(value: unknown): PriceParseResult {
  if (value === undefined || value === null) return { status: 'missing', raw: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { status: 'invalid', raw: value, reason: 'Valeur numérique invalide' };
    return { status: 'valid', amount: value, raw: value };
  }

  const text = String(value).trim();
  if (!text) return { status: 'missing', raw: value };

  const cleaned = text.replace(/[€$£¥\p{L}]/gu, '').replace(/\s+/g, '');
  if (!cleaned) return { status: 'invalid', raw: value, reason: `Contenu non numérique ("${text}")` };

  let normalized = cleaned;
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');
  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(',') < normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/,/g, '');
    } else {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    return { status: 'invalid', raw: value, reason: `Impossible de convertir "${text}" en nombre` };
  }
  return { status: 'valid', amount, raw: value };
}