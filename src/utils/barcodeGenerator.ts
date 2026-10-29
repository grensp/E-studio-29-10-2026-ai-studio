import * as bwipjs from 'bwip-js/browser';

// Vector barcode generation with strict retail GTIN validation and GS1 validation.

const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

// EAN-13 encodings
const EAN_L = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011"
];
const EAN_G = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111"
];
const EAN_R = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100"
];
const EAN_PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"
];

const CODE39_PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw',
  C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn',
  G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww',
  O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn',
  S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw',
  W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
};

// Runtime Memoization Caches
const code128Cache = new Map<string, boolean[]>();
const ean13Cache = new Map<string, { bars: boolean[]; formattedCode: string; error?: string }>();
const ean8Cache = new Map<string, { bars: boolean[]; formattedCode: string; error?: string }>();
const gtin14Cache = new Map<string, { bars: boolean[]; formattedCode: string; error?: string }>();
const svgPathCache = new Map<string, string>();

function calculateGtinCheckDigit(body: string): string {
  const sum = body.split('').reverse().reduce((total, digit, index) => {
    return total + Number(digit) * (index % 2 === 0 ? 3 : 1);
  }, 0);
  return String((10 - (sum % 10)) % 10);
}

function hasGs1Mod10CheckDigit(value: string): boolean {
  return /^\d+$/.test(value) &&
    value.length > 1 &&
    calculateGtinCheckDigit(value.slice(0, -1)) === value[value.length - 1];
}

function validateGtin(code: string, bodyLength: number): { normalizedCode?: string; reason?: string } {
  const digits = String(code || '').trim();
  if (!new RegExp(`^\\d{${bodyLength}}(?:\\d)?$`).test(digits)) {
    return { reason: `Longueur GTIN invalide : ${digits.length} chiffres.` };
  }
  if (digits.length === bodyLength) return { normalizedCode: digits + calculateGtinCheckDigit(digits) };
  if (calculateGtinCheckDigit(digits.slice(0, bodyLength)) !== digits[bodyLength]) {
    return { reason: 'Clé de contrôle GTIN invalide.' };
  }
  return { normalizedCode: digits };
}

const EAN8_L = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
];
const EAN8_R = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
];

function encodeEan8(code: string): { bars: boolean[]; formattedCode: string; error?: string } {
  const validation = validateGtin(code, 7);
  if (!validation.normalizedCode) return { bars: [], formattedCode: code, error: validation.reason };
  const digits = validation.normalizedCode;
  const bits = `101${digits.slice(0, 4).split('').map((d) => EAN8_L[Number(d)]).join('')}01010${digits.slice(4).split('').map((d) => EAN8_R[Number(d)]).join('')}101`;
  return { bars: [...bits].map((bit) => bit === '1'), formattedCode: digits };
}

const ITF_DIGITS = [
  '00110', '10001', '01001', '11000', '00101',
  '10100', '01100', '00011', '10010', '01010',
];

function encodeItf14(code: string): { bars: boolean[]; formattedCode: string; error?: string } {
  const validation = validateGtin(code, 13);
  if (!validation.normalizedCode) return { bars: [], formattedCode: code, error: validation.reason };
  const digits = validation.normalizedCode;
  const bits: boolean[] = [true, false, true, false];
  for (let i = 0; i < digits.length; i += 2) {
    const bars = ITF_DIGITS[Number(digits[i])];
    const spaces = ITF_DIGITS[Number(digits[i + 1])];
    for (let j = 0; j < 5; j++) {
      bits.push(bars[j] === '1', spaces[j] === '1');
    }
  }
  bits.push(true, true, false);
  return { bars: bits, formattedCode: digits };
}

function code128FromValues(values: number[]): boolean[] {
  const codes = [104, ...values];
  let checksum = codes[0];
  for (let i = 1; i < codes.length; i++) checksum += codes[i] * i;
  codes.push(checksum % 103, 106);
  const bars: boolean[] = [];
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code] || CODE128_PATTERNS[0];
    let isBar = true;
    for (const widthText of pattern) {
      for (let width = 0; width < Number(widthText); width++) bars.push(isBar);
      isBar = !isBar;
    }
  }
  bars.push(true, true);
  return bars;
}

