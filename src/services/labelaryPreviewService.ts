export type LabelaryDpi = 203 | 300 | 600;

const DPI_TO_DPMM: Record<LabelaryDpi, number> = {
  203: 8,
  300: 12,
  600: 24,
};

export function createLabelaryPreviewUrl(dpi: LabelaryDpi, widthMm: number, heightMm: number): string {
  if (!Number.isFinite(widthMm) || widthMm <= 0 || !Number.isFinite(heightMm) || heightMm <= 0) {
    throw new Error('Label dimensions must be positive finite numbers.');
  }
  const widthInches = (widthMm / 25.4).toFixed(3);
  const heightInches = (heightMm / 25.4).toFixed(3);
  return `https://api.labelary.com/v1/printers/${DPI_TO_DPMM[dpi]}dpmm/labels/${widthInches}x${heightInches}/0/`;
}

export async function fetchLabelaryPreview(
  zpl: string,
  dpi: LabelaryDpi,
  widthMm: number,
  heightMm: number,
  signal?: AbortSignal
): Promise<Blob> {
  if (!zpl.trim()) throw new Error('Cannot preview empty ZPL source.');
  const response = await fetch(createLabelaryPreviewUrl(dpi, widthMm, heightMm), {
    method: 'POST',
    headers: { Accept: 'image/png', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: zpl,
    signal,
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(`Labelary preview failed (${response.status}): ${detail || response.statusText}`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/png')) {
    throw new Error(`Labelary returned an unexpected content type: ${contentType || 'unknown'}.`);
  }
  return response.blob();
}
