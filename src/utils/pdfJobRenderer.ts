import jsPDF from 'jspdf';
import { ImpositionConfig, LabelTemplate, ProductRecord } from '../types';
import { ImpositionCalculator } from './impositionCalculator';
import { drawPdfItem } from '../render/drawPdfItem';

export function renderImposedPdfJob(
  template: LabelTemplate,
  products: ProductRecord[],
  config: ImpositionConfig,
  productTemplates?: LabelTemplate[]
): jsPDF {
  const imposition = ImpositionCalculator.calculate(
    template.width_mm,
    template.height_mm,
    template.outer_margins_mm,
    config
  );
  if (imposition.total_per_page < 1) throw new Error('The label does not fit on the selected page.');
  if (products.length === 0) throw new Error('The print job has no product snapshot to render.');
  if (!Number.isFinite(imposition.total_per_page)) throw new Error('The selected imposition is invalid.');

  const format = config.page_size === 'CUSTOM'
    ? [config.custom_page_w_mm || imposition.page_w_mm, config.custom_page_h_mm || imposition.page_h_mm]
    : config.page_size.toLowerCase();
  const doc = new jsPDF({
    orientation: config.orientation === 'landscape' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: format as any,
  });
  const labelsPerPage = imposition.total_per_page;
  const startOffset = Math.max(0, Math.min(labelsPerPage - 1, Math.floor(config.start_offset_slot || 0)));
  const totalPages = Math.max(1, Math.ceil((products.length + startOffset) / labelsPerPage));
  let productCursor = 0;

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();
    for (let slot = 0; slot < labelsPerPage; slot++) {
      if (page === 0 && slot < startOffset) continue;
      if (productCursor >= products.length) break;

      const productIndex = productCursor++;
      const product = products[productIndex];
      const renderTemplate = productTemplates?.[productIndex] || template;
      const { x_mm: x, y_mm: y } = ImpositionCalculator.getSlotPosition(imposition, config, slot);

      if (renderTemplate.bg_color && renderTemplate.bg_color !== 'transparent') {
        const hex = renderTemplate.bg_color.replace('#', '');
        doc.setFillColor(
          parseInt(hex.substring(0, 2), 16) || 255,
          parseInt(hex.substring(2, 4), 16) || 255,
          parseInt(hex.substring(4, 6), 16) || 255
        );
        doc.rect(x, y, renderTemplate.width_mm, renderTemplate.height_mm, 'F');
      }
      if (renderTemplate.background_image_path && renderTemplate.background_image_in_output) {
        doc.addImage(renderTemplate.background_image_path, 'JPEG', x, y, renderTemplate.width_mm, renderTemplate.height_mm);
      }
      if (config.show_cut_marks) {
        doc.setDrawColor(180, 180, 180);
        doc.line(x - 1.5, y, x + 1.5, y);
        doc.line(x, y - 1.5, x, y + 1.5);
        doc.line(x + renderTemplate.width_mm - 1.5, y + renderTemplate.height_mm, x + renderTemplate.width_mm + 1.5, y + renderTemplate.height_mm);
        doc.line(x + renderTemplate.width_mm, y + renderTemplate.height_mm - 1.5, x + renderTemplate.width_mm, y + renderTemplate.height_mm + 1.5);
      }
      renderTemplate.items.forEach((item) => drawPdfItem(doc, item, x + item.x_mm, y + item.y_mm, product));
    }
  }

  return doc;
}