interface Gs1AiSchema {
  fixedLength?: number;
  minLength?: number;
  maxLength?: number;
  numeric?: boolean;
  dateFormat?: 'date' | 'dateTime' | 'dateRange';
}

function getGs1AiSchema(ai: string): Gs1AiSchema | null {
  if (ai === '00') return { fixedLength: 18, numeric: true };
  if (ai === '01' || ai === '02') return { fixedLength: 14, numeric: true };
  if (['11', '12', '13', '15', '16', '17'].includes(ai)) return { fixedLength: 6, numeric: true, dateFormat: 'date' };
  if (ai === '20') return { fixedLength: 2, numeric: true };
  if (ai === '10' || ai === '21' || ai === '22') return { minLength: 1, maxLength: 20 };
  if (ai === '30' || ai === '37') return { minLength: 1, maxLength: 8, numeric: true };
  if (ai === '235') return { minLength: 1, maxLength: 28 };
  if (['240', '241', '250', '251'].includes(ai)) return { minLength: 1, maxLength: 30 };
  if (ai === '242') return { minLength: 1, maxLength: 6, numeric: true };
  if (ai === '243') return { minLength: 1, maxLength: 20 };
  if (ai === '253') return { minLength: 13, maxLength: 30 };
  if (ai === '254') return { minLength: 1, maxLength: 20 };
  if (ai === '255') return { minLength: 13, maxLength: 25, numeric: true };
  if (/^(31|32|33|34|35|36)\d{2}$/.test(ai)) return { fixedLength: 6, numeric: true };
  if (/^390\d$/.test(ai) || /^392\d$/.test(ai)) return { minLength: 1, maxLength: 15, numeric: true };
  if (/^391\d$/.test(ai) || /^393\d$/.test(ai)) return { minLength: 4, maxLength: 18, numeric: true };
  if (/^394\d$/.test(ai)) return { fixedLength: 4, numeric: true };
  if (/^395\d$/.test(ai)) return { fixedLength: 6, numeric: true };
  if (ai === '400' || ai === '401' || ai === '403') return { minLength: 1, maxLength: 30 };
  if (ai === '402') return { fixedLength: 17, numeric: true };
  if (/^41[0-7]$/.test(ai)) return { fixedLength: 13, numeric: true };
  if (ai === '420') return { minLength: 1, maxLength: 20 };
  if (ai === '421') return { minLength: 4, maxLength: 15 };
  if (ai === '422' || ai === '424' || ai === '425' || ai === '426') return { fixedLength: 3, numeric: true };
  if (ai === '423') return { minLength: 3, maxLength: 15, numeric: true };
  if (ai === '427') return { minLength: 1, maxLength: 3 };
  if (ai === '7001') return { fixedLength: 13, numeric: true };
  if (ai === '7003') return { fixedLength: 10, numeric: true, dateFormat: 'dateTime' };
  if (ai === '7006') return { fixedLength: 6, numeric: true, dateFormat: 'date' };
  if (ai === '7007') return { minLength: 6, maxLength: 12, numeric: true, dateFormat: 'dateRange' };
  if (ai === '7040') return { fixedLength: 4, numeric: true };
  if (ai === '8001') return { fixedLength: 14, numeric: true };
  if (ai === '8005') return { fixedLength: 6, numeric: true };
  if (ai === '8006' || ai === '8026') return { fixedLength: 18, numeric: true };
  if (ai === '8008') return { minLength: 8, maxLength: 12, numeric: true, dateFormat: 'dateTime' };
  if (ai === '8011') return { minLength: 1, maxLength: 12, numeric: true };
  if (/^70(02|04|05|08|09|10|20|21|22|23)$/.test(ai)) return { minLength: 1, maxLength: ai === '7002' || ai === '7023' ? 30 : 20 };
  if (/^70(03|06|07)$/.test(ai)) return { minLength: 6, maxLength: 12, numeric: true };
  if (/^703\d$/.test(ai)) return { minLength: 4, maxLength: 30 };
  if (/^80(02|04|07|12|20|30)$/.test(ai)) return { minLength: 1, maxLength: 34 };
  if (ai === '8003') return { minLength: 14, maxLength: 30 };
  if (ai === '8010') return { minLength: 1, maxLength: 30 };
  if (ai === '8012' || ai === '8013') return { minLength: 1, maxLength: ai === '8012' ? 20 : 25 };
  if (ai === '8017' || ai === '8018') return { fixedLength: 18, numeric: true };
  if (ai === '8019') return { minLength: 1, maxLength: 10, numeric: true };
  if (ai === '8020') return { minLength: 1, maxLength: 25 };
  if (/^91\d{2}$/.test(ai)) return { minLength: 1, maxLength: 90 };
  if (/^9[0-9]$/.test(ai)) return { minLength: 1, maxLength: 30 };
  return null;
}

