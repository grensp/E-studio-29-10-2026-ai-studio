import { describe, expect, it } from 'vitest';
import { drawZplItem } from '../render/drawZplItem';
import { EllipseItemProperties, PriceBlockItemProperties, ProductRecord, ShapeItemProperties } from '../types';

describe('drawZplItem price blocks', () => {
  const item: PriceBlockItemProperties = {
    id: 'price',
    type: 'price_block',
    x_mm: 5,
    y_mm: 5,
    w_mm: 30,
    h_mm: 12,
    rotation: 0,
    z_index: 1,
    locked: false,
    binding_key: 'SELLING_PRICE',
    currency_symbol: '€',
    integer_style: { font_size_pt: 24 },
    decimal_style: { font_size_pt: 12 },
    promo_takes_hero_style: true,
    extensions: [{
      id: 'compare',
      role: 'compare_at',
      anchor: 'above',
      binding_key: 'SELLING_PRICE',
    }],
  };

  const product: ProductRecord = {
    id: 'product',
    ITEMNAME: 'Promo product',
    SELLING_PRICE: 10,
    PROMOPRICE: 8,
  };

  it('uses the shared resolver for active promo hero and compare-at values', () => {
    const output = drawZplItem(item, 203, product).join('\n');

    expect(output).toContain('^FD8 €^FS');
    expect(output).toContain('^FD10,00 €^FS');
  });

  it('hides promo extensions when the promotion is inactive', () => {
    const output = drawZplItem(item, 203, {
      ...product,
      PROMO_END_DATE: '2000-01-01',
    }).join('\n');

    expect(output).toContain('^FD10 €^FS');
    expect(output).not.toContain('8,00 €');
  });

  it('applies independent segment offsets in millimeters', () => {
    const output = drawZplItem({
      ...item,
      extensions: [{
        id: 'child',
        role: 'custom',
        anchor: 'below',
        text: 'Child segment',
        offset_x_mm: 1,
        offset_y_mm: 2,
      }],
    }, 203, product).join('\n');

    expect(output).toContain('^FO48,133');
    expect(output).toContain('Child segment');
  });
});

describe('drawZplItem ellipses', () => {
  const ellipse: EllipseItemProperties = {
    id: 'ellipse',
    type: 'ellipse' as const,
    x_mm: 5,
    y_mm: 8,
    w_mm: 12,
    h_mm: 6,
    rotation: 0,
    z_index: 1,
    locked: false,
    fill_color: '#ffffff',
    border_color: '#000000',
    border_width: 0.5,
  };

  it('emits a native ZPL outline ellipse at the configured position and size', () => {
    expect(drawZplItem(ellipse, 203)).toEqual(['^FO40,64^GE96,48,4,B^FS']);
  });

  it('emits a filled ellipse when the fill color is non-white', () => {
    expect(drawZplItem({ ...ellipse, fill_color: '#2563eb' }, 203)).toEqual([
      '^FO40,64^GE96,48,48,B^FS',
    ]);
  });

  it('treats white and transparent fills as outlines', () => {
    for (const fill_color of ['#FFFFFF', '#fff', 'white', 'transparent', 'rgba(0,0,0,0)']) {
      expect(drawZplItem({ ...ellipse, fill_color }, 203)).toEqual(['^FO40,64^GE96,48,4,B^FS']);
    }
  });
});

describe('drawZplItem shapes', () => {
  const shape: ShapeItemProperties = {
    id: 'shape',
    type: 'shape',
    x_mm: 5,
    y_mm: 8,
    w_mm: 12,
    h_mm: 6,
    rotation: 0,
    z_index: 1,
    locked: false,
    fill_color: '#ffffff',
    border_color: '#000000',
    border_width: 0.5,
    corner_radius: 0,
  };

  it('renders common white and transparent fill values as outlines', () => {
    for (const fill_color of ['#ffffff', '#FFFFFF', '#fff', 'white', 'transparent', 'rgba(0,0,0,0)']) {
      expect(drawZplItem({ ...shape, fill_color }, 203)).toEqual(['^FO40,64^GB96,48,4,B,0^FS']);
    }
  });

  it('renders a non-white shape fill as a solid monochrome block', () => {
    expect(drawZplItem({ ...shape, fill_color: '#2563eb' }, 203)).toEqual([
      '^FO40,64^GB96,48,48,B,0^FS',
    ]);
  });
});

