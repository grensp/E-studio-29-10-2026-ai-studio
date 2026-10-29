/**
 * Excel & CSV Smart Data Cleaning Utility for E-Studio
 * Automatically cleans ERP reports, strips title banners, subtotal lines, formats prices and barcodes.
 */

export interface CleaningDiagnosticReport {
  healthScore: number; // 0 to 100%
  totalRowsProcessed: number;
  validRowsCount: number;
  reportLinesRemovedCount: number;
  subtotalsRemovedCount: number;
  pricesFixedCount: number;
  barcodesFixedCount: number;
  duplicateBarcodesCount: number;
  missingPriceCount: number;
  missingEanCount: number;
  issues: Array<{ rowIdx: number; colName: string; type: 'warning' | 'error'; message: string }>;
}

export const COMMON_REPORT_BANNER_KEYWORDS = [
  'rapport',
  'societe',
  'entreprise',
  'page 1',
  'page 2',
  'edite le',
  'impression du',
  'bilan',
  'recapitulatif',
  'selection',
  'filtre',
  'periode du',
  'inventaire au',
  'extrait de compte',
];

export const COMMON_SUBTOTAL_KEYWORDS = [
  'total',
  'sous-total',
  'sous total',
  'grand total',
  'report',
  'cumul',
  'recapitulatif',
  'ensemble',
  'moyenne',
];

export const COMMON_HEADER_KEYWORDS = [
  'code',
  'ean',
  'gencod',
  'barcode',
  'article',
  'designation',
  'libelle',
  'nom',
  'product',
  'item',
  'prix',
  'tarif',
  'pu',
  'pv',
  'price',
  'selling_price',
  'promoprice',
  'famille',
  'rayon',
  'categorie',
  'dept',
];

function inferCsvDelimiter(text: string): string {
  let commaCount = 0;
  let semicolonCount = 0;
  let inQuotes = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        index++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && (char === '\r' || char === '\n')) {
      break;
    } else if (!inQuotes && char === ',') {
      commaCount++;
    } else if (!inQuotes && char === ';') {
      semicolonCount++;
    }
  }
  return semicolonCount > commaCount ? ';' : ',';
}

function parseCsvRecords(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let closedQuote = false;
  let atFieldStart = true;

  const pushField = () => {
    row.push(field.trim());
    field = '';
    atFieldStart = true;
    closedQuote = false;
  };
  const pushRow = () => {
    pushField();
    if (row.some((value) => value.length > 0)) rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        inQuotes = false;
        closedQuote = true;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && atFieldStart) {
      inQuotes = true;
      atFieldStart = false;
    } else if (char === delimiter) {
      pushField();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      pushRow();
      if (rows.length > 50000) {
        throw new Error('Classeur trop volumineux : la limite maximale est de 50 000 lignes.');
      }
    } else {
      if (closedQuote && char.trim() !== '') {
        throw new Error('Fichier CSV invalide : caractères inattendus après un champ entre guillemets.');
      }
      if (char === '"' && !atFieldStart) {
        throw new Error('Fichier CSV invalide : guillemet non échappé dans un champ.');
      }
      field += char;
      if (char.trim() !== '') atFieldStart = false;
    }
  }
  if (inQuotes) throw new Error('Fichier CSV invalide : champ entre guillemets non terminé.');
  if (field.length > 0 || row.length > 0 || closedQuote) pushRow();
  if (rows.length > 50000) {
    throw new Error('Classeur trop volumineux : la limite maximale est de 50 000 lignes.');
  }
  return rows;
}

import ExcelJS from 'exceljs';
import { PricingEngine } from './pricingEngine';

/**
 * Parses an Excel (.xlsx) or CSV binary buffer using ExcelJS in read-only mode.
 * Strictly enforces limits: maximum 20 MB file size and maximum 50 000 rows before processing.
 */
