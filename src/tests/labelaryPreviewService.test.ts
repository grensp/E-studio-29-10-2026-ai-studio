import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLabelaryPreviewUrl, fetchLabelaryPreview } from '../services/labelaryPreviewService';

describe('Labelary preview service', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('builds printer-resolution endpoints using the physical label dimensions', () => {
    expect(createLabelaryPreviewUrl(203, 50.8, 25.4))
      .toBe('https://api.labelary.com/v1/printers/8dpmm/labels/2.000x1.000/0/');
    expect(createLabelaryPreviewUrl(300, 50.8, 25.4))
      .toBe('https://api.labelary.com/v1/printers/12dpmm/labels/2.000x1.000/0/');
  });

  it('posts ZPL and accepts only successful PNG responses', async () => {
    const image = new Blob(['png-bytes'], { type: 'image/png' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(image, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchLabelaryPreview('^XA^XZ', 203, 50.8, 25.4)).resolves.toBeInstanceOf(Blob);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.labelary.com/v1/printers/8dpmm/labels/2.000x1.000/0/',
      expect.objectContaining({ method: 'POST', body: '^XA^XZ' })
    );
  });

  it('rejects empty source, invalid dimensions, API errors, and unexpected response content', async () => {
    expect(() => createLabelaryPreviewUrl(203, 0, 20)).toThrow(/positive finite/);
    await expect(fetchLabelaryPreview(' ', 203, 20, 20)).rejects.toThrow(/empty ZPL/);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('invalid command', { status: 400 })));
    await expect(fetchLabelaryPreview('^XA^XZ', 203, 20, 20)).rejects.toThrow(/400/);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    await expect(fetchLabelaryPreview('^XA^XZ', 203, 20, 20)).rejects.toThrow(/unexpected content type/);
  });
});
