import { LabelTemplate, TemplateItem, ProductRecord } from '../types';
import { drawZplItem, mmToDots } from '../render/drawZplItem';
import { applyZplSourceEdits, parseZplSource, ZplSourceEdit } from './zplSourceDocument';

function sameItem(left: TemplateItem, right: TemplateItem): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function generateSourcePreservingZpl(
  template: LabelTemplate,
  record: ProductRecord,
): string {
  const metadata = template.zpl_source;
  if (!metadata) throw new Error('Template does not contain an imported ZPL source document.');

  const edits: ZplSourceEdit[] = [];
  const itemById = new Map(template.items.map((item) => [item.id, item]));
  const sourceItemIds = new Set(metadata.item_ranges.map(({ item_id }) => item_id));
  const appended: TemplateItem[] = [];

  for (const range of metadata.item_ranges) {
    const item = itemById.get(range.item_id);
    if (!item) {
      edits.push({
        start: range.start,
        end: range.end,
        expected: metadata.source.slice(range.start, range.end),
        replacement: '',
      });
      continue;
    }
    if (sameItem(item, range.original_item)) continue;
    const replacement = drawZplItem(item, metadata.dpi, record).join('\n');
    edits.push({
      start: range.start,
      end: range.end,
      expected: metadata.source.slice(range.start, range.end),
      replacement,
    });
  }

  for (const item of template.items) {
    if (!sourceItemIds.has(item.id)) appended.push(item);
  }

  const pageSizeChanges: Array<{
    range: typeof metadata.page_width_range;
    changed: boolean;
    dots: number;
    expectedSize: number;
    label: string;
  }> = [
    {
      range: metadata.page_width_range,
      changed: Math.abs(template.width_mm - metadata.original_width_mm) > 0.0001,
      dots: mmToDots(template.width_mm, metadata.dpi),
      expectedSize: mmToDots(metadata.original_width_mm, metadata.dpi),
      label: 'width (^PW)',
    },
    {
      range: metadata.page_height_range,
      changed: Math.abs(template.height_mm - metadata.original_height_mm) > 0.0001,
      dots: mmToDots(template.height_mm, metadata.dpi),
      expectedSize: mmToDots(metadata.original_height_mm, metadata.dpi),
      label: 'height (^LL)',
    },
  ];
  for (const size of pageSizeChanges) {
    if (!size.changed) continue;
    if (!size.range) throw new Error(`Cannot export the resized imported label: source has no unique editable ${size.label} command.`);
    if (size.dots < 1) throw new Error(`Page ${size.label} must be at least one printer dot.`);
    edits.push({
      start: size.range.start,
      end: size.range.end,
      expected: size.range.expected,
      replacement: String(size.dots),
    });
  }

  if (appended.length > 0) {
    const sourceDocument = parseZplSource(metadata.source);
    const endCommand = [...sourceDocument.segments].reverse().find(({ command }) => command === '^XZ');
    if (!endCommand) {
      throw new Error('Cannot append canvas objects because the imported source has no ^XZ label terminator.');
    }
    const newline = metadata.source.includes('\r\n') ? '\r\n' : metadata.source.includes('\r') ? '\r' : '\n';
    const rendered = appended.flatMap((item) => drawZplItem(item, metadata.dpi, record)).join(newline);
    edits.push({
      start: endCommand.start,
      end: endCommand.start,
      expected: '',
      replacement: `${rendered}${rendered ? newline : ''}`,
    });
  }

  return applyZplSourceEdits(metadata.source, edits);
}