function gs1Values(input: string): number[] | null {
  const text = input.trim().replace(/^\]C1/, '');
  const values: number[] = [102];
  if (!text.includes('(')) {
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 29) values.push(102);
      else {
        const value = text.charCodeAt(i) - 32;
        if (value < 0 || value > 95) return null;
        values.push(value);
      }
    }
    return values;
  }

  const fields = [...text.matchAll(/\((\d{2,4})\)([^()]*)/g)];
  if (!fields.length || fields.map((field) => field[0]).join('') !== text) return null;
  const isVariableLengthAi = (ai: string) => getGs1AiSchema(ai)?.fixedLength === undefined;
  const seenAis = new Set<string>();
  const parsedFields: Array<{ ai: string; data: string; fixedLength?: number }> = [];
  const isValidGs1Date = (value: string, allowDayZero: boolean): boolean => {
    if (!/^\d{6}$/.test(value)) return false;
    const month = Number(value.slice(2, 4));
    const day = Number(value.slice(4, 6));
    if (month < 1 || month > 12 || day > 31) return false;
    if (day === 0) return allowDayZero;
    const year = 2000 + Number(value.slice(0, 2));
    return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
  };

  for (const field of fields) {
    const ai = field[1];
    const data = field[2];
    if (seenAis.has(ai)) return null;
    seenAis.add(ai);

    const schema = getGs1AiSchema(ai);
    if (!schema) return null;
    const fixedLength = schema.fixedLength;

    if (!data || /[^\x20-\x7e]/.test(data)) return null;
    if (fixedLength !== undefined && data.length !== fixedLength) return null;
    if (schema.minLength !== undefined && data.length < schema.minLength) return null;
    if (schema.maxLength !== undefined && data.length > schema.maxLength) return null;
    if (schema.numeric && !/^\d+$/.test(data)) return null;
    if ((ai === '00' || ai === '01' || ai === '02') && !/^\d+$/.test(data)) return null;
    if ((ai === '00' || ai === '01' || ai === '02') &&
      calculateGtinCheckDigit(data.slice(0, -1)) !== data[data.length - 1]) return null;
    if (
      (ai === '402' || /^41[0-7]$/.test(ai) || ai === '8017' || ai === '8018') &&
      !hasGs1Mod10CheckDigit(data)
    ) return null;
    if (ai === '253' && !hasGs1Mod10CheckDigit(data.slice(0, 13))) return null;
    if (ai === '255' && !hasGs1Mod10CheckDigit(data.slice(0, 13))) return null;
    if (ai === '8003' && !hasGs1Mod10CheckDigit(data.slice(1, 14))) return null;
    if ((ai === '8006' || ai === '8026') && !hasGs1Mod10CheckDigit(data.slice(0, 14))) return null;
    if (schema.dateFormat === 'date' && !isValidGs1Date(data, ai === '15' || ai === '17')) return null;
    if (schema.dateFormat === 'dateTime') {
      const validLengths = ai === '7003' ? [10] : [8, 10, 12];
      if (!validLengths.includes(data.length) || !isValidGs1Date(data.slice(0, 6), false)) return null;
      if (Number(data.slice(6, 8)) > 23) return null;
      if (data.length >= 10 && Number(data.slice(8, 10)) > 59) return null;
      if (data.length >= 12 && Number(data.slice(10, 12)) > 59) return null;
    }
    if (schema.dateFormat === 'dateRange') {
      if (![6, 12].includes(data.length) || !isValidGs1Date(data.slice(0, 6), false)) return null;
      if (data.length === 12 && !isValidGs1Date(data.slice(6, 12), false)) return null;
    }
    if (ai === '20' && !/^\d{2}$/.test(data)) return null;
    if (ai === '421' && !/^\d{3}[A-Za-z0-9 -]{1,12}$/.test(data)) return null;
    if (ai === '3910' || ai === '3911' || ai === '3912' || ai === '3913' ||
        ai === '3930' || ai === '3931' || ai === '3932' || ai === '3933') {
      if (!/^\d{3}\d{1,15}$/.test(data)) return null;
    }
    parsedFields.push({ ai, data, fixedLength });
  }

  if (seenAis.has('02') !== seenAis.has('37') || (seenAis.has('01') && seenAis.has('02'))) return null;
  if (parsedFields.findIndex(({ ai }) => ai === '02') > parsedFields.findIndex(({ ai }) => ai === '37')) return null;
  for (const [index, { ai, data }] of parsedFields.entries()) {
    for (const char of `${ai}${data}`) values.push(char.charCodeAt(0) - 32);
    if (index < parsedFields.length - 1 && isVariableLengthAi(ai)) values.push(102);
  }
  return values.length ? values : null;
}

