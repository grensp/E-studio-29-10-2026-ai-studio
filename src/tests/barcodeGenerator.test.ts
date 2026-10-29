import { describe, expect, it } from 'vitest';
import {
  generateBarcodeBars,
  generateCode39Bars,
  generateEan8Bars,
  generateGtin14Bars,
  generateGs1Code128Bars,
  generateUpcaBars,
  generateBarcodeSvg,
  getBarcodeQuietZone,
  BARCODE_SYMBOLOGIES,
  normalizeGs1Data,
} from '../utils/barcodeGenerator';

describe('barcodeGenerator retail and logistics symbologies', () => {
  it('provides symbology-specific module quiet zones for linear barcodes', () => {
    expect(getBarcodeQuietZone('ean13')).toEqual({ leftModules: 11, rightModules: 7 });
    expect(getBarcodeQuietZone('ean8')).toEqual({ leftModules: 7, rightModules: 7 });
    expect(getBarcodeQuietZone('upca')).toEqual({ leftModules: 9, rightModules: 9 });
    expect(getBarcodeQuietZone('upce')).toEqual({ leftModules: 9, rightModules: 7 });
    expect(getBarcodeQuietZone('code128')).toEqual({ leftModules: 10, rightModules: 10 });
    expect(getBarcodeQuietZone('gs1_128')).toEqual({ leftModules: 10, rightModules: 10 });
    expect(getBarcodeQuietZone('qrcode')).toEqual({ leftModules: 0, rightModules: 0 });
    expect(getBarcodeQuietZone('datamatrix')).toEqual({ leftModules: 0, rightModules: 0 });
  });

  it('encodes Code 39 characters with start/stop framing and rejects unsupported input', () => {
    const generated = generateCode39Bars('abc-123');
    expect(generated.error).toBeUndefined();
    expect(generated.formattedCode).toBe('ABC-123');
    expect(generated.bars.length).toBeGreaterThan(100);
    expect(generateCode39Bars('lowercase ok').error).toBeUndefined();
    expect(generateCode39Bars('unsupported *').error).toBeDefined();
    expect(generateCode39Bars('').error).toBeDefined();
  });

  it('automatically selects EAN-8 for an 8-digit code and calculates a 7-digit check digit', () => {
    const generated = generateBarcodeBars('96385074', 'auto');
    expect(generated.error).toBeUndefined();
    expect(generated.formattedCode).toBe('96385074');
    expect(generated.bars).toHaveLength(67);
    expect(generateEan8Bars('9638507').formattedCode).toBe('96385074');
  });

  it('accepts a leading-zero UPC/EAN payload and calculates its EAN-13 check digit', () => {
    const generated = generateBarcodeBars('000123456789', 'auto');
    expect(generated.error).toBeUndefined();
    expect(generated.formattedCode.replace(/\s/g, '')).toHaveLength(13);
    expect(generated.formattedCode.replace(/\s/g, '').startsWith('0')).toBe(true);
  });

  it('encodes UPC-A as its equivalent leading-zero EAN-13 and validates the UPC check digit', () => {
    expect(generateBarcodeBars('03600029145', 'upca')).toMatchObject({
      formattedCode: '036000291452',
    });
    expect(generateUpcaBars('036000291452').formattedCode).toBe('036000291452');
    expect(generateUpcaBars('036000291453').error).toMatch(/contrôle/i);
    expect(generateUpcaBars('123').error).toBeDefined();
  });

  it('encodes GTIN-14 as ITF-14 and rejects an invalid check digit', () => {
    const calculated = generateGtin14Bars('1001234500001');
    expect(calculated.error).toBeUndefined();
    expect(calculated.formattedCode).toHaveLength(14);
    expect(calculated.bars.length).toBeGreaterThan(70);
    expect(generateGtin14Bars('10012345000010').error).toBeDefined();
  });

  it('encodes parenthesized GS1 application identifiers and inserts a separator after variable-length data', () => {
    const input = '(01)09506000134352(17)250101(10)LOT-7';
    const generated = generateGs1Code128Bars(input);
    expect(generated.error).toBeUndefined();
    expect(generated.bars.length).toBeGreaterThan(0);
    expect(normalizeGs1Data(input)).toBe('01095060001343521725010110LOT-7');
    expect(generateGs1Code128Bars('(01)123(17)250101').error).toBeDefined();
  });

  it('rejects GS1 GTINs with an invalid check digit, invalid dates, and inconsistent contained-item AIs', () => {
    expect(generateGs1Code128Bars('(01)09506000134353').error).toBeDefined();
    expect(generateGs1Code128Bars('(17)251332').error).toBeDefined();
    expect(generateGs1Code128Bars('(02)09506000134352').error).toBeDefined();
    expect(generateGs1Code128Bars('(02)09506000134352(37)12').error).toBeUndefined();
    expect(generateGs1Code128Bars('(37)12(02)09506000134352').error).toBeDefined();
    expect(generateGs1Code128Bars('(01)09506000134352(02)09506000134352(37)12').error).toBeDefined();
  });

  it('rejects unsupported or duplicate AIs instead of silently treating them as valid variable data', () => {
    expect(generateGs1Code128Bars('(88)123').error).toBeDefined();
    expect(generateGs1Code128Bars('(99)123').error).toBeUndefined();
    expect(generateGs1Code128Bars('(10)LOT-A(10)LOT-B').error).toBeDefined();
  });

  it('validates supported GS1 monetary AIs with and without currency indicators', () => {
    expect(generateGs1Code128Bars('(3922)12345').error).toBeUndefined();
    expect(generateGs1Code128Bars('(3912)97812345').error).toBeUndefined();
    expect(generateGs1Code128Bars('(3932)97812345').error).toBeUndefined();
    expect(generateGs1Code128Bars('(3912)978ABC').error).toBeDefined();
    expect(generateGs1Code128Bars('(3932)978').error).toBeDefined();
    expect(normalizeGs1Data('(3922)12345(10)LOT-A')).toBe('392212345\x1d10LOT-A');
  });

  it('offers 28 standards-based symbologies with generated SVG previews', () => {
    const cases: Record<string, string> = {
      code128: 'HELLO',
      code39: 'ABC',
      code93: 'ABC',
      codabar: 'A1234B',
      code11: '123456',
      interleaved2of5: '123456',
      industrial2of5: '1234',
      iata2of5: '1234',
      itf14: '1001234500001',
      ean8: '96385074',
      ean13: '4006381333931',
      upca: '036000291452',
      upce: '04252614',
      gs1_128: '(01)09506000134352(17)250101',
      databar: '(01)09506000134352',
      databarexpanded: '(01)09506000134352(3103)000123',
      qrcode: 'https://example.com',
      gs1_qrcode: '(01)09506000134352(17)250101',
      datamatrix: 'ABC123',
      gs1_datamatrix: '(01)09506000134352(17)250101',
      pdf417: 'ABC123',
      micropdf417: 'ABC123',
      azteccode: 'ABC123',
      maxicode: 'ABC123',
      postnet: '12345',
      planet: '12345678901',
      royalmail: 'ABC123',
      auspost: '5956439111',
    };
    expect(BARCODE_SYMBOLOGIES.filter((value) => value !== 'auto')).toHaveLength(28);
    for (const [symbology, data] of Object.entries(cases)) {
      expect(generateBarcodeSvg(data, symbology as any)).toContain('<svg');
    }
  });

  it('validates additional fixed-length, date, numeric, and variable GS1 application identifiers', () => {
    expect(normalizeGs1Data('(422)840(7001)1234567890123')).toBe('42284070011234567890123');
    expect(generateGs1Code128Bars('(8005)123456(10)LOT-3').error).toBeUndefined();
    expect(generateGs1Code128Bars('(3942)1234').error).toBeUndefined();
    expect(generateGs1Code128Bars('(422)84').error).toBeDefined();
    expect(generateGs1Code128Bars('(7001)123').error).toBeDefined();
    expect(generateGs1Code128Bars('(8005)12AB56').error).toBeDefined();
  });

  it('validates dates and times in extended GS1 date application identifiers', () => {
    expect(generateGs1Code128Bars('(7006)240229').error).toBeUndefined();
    expect(generateGs1Code128Bars('(7006)240230').error).toBeDefined();
    expect(generateGs1Code128Bars('(7003)2402292359').error).toBeUndefined();
    expect(generateGs1Code128Bars('(7003)2402292360').error).toBeDefined();
    expect(generateGs1Code128Bars('(7007)240229').error).toBeUndefined();
    expect(generateGs1Code128Bars('(7007)240229240301').error).toBeUndefined();
    expect(generateGs1Code128Bars('(7007)240229240230').error).toBeDefined();
    expect(generateGs1Code128Bars('(7007)240229235959').error).toBeDefined();
    expect(generateGs1Code128Bars('(8008)24022923').error).toBeUndefined();
    expect(generateGs1Code128Bars('(8008)2402292400').error).toBeDefined();
    expect(generateGs1Code128Bars('(8008)24023023').error).toBeDefined();
  });

  it('validates GS1 Mod-10 key check digits in logistic and party-identification fields', () => {
    expect(generateGs1Code128Bars('(414)0614141123452').error).toBeUndefined();
    expect(generateGs1Code128Bars('(414)0614141123453').error).toBeDefined();
    expect(generateGs1Code128Bars('(402)12345678901234560').error).toBeUndefined();
    expect(generateGs1Code128Bars('(402)12345678901234561').error).toBeDefined();
    expect(generateGs1Code128Bars('(8017)000000000000000000').error).toBeUndefined();
    expect(generateGs1Code128Bars('(8018)000000000000000001').error).toBeDefined();
    expect(generateGs1Code128Bars('(253)0614141123452SERIAL').error).toBeUndefined();
    expect(generateGs1Code128Bars('(255)0614141123452').error).toBeUndefined();
    expect(generateGs1Code128Bars('(8003)00614141123452SERIAL').error).toBeUndefined();
    expect(generateGs1Code128Bars('(8006)095060001343520000').error).toBeUndefined();
  });
});
