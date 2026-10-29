import { LabelTemplate, ProductRecord } from '../types';
import { desktopFileService } from '../services/desktopFileService';
import { drawZplItem, mmToDots, escapeZplText } from '../render/drawZplItem';
import { generateSourcePreservingZpl } from './zplSourceExporter';

export interface ZplConfig {
  dpi: 203 | 300 | 600;
  quantity?: number;
  printSpeed?: number; // 2 to 14
  darkness?: number; // 0 to 30
  includeComments?: boolean;
}

export class ZplExporter {
  static mmToDots = mmToDots;
  static escapeZplText = escapeZplText;

  /**
   * Generates a single ZPL string for a specific product and template
   */
  static generateLabelZpl(
    template: LabelTemplate,
    record: ProductRecord,
    config: ZplConfig = { dpi: 203, quantity: 1, printSpeed: 4, darkness: 15, includeComments: true }
  ): string {
    if (template.zpl_source) return generateSourcePreservingZpl(template, record);
    const lines: string[] = [];
    const { dpi, quantity = 1, darkness = 15, includeComments = true } = config;

    const labelWidthDots = mmToDots(template.width_mm, dpi);
    const labelHeightDots = mmToDots(template.height_mm, dpi);

    lines.push('^XA');
    // Enable UTF-8 encoding support
    lines.push('^CI28');

    if (includeComments) {
      const cleanTplName = (template.name || '').replace(/[\^~\r\n]/g, ' ');
      const cleanArtName = (record.ITEMNAME || '').replace(/[\^~\r\n]/g, ' ');
      lines.push(`^FX --- E-STUDIO GENERATED ZPL II ---`);
      lines.push(`^FX Template: ${cleanTplName} (${template.width_mm}x${template.height_mm} mm)`);
      lines.push(`^FX Article: ${cleanArtName}`);
    }

    // Label dimensions and darkness
    lines.push(`^PW${labelWidthDots}`);
    lines.push(`^LL${labelHeightDots}`);
    lines.push(`~SD${darkness}`);
    lines.push(`^LH0,0`);

    // Render elements using drawZplItem
    const orderedItems = (template.items || [])
      .map((item, index) => ({ item, index }))
      .sort((a, b) => (a.item.z_index || 0) - (b.item.z_index || 0) || a.index - b.index)
      .map(({ item }) => item);
    for (const item of orderedItems) {
      const itemLines = drawZplItem(item, dpi, record);
      lines.push(...itemLines);
    }

    lines.push(`^PQ${quantity},0,1,Y`);
    lines.push('^XZ');

    return lines.join('\n');
  }

  /**
   * Generates a batch ZPL file for all records in the queue
   */
  static generateBatchZpl(
    template: LabelTemplate,
    products: ProductRecord[],
    config: ZplConfig = { dpi: 203, quantity: 1, printSpeed: 4, darkness: 15, includeComments: true },
    productTemplates?: LabelTemplate[]
  ): string {
    if (productTemplates && productTemplates.length !== products.length) {
      throw new Error('Each rule-processed product must have exactly one resolved template.');
    }
    return products
      .map((product, index) => ZplExporter.generateLabelZpl(productTemplates?.[index] || template, product, config))
      .join('\n\n');
  }

  /**
   * Saves the generated .zpl file to local disk or triggers browser download
   */
  static async downloadZplFile(filename: string, content: string): Promise<string | null> {
    const finalName = filename.endsWith('.zpl') ? filename : `${filename}.zpl`;
    return await desktopFileService.saveText(finalName, content, [
      { name: 'Fichier ZPL', extensions: ['zpl', 'txt'] },
    ]);
  }
}