export function normalizeGs1Data(input: string): string | null {
  if (!gs1Values(input)) return null;
  const text = input.trim().replace(/^\]C1/, '');
  if (!text.includes('(')) return text;
  const fields = [...text.matchAll(/\((\d{2,4})\)([^()]*)/g)];
  return fields.map((field, index) => {
    const ai = field[1];
    const data = field[2];
    const separator = index < fields.length - 1 && getGs1AiSchema(ai)?.fixedLength === undefined ? '\x1d' : '';
    return `${ai}${data}${separator}`;
  }).join('');
}

export function generateGs1Code128Bars(input: string): { bars: boolean[]; formattedCode: string; error?: string } {
  if (!input?.trim()) return { bars: [], formattedCode: input || '', error: 'Code GS1-128 vide.' };
  const values = gs1Values(input);
  if (!values) return { bars: [], formattedCode: input, error: 'Données GS1-128 mal formées.' };
  return { bars: code128FromValues(values), formattedCode: input };
}

export function generateCode39Bars(input: string): { bars: boolean[]; formattedCode: string; error?: string } {
  const formattedCode = String(input || '').trim().toUpperCase();
  if (!formattedCode) return { bars: [], formattedCode, error: 'Code 39 vide.' };
  if ([...formattedCode].some((character) => !CODE39_PATTERNS[character] || character === '*')) {
    return { bars: [], formattedCode, error: 'Le Code 39 accepte uniquement A-Z, 0-9, espace et - . $ / + %.' };
  }

  const bars: boolean[] = [];
  for (const [index, character] of [...`*${formattedCode}*`].entries()) {
    const pattern = CODE39_PATTERNS[character];
    for (const [runIndex, width] of [...pattern].entries()) {
      bars.push(...Array(width === 'w' ? 3 : 1).fill(runIndex % 2 === 0));
    }
    if (index < formattedCode.length + 1) bars.push(false);
  }
  return { bars, formattedCode };
}

export function generateEan8Bars(code: string): { bars: boolean[]; formattedCode: string; error?: string } {
  const cached = ean8Cache.get(code);
  if (cached) return cached;
  const result = encodeEan8(code);
  if (ean8Cache.size > 2000) ean8Cache.clear();
  ean8Cache.set(code, result);
  return result;
}

export function generateGtin14Bars(code: string): { bars: boolean[]; formattedCode: string; error?: string } {
  const cached = gtin14Cache.get(code);
  if (cached) return cached;
  const result = encodeItf14(code);
  if (gtin14Cache.size > 2000) gtin14Cache.clear();
  gtin14Cache.set(code, result);
  return result;
}

export function generateUpcaBars(code: string): { bars: boolean[]; formattedCode: string; error?: string } {
  const digits = String(code || '').trim();
  if (!/^\d{11,12}$/.test(digits)) {
    return { bars: [], formattedCode: digits, error: `Longueur UPC-A invalide : ${digits.length} chiffres.` };
  }
  const result = generateEAN13Bars(`0${digits}`);
  return {
    ...result,
    formattedCode: result.error ? digits : result.formattedCode.replace(/\s/g, '').slice(1),
  };
}

export function inferBarcodeType(code: string): 'ean8' | 'ean13' | 'upca' | 'code128' {
  const digits = String(code || '').trim();
  if (/^\d{8}$/.test(digits)) return 'ean8';
  if (/^\d{11}$/.test(digits)) return 'upca';
  if (/^\d{12,13}$/.test(digits)) return 'ean13';
  return 'code128';
}