describe('drawZplItem Code 39', () => {
  it('emits the validated uppercase Code 39 payload using the native ZPL command', () => {
    const result = drawZplItem({
      id: 'code39',
      type: 'barcode',
      x_mm: 5,
      y_mm: 8,
      w_mm: 40,
      h_mm: 12,
      rotation: 0,
      z_index: 1,
      locked: false,
      binding_key: 'PRODUCT_SCAN',
      code: 'abc-123',
      barcode_type: 'code39',
      show_text: true,
      bar_color: '#000000',
    }, 203, {
      id: 'product-code39',
      ITEMNAME: 'Code 39 sample',
      PRODUCT_SCAN: 'abc-123',
    }).join('\n');

    expect(result).toContain('^B3N,N,76,Y,N^FDABC-123^FS');
  });
});

describe('drawZplItem UPC-A', () => {
  it('emits the native UPC-A command only after check-digit validation', () => {
    const item = {
      id: 'upca',
      type: 'barcode' as const,
      x_mm: 5,
      y_mm: 8,
      w_mm: 40,
      h_mm: 12,
      rotation: 0,
      z_index: 1,
      locked: false,
      code: '03600029145',
      barcode_type: 'upca' as const,
      show_text: true,
      bar_color: '#000000',
    };

    const record: ProductRecord = { id: 'upca-product', ITEMNAME: 'UPC-A item', PRODUCT_SCAN: '03600029145' };
    expect(drawZplItem(item, 203, record).join('\n')).toContain('^BUN,76,Y,N^FD03600029145^FS');
    expect(() => drawZplItem(item, 203, { ...record, PRODUCT_SCAN: '036000291453' }))
      .toThrow(/Invalid upca barcode/);
  });

  describe('drawZplItem barcode output support', () => {
    const base = {
      id: 'barcode-zpl',
      type: 'barcode' as const,
      x_mm: 5,
      y_mm: 8,
      w_mm: 40,
      h_mm: 12,
      rotation: 0,
      z_index: 1,
      locked: false,
      code: 'ABC123',
      use_static_value: true,
      show_text: false,
      bar_color: '#000000',
    };

    it('emits a native Code 93 command', () => {
      expect(drawZplItem(
        { ...base, barcode_type: 'code93' },
        203,
        { id: 'barcode-product', ITEMNAME: 'Barcode item' }
      ).join('\n')).toContain('^BAN,96,N,N^FH^FDABC123^FS');
    });

    it('fails explicitly rather than omitting unsupported GS1 matrix output', () => {
      expect(() => drawZplItem({
        ...base,
        barcode_type: 'gs1_datamatrix',
        code: '(01)09506000134352',
      }, 203, { id: 'barcode-product', ITEMNAME: 'Barcode item' }))
        .toThrow(/does not support the selected barcode symbology: gs1_datamatrix/);
    });
  });
});

describe('drawZplItem text layout', () => {
  const textItem = {
    id: 'text-layout',
    type: 'text' as const,
    x_mm: 2,
    y_mm: 3,
    w_mm: 30,
    h_mm: 12,
    rotation: 0,
    z_index: 1,
    locked: false,
    text: 'hello zebra',
    font_family: 'A',
    font_size_pt: 10,
    font_weight: 'normal' as const,
    font_style: 'normal' as const,
    text_decoration: 'none' as const,
    text_color: '#000000',
    alignment: 'center' as const,
    valign: 'top' as const,
    wrap: true,
    overflow: 'clip' as const,
    text_transform: 'uppercase' as const,
  };

  it('applies supported text transform, box width, wrapping and alignment in ZPL', () => {
    expect(drawZplItem(textItem, 203).join('')).toContain('^FB240,4,0,C,0^FH^FDHELLO ZEBRA^FS');
  });

  it('emits native ZPL font orientations for quarter-turned canvas text', () => {
    expect(drawZplItem({ ...textItem, rotation: 90 }, 203).join('')).toContain('^A0R,');
    expect(drawZplItem({ ...textItem, rotation: 180 }, 203).join('')).toContain('^A0I,');
    expect(drawZplItem({ ...textItem, rotation: 270 }, 203).join('')).toContain('^A0B,');
  });
});