export async function parseWorkbookFile(
  data: Uint8Array | ArrayBuffer,
  fileName?: string,
  worksheetName?: string
): Promise<{ headers: string[]; rows: any[][]; worksheetNames: string[] }> {
  const byteLength = data.byteLength;
  if (byteLength > 20 * 1024 * 1024) {
    throw new Error('Classeur trop volumineux : la taille maximale autorisée est de 20 Mo.');
  }

  const isCsv = fileName ? fileName.toLowerCase().endsWith('.csv') : false;
  if (fileName && /\.xls$/i.test(fileName) && !/\.xlsx$/i.test(fileName)) {
    throw new Error('Le format Excel .xls ancien n’est pas pris en charge. Enregistrez le classeur au format .xlsx.');
  }
  let matrix: any[][] = [];
  let worksheetNames: string[] = [];

  if (isCsv) {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const text = decoder.decode(data);
    matrix = parseCsvRecords(text, inferCsvDelimiter(text));
  } else {
    const workbook = new ExcelJS.Workbook();
    const buffer =
      data instanceof ArrayBuffer
        ? data
        : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    await workbook.xlsx.load(buffer as any);
    worksheetNames = workbook.worksheets.map(({ name }) => name);
    const worksheet = worksheetName
      ? workbook.getWorksheet(worksheetName)
      : workbook.worksheets[0];
    if (!worksheet) {
      if (worksheetName) throw new Error(`La feuille Excel "${worksheetName}" est introuvable.`);
      return { headers: [], rows: [], worksheetNames };
    }

    if (worksheet.rowCount > 50000) {
      throw new Error('Classeur trop volumineux : la limite maximale est de 50 000 lignes.');
    }

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let val = cell.value;
        if (val && typeof val === 'object') {
          if ('result' in val) val = (val as any).result;
          else if ('text' in val) val = (val as any).text;
          else if ('richText' in val) val = (val as any).richText.map((rt: any) => rt.text).join('');
        }
        values[colNumber - 1] = val !== undefined && val !== null ? val : '';
      });
      matrix.push(values);
    });
  }

  if (matrix.length === 0) {
    return { headers: [], rows: [], worksheetNames };
  }

  if (matrix.length > 50000) {
    throw new Error('Classeur trop volumineux : la limite maximale est de 50 000 lignes.');
  }

  const { headers, dataRows } = detectHeaderAndDataFromMatrix(matrix);
  return { headers, rows: dataRows, worksheetNames };
}

/**
 * Sanitizes dirty numeric prices ("12,50 €", "12.50€", "12 500 FCFA", "12,50", "12.50 EUR")
 * uses unified PricingEngine.parsePriceNumber logic.
 */
export function sanitizePriceValue(val: any): number {
  return PricingEngine.parsePriceNumber(val);
}

/**
 * Sanitizes barcodes / EAN codes (scientific notation "3.25039E+12", quotes, spaces)
 */