export const BARCODE_SYMBOLOGIES = [
  'auto',
  'code128', 'code39', 'code93', 'codabar', 'code11',
  'interleaved2of5', 'industrial2of5', 'iata2of5', 'itf14',
  'ean8', 'ean13', 'upca', 'upce',
  'gs1_128', 'databar', 'databarexpanded',
  'qrcode', 'gs1_qrcode', 'datamatrix', 'gs1_datamatrix', 'pdf417', 'micropdf417', 'azteccode', 'maxicode',
  'postnet', 'planet', 'royalmail', 'auspost',
] as const;

export type BarcodeSymbology = typeof BARCODE_SYMBOLOGIES[number] | 'gtin14';

export interface BarcodeQuietZone {
  leftModules: number;
  rightModules: number;
}

export function getBarcodeQuietZone(symbology: BarcodeSymbology): BarcodeQuietZone {
  switch (symbology) {
    case 'ean13':
      return { leftModules: 11, rightModules: 7 };
    case 'ean8':
      return { leftModules: 7, rightModules: 7 };
    case 'upca':
      return { leftModules: 9, rightModules: 9 };
    case 'upce':
      return { leftModules: 9, rightModules: 7 };
    case 'qrcode':
    case 'gs1_qrcode':
    case 'datamatrix':
    case 'gs1_datamatrix':
    case 'pdf417':
    case 'micropdf417':
    case 'azteccode':
    case 'maxicode':
      return { leftModules: 0, rightModules: 0 };
    default:
      return { leftModules: 10, rightModules: 10 };
  }
}

export const ZPL_SUPPORTED_BARCODE_SYMBOLOGIES: readonly Exclude<BarcodeSymbology, 'auto'>[] = [
  'code128', 'code39', 'code93', 'codabar', 'code11', 'interleaved2of5', 'itf14', 'gtin14',
  'ean8', 'ean13', 'upca', 'upce', 'gs1_128', 'databar', 'qrcode', 'datamatrix',
  'pdf417', 'micropdf417', 'azteccode', 'maxicode', 'postnet',
];

export function isZplBarcodeSupported(symbology: BarcodeSymbology): boolean {
  return symbology === 'auto' || ZPL_SUPPORTED_BARCODE_SYMBOLOGIES.includes(symbology);
}

export const BARCODE_SYMBOLOGY_LABELS: Record<BarcodeSymbology, string> = {
  auto: 'Automatique',
  code128: 'Code 128',
  code39: 'Code 39',
  code93: 'Code 93',
  codabar: 'Codabar',
  code11: 'Code 11',
  interleaved2of5: 'Interleaved 2 of 5',
  industrial2of5: 'Industrial 2 of 5',
  iata2of5: 'IATA 2 of 5',
  itf14: 'ITF-14',
  gtin14: 'GTIN-14 / ITF-14',
  ean8: 'EAN-8',
  ean13: 'EAN-13',
  upca: 'UPC-A',
  upce: 'UPC-E',
  gs1_128: 'GS1-128',
  databar: 'GS1 DataBar Omnidirectional',
  databarexpanded: 'GS1 DataBar Expanded',
  qrcode: 'QR Code',
  gs1_qrcode: 'GS1 QR Code',
  datamatrix: 'Data Matrix',
  gs1_datamatrix: 'GS1 Data Matrix',
  pdf417: 'PDF417',
  micropdf417: 'MicroPDF417',
  azteccode: 'Aztec',
  maxicode: 'MaxiCode',
  postnet: 'POSTNET',
  planet: 'PLANET',
  royalmail: 'Royal Mail (RM4SCC)',
  auspost: 'Australia Post',
};

const BWIP_BCID: Partial<Record<Exclude<BarcodeSymbology, 'auto'>, string>> = {
  code128: 'code128',
  code39: 'code39',
  code93: 'code93',
  codabar: 'rationalizedCodabar',
  code11: 'code11',
  interleaved2of5: 'interleaved2of5',
  industrial2of5: 'industrial2of5',
  iata2of5: 'iata2of5',
  itf14: 'itf14',
  gtin14: 'itf14',
  ean8: 'ean8',
  ean13: 'ean13',
  upca: 'upca',
  upce: 'upce',
  gs1_128: 'gs1_128',
  databar: 'databaromni',
  databarexpanded: 'databarexpanded',
  qrcode: 'qrcode',
  gs1_qrcode: 'gs1qrcode',
  datamatrix: 'datamatrix',
  gs1_datamatrix: 'gs1datamatrix',
  pdf417: 'pdf417',
  micropdf417: 'micropdf417',
  azteccode: 'azteccode',
  maxicode: 'maxicode',
  postnet: 'postnet',
  planet: 'planet',
  royalmail: 'royalmail',
  auspost: 'auspost',
};

