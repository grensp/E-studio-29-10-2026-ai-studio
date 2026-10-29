import { beforeEach, describe, expect, it, vi } from 'vitest';
import jsPDF from 'jspdf';

const { toCanvas } = vi.hoisted(() => ({
  toCanvas: vi.fn((canvas: { toDataURL: () => string }) => canvas),
}));

vi.mock('bwip-js/browser', () => ({
  toCanvas,
  toSVG: vi.fn(() => '<svg></svg>'),
}));

import { renderBarcodePng } from '../utils/barcodeGenerator';
import { drawPdfItem } from '../render/drawPdfItem';

describe('barcode export raster rendering', () => {
  const canvas = {
    width: 120,
    height: 80,
    toDataURL: vi.fn(() => 'data:image/png;base64,barcode'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('document', {
      createElement: vi.fn(() => canvas),
    });
  });

  it('renders a selected symbology to a PNG using the requested colors and text setting', () => {
    expect(renderBarcodePng('(01)09506000134352(17)250101', 'gs1_qrcode', {
      includeText: true,
      barColor: '#123456',
      backgroundColor: '#ABCDEF',
    })).toEqual({
      dataUrl: 'data:image/png;base64,barcode',
      widthPx: 120,
      heightPx: 80,
    });

    expect(toCanvas).toHaveBeenCalledWith(canvas, expect.objectContaining({
      bcid: 'gs1qrcode',
      text: '(01)09506000134352(17)250101',
      barcolor: '123456',
      backgroundcolor: 'ABCDEF',
      includetext: true,
      parse: true,
    }));
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png');
  });

  it('embeds SVG-only symbologies in PDF output instead of dropping them', () => {
    const doc = new jsPDF({ unit: 'mm', format: [100, 50] });
    const addImage = vi.spyOn(doc, 'addImage').mockImplementation(() => doc);
    const item = {
      id: 'qr-pdf',
      type: 'barcode' as const,
      x_mm: 2,
      y_mm: 3,
      w_mm: 25,
      h_mm: 25,
      rotation: 0,
      z_index: 1,
      locked: false,
      code: 'https://example.com',
      use_static_value: true,
      barcode_type: 'qrcode' as const,
      show_text: false,
      bar_color: '#000000',
    };

    drawPdfItem(doc, item, 2, 3, { id: 'test', ITEMNAME: 'Test' });

    expect(addImage).toHaveBeenCalledWith(
      'data:image/png;base64,barcode',
      'PNG',
      2,
      7.166666666666666,
      25,
      16.666666666666668
    );
  });

  it('reserves quiet zones in PDF geometry for an EAN-13 symbol', () => {
    const doc = new jsPDF({ unit: 'mm', format: [100, 50] });
    const rect = vi.spyOn(doc, 'rect').mockImplementation(() => doc);
    const item = {
      id: 'ean-pdf',
      type: 'barcode' as const,
      x_mm: 2,
      y_mm: 3,
      w_mm: 35,
      h_mm: 20,
      rotation: 0,
      z_index: 1,
      locked: false,
      code: '4006381333931',
      use_static_value: true,
      barcode_type: 'ean13' as const,
      show_text: false,
      bar_color: '#000000',
    };

    drawPdfItem(doc, item, 2, 3, { id: 'test', ITEMNAME: 'Test' });

    const firstBar = rect.mock.calls.find(([x, y, width, height, style]) =>
      x > item.x_mm && y === item.y_mm && width > 0 && height === item.h_mm && style === 'F'
    );
    expect(firstBar?.[0]).toBeCloseTo(item.x_mm + (11 * item.w_mm) / (95 + 11 + 7));
  });

  it('rejects barcode rendering when the browser canvas is unavailable', () => {
    vi.stubGlobal('document', undefined);
    expect(() => renderBarcodePng('ABC123', 'qrcode'))
      .toThrow('Barcode PNG rendering requires a browser canvas.');
  });
});