export function sanitizeBarcodeValue(val: any): string {
  if (val === undefined || val === null) return '';

  let str = String(val).trim();
  if (!str) return '';

  // Handle Excel scientific notation (e.g. 3.25039E+12 -> 3250390000000)
  if (/^\d+(\.\d+)?e\+\d+$/i.test(str)) {
    try {
      const num = Number(str);
      if (!isNaN(num)) {
        str = BigInt(Math.round(num)).toString();
      }
    } catch {}
  }

  // Remove leading single quotes, spaces, hyphens
  str = str.replace(/^['"]+/, '').replace(/[\s-]+/g, '');

  return str;
}

/**
 * Auto-detects where actual headers start in a raw 2D array from XLSX
 */
export function detectHeaderAndDataFromMatrix(matrix: any[][]): {
  headers: string[];
  dataRows: any[][];
  skippedTopRowsCount: number;
} {
  if (!matrix || matrix.length === 0) {
    return { headers: [], dataRows: [], skippedTopRowsCount: 0 };
  }

  let bestHeaderRowIdx = 0;
  let maxMatchScore = -1;

  // Search first 12 rows for header density
  const maxSearchIdx = Math.min(12, matrix.length);
  for (let r = 0; r < maxSearchIdx; r++) {
    const row = matrix[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    let matchCount = 0;
    row.forEach((cell) => {
      if (cell !== undefined && cell !== null) {
        const strCell = String(cell).toLowerCase().trim();
        if (COMMON_HEADER_KEYWORDS.some((kw) => strCell.includes(kw))) {
          matchCount++;
        }
      }
    });

    if (matchCount > maxMatchScore) {
      maxMatchScore = matchCount;
      bestHeaderRowIdx = r;
    }
  }

  const rawHeaderRow = matrix[bestHeaderRowIdx] || [];
  const headers = rawHeaderRow.map((cell, cIdx) => {
    const cleanCell = cell !== undefined && cell !== null ? String(cell).trim() : '';
    return cleanCell || `Colonne_${cIdx + 1}`;
  });

  const rawData = matrix.slice(bestHeaderRowIdx + 1);

  return {
    headers,
    dataRows: rawData,
    skippedTopRowsCount: bestHeaderRowIdx,
  };
}

/**
 * Filters out ERP subtotal rows, empty lines, and report summary footers
 */
export function isSubtotalOrReportFooterRow(row: any[] | Record<string, any>): boolean {
  const values = Array.isArray(row) ? row : Object.values(row);
  const textContent = values
    .map((v) => (v !== undefined && v !== null ? String(v).toLowerCase().trim() : ''))
    .join(' ');

  if (!textContent.trim()) return true; // Empty row

  return COMMON_SUBTOTAL_KEYWORDS.some((kw) => textContent.includes(kw));
}

/**
 * Automatically cleans raw rows and returns a structured clean object
 */
export function smartAutoCleanRawRows(
  headers: string[],
  rows: any[]
): {
  cleanHeaders: string[];
  cleanRows: Record<string, any>[];
  report: CleaningDiagnosticReport;
} {
  let subtotalsRemovedCount = 0;
  let reportLinesRemovedCount = 0;
  let pricesFixedCount = 0;
  let barcodesFixedCount = 0;
  let duplicateBarcodesCount = 0;
  let missingPriceCount = 0;
  let missingEanCount = 0;

  const seenBarcodes = new Set<string>();
  const cleanRows: Record<string, any>[] = [];
  const issues: CleaningDiagnosticReport['issues'] = [];

  // Identify column roles
  const barcodeCol = headers.find((h) =>
    COMMON_HEADER_KEYWORDS.some((kw) => ['code', 'ean', 'gencod', 'barcode'].includes(kw) && h.toLowerCase().includes(kw))
  );
  const priceCol = headers.find((h) =>
    COMMON_HEADER_KEYWORDS.some((kw) => ['prix', 'tarif', 'pu', 'pv', 'price'].includes(kw) && h.toLowerCase().includes(kw))
  );

  rows.forEach((row, rIdx) => {
    // Check if row is subtotal or report text
    if (isSubtotalOrReportFooterRow(row)) {
      subtotalsRemovedCount++;
      return;
    }

    const cleanRowObj: Record<string, any> = {};
    let isRowEmpty = true;

    headers.forEach((h) => {
      let val = row[h];
      if (val !== undefined && val !== null) {
        if (typeof val === 'string') {
          val = val.trim();
        }
        if (val !== '') isRowEmpty = false;
      }

      // Auto-sanitize barcode if this column is barcode
      if (h === barcodeCol && val) {
        const sanitized = sanitizeBarcodeValue(val);
        if (sanitized !== String(val)) barcodesFixedCount++;
        val = sanitized;
      }

      // Auto-sanitize price if this column is price
      if (h === priceCol && val) {
        const origVal = val;
        const numPrice = sanitizePriceValue(val);
        if (numPrice !== origVal && typeof origVal === 'string') pricesFixedCount++;
        val = numPrice;
      }

      cleanRowObj[h] = val;
    });

    if (isRowEmpty) {
      reportLinesRemovedCount++;
      return;
    }

    // Diagnostics checks
    const barcodeVal = barcodeCol ? cleanRowObj[barcodeCol] : null;
    const priceVal = priceCol ? cleanRowObj[priceCol] : null;

    if (!barcodeVal) {
      missingEanCount++;
      issues.push({
        rowIdx: cleanRows.length,
        colName: barcodeCol || 'EAN',
        type: 'warning',
        message: 'Code-barres ou EAN absent',
      });
    } else if (seenBarcodes.has(String(barcodeVal))) {
      duplicateBarcodesCount++;
      issues.push({
        rowIdx: cleanRows.length,
        colName: barcodeCol || 'EAN',
        type: 'warning',
        message: `Code-barres en double (${barcodeVal})`,
      });
    } else {
      seenBarcodes.add(String(barcodeVal));
    }

    if (priceVal === undefined || priceVal === null || Number(priceVal) <= 0) {
      missingPriceCount++;
      issues.push({
        rowIdx: cleanRows.length,
        colName: priceCol || 'PRIX',
        type: 'warning',
        message: 'Prix de vente nul ou manquant',
      });
    }

    cleanRows.push(cleanRowObj);
  });

  const total = cleanRows.length;
  const validRowsCount = Math.max(0, total - (missingPriceCount + missingEanCount));
  const healthScore = total > 0 ? Math.round((validRowsCount / total) * 100) : 100;

  const report: CleaningDiagnosticReport = {
    healthScore,
    totalRowsProcessed: rows.length,
    validRowsCount,
    reportLinesRemovedCount,
    subtotalsRemovedCount,
    pricesFixedCount,
    barcodesFixedCount,
    duplicateBarcodesCount,
    missingPriceCount,
    missingEanCount,
    issues,
  };

  return {
    cleanHeaders: headers,
    cleanRows,
    report,
  };
}
