import QRCode from 'qrcode';

// Standards-compliant QR Code Matrix generator backed by ISO/IEC 18004 encoder
const qrMatrixCache = new Map<string, boolean[][]>();
const qrPathCache = new Map<string, string>();

export function generateQrMatrix(
  text: string,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'
): boolean[][] {
  const content = text && text.trim().length > 0 ? text : '0';
  const cacheKey = `${errorCorrectionLevel}:${content}`;
  const cached = qrMatrixCache.get(cacheKey);
  if (cached) return cached;

  try {
    const qr = QRCode.create(content, { errorCorrectionLevel });
    const size = qr.modules.size;
    const matrix: boolean[][] = [];

    for (let r = 0; r < size; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < size; c++) {
        row.push(Boolean(qr.modules.get(r, c)));
      }
      matrix.push(row);
    }

    if (qrMatrixCache.size > 1000) qrMatrixCache.clear();
    qrMatrixCache.set(cacheKey, matrix);
    return matrix;
  } catch (err) {
    console.error('Failed to generate standards-compliant QR code:', err);
    return [];
  }
}

/**
 * Builds a single SVG path definition string for a QR matrix.
 * Efficiently batches runs of consecutive modules into horizontal lines.
 */
export function getQrSvgPath(matrix: boolean[][]): string {
  if (!matrix || matrix.length === 0) return '';
  const size = matrix.length;
  const cacheKey = `${size}_${matrix[0]?.slice(0, 10).join('')}_${matrix[matrix.length - 1]?.slice(0, 10).join('')}`;
  const cached = qrPathCache.get(cacheKey);
  if (cached) return cached;

  let d = '';
  const cellSize = 100 / size;

  for (let r = 0; r < size; r++) {
    const y = (r * cellSize).toFixed(2);
    const h = (cellSize + 0.05).toFixed(2);

    let c = 0;
    while (c < size) {
      if (matrix[r][c]) {
        let span = 1;
        while (c + span < size && matrix[r][c + span]) {
          span++;
        }
        const x = (c * cellSize).toFixed(2);
        const w = (span * cellSize + 0.05).toFixed(2);
        d += `M${x} ${y}h${w}v${h}h-${w}Z `;
        c += span;
      } else {
        c++;
      }
    }
  }

  if (qrPathCache.size > 1000) qrPathCache.clear();
  qrPathCache.set(cacheKey, d);
  return d;
}

/**
 * Renders a crisp rasterized standards-compliant QR Code dataURL (PNG)
 */
export function renderQrToDataUrl(
  content: string,
  moduleColor: string = '#000000',
  backgroundColor: string = '#FFFFFF'
): string {
  if (typeof document === 'undefined') return '';

  const matrix = generateQrMatrix(content || '0');
  if (matrix.length === 0) return '';
  const size = matrix.length;
  const scale = 8;
  const quietZone = 4; // ISO quiet zone standard: 4 modules
  const fullSize = (size + quietZone * 2) * scale;

  const canvas = document.createElement('canvas');
  canvas.width = fullSize;
  canvas.height = fullSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = backgroundColor || '#FFFFFF';
  ctx.fillRect(0, 0, fullSize, fullSize);

  // Modules
  ctx.fillStyle = moduleColor || '#000000';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        ctx.fillRect((c + quietZone) * scale, (r + quietZone) * scale, scale, scale);
      }
    }
  }

  return canvas.toDataURL('image/png');
}