export function resolveBarcodeSymbology(code: string, requested: BarcodeSymbology = 'auto'): Exclude<BarcodeSymbology, 'auto'> {
  if (requested !== 'auto') return requested;
  if (/^\(\d{2,4}\)/.test(code) || /^\]C1/.test(code)) return 'gs1_128';
  const inferred = inferBarcodeType(code);
  return inferred;
}

export function generateBarcodeSvg(
  code: string,
  requested: BarcodeSymbology = 'auto',
  options: { includeText?: boolean; scale?: number; barColor?: string; backgroundColor?: string } = {}
): string {
  const symbology = resolveBarcodeSymbology(code, requested);
  const bcid = BWIP_BCID[symbology];
  if (!bcid) throw new Error(`Unsupported barcode symbology: ${symbology}`);
  if (!String(code || '').trim()) throw new Error('Barcode data is empty.');
  const isGs1 = symbology === 'gs1_128' || symbology === 'gs1_qrcode' || symbology === 'gs1_datamatrix';
  if (isGs1 && !normalizeGs1Data(code)) throw new Error('Malformed GS1 application identifier data.');
  const text = symbology === 'databar' && /^\d{14}$/.test(String(code).trim())
    ? `(01)${String(code).trim()}`
    : isGs1 || symbology === 'databarexpanded'
    ? String(code).trim().replace(/^\]C1/, '')
    : String(code);
  return bwipjs.toSVG({
    bcid,
    text,
    scale: options.scale || 2,
    height: 12,
    includetext: options.includeText ?? false,
    ...(options.barColor ? { barcolor: options.barColor.replace(/^#/, '') } : {}),
    ...(options.backgroundColor ? { backgroundcolor: options.backgroundColor.replace(/^#/, '') } : {}),
    parse: isGs1 || symbology === 'databarexpanded' || symbology === 'databar',
  });
}

export function renderBarcodePng(
  code: string,
  requested: BarcodeSymbology = 'auto',
  options: { includeText?: boolean; scale?: number; barColor?: string; backgroundColor?: string } = {}
): { dataUrl: string; widthPx: number; heightPx: number } {
  if (typeof document === 'undefined') {
    throw new Error('Barcode PNG rendering requires a browser canvas.');
  }
  const symbology = resolveBarcodeSymbology(code, requested);
  const bcid = BWIP_BCID[symbology];
  if (!bcid) throw new Error(`Unsupported barcode symbology: ${symbology}`);
  if (!String(code || '').trim()) throw new Error('Barcode data is empty.');
  const isGs1 = symbology === 'gs1_128' || symbology === 'gs1_qrcode' || symbology === 'gs1_datamatrix';
  if (isGs1 && !normalizeGs1Data(code)) throw new Error('Malformed GS1 application identifier data.');
  const text = symbology === 'databar' && /^\d{14}$/.test(String(code).trim())
    ? `(01)${String(code).trim()}`
    : isGs1 || symbology === 'databarexpanded'
      ? String(code).trim().replace(/^\]C1/, '')
      : String(code);
  const canvas = document.createElement('canvas');
  bwipjs.toCanvas(canvas, {
    bcid,
    text,
    scale: options.scale || 3,
    height: 12,
    includetext: options.includeText ?? false,
    barcolor: (options.barColor || '#000000').replace(/^#/, ''),
    backgroundcolor: (options.backgroundColor || '#FFFFFF').replace(/^#/, ''),
    parse: isGs1 || symbology === 'databarexpanded' || symbology === 'databar',
  });
  return {
    dataUrl: canvas.toDataURL('image/png'),
    widthPx: canvas.width,
    heightPx: canvas.height,
  };
}

export function generateBarcodeBars(
  code: string,
  requested: BarcodeSymbology = 'auto'
): { bars: boolean[]; formattedCode: string; error?: string } {
  const symbology = resolveBarcodeSymbology(code, requested);
  if (symbology === 'itf14' || symbology === 'gtin14') return generateGtin14Bars(code);
  if (symbology === 'code39') return generateCode39Bars(code);
  if (symbology === 'gs1_128') return generateGs1Code128Bars(code);
  switch (symbology) {
    case 'ean8':
      return generateEan8Bars(code);
    case 'ean13':
      return generateEAN13Bars(code);
    case 'upca':
      return generateUpcaBars(code);
    case 'code128':
      if (!code?.trim()) return { bars: [], formattedCode: code || '', error: 'Code-barres vide.' };
      return { bars: generateCode128Bars(code), formattedCode: code };
    default:
      try {
        generateBarcodeSvg(code, symbology);
        return { bars: [], formattedCode: code };
      } catch (error) {
        return {
          bars: [],
          formattedCode: code,
          error: error instanceof Error ? error.message : String(error),
        };
      }
  }
}

/**
 * Validates whether a given string is a strictly compliant EAN-13 or 12-digit UPC code.
 */
export function validateEAN13(code: string): { valid: boolean; reason?: string; normalizedCode?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, reason: 'Code-barre manquant ou vide' };
  }
  const trimmed = code.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, reason: 'Un code EAN-13 ne doit contenir que des chiffres décimaux (0-9)' };
  }

  if (trimmed.length === 12) {
    // 12 digits: calculate and append check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(trimmed[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return { valid: true, normalizedCode: trimmed + checkDigit };
  }

  if (trimmed.length === 13) {
    // 13 digits: strictly verify checksum
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(trimmed[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    const expectedCheck = (10 - (sum % 10)) % 10;
    const actualCheck = parseInt(trimmed[12], 10);
    if (actualCheck !== expectedCheck) {
      return {
        valid: false,
        reason: `Clé de contrôle EAN-13 invalide (attendu: ${expectedCheck}, trouvé: ${actualCheck})`,
      };
    }
    return { valid: true, normalizedCode: trimmed };
  }

  return {
    valid: false,
    reason: `Longueur EAN-13 invalide : ${trimmed.length} chiffres (13 chiffres requis, ou 12 sans clé)`,
  };
}

export function generateCode128Bars(text: string): boolean[] {
  const clean = text ? text.trim() : "";
  if (!clean) return [];

  const cached = code128Cache.get(clean);
  if (cached) return cached;

  const startCodeB = 104; // Start B
  const codes: number[] = [startCodeB];

  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const codeVal = charCode - 32;
    if (codeVal >= 0 && codeVal <= 95) {
      codes.push(codeVal);
    } else {
      codes.push(0);
    }
  }

  // Calculate checksum
  let sum = codes[0];
  for (let i = 1; i < codes.length; i++) {
    sum += codes[i] * i;
  }
  const checksum = sum % 103;
  codes.push(checksum);
  codes.push(106); // Stop code

  // Convert to bar pattern
  const bars: boolean[] = [];
  for (const c of codes) {
    const pattern = CODE128_PATTERNS[c] || CODE128_PATTERNS[0];
    let isBar = true;
    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j], 10);
      for (let w = 0; w < width; w++) {
        bars.push(isBar);
      }
      isBar = !isBar;
    }
  }
  // Terminal bar
  bars.push(true, true);

  if (code128Cache.size > 2000) code128Cache.clear();
  code128Cache.set(clean, bars);
  return bars;
}

export function generateEAN13Bars(code: string): { bars: boolean[]; formattedCode: string; error?: string } {
  if (!code) {
    return { bars: [], formattedCode: '', error: 'Code vide' };
  }

  const cached = ean13Cache.get(code);
  if (cached) return cached;

  const validation = validateEAN13(code);
  if (!validation.valid || !validation.normalizedCode) {
    const result = {
      bars: [],
      formattedCode: code,
      error: validation.reason || 'Code EAN-13 non conforme',
    };
    ean13Cache.set(code, result);
    return result;
  }

  const full13 = validation.normalizedCode;
  const firstDigit = parseInt(full13[0], 10);
  const parityPattern = EAN_PARITY[firstDigit];

  const bars: boolean[] = [];

  // Start guard (101)
  bars.push(true, false, true);

  // Left 6 digits
  for (let i = 1; i <= 6; i++) {
    const digit = parseInt(full13[i], 10);
    const useG = parityPattern[i - 1] === 'G';
    const pattern = useG ? EAN_G[digit] : EAN_L[digit];
    for (let j = 0; j < pattern.length; j++) {
      bars.push(pattern[j] === '1');
    }
  }

  // Center guard (01010)
  bars.push(false, true, false, true, false);

  // Right 6 digits (always R encoding)
  for (let i = 7; i <= 12; i++) {
    const digit = parseInt(full13[i], 10);
    const pattern = EAN_R[digit];
    for (let j = 0; j < pattern.length; j++) {
      bars.push(pattern[j] === '1');
    }
  }

  // Stop guard (101)
  bars.push(true, false, true);

  const formattedCode = `${full13[0]} ${full13.slice(1, 7)} ${full13.slice(7)}`;
  const result = { bars, formattedCode };

  if (ean13Cache.size > 2000) ean13Cache.clear();
  ean13Cache.set(code, result);
  return result;
}

/**
 * Builds a single SVG path definition string for a barcode bar array.
 */
export function getBarcodeSvgPath(bars: boolean[], height: number = 100): string {
  if (!bars || bars.length === 0) return '';
  const key = `${bars.length}_${height}_${bars.slice(0, 15).join('')}_${bars.slice(-15).join('')}`;
  const cached = svgPathCache.get(key);
  if (cached) return cached;

  let d = '';
  const total = bars.length;
  const barWidth = 100 / total;

  let i = 0;
  while (i < total) {
    if (bars[i]) {
      let span = 1;
      while (i + span < total && bars[i + span]) {
        span++;
      }
      const x = (i * barWidth).toFixed(3);
      const w = (span * barWidth + 0.05).toFixed(3);
      d += `M${x} 0h${w}v${height}h-${w}Z `;
      i += span;
    } else {
      i++;
    }
  }

  if (svgPathCache.size > 1000) svgPathCache.clear();
  svgPathCache.set(key, d);
  return d;
}

/**
 * Renders a crisp rasterized barcode dataURL (PNG) with proper quiet zones.
 */
export function renderBarcodeToDataUrl(
  barsOrCode: boolean[] | string,
  barColorOrType: string = '#000000',
  backgroundColorOrShowText: string | boolean = '#FFFFFF',
  widthPxOrColor: number | string = 300,
  heightPx: number = 100
): string {
  if (typeof document === 'undefined') return '';
  let bars: boolean[] = [];
  let barColor = '#000000';
  let backgroundColor = '#FFFFFF';
  let widthPx = 300;

  if (typeof barsOrCode === 'string') {
    const code = barsOrCode;
    const type =
      typeof barColorOrType === 'string' && (barColorOrType === 'code128' || barColorOrType === 'ean13')
        ? barColorOrType
        : 'ean13';
    try {
      if (type === 'ean13') {
        const eanRes = generateEAN13Bars(code);
        bars = eanRes.bars;
      } else {
        bars = generateCode128Bars(code);
      }
    } catch {
      bars = generateCode128Bars(code);
    }
    if (typeof widthPxOrColor === 'string') {
      barColor = widthPxOrColor;
    }
  } else {
    bars = barsOrCode || [];
    barColor = typeof barColorOrType === 'string' ? barColorOrType : '#000000';
    backgroundColor = typeof backgroundColorOrShowText === 'string' ? backgroundColorOrShowText : '#FFFFFF';
    widthPx = typeof widthPxOrColor === 'number' ? widthPxOrColor : 300;
  }

  if (!bars || bars.length === 0) return '';

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = backgroundColor || '#FFFFFF';
  ctx.fillRect(0, 0, widthPx, heightPx);

  const quietMargin = Math.round(widthPx * 0.05);
  const drawableWidth = widthPx - quietMargin * 2;
  const barWidth = drawableWidth / bars.length;

  ctx.fillStyle = barColor || '#000000';
  let i = 0;
  while (i < bars.length) {
    if (bars[i]) {
      let span = 1;
      while (i + span < bars.length && bars[i + span]) {
        span++;
      }
      const x = quietMargin + i * barWidth;
      const w = span * barWidth;
      ctx.fillRect(x, 0, Math.max(1, Math.round(w)), heightPx);
      i += span;
    } else {
      i++;
    }
  }

  return canvas.toDataURL('image/png');
}
