import React from 'react';
import {
  TemplateItem,
  TextItemProperties,
  RichTextItemProperties,
  PriceBlockItemProperties,
  TextRun,
  ShapeItemProperties,
  BarcodeItemProperties,
  RestrictedAreaItemProperties,
  CurvedTextItemProperties,
  PictogramItemProperties,
  PictogramType,
  ConditionalDisplayConfig,
  SemanticSnapConfig,
} from '../types';
import { DOMAIN_FIELDS } from '../domainFields';
import { useMappingDictionary } from '../context/MappingDictionaryContext';
import { isPriceRelatedElement, sanitizeNonPriceElement } from '../utils/pricingEngine';
import { TypedQrPayloadWizard } from './TypedQrPayloadWizard';
import { Gs1PayloadWizard } from './Gs1PayloadWizard';
import { BARCODE_SYMBOLOGIES, BARCODE_SYMBOLOGY_LABELS } from '../utils/barcodeGenerator';
import {
  AVAILABLE_FONTS,
  FONT_WEIGHTS,
  TEXT_ALIGNMENTS,
  VERTICAL_ALIGNMENTS,
  TEXT_TRANSFORMS,
  CURRENCY_SYMBOLS,
  FONT_SIZE_PRESETS,
  extractCommonProperties,
  ElementStylePayload,
  extractElementStyle,
  applyElementStyle,
} from '../models/TemplateObjectModel';
import {
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Layers,
  Palette,
  Type,
  Maximize2,
  Box,
  Sliders,
  Paintbrush,
  DollarSign,
  ClipboardCheck,
  Highlighter,
  RotateCcw,
  ShieldAlert,
  Sun,
  Ban,
  Sparkles,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Calculator,
  Calendar,
  Coins,
  Eye,
  Scissors,
  Stamp,
  CircleDot,
  Magnet,
  Plus,
  Link2,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface PropertyInspectorProps {
  selectedItems: TemplateItem[];
  allItems?: TemplateItem[];
  onUpdateItem: (updatedItem: TemplateItem) => void;
  onUpdateMultipleItems?: (updatedItems: TemplateItem[]) => void;
  onDeleteItem: (id: string) => void;
  onDeleteMultipleItems?: (ids: string[]) => void;
  onDuplicateItem: (id: string) => void;
  onDuplicateMultipleItems?: (ids: string[]) => void;
  onReorderItem: (id: string, delta: number) => void;
  copiedStyle?: ElementStylePayload | null;
  onCopyStyle?: (style: ElementStylePayload) => void;
  onPasteStyle?: () => void;
  onClose?: () => void;
  inspectorWidth?: number;
  inspectorWidthLocked?: boolean;
  selectedPriceExtensionId?: string | null;
  onToggleInspectorWidthLock?: () => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  selectedItems,
  allItems = [],
  onUpdateItem,
  onUpdateMultipleItems,
  onDeleteItem,
  onDeleteMultipleItems,
  onDuplicateItem,
  onDuplicateMultipleItems,
  onReorderItem,
  copiedStyle,
  onCopyStyle,
  onPasteStyle,
  onClose,
  inspectorWidth = 320,
  inspectorWidthLocked = false,
  selectedPriceExtensionId,
  onToggleInspectorWidthLock,
}) => {
  const { dictionary } = useMappingDictionary();
  const availableFields = React.useMemo(() => {
    if (!dictionary || !Array.isArray(dictionary) || dictionary.length === 0) return DOMAIN_FIELDS;
    return dictionary.map((f) => ({
      key: f.key,
      label: f.label,
      description: f.description,
    }));
  }, [dictionary]);

  const count = selectedItems.length;
  const [arePropertiesFolded, setArePropertiesFolded] = React.useState(false);
  const [isTypedQrWizardOpen, setIsTypedQrWizardOpen] = React.useState(false);
  const [isGs1WizardOpen, setIsGs1WizardOpen] = React.useState(false);
  const foldButton = (
    <button
      type="button"
      onClick={() => setArePropertiesFolded((folded) => !folded)}
      aria-expanded={!arePropertiesFolded}
      title={arePropertiesFolded ? 'Déplier les propriétés' : 'Replier les propriétés'}
      className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
    >
      {arePropertiesFolded ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
    </button>
  );
  const widthLockButton = onToggleInspectorWidthLock ? (
    <button
      type="button"
      onClick={onToggleInspectorWidthLock}
      aria-pressed={inspectorWidthLocked}
      title={inspectorWidthLocked ? 'Déverrouiller la largeur de l’inspecteur' : 'Verrouiller la largeur de l’inspecteur'}
      className={`p-1.5 rounded transition ${inspectorWidthLocked ? 'bg-amber-100 text-amber-800' : 'hover:bg-slate-200 text-slate-600'}`}
    >
      {inspectorWidthLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
    </button>
  ) : null;

  if (count === 0) {
    return (
      <div style={{ width: inspectorWidth }} className="designer-inspector-panel bg-white border-l border-slate-200 p-6 text-slate-500 text-sm flex flex-col items-center justify-center text-center h-full select-none shrink-0 z-10">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <Sliders className="w-6 h-6" />
        </div>
        <p className="font-semibold text-slate-700">Aucun élément sélectionné</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Sélectionnez un ou plusieurs objets pour afficher leurs propriétés contextuelles.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
          >
            Fermer l'inspecteur
          </button>
        )}
      </div>
    );
  }

  // MULTI-SELECTION MODE
  if (count > 1) {
    const common = extractCommonProperties(selectedItems);

    const updateMulti = (patch: Partial<any>) => {
      const updated = selectedItems.map((it) => ({
        ...it,
        ...patch,
      }));
      if (onUpdateMultipleItems) {
        onUpdateMultipleItems(updated);
      } else {
        updated.forEach((it) => onUpdateItem(it));
      }
    };

    const handleDeleteAll = () => {
      if (onDeleteMultipleItems) {
        onDeleteMultipleItems(selectedItems.map((it) => it.id));
      } else {
        selectedItems.forEach((it) => onDeleteItem(it.id));
      }
    };

    const handleDuplicateAll = () => {
      if (onDuplicateMultipleItems) {
        onDuplicateMultipleItems(selectedItems.map((it) => it.id));
      } else {
        selectedItems.forEach((it) => onDuplicateItem(it.id));
      }
    };

    const handleCopyStyleFromFirst = () => {
      if (onCopyStyle && selectedItems[0]) {
        onCopyStyle(extractElementStyle(selectedItems[0]));
      }
    };

    const allLocked = selectedItems.every((it) => it.locked);

    return (
      <div style={{ width: inspectorWidth }} className="designer-inspector-panel bg-white border-l border-slate-200 h-full flex flex-col text-xs text-slate-700 select-none overflow-y-auto shrink-0 z-10 shadow-lg">
        {/* Multi-Selection Header */}
        <div className="p-3 border-b border-slate-200 bg-blue-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
              {count}
            </span>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-800">Sélection Multiple</span>
              <h3 className="font-bold text-slate-900 text-xs">Propriétés Communes</h3>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {foldButton}
            {widthLockButton}
            {onCopyStyle && (
              <button
                onClick={handleCopyStyleFromFirst}
                title="Copier le style du 1er élément (Ctrl+Alt+C)"
                className="p-1.5 rounded hover:bg-blue-100 text-blue-700 transition"
              >
                <Paintbrush className="w-3.5 h-3.5" />
              </button>
            )}
            {onPasteStyle && copiedStyle && (
              <button
                onClick={onPasteStyle}
                title="Coller le style sur toute la sélection (Ctrl+Alt+V)"
                className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => updateMulti({ locked: !allLocked })}
              title={allLocked ? 'Déverrouiller tout' : 'Verrouiller tout'}
              className={`p-1.5 rounded transition ${allLocked ? 'bg-amber-100 text-amber-800' : 'hover:bg-slate-200 text-slate-600'}`}
            >
              {allLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleDuplicateAll}
              title="Dupliquer la sélection"
              className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDeleteAll}
              title="Supprimer la sélection"
              className="p-1.5 rounded hover:bg-rose-100 text-rose-600 ml-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded ml-1"
                title="Fermer l'inspecteur"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Style Paste Alert in Multi-Select */}
        {copiedStyle && onPasteStyle && (
          <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <span className="text-[11px] text-blue-700">Style en mémoire prêt à coller</span>
            <button
              onClick={onPasteStyle}
              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-[10px]"
            >
              Appliquer à la sélection
            </button>
          </div>
        )}

        <div className={arePropertiesFolded ? 'hidden' : 'p-4 space-y-4'}>
          {/* Dimensions communes */}
          <div>
            <h4 className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1">
              <Box className="w-3 h-3" />
              <span>Dimensions Communes (mm)</span>
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Largeur (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  placeholder={common.w_mm !== undefined ? String(common.w_mm) : 'Mixte'}
                  value={common.w_mm !== undefined ? common.w_mm : ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) updateMulti({ w_mm: val });
                  }}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Hauteur (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  placeholder={common.h_mm !== undefined ? String(common.h_mm) : 'Mixte'}
                  value={common.h_mm !== undefined ? common.h_mm : ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) updateMulti({ h_mm: val });
                  }}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Rotation (°)</label>
                <input
                  type="number"
                  step="15"
                  placeholder={common.rotation !== undefined ? String(common.rotation) : 'Mixte'}
                  value={common.rotation !== undefined ? common.rotation : ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) updateMulti({ rotation: val });
                  }}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Typographie commune */}
          <div className="pt-2 border-t border-slate-200">
            <h4 className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1">
              <Type className="w-3 h-3" />
              <span>Typographie Commune</span>
            </h4>
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] text-slate-500">Police de Caractères</label>
                <select
                  value={common.font_family || ''}
                  onChange={(e) => {
                    if (e.target.value) updateMulti({ font_family: e.target.value });
                  }}
                  className="w-full mt-0.5 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
                >
                  <option value="">{common.font_family ? common.font_family : '-- Conserver / Mixte --'}</option>
                  {AVAILABLE_FONTS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500">Taille (pt)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="5"
                    max="100"
                    placeholder={common.font_size_pt !== undefined ? String(common.font_size_pt) : 'Mixte'}
                    value={common.font_size_pt !== undefined ? common.font_size_pt : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) updateMulti({ font_size_pt: val });
                    }}
                    className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">Graisse</label>
                  <select
                    value={common.font_weight || ''}
                    onChange={(e) => {
                      if (e.target.value) updateMulti({ font_weight: e.target.value });
                    }}
                    className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                  >
                    <option value="">{common.font_weight || '-- Mixte --'}</option>
                    {FONT_WEIGHTS.map((fw) => (
                      <option key={fw.value} value={fw.value}>
                        {fw.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Style & Décoration Multi */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500">Style Itlique</label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <button
                      type="button"
                      onClick={() => updateMulti({ font_style: common.font_style === 'italic' ? 'normal' : 'italic' })}
                      className={`flex-1 py-1 text-center font-serif italic text-xs rounded border ${common.font_style === 'italic' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'border-slate-200 bg-white text-slate-700'}`}
                    >
                      Italique
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">Décoration</label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <button
                      type="button"
                      onClick={() => updateMulti({ text_decoration: common.text_decoration === 'underline' ? 'none' : 'underline' })}
                      className={`flex-1 py-1 text-center underline text-xs rounded border ${common.text_decoration === 'underline' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'border-slate-200 bg-white text-slate-700'}`}
                      title="Souligné"
                    >
                      U
                    </button>
                    <button
                      type="button"
                      onClick={() => updateMulti({ text_decoration: common.text_decoration === 'line-through' ? 'none' : 'line-through' })}
                      className={`flex-1 py-1 text-center line-through text-xs rounded border ${common.text_decoration === 'line-through' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'border-slate-200 bg-white text-slate-700'}`}
                      title="Barré"
                    >
                      S
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500">Couleur Texte</label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="color"
                      value={common.text_color || '#000000'}
                      onChange={(e) => updateMulti({ text_color: e.target.value })}
                      className="w-8 h-7 p-0 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="Mixte"
                      value={common.text_color || ''}
                      onChange={(e) => updateMulti({ text_color: e.target.value })}
                      className="flex-1 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">Alignement H</label>
                  <div className="flex items-center gap-1 mt-0.5 bg-slate-100 p-0.5 rounded border border-slate-200">
                    <button
                      type="button"
                      onClick={() => updateMulti({ alignment: 'left' })}
                      className={`flex-1 py-1 flex justify-center rounded ${common.alignment === 'left' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-600'}`}
                      title="Gauche"
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateMulti({ alignment: 'center' })}
                      className={`flex-1 py-1 flex justify-center rounded ${common.alignment === 'center' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-600'}`}
                      title="Centré"
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateMulti({ alignment: 'right' })}
                      className={`flex-1 py-1 flex justify-center rounded ${common.alignment === 'right' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-600'}`}
                      title="Droite"
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateMulti({ alignment: 'justify' })}
                      className={`flex-1 py-1 flex justify-center rounded ${common.alignment === 'justify' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-600'}`}
                      title="Justifié"
                    >
                      <AlignJustify className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Couleurs et Bordures Communes */}
          <div className="pt-2 border-t border-slate-200">
            <h4 className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1">
              <Palette className="w-3 h-3" />
              <span>Couleurs & Bordures Communes</span>
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Fond (Fill)</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="color"
                    value={common.fill_color || '#ffffff'}
                    onChange={(e) => updateMulti({ fill_color: e.target.value })}
                    className="w-8 h-7 p-0 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    placeholder="Mixte"
                    value={common.fill_color || ''}
                    onChange={(e) => updateMulti({ fill_color: e.target.value })}
                    className="flex-1 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Bordure</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="color"
                    value={common.border_color || '#000000'}
                    onChange={(e) => updateMulti({ border_color: e.target.value })}
                    className="w-8 h-7 p-0 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    placeholder="Mixte"
                    value={common.border_color || ''}
                    onChange={(e) => updateMulti({ border_color: e.target.value })}
                    className="flex-1 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono uppercase"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SINGLE-SELECTION FULL INSPECTOR
  const selectedItem = selectedItems[0];

  const update = (patch: Partial<TemplateItem>) => {
    onUpdateItem({ ...selectedItem, ...patch } as TemplateItem);
  };

  return (
    <div style={{ width: inspectorWidth }} className="designer-inspector-panel bg-white border-l border-slate-200 h-full flex flex-col text-xs text-slate-700 select-none overflow-y-auto shrink-0 z-10 shadow-none">
      {/* Header with quick actions */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Élément</span>
          <h3 className="font-bold text-slate-800 capitalize text-sm">{selectedItem.type.replace('_', ' ')}</h3>
        </div>
        <div className="flex items-center gap-1">
          {foldButton}
          {widthLockButton}
          {onCopyStyle && (
            <button
              onClick={() => onCopyStyle(extractElementStyle(selectedItem))}
              title="Copier le style de cet élément (Ctrl+Alt+C)"
              className="p-1.5 rounded hover:bg-blue-100 text-blue-700 transition"
            >
              <Paintbrush className="w-3.5 h-3.5" />
            </button>
          )}
          {onPasteStyle && copiedStyle && (
            <button
              onClick={onPasteStyle}
              title="Coller le style copié sur cet élément (Ctrl+Alt+V)"
              className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => update({ locked: !selectedItem.locked })}
            title={selectedItem.locked ? 'Déverrouiller' : 'Verrouiller'}
            className={`p-1.5 rounded transition ${selectedItem.locked ? 'bg-amber-100 text-amber-800' : 'hover:bg-slate-200 text-slate-600'}`}
          >
            {selectedItem.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onReorderItem(selectedItem.id, 1)}
            title="Avancer (z-index)"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onReorderItem(selectedItem.id, -1)}
            title="Reculer (z-index)"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Fermer l'inspecteur"
              className="p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onDuplicateItem(selectedItem.id)}
            title="Dupliquer"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteItem(selectedItem.id)}
            title="Supprimer"
            className="p-1.5 rounded hover:bg-rose-100 text-rose-600 ml-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Copy/Paste Style Notification Bar */}
      {copiedStyle && onPasteStyle && (
        <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <span className="text-[11px] text-blue-700">Style en mémoire</span>
          <button
            onClick={onPasteStyle}
            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-[10px]"
          >
            Coller le style
          </button>
        </div>
      )}

      <div className={arePropertiesFolded ? 'hidden' : 'p-4 space-y-4'}>
        {/* Geometry (mm) */}
        <div>
          <h4 className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-wider text-slate-400">
            Géométrie (Millimètres)
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-500">X (mm)</label>
              <input
                type="number"
                step="0.5"
                value={selectedItem.x_mm ?? 0}
                onChange={(e) => update({ x_mm: parseFloat(e.target.value) || 0 })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Y (mm)</label>
              <input
                type="number"
                step="0.5"
                value={selectedItem.y_mm ?? 0}
                onChange={(e) => update({ y_mm: parseFloat(e.target.value) || 0 })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Largeur (mm)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={selectedItem.w_mm ?? 1}
                onChange={(e) => update({ w_mm: Math.max(1, parseFloat(e.target.value) || 1) })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Hauteur (mm)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={selectedItem.h_mm ?? 1}
                onChange={(e) => update({ h_mm: Math.max(1, parseFloat(e.target.value) || 1) })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Rotation (°)</label>
              <input
                type="number"
                step="15"
                value={selectedItem.rotation ?? 0}
                onChange={(e) => update({ rotation: parseFloat(e.target.value) || 0 })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Plan (Z-Index)</label>
              <input
                type="number"
                value={selectedItem.z_index ?? 1}
                onChange={(e) => update({ z_index: parseInt(e.target.value, 10) || 1 })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Data Binding Key (Clé de liaison) */}
        {selectedItem.type !== 'shape' && selectedItem.type !== 'ellipse' && selectedItem.type !== 'line' && (
          <div className="pt-2 border-t border-slate-200">
            <h4 className="font-bold text-slate-900 mb-1.5 uppercase text-[10px] tracking-wider text-slate-400">
              Liaison de Données (Binding)
            </h4>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-500">Champ Canonique</label>
                <select
                  value={selectedItem.binding_key || ''}
                  onChange={(e) => update({ binding_key: e.target.value || undefined })}
                  className="w-full mt-0.5 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="">-- Aucun (Texte statique) --</option>
                  {availableFields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.key} ({f.label})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Ou Clé Personnalisée</label>
                <input
                  type="text"
                  placeholder="ex: CODE_RAYON, PROMO_TAG..."
                  value={selectedItem.binding_key || ''}
                  onChange={(e) => update({ binding_key: e.target.value.trim() || undefined })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* CONDITIONAL DISPLAY & VISIBILITY RULES */}
        <div className="pt-2 border-t border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>Règles Conditionnelles d'Affichage</span>
            </h4>
          </div>
          <div>
            <label className="text-[11px] text-slate-500">Visibilité dynamique</label>
            <select
              value={selectedItem.conditional_display?.rule || 'always'}
              onChange={(e) => {
                const rule = e.target.value as any;
                update({
                  conditional_display: {
                    enabled: rule !== 'always',
                    rule,
                    field_key: selectedItem.conditional_display?.field_key || selectedItem.binding_key,
                  },
                });
              }}
              className="w-full mt-0.5 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="always">Toujours afficher (Par défaut)</option>
              <option value="has_promo">Afficher UNIQUEMENT si l'article est en promotion</option>
              <option value="has_barcode">Afficher UNIQUEMENT si le code-barres est renseigné</option>
              <option value="has_tiers">Afficher UNIQUEMENT si des paliers de prix existent</option>
              <option value="field_gt_zero">Afficher si la valeur numérique est &gt; 0</option>
              <option value="field_not_empty">Afficher si le champ n'est pas vide</option>
            </select>
          </div>
        </div>

        {/* PRINT FINISH & DIE-CUT MASKS */}
        <div className="pt-2 border-t border-slate-200 space-y-2">
          <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1">
            <Scissors className="w-3.5 h-3.5" />
            <span>Finition & Masque d'Impression</span>
          </h4>
          <div>
            <label className="text-[11px] text-slate-500">Traitement spécial / Finition</label>
            <select
              value={selectedItem.finish_effect || 'none'}
              onChange={(e) => update({ finish_effect: e.target.value as any })}
              className="w-full mt-0.5 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="none">Standard (Impression quadrichromie)</option>
              <option value="die_cut">Repère visuel de découpe (éditeur uniquement)</option>
              <option value="spot_varnish">Repère visuel de vernis (éditeur uniquement)</option>
              <option value="hot_foil">Repère visuel de dorure (éditeur uniquement)</option>
            </select>
            <p className="mt-1 text-[10px] text-amber-700">
              Ces effets ne créent pas de tracé, de séparation ni de calque dans les exports.
            </p>
          </div>
        </div>

        {/* SEMANTIC SNAPPING (Aimant Sémantique) */}
        <div className="pt-2 border-t border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1.5">
              <Magnet className="w-3.5 h-3.5 text-indigo-600" />
              <span>Aimant Sémantique (Snapping Lié)</span>
            </h4>
            {selectedItem.semantic_snap && (
              <button
                type="button"
                onClick={() => update({ semantic_snap: undefined })}
                className="text-[10px] text-rose-600 hover:text-rose-700 underline font-medium"
              >
                Détacher
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={Boolean(selectedItem.semantic_snap)}
              onChange={(e) => {
                if (e.target.checked) {
                  const potentialParent = allItems.find((i) => i.id !== selectedItem.id);
                  update({
                    semantic_snap: {
                      parent_id: potentialParent ? potentialParent.id : '',
                      anchor_edge: 'bottom',
                      offset_mm: 2.0,
                    },
                  });
                } else {
                  update({ semantic_snap: undefined });
                }
              }}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Asservir la boîte à un élément parent</span>
          </label>

          {selectedItem.semantic_snap && (
            <div className="p-2.5 bg-indigo-50/60 rounded-lg border border-indigo-200 space-y-2">
              <div>
                <label className="text-[11px] text-indigo-900 font-medium flex items-center gap-1">
                  <Link2 className="w-3 h-3 text-indigo-600" />
                  <span>Élément Parent de Référence</span>
                </label>
                <select
                  value={selectedItem.semantic_snap.parent_id}
                  onChange={(e) =>
                    update({
                      semantic_snap: {
                        ...selectedItem.semantic_snap!,
                        parent_id: e.target.value,
                      },
                    })
                  }
                  className="w-full mt-1 px-2 py-1.5 bg-white border border-indigo-300 rounded text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Sélectionner un élément --</option>
                  {allItems
                    .filter((it) => it.id !== selectedItem.id)
                    .map((it) => {
                      const label =
                        (it as any).text ||
                        (it as any).code ||
                        (it as any).label ||
                        (it as any).binding_key ||
                        it.type;
                      return (
                        <option key={it.id} value={it.id}>
                          {it.id} ({it.type} - {String(label).slice(0, 22)})
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-indigo-900 font-medium">Bord d'ancrage</label>
                  <select
                    value={selectedItem.semantic_snap.anchor_edge}
                    onChange={(e) =>
                      update({
                        semantic_snap: {
                          ...selectedItem.semantic_snap!,
                          anchor_edge: e.target.value as any,
                        },
                      })
                    }
                    className="w-full mt-1 px-2 py-1 bg-white border border-indigo-300 rounded text-xs text-slate-800"
                  >
                    <option value="bottom">En dessous (bottom)</option>
                    <option value="top">Au dessus (top)</option>
                    <option value="right">À droite (right)</option>
                    <option value="left">À gauche (left)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-indigo-900 font-medium">Distance (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedItem.semantic_snap.offset_mm ?? 0}
                    onChange={(e) =>
                      update({
                        semantic_snap: {
                          ...selectedItem.semantic_snap!,
                          offset_mm: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full mt-1 px-2 py-1 bg-white border border-indigo-300 rounded text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

              <p className="text-[10px] text-indigo-700 leading-tight">
                💡 Si le parent bouge ou s'élargit, cet élément se déplace de façon synchrone à {selectedItem.semantic_snap.offset_mm} mm.
              </p>
            </div>
          )}
        </div>

        {/* FULL TYPOGRAPHY SECTION FOR TEXT & TIER PRICE ITEMS */}
        {(selectedItem.type === 'text' || selectedItem.type === 'tier_price') && (
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 mb-1.5 uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1">
              <Type className="w-3.5 h-3.5" />
              <span>Typographie & Texte</span>
            </h4>
            {selectedItem.type === 'text' && (
              <div>
                <label className="text-[11px] text-slate-500">Texte / Valeur par défaut</label>
                <textarea
                  rows={2}
                  value={selectedItem.text ?? ''}
                  onChange={(e) => update({ text: e.target.value })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            )}

            {/* Prefix & Suffix */}
            {selectedItem.type === 'text' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500">Préfixe</label>
                  <input
                    type="text"
                    placeholder="ex: Réf: "
                    value={selectedItem.prefix_text || ''}
                    onChange={(e) => update({ prefix_text: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">Suffixe</label>
                  <input
                    type="text"
                    placeholder="ex: TTC"
                    value={selectedItem.suffix_text || ''}
                    onChange={(e) => update({ suffix_text: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>
            )}

            {/* Quick Size Presets & Size Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-slate-500 font-medium">Taille de Police (pt)</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      update({
                        font_size_pt: 10,
                        font_weight: 'normal',
                        font_style: 'normal',
                        text_decoration: 'none',
                        letter_spacing_pt: 0,
                        line_height_multiplier: 1.25,
                        highlight_color: undefined,
                        strikethrough_color: undefined,
                        text_shadow: undefined,
                        subscript_superscript: 'none',
                        text_transform: 'none',
                      });
                    }}
                    title="Effacer le formatage et réinitialiser la typographie"
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.5"
                  min="4"
                  max="120"
                  value={selectedItem.font_size_pt ?? 10}
                  onChange={(e) => update({ font_size_pt: parseFloat(e.target.value) || 10 })}
                  className="w-20 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold"
                />
                <div className="flex-1 flex items-center gap-1 overflow-x-auto pb-0.5">
                  {FONT_SIZE_PRESETS.slice(0, 7).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => update({ font_size_pt: size })}
                      className={`px-1.5 py-0.5 text-[10px] rounded border transition ${
                        selectedItem.font_size_pt === size
                          ? 'bg-blue-600 border-blue-600 text-white font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-slate-400">
                  Transparence
                </h4>
                {([
                  ['background_opacity', 'Arrière-plan'],
                  ['foreground_opacity', 'Objet / premier plan'],
                  ['text_opacity', 'Texte'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="grid grid-cols-[1fr_auto] items-center gap-2 text-[11px] text-slate-600">
                    <span>{label}</span>
                    <span className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedItem[key] ?? 1}
                        onChange={(event) => update({ [key]: parseFloat(event.target.value) })}
                        className="w-24"
                      />
                      <span className="w-8 text-right font-mono">{Math.round((selectedItem[key] ?? 1) * 100)}%</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Police de Caractères</label>
                <select
                  value={selectedItem.font_family || 'Arial'}
                  onChange={(e) => update({ font_family: e.target.value })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                >
                  {AVAILABLE_FONTS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Graisse (Font Weight)</label>
                <select
                  value={selectedItem.font_weight || 'normal'}
                  onChange={(e) => update({ font_weight: e.target.value as any })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                >
                  {FONT_WEIGHTS.map((fw) => (
                    <option key={fw.value} value={fw.value}>
                      {fw.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Styles, Sub/Superscript & Décorations */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-500">Style, Décoration & Indice</label>
              <div className="grid grid-cols-5 gap-1">
                {/* Italic */}
                <button
                  type="button"
                  onClick={() => update({ font_style: selectedItem.font_style === 'italic' ? 'normal' : 'italic' })}
                  className={`py-1 text-center font-serif italic text-xs rounded border ${selectedItem.font_style === 'italic' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'border-slate-200 bg-white'}`}
                  title="Italique"
                >
                  I
                </button>
                {/* Underline */}
                <button
                  type="button"
                  onClick={() => update({ text_decoration: selectedItem.text_decoration === 'underline' ? 'none' : 'underline' })}
                  className={`py-1 text-center underline text-xs rounded border ${selectedItem.text_decoration === 'underline' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'border-slate-200 bg-white'}`}
                  title="Souligné"
                >
                  U
                </button>
                {/* Strikethrough */}
                <button
                  type="button"
                  onClick={() => update({ text_decoration: selectedItem.text_decoration === 'line-through' ? 'none' : 'line-through' })}
                  className={`py-1 text-center line-through text-xs rounded border ${selectedItem.text_decoration === 'line-through' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'border-slate-200 bg-white'}`}
                  title="Barré"
                >
                  S
                </button>
                {/* Subscript */}
                <button
                  type="button"
                  onClick={() =>
                    update({
                      subscript_superscript:
                        selectedItem.subscript_superscript === 'subscript' ? 'none' : 'subscript',
                    })
                  }
                  className={`py-1 flex items-center justify-center text-xs rounded border ${
                    selectedItem.subscript_superscript === 'subscript'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                  title="Indice (Subscript)"
                >
                  <SubscriptIcon className="w-3.5 h-3.5" />
                </button>
                {/* Superscript */}
                <button
                  type="button"
                  onClick={() =>
                    update({
                      subscript_superscript:
                        selectedItem.subscript_superscript === 'superscript' ? 'none' : 'superscript',
                    })
                  }
                  className={`py-1 flex items-center justify-center text-xs rounded border ${
                    selectedItem.subscript_superscript === 'superscript'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                  title="Exposant (Superscript)"
                >
                  <SuperscriptIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Surlignage (Highlight) & Couleur de Texte */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Highlighter className="w-3 h-3 text-amber-500" />
                  <span>Surlignage</span>
                </label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="color"
                    value={selectedItem.highlight_color || '#fef08a'}
                    onChange={(e) => update({ highlight_color: e.target.value })}
                    className="w-7 h-6 p-0 rounded border border-slate-300 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => update({ highlight_color: undefined })}
                    className={`px-1.5 py-1 text-[10px] rounded border ${!selectedItem.highlight_color ? 'bg-slate-200 text-slate-800 font-bold' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    Aucun
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500">Couleur Texte</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="color"
                    value={selectedItem.text_color || '#000000'}
                    onChange={(e) => update({ text_color: e.target.value })}
                    className="w-7 h-6 p-0 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={selectedItem.text_color || '#000000'}
                    onChange={(e) => update({ text_color: e.target.value })}
                    className="flex-1 px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Ombre Portée (Text Shadow) */}
            <div className="space-y-1.5 p-2 bg-slate-50 rounded border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-slate-700 flex items-center gap-1">
                  <Sun className="w-3 h-3 text-slate-500" />
                  <span>Ombre du Texte (Shadow)</span>
                </label>
                <input
                  type="checkbox"
                  checked={Boolean(selectedItem.text_shadow && selectedItem.text_shadow.enabled)}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    update({
                      text_shadow: {
                        enabled,
                        offset_x_px: selectedItem.text_shadow?.offset_x_px ?? 1,
                        offset_y_px: selectedItem.text_shadow?.offset_y_px ?? 1,
                        blur_px: selectedItem.text_shadow?.blur_px ?? 2,
                        color: selectedItem.text_shadow?.color ?? 'rgba(0,0,0,0.4)',
                      },
                    });
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </div>

              {selectedItem.text_shadow && selectedItem.text_shadow.enabled && (
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <div>
                    <label className="text-[9px] text-slate-400">X (px)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={selectedItem.text_shadow?.offset_x_px ?? 0}
                      onChange={(e) =>
                        update({
                          text_shadow: {
                            ...selectedItem.text_shadow!,
                            offset_x_px: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-1 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400">Y (px)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={selectedItem.text_shadow?.offset_y_px ?? 0}
                      onChange={(e) =>
                        update({
                          text_shadow: {
                            ...selectedItem.text_shadow!,
                            offset_y_px: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-1 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400">Flou (px)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={selectedItem.text_shadow?.blur_px ?? 0}
                      onChange={(e) =>
                        update({
                          text_shadow: {
                            ...selectedItem.text_shadow!,
                            blur_px: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-1 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400">Couleur</label>
                    <input
                      type="color"
                      value={selectedItem.text_shadow?.color || '#000000'}
                      onChange={(e) =>
                        update({
                          text_shadow: {
                            ...selectedItem.text_shadow!,
                            color: e.target.value,
                          },
                        })
                      }
                      className="w-full h-6 p-0 rounded border border-slate-300 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Transformations & Spacing */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Casse / Transform</label>
                <select
                  value={selectedItem.text_transform || 'none'}
                  onChange={(e) => update({ text_transform: e.target.value as any })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                >
                  {TEXT_TRANSFORMS.map((tt) => (
                    <option key={tt.value} value={tt.value}>
                      {tt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Interlettrage (pt)</label>
                <input
                  type="number"
                  step="0.2"
                  min="-2"
                  max="10"
                  value={selectedItem.letter_spacing_pt || 0}
                  onChange={(e) => update({ letter_spacing_pt: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Interligne (Line Height)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.8"
                  max="3"
                  value={selectedItem.line_height_multiplier || 1.2}
                  onChange={(e) => update({ line_height_multiplier: parseFloat(e.target.value) || 1.2 })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Couleur Texte</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="color"
                    value={selectedItem.text_color || '#000000'}
                    onChange={(e) => update({ text_color: e.target.value })}
                    className="w-8 h-7 p-0 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={selectedItem.text_color || '#000000'}
                    onChange={(e) => update({ text_color: e.target.value })}
                    className="flex-1 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Alignments */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Alignement H</label>
                <div className="flex items-center gap-1 mt-0.5 bg-slate-100 p-0.5 rounded border border-slate-200">
                  <button
                    type="button"
                    onClick={() => update({ alignment: 'left' })}
                    className={`flex-1 py-1 flex justify-center rounded ${selectedItem.alignment === 'left' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-600'}`}
                    title="Gauche"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ alignment: 'center' })}
                    className={`flex-1 py-1 flex justify-center rounded ${selectedItem.alignment === 'center' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-600'}`}
                    title="Centré"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ alignment: 'right' })}
                    className={`flex-1 py-1 flex justify-center rounded ${selectedItem.alignment === 'right' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-600'}`}
                    title="Droite"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ alignment: 'justify' })}
                    className={`flex-1 py-1 flex justify-center rounded ${selectedItem.alignment === 'justify' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-600'}`}
                    title="Justifié"
                  >
                    <AlignJustify className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Alignement V</label>
                <select
                  value={selectedItem.valign || 'top'}
                  onChange={(e) => update({ valign: e.target.value as any })}
                  className="w-full mt-0.5 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
                >
                  {VERTICAL_ALIGNMENTS.map((va) => (
                    <option key={va.value} value={va.value}>
                      {va.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Box styling for text */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[11px] text-slate-500">Fond de bloc</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="color"
                    value={selectedItem.fill_color || '#ffffff'}
                    onChange={(e) => update({ fill_color: e.target.value })}
                    className="w-8 h-7 p-0 rounded border border-slate-300 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => update({ fill_color: undefined })}
                    className="text-[10px] text-slate-500 hover:text-slate-800 underline ml-1"
                  >
                    Transparent
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Bordure & Arrondi (mm)</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    placeholder="Épaisseur"
                    value={selectedItem.border_width || 0}
                    onChange={(e) => update({ border_width: parseFloat(e.target.value) || 0 })}
                    className="w-14 px-1 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                  />
                  <input
                    type="number"
                    min="0"
                    max="20"
                    placeholder="Arrondi"
                    value={selectedItem.corner_radius || 0}
                    onChange={(e) => update({ corner_radius: parseFloat(e.target.value) || 0 })}
                    className="w-14 px-1 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>
            </div>

            {/* ATTACHED CURRENCY / PRICE INDEPENDENT TYPOGRAPHY (PRICE-RELATED ELEMENTS ONLY) */}
            {selectedItem.type === 'text' && isPriceRelatedElement(selectedItem) && (
              <div className="pt-3 border-t border-dashed border-slate-300 space-y-2.5 bg-slate-50/60 p-2.5 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-bold text-slate-800 text-xs">Devise Associée & Prix</span>
                </div>
                <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedItem.is_price || selectedItem.currency_symbol)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (!checked) {
                        update({
                          is_price: false,
                          currency_symbol: undefined,
                          currency_position: undefined,
                          currency_font_family: undefined,
                          currency_font_size_pt: undefined,
                          currency_font_weight: undefined,
                          currency_font_style: undefined,
                          currency_color: undefined,
                          currency_spacing_pt: undefined,
                        });
                      } else {
                        update({
                          is_price: true,
                          currency_symbol: selectedItem.currency_symbol || 'FCFA',
                        });
                      }
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Activer Devise</span>
                </label>
              </div>

              {(selectedItem.is_price || selectedItem.currency_symbol) && (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium">Symbole Devise</label>
                      <select
                        value={selectedItem.currency_symbol || 'FCFA'}
                        onChange={(e) => update({ currency_symbol: e.target.value })}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-emerald-800"
                      >
                        {CURRENCY_SYMBOLS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-500 font-medium">Position Devise</label>
                      <select
                        value={selectedItem.currency_position || 'after'}
                        onChange={(e) => update({ currency_position: e.target.value as any })}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      >
                        <option value="after">Après le prix (ex: 2 500 FCFA)</option>
                        <option value="before">Avant le prix (ex: $ 25.00)</option>
                        <option value="superscript">Exposant / Haut (ex: 2500 ᶠᶜᶠᵃ)</option>
                        <option value="subscript">Indice / Bas (ex: 2500 ₍FCFA₎)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500">Police Devise</label>
                      <select
                        value={selectedItem.currency_font_family || selectedItem.font_family}
                        onChange={(e) => update({ currency_font_family: e.target.value })}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      >
                        <option value="">(Identique au prix)</option>
                        {AVAILABLE_FONTS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-500">Taille Devise (pt)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="4"
                        max="80"
                        placeholder={String(Math.round(selectedItem.font_size_pt * 0.6))}
                        value={selectedItem.currency_font_size_pt || ''}
                        onChange={(e) => update({ currency_font_size_pt: parseFloat(e.target.value) || undefined })}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500">Graisse Devise</label>
                      <select
                        value={selectedItem.currency_font_weight || ''}
                        onChange={(e) => update({ currency_font_weight: (e.target.value as any) || undefined })}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      >
                        <option value="">(Identique au prix)</option>
                        {FONT_WEIGHTS.map((fw) => (
                          <option key={fw.value} value={fw.value}>
                            {fw.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-500">Couleur Devise</label>
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="color"
                          value={selectedItem.currency_color || selectedItem.text_color || '#000000'}
                          onChange={(e) => update({ currency_color: e.target.value })}
                          className="w-7 h-6 p-0 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          placeholder="(Auto)"
                          value={selectedItem.currency_color || ''}
                          onChange={(e) => update({ currency_color: e.target.value || undefined })}
                          className="flex-1 px-1.5 py-1 bg-white border border-slate-300 rounded text-[11px] font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* RETAIL AUTOMATION & DYNAMIC CALCULATIONS */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <h5 className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                  <Calculator className="w-3 h-3 text-sky-600" />
                  <span>Automatisation Métier & Calculs</span>
                </h5>
                <div>
                  <label className="text-[11px] text-slate-500">Mode de Calcul</label>
                  <select
                    value={selectedItem.calculation_mode || 'none'}
                    onChange={(e) => {
                      const mode = e.target.value as any;
                      update({
                        calculation_mode: mode,
                        unit_price_config:
                          mode === 'unit_price'
                            ? selectedItem.unit_price_config || {
                                enabled: true,
                                weight_volume_key: 'NET_WEIGHT_KG',
                                measure_unit: 'kg',
                              }
                            : selectedItem.unit_price_config,
                        secondary_currency_config:
                          mode === 'secondary_currency'
                            ? selectedItem.secondary_currency_config || {
                                enabled: true,
                                target_currency: 'EUR',
                                exchange_rate: 655.957,
                                mode: 'divide',
                              }
                            : selectedItem.secondary_currency_config,
                        dynamic_date_config:
                          mode === 'dynamic_date'
                            ? selectedItem.dynamic_date_config || {
                                enabled: true,
                                date_type: 'dlc',
                                offset_days: 3,
                                format: 'DD/MM/YYYY',
                                prefix_label: "À consommer jusqu'au :",
                              }
                            : selectedItem.dynamic_date_config,
                      });
                    }}
                    className="w-full mt-0.5 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
                  >
                    <option value="none">Aucun (Texte ou Prix standard)</option>
                    <option value="unit_price">Calcul Automatique Prix au Kg / Litre</option>
                    <option value="discount_pct">Calcul Automatique Taux de Remise (%)</option>
                    <option value="secondary_currency">Double Affichage & Conversion Devise</option>
                    <option value="dynamic_date">Calculateur de Dates Dynamiques (DLC / DLUO)</option>
                  </select>
                </div>

                {/* Specific configs based on mode */}
                {selectedItem.calculation_mode === 'unit_price' && (
                  <div className="p-2 bg-sky-50/70 border border-sky-200 rounded space-y-2 mt-1">
                    <div>
                      <label className="text-[10px] font-bold text-sky-900">Champ Poids / Volume / Colisage</label>
                      <select
                        value={selectedItem.unit_price_config?.weight_volume_key || 'NET_WEIGHT_KG'}
                        onChange={(e) =>
                          update({
                            unit_price_config: {
                              ...selectedItem.unit_price_config!,
                              weight_volume_key: e.target.value,
                              enabled: true,
                            },
                          })
                        }
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-sky-300 rounded text-xs"
                      >
                        <option value="NET_WEIGHT_KG">NET_WEIGHT_KG (Poids Net en kg)</option>
                        <option value="VOLUME_L">VOLUME_L (Volume Net en Litres)</option>
                        <option value="CASE_SIZE">CASE_SIZE (Colisage / Nb pièces)</option>
                        <option value="PACK_UNIT">PACK_UNIT (Format texte e.g. 250g)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-sky-900">Unité Cible</label>
                      <select
                        value={selectedItem.unit_price_config?.measure_unit || 'kg'}
                        onChange={(e) =>
                          update({
                            unit_price_config: {
                              ...selectedItem.unit_price_config!,
                              measure_unit: e.target.value as any,
                              enabled: true,
                            },
                          })
                        }
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-sky-300 rounded text-xs"
                      >
                        <option value="kg">au Kilogramme (kg)</option>
                        <option value="g">au Gramme (g)</option>
                        <option value="L">au Litre (L)</option>
                        <option value="cl">au Centilitre (cl)</option>
                        <option value="ml">au Millilitre (ml)</option>
                        <option value="piece">à la Pièce (pc)</option>
                        <option value="carton">au Carton</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedItem.calculation_mode === 'secondary_currency' && (
                  <div className="p-2 bg-emerald-50/70 border border-emerald-200 rounded space-y-2 mt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-emerald-900">Devise Cible</label>
                        <input
                          type="text"
                          value={selectedItem.secondary_currency_config?.target_currency || 'EUR'}
                          onChange={(e) =>
                            update({
                              secondary_currency_config: {
                                ...selectedItem.secondary_currency_config!,
                                target_currency: e.target.value,
                                enabled: true,
                              },
                            })
                          }
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-emerald-300 rounded text-xs font-mono uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-emerald-900">Taux Conversion</label>
                        <input
                          type="number"
                          step="0.001"
                          value={selectedItem.secondary_currency_config?.exchange_rate || 655.957}
                          onChange={(e) =>
                            update({
                              secondary_currency_config: {
                                ...selectedItem.secondary_currency_config!,
                                exchange_rate: parseFloat(e.target.value) || 1,
                                enabled: true,
                              },
                            })
                          }
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-emerald-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-emerald-900">Opération</label>
                      <select
                        value={selectedItem.secondary_currency_config?.mode || 'divide'}
                        onChange={(e) =>
                          update({
                            secondary_currency_config: {
                              ...selectedItem.secondary_currency_config!,
                              mode: e.target.value as any,
                              enabled: true,
                            },
                          })
                        }
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-emerald-300 rounded text-xs"
                      >
                        <option value="divide">Diviser (ex: FCFA ÷ 655.957 = EUR)</option>
                        <option value="multiply">Multiplier (ex: EUR × 1.08 = USD)</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedItem.calculation_mode === 'dynamic_date' && (
                  <div className="p-2 bg-amber-50/70 border border-amber-200 rounded space-y-2 mt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-amber-900">Type de Date</label>
                        <select
                          value={selectedItem.dynamic_date_config?.date_type || 'dlc'}
                          onChange={(e) =>
                            update({
                              dynamic_date_config: {
                                ...selectedItem.dynamic_date_config!,
                                date_type: e.target.value as any,
                                enabled: true,
                              },
                            })
                          }
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-amber-300 rounded text-xs"
                        >
                          <option value="dlc">DLC (Péremption Frais)</option>
                          <option value="dluo">DLUO (Durabilité Minimale)</option>
                          <option value="fab_date">Date de Fabrication / Emballage</option>
                          <option value="today">Date du Jour</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-amber-900">Décalage (Jours)</label>
                        <input
                          type="number"
                          step="1"
                          value={selectedItem.dynamic_date_config?.offset_days ?? 3}
                          onChange={(e) =>
                            update({
                              dynamic_date_config: {
                                ...selectedItem.dynamic_date_config!,
                                offset_days: parseInt(e.target.value, 10) || 0,
                                enabled: true,
                              },
                            })
                          }
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-amber-300 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-amber-900">Libellé Préfixe</label>
                      <input
                        type="text"
                        value={selectedItem.dynamic_date_config?.prefix_label || ''}
                        onChange={(e) =>
                          update({
                            dynamic_date_config: {
                              ...selectedItem.dynamic_date_config!,
                              prefix_label: e.target.value,
                              enabled: true,
                            },
                          })
                        }
                        placeholder="ex: À consommer jusqu'au :"
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-amber-300 rounded text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        )}

        {/* SHAPE SPECIFIC */}
        {(selectedItem.type === 'shape' || selectedItem.type === 'ellipse') && (
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 mb-1.5 uppercase text-[10px] tracking-wider text-slate-400">
              Style de la Forme
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Couleur de fond</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="color"
                    value={selectedItem.fill_color || '#ffffff'}
                    onChange={(e) => update({ fill_color: e.target.value })}
                    className="w-8 h-7 p-0 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={selectedItem.fill_color || '#ffffff'}
                    onChange={(e) => update({ fill_color: e.target.value })}
                    className="flex-1 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Couleur bordure</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="color"
                    value={selectedItem.border_color || '#000000'}
                    onChange={(e) => update({ border_color: e.target.value })}
                    className="w-8 h-7 p-0 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={selectedItem.border_color || '#000000'}
                    onChange={(e) => update({ border_color: e.target.value })}
                    className="flex-1 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono uppercase"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Épaisseur bordure (px)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={selectedItem.border_width || 1}
                  onChange={(e) => update({ border_width: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs"
                />
              </div>
              {selectedItem.type === 'shape' && (
                <div>
                  <label className="text-[11px] text-slate-500">Rayon coins (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={(selectedItem as ShapeItemProperties).corner_radius || 0}
                    onChange={(e) => update({ corner_radius: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* LINE SPECIFIC */}
        {selectedItem.type === 'line' && (
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 mb-1.5 uppercase text-[10px] tracking-wider text-slate-400">
              Paramètres de la Ligne
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Couleur du trait</label>
                <input
                  type="color"
                  value={selectedItem.color || '#000000'}
                  onChange={(e) => update({ color: e.target.value })}
                  className="w-full h-7 p-0 rounded border border-slate-300 cursor-pointer mt-0.5"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Épaisseur (px)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={selectedItem.thickness || 1}
                  onChange={(e) => update({ thickness: parseFloat(e.target.value) || 1 })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Style du trait</label>
              <select
                value={selectedItem.style}
                onChange={(e) => update({ style: e.target.value as any })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
              >
                <option value="solid">Trait continu (Solid)</option>
                <option value="dashed">Tirets (Dashed)</option>
                <option value="dotted">Pointillés (Dotted)</option>
              </select>
            </div>
          </div>
        )}

        {/* BARCODE SPECIFIC */}
        {selectedItem.type === 'barcode' && (
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 mb-1.5 uppercase text-[10px] tracking-wider text-slate-400">
              Paramètres Code-Barres
            </h4>
            <div>
              <label className="text-[11px] text-slate-500">Type de Code-barres</label>
              <select
                value={selectedItem.barcode_type || 'auto'}
                onChange={(e) => update({ barcode_type: e.target.value as any })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
              >
                {BARCODE_SYMBOLOGIES.map((symbology) => (
                  <option key={symbology} value={symbology}>
                    {BARCODE_SYMBOLOGY_LABELS[symbology]}
                    {['qrcode', 'datamatrix', 'pdf417', 'micropdf417', 'azteccode', 'maxicode'].includes(symbology)
                      ? ' · aperçu'
                      : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Code par défaut (si non lié)</label>
              <input
                type="text"
                value={selectedItem.code || ''}
                onChange={(e) => update({ code: e.target.value })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs"
              />
            </div>
            {['gs1_128', 'databarexpanded', 'gs1_qrcode', 'gs1_datamatrix'].includes(selectedItem.barcode_type || '') && (
              <button
                type="button"
                onClick={() => setIsGs1WizardOpen(true)}
                className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                Build GS1 content
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Couleur des Barres</label>
                <input
                  type="color"
                  value={selectedItem.bar_color || '#000000'}
                  onChange={(e) => update({ bar_color: e.target.value })}
                  className="w-full h-7 p-0 rounded border border-slate-300 cursor-pointer mt-0.5"
                />
              </div>
              <div className="flex items-center pt-4">
                <label className="text-[11px] text-slate-600 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedItem.show_text)}
                    onChange={(e) => update({ show_text: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Afficher texte</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* QR CODE SPECIFIC */}
        {selectedItem.type === 'qrcode' && (
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 mb-1.5 uppercase text-[10px] tracking-wider text-slate-400">
              Paramètres QR Code
            </h4>
            <div>
              <label className="text-[11px] text-slate-500">Contenu / URL</label>
              <input
                type="text"
                value={selectedItem.content || ''}
                onChange={(e) => update({ content: e.target.value })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsTypedQrWizardOpen(true)}
              className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 transition hover:bg-blue-100"
            >
              Build typed QR content
            </button>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Couleur modules</label>
                <input
                  type="color"
                  value={selectedItem.module_color || '#000000'}
                  onChange={(e) => update({ module_color: e.target.value })}
                  className="w-full h-7 p-0 rounded border border-slate-300 cursor-pointer mt-0.5"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Couleur fond</label>
                <input
                  type="color"
                  value={selectedItem.background_color || '#ffffff'}
                  onChange={(e) => update({ background_color: e.target.value })}
                  className="w-full h-7 p-0 rounded border border-slate-300 cursor-pointer mt-0.5"
                />
              </div>
            </div>
          </div>
        )}

        {/* RESTRICTED AREA SPECIFIC */}
        {selectedItem.type === 'restricted_area' && (
          <div className="pt-2 border-t border-slate-200 space-y-3 bg-rose-50/40 p-3 rounded-lg border border-rose-200">
            <h4 className="font-bold text-rose-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Zone de Contrainte / Masquage</span>
            </h4>
            <div>
              <label className="text-[11px] text-slate-600 font-medium">Libellé / Description</label>
              <input
                type="text"
                placeholder="ex: Zone Poinçon / Encoche"
                value={(selectedItem as RestrictedAreaItemProperties).label || ''}
                onChange={(e) => update({ label: e.target.value })}
                className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-600">Motif de Hachure</label>
                <select
                  value={(selectedItem as RestrictedAreaItemProperties).pattern || 'diagonal_stripes'}
                  onChange={(e) => update({ pattern: e.target.value as any })}
                  className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                >
                  <option value="diagonal_stripes">Hachures Diagonales</option>
                  <option value="cross">Croisillons (Grille)</option>
                  <option value="solid">Couleur Pleine</option>
                  <option value="outline">Contour Simple</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-600">Couleur d'Alerte</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="color"
                    value={(selectedItem as RestrictedAreaItemProperties).zone_color || '#ef4444'}
                    onChange={(e) => update({ zone_color: e.target.value })}
                    className="w-7 h-6 p-0 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={(selectedItem as RestrictedAreaItemProperties).zone_color || '#ef4444'}
                    onChange={(e) => update({ zone_color: e.target.value })}
                    className="flex-1 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono uppercase"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label className="text-[11px] text-slate-600">Opacité ({Math.round(((selectedItem as RestrictedAreaItemProperties).opacity ?? 0.25) * 100)}%)</label>
              </div>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={(selectedItem as RestrictedAreaItemProperties).opacity ?? 0.25}
                onChange={(e) => update({ opacity: parseFloat(e.target.value) || 0.25 })}
                className="w-full accent-rose-600 mt-1 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={Boolean((selectedItem as RestrictedAreaItemProperties).warn_on_overlap ?? true)}
                  onChange={(e) => update({ warn_on_overlap: e.target.checked })}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span>Alerter si un élément déborde sur cette zone</span>
              </label>
            </div>
          </div>
        )}
        {selectedItem.type === 'curved_text' && (
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 mb-1.5 uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1">
              <CircleDot className="w-3.5 h-3.5 text-blue-600" />
              <span>Texte Circulaire & Arc de Cercle</span>
            </h4>
            <div>
              <label className="text-[11px] text-slate-500">Texte</label>
              <input
                type="text"
                value={(selectedItem as CurvedTextItemProperties).text || ''}
                onChange={(e) => update({ text: e.target.value })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Angle de Départ (°)</label>
                <input
                  type="number"
                  step="5"
                  value={(selectedItem as CurvedTextItemProperties).start_angle_deg ?? 180}
                  onChange={(e) => update({ start_angle_deg: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Angle de Balayage (°)</label>
                <input
                  type="number"
                  step="5"
                  min="10"
                  max="360"
                  value={(selectedItem as CurvedTextItemProperties).sweep_angle_deg ?? 180}
                  onChange={(e) => update({ sweep_angle_deg: parseFloat(e.target.value) || 180 })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Taille Police (pt)</label>
                <input
                  type="number"
                  step="0.5"
                  min="5"
                  value={(selectedItem as CurvedTextItemProperties).font_size_pt || 10}
                  onChange={(e) => update({ font_size_pt: parseFloat(e.target.value) || 10 })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Couleur Texte</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="color"
                    value={(selectedItem as CurvedTextItemProperties).text_color || '#000000'}
                    onChange={(e) => update({ text_color: e.target.value })}
                    className="w-8 h-7 p-0 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={(selectedItem as CurvedTextItemProperties).text_color || '#000000'}
                    onChange={(e) => update({ text_color: e.target.value })}
                    className="flex-1 px-1.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono uppercase"
                  />
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-[11px] pt-1 text-slate-700">
              <input
                type="checkbox"
                checked={(selectedItem as CurvedTextItemProperties).clockwise !== false}
                onChange={(e) => update({ clockwise: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span>Sens horaire (Haut de courbe)</span>
            </label>
          </div>
        )}

        {selectedItem.type === 'pictogram' && (
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 mb-1.5 uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1">
              <Stamp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pictogramme Métier & Réglementaire</span>
            </h4>
            <div>
              <label className="text-[11px] text-slate-500">Type de Pictogramme</label>
              <select
                value={(selectedItem as PictogramItemProperties).pictogram_type || 'nutriscore_a'}
                onChange={(e) => update({ pictogram_type: e.target.value as any })}
                className="w-full mt-0.5 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-500"
              >
                <optgroup label="Nutri-Score Officiel">
                  <option value="nutriscore_a">Nutri-Score A (Vert foncé)</option>
                  <option value="nutriscore_b">Nutri-Score B (Vert clair)</option>
                  <option value="nutriscore_c">Nutri-Score C (Jaune)</option>
                  <option value="nutriscore_d">Nutri-Score D (Orange)</option>
                  <option value="nutriscore_e">Nutri-Score E (Rouge)</option>
                </optgroup>
                <optgroup label="Éco-Score Environnemental">
                  <option value="ecoscore_a">Éco-Score A (Très faible impact)</option>
                  <option value="ecoscore_b">Éco-Score B (Faible impact)</option>
                  <option value="ecoscore_c">Éco-Score C (Impact modéré)</option>
                  <option value="ecoscore_d">Éco-Score D (Impact élevé)</option>
                  <option value="ecoscore_e">Éco-Score E (Très fort impact)</option>
                </optgroup>
                <optgroup label="Origine & Labels Bio">
                  <option value="origin_france">Origine France (Drapeau tricolore)</option>
                  <option value="origin_local">Origine Locale / Régionale</option>
                  <option value="bio_ab">Label AB (Agriculture Biologique)</option>
                  <option value="bio_europe">Euro-feuille (Bio Européen)</option>
                  <option value="triman_recycling">Logo Triman & Bac Jaune</option>
                </optgroup>
                <optgroup label="Allergènes Reconnus">
                  <option value="allergen_gluten">Allergène : GLUTEN</option>
                  <option value="allergen_milk">Allergène : LAIT / LACTOSE</option>
                  <option value="allergen_peanut">Allergène : ARACHIDE</option>
                  <option value="allergen_egg">Allergène : OEUF</option>
                  <option value="allergen_fish">Allergène : POISSON</option>
                  <option value="allergen_crustacean">Allergène : CRUSTACÉS</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Variante Graphique</label>
              <select
                value={(selectedItem as PictogramItemProperties).style_variant || 'color'}
                onChange={(e) => update({ style_variant: e.target.value as any })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
              >
                <option value="color">Couleurs Officielles Complètes</option>
                <option value="monochrome_black">Monochrome 100% Noir (Thermique)</option>
                <option value="badge">Style Badge avec Bordure</option>
              </select>
            </div>
          </div>
        )}

        {selectedItem.type === 'tier_price' && (
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 mb-1.5 uppercase text-[10px] tracking-wider text-slate-400">
              Paliers Cash & Carry
            </h4>
            <div>
              <label className="text-[11px] text-slate-500">Palier Cible (1 à 10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={selectedItem.primary_tier ?? 1}
                onChange={(e) => update({ primary_tier: parseInt(e.target.value, 10) || 1 })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Préfixe quantité</label>
              <input
                type="text"
                value={selectedItem.prefix_text || ''}
                onChange={(e) => update({ prefix_text: e.target.value })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Symbole monétaire</label>
              <input
                type="text"
                value={selectedItem.unit_label || ''}
                onChange={(e) => update({ unit_label: e.target.value })}
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
              />
            </div>

            {/* Sélecteur d'Algorithme de Palier (Pricing Strategy) */}
            <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-200 space-y-1.5">
              <label className="text-[11px] font-bold text-sky-950 flex items-center justify-between">
                <span>Mode de Tarification (Pricing Strategy)</span>
                <span className="text-[10px] text-sky-700 uppercase font-mono">
                  {selectedItem.pricing_strategy === 'graduated' ? 'Progressif' : 'Unitaire'}
                </span>
              </label>
              <select
                value={selectedItem.pricing_strategy || 'flat'}
                onChange={(e) => update({ pricing_strategy: e.target.value as any })}
                className="w-full px-2 py-1.5 bg-white border border-sky-300 rounded text-xs text-sky-950 focus:ring-1 focus:ring-sky-500"
              >
                <option value="flat">Volume Standard (Prix unitaire appliqué à tous les articles)</option>
                <option value="graduated">Tarification Cumulative / Par Tranche (Graduated)</option>
              </select>
              <p className="text-[10px] text-sky-700 leading-tight">
                {selectedItem.pricing_strategy === 'graduated'
                  ? '⚡ Chaque tranche de quantité est calculée avec son propre barème de prix.'
                  : '📦 Dès que le palier est atteint, tout le panier bénéficie du prix réduit.'}
              </p>
            </div>

            {/* Paliers Conditionnels Croisés (Cross-Tiers) */}
            <div className="p-2.5 bg-indigo-50/70 rounded-lg border border-indigo-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-indigo-950">
                <input
                  type="checkbox"
                  checked={Boolean(selectedItem.cross_conditional?.enabled)}
                  onChange={(e) =>
                    update({
                      cross_conditional: {
                        enabled: e.target.checked,
                        trigger_column: selectedItem.cross_conditional?.trigger_column || 'PARENT_BRAND_VOLUME',
                        min_threshold: selectedItem.cross_conditional?.min_threshold ?? 50,
                      },
                    })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Condition Croisée (Cross-Tiers)</span>
              </label>

              {selectedItem.cross_conditional?.enabled && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="text-[10px] text-indigo-900 font-medium">Colonne Déclencheur</label>
                    <input
                      type="text"
                      placeholder="ex: PARENT_BRAND_VOLUME"
                      value={selectedItem.cross_conditional.trigger_column || ''}
                      onChange={(e) =>
                        update({
                          cross_conditional: {
                            ...selectedItem.cross_conditional!,
                            trigger_column: e.target.value,
                          },
                        })
                      }
                      className="w-full mt-0.5 px-2 py-1 bg-white border border-indigo-300 rounded text-xs font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-indigo-900 font-medium">Seuil Minimal</label>
                    <input
                      type="number"
                      value={selectedItem.cross_conditional.min_threshold ?? 50}
                      onChange={(e) =>
                        update({
                          cross_conditional: {
                            ...selectedItem.cross_conditional!,
                            min_threshold: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full mt-0.5 px-2 py-1 bg-white border border-indigo-300 rounded text-xs font-mono text-slate-800"
                    />
                  </div>
                  <p className="text-[10px] text-indigo-700 leading-tight">
                    Le palier promo sera validé uniquement si la colonne atteint ce seuil.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={Boolean(selectedItem.strict_required)}
                  onChange={(e) => update({ strict_required: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span>Strictement requis (Alerte si palier absent)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={Boolean(selectedItem.fallback_to_base_price ?? true)}
                  onChange={(e) => update({ fallback_to_base_price: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span>Repli sur le prix de base si palier absent</span>
              </label>
            </div>
          </div>
        )}

        {/* PRICE BLOCK (Smart Floating Decimal) */}
        {selectedItem.type === 'price_block' && (
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 mb-1.5 uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bloc Prix & Centimes Flottants</span>
            </h4>

            <label className="flex items-center gap-2 text-[11px] text-slate-700">
              <input
                type="checkbox"
                checked={(selectedItem as PriceBlockItemProperties).decimals_enabled !== false}
                onChange={(event) => update({ decimals_enabled: event.target.checked })}
                className="rounded text-blue-600"
              />
              Afficher les centimes / décimales
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-slate-500">
                Format de devise
                <select
                  value={(selectedItem as PriceBlockItemProperties).currency_display || 'symbol'}
                  onChange={(event) => update({ currency_display: event.target.value as PriceBlockItemProperties['currency_display'] })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                >
                  <option value="symbol">Symbole</option>
                  <option value="code">Code monétaire (ISO)</option>
                  <option value="none">Aucune devise</option>
                </select>
              </label>
              <label className="text-[11px] text-slate-500">
                Code monétaire
                <input
                  type="text"
                  value={(selectedItem as PriceBlockItemProperties).currency_code || ''}
                  onChange={(event) => update({ currency_code: event.target.value.trim().toUpperCase() || undefined })}
                  placeholder="EUR, XOF, USD…"
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono uppercase"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(['prefix_text', 'suffix_text'] as const).map((key) => (
                <label key={key} className="text-[11px] text-slate-500">
                  {key === 'prefix_text' ? 'Préfixe du prix' : 'Suffixe du prix'}
                  <input
                    type="text"
                    value={(selectedItem as PriceBlockItemProperties)[key] || ''}
                    onChange={(event) => update({ [key]: event.target.value || undefined })}
                    className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                  />
                </label>
              ))}
            </div>

            <label className="flex items-center gap-2 text-[11px] text-slate-700">
              <input
                type="checkbox"
                checked={Boolean((selectedItem as PriceBlockItemProperties).promo_takes_hero_style)}
                onChange={(event) => update({ promo_takes_hero_style: event.target.checked })}
                className="rounded text-blue-600"
              />
              Promo active : remplacer le prix principal et conserver son style
            </label>
            <label className="block text-[11px] text-slate-500">
              Champ prix de comparaison (optionnel)
              <input
                type="text"
                value={(selectedItem as PriceBlockItemProperties).compare_at_binding_key || ''}
                onChange={(event) => update({ compare_at_binding_key: event.target.value.trim() || undefined })}
                placeholder="SELLING_PRICE ou LAST_SELLING_PRICE"
                className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">Segments additionnels du prix</span>
                <button
                  type="button"
                  onClick={() => {
                    const current = (selectedItem as PriceBlockItemProperties).extensions || [];
                    update({
                      extensions: [
                        ...current,
                        {
                          id: `price_extension_${Date.now()}`,
                          role: 'custom',
                          anchor: 'above',
                          fallback: 'hide',
                          style: { font_size_pt: 8, font_weight: 'normal', text_color: '#000000' },
                        },
                      ],
                    });
                  }}
                  className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold"
                >
                  + Ajouter
                </button>
              </div>
              {((selectedItem as PriceBlockItemProperties).extensions || []).map((extension, index) => (
                <details
                  key={extension.id}
                  open
                  className={`bg-slate-50 border rounded ${selectedPriceExtensionId === extension.id ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-200'}`}
                >
                  <summary className="px-2 py-1.5 text-[10px] font-bold text-slate-700 cursor-pointer">
                    Segment {index + 1} · {extension.role.replace('_', ' ')}
                  </summary>
                  <div className="p-2 pt-0 space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={extension.enabled !== false}
                      onChange={(event) => {
                        const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                        extensions[index] = { ...extension, enabled: event.target.checked };
                        update({ extensions });
                      }}
                      className="rounded text-blue-600"
                    />
                    Segment actif
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={extension.role}
                      onChange={(event) => {
                        const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                        const role = event.target.value as typeof extension.role;
                        extensions[index] = {
                          ...extension,
                          role,
                          tier_config: role === 'tier_price'
                            ? { ...extension.tier_config, primary_tier: extension.tier_config?.primary_tier || 1 }
                            : extension.tier_config,
                        };
                        update({ extensions });
                      }}
                      className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                    >
                      <option value="promo_price">Prix promotionnel</option>
                      <option value="compare_at">Ancien prix barré</option>
                      <option value="discount_pct">Pourcentage de remise</option>
                      <option value="unit_price">Prix unitaire / kg / L</option>
                      <option value="tier_price">Prix de palier</option>
                      <option value="custom">Champ personnalisé</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => update({
                        extensions: ((selectedItem as PriceBlockItemProperties).extensions || []).filter((_, itemIndex) => itemIndex !== index),
                      })}
                      className="p-1 text-slate-400 hover:text-rose-600"
                      aria-label="Supprimer le segment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-slate-500">
                      Ancrage
                      <select
                        value={extension.anchor}
                        onChange={(event) => {
                          const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                          extensions[index] = { ...extension, anchor: event.target.value as typeof extension.anchor };
                          update({ extensions });
                        }}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      >
                        {['before', 'after', 'above', 'below', 'beside', 'corner'].map((anchor) => (
                          <option key={anchor} value={anchor}>{anchor}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[10px] text-slate-500">
                      Champ lié
                      <input
                        type="text"
                        value={extension.binding_key || ''}
                        onChange={(event) => {
                          const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                          extensions[index] = { ...extension, binding_key: event.target.value || undefined };
                          update({ extensions });
                        }}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ['offset_x_mm', 'Décalage X (mm)'],
                      ['offset_y_mm', 'Décalage Y (mm)'],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="text-[10px] text-slate-500">
                        {label}
                        <input
                          type="number"
                          step="0.1"
                          value={extension[key] ?? 0}
                          onChange={(event) => {
                            const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                            extensions[index] = { ...extension, [key]: Number(event.target.value) || 0 };
                            update({ extensions });
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                        />
                      </label>
                    ))}
                  </div>
                  {['promo_price', 'compare_at', 'discount_pct'].includes(extension.role) && (
                    <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-[10px] text-slate-500">
                        Devise
                        <input
                          type="text"
                          value={extension.currency_symbol || ''}
                          onChange={(event) => {
                            const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                            extensions[index] = { ...extension, currency_symbol: event.target.value || undefined };
                            update({ extensions });
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Décimales
                        <input
                          type="number"
                          min="0"
                          max="4"
                          value={extension.decimals ?? ''}
                          onChange={(event) => {
                            const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                            extensions[index] = { ...extension, decimals: event.target.value ? parseInt(event.target.value, 10) : undefined };
                            update({ extensions });
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Devise
                        <select
                          value={extension.currency_position || 'after'}
                          onChange={(event) => {
                            const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                            extensions[index] = { ...extension, currency_position: event.target.value as typeof extension.currency_position };
                            update({ extensions });
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                        >
                          <option value="before">Avant</option>
                          <option value="after">Après</option>
                          <option value="superscript">Exposant</option>
                          <option value="subscript">Indice</option>
                        </select>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-slate-500">
                        Affichage de devise
                        <select
                          value={extension.currency_display || (selectedItem as PriceBlockItemProperties).currency_display || 'symbol'}
                          onChange={(event) => {
                            const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                            extensions[index] = { ...extension, currency_display: event.target.value as typeof extension.currency_display };
                            update({ extensions });
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                        >
                          <option value="symbol">Symbole</option>
                          <option value="code">Code ISO</option>
                          <option value="none">Aucune</option>
                        </select>
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Code ISO
                        <input
                          type="text"
                          value={extension.currency_code || (selectedItem as PriceBlockItemProperties).currency_code || ''}
                          onChange={(event) => {
                            const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                            extensions[index] = { ...extension, currency_code: event.target.value.trim().toUpperCase() || undefined };
                            update({ extensions });
                          }}
                          placeholder="EUR, XOF…"
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono uppercase"
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={extension.decimals_enabled !== undefined
                          ? extension.decimals_enabled
                          : (selectedItem as PriceBlockItemProperties).decimals_enabled !== false}
                        onChange={(event) => {
                          const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                          extensions[index] = { ...extension, decimals_enabled: event.target.checked };
                          update({ extensions });
                        }}
                        className="rounded text-blue-600"
                      />
                      Décimales pour ce segment (remplace le réglage global)
                    </label>
                    </div>
                  )}
                  <label className="block text-[10px] text-slate-500">
                    Format (facultatif)
                    <input
                      type="text"
                      value={extension.format_pattern || ''}
                      onChange={(event) => {
                        const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                        extensions[index] = { ...extension, format_pattern: event.target.value || undefined };
                        update({ extensions });
                      }}
                      placeholder="{price}, {amount}, {currency}"
                      className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                    />
                  </label>
                  {extension.role === 'tier_price' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-slate-500">
                        Palier
                        <input
                          type="number"
                          min="1"
                          value={extension.tier_config?.primary_tier || 1}
                          onChange={(event) => {
                            const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                            extensions[index] = {
                              ...extension,
                              tier_config: { ...extension.tier_config, primary_tier: parseInt(event.target.value, 10) || 1 },
                            };
                            update({ extensions });
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Stratégie
                        <select
                          value={extension.tier_config?.pricing_strategy || 'flat'}
                          onChange={(event) => {
                            const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                            extensions[index] = {
                              ...extension,
                              tier_config: {
                                ...extension.tier_config,
                                primary_tier: extension.tier_config?.primary_tier || 1,
                                pricing_strategy: event.target.value as 'flat' | 'graduated',
                              },
                            };
                            update({ extensions });
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                        >
                          <option value="flat">Flat</option>
                          <option value="graduated">Graduated</option>
                        </select>
                      </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(['prefix_text', 'unit_label'] as const).map((key) => (
                          <label key={key} className="text-[10px] text-slate-500">
                            {key === 'prefix_text' ? 'Préfixe palier' : 'Unité'}
                            <input
                              type="text"
                              value={extension.tier_config?.[key] || ''}
                              onChange={(event) => {
                                const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                                extensions[index] = {
                                  ...extension,
                                  tier_config: {
                                    ...extension.tier_config,
                                    primary_tier: extension.tier_config?.primary_tier || 1,
                                    [key]: event.target.value || undefined,
                                  },
                                };
                                update({ extensions });
                              }}
                              className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ['strict_required', 'Palier obligatoire'],
                          ['fallback_to_base_price', 'Repli prix de base'],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-1 text-[10px] text-slate-600">
                            <input
                              type="checkbox"
                              checked={Boolean(extension.tier_config?.[key])}
                              onChange={(event) => {
                                const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                                extensions[index] = {
                                  ...extension,
                                  tier_config: {
                                    ...extension.tier_config,
                                    primary_tier: extension.tier_config?.primary_tier || 1,
                                    [key]: event.target.checked,
                                  },
                                };
                                update({ extensions });
                              }}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {(extension.role === 'custom' || extension.role === 'unit_price') && (
                    <label className="block text-[10px] text-slate-500">
                      Texte statique (facultatif)
                      <input
                        type="text"
                        value={extension.text || ''}
                        onChange={(event) => {
                          const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                          extensions[index] = { ...extension, text: event.target.value || undefined };
                          update({ extensions });
                        }}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      />
                    </label>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-slate-500">
                      Condition
                      <select
                        value={extension.condition?.rule || 'always'}
                        onChange={(event) => {
                          const rule = event.target.value as ConditionalDisplayConfig['rule'];
                          const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                          extensions[index] = {
                            ...extension,
                            condition: { enabled: rule !== 'always', rule, field_key: extension.binding_key },
                          };
                          update({ extensions });
                        }}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      >
                        {['always', 'has_promo', 'has_tiers', 'field_gt_zero', 'field_not_empty'].map((rule) => (
                          <option key={rule} value={rule}>{rule}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[10px] text-slate-500">
                      Repli
                      <select
                        value={extension.fallback === 'hide' || !extension.fallback ? 'hide' : 'literal'}
                        onChange={(event) => {
                          const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                          extensions[index] = { ...extension, fallback: event.target.value === 'literal' ? { literal: '' } : 'hide' };
                          update({ extensions });
                        }}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      >
                        <option value="hide">Masquer si absent</option>
                        <option value="literal">Texte de remplacement</option>
                      </select>
                    </label>
                  </div>
                  {extension.fallback && typeof extension.fallback === 'object' && (
                    <label className="block text-[10px] text-slate-500">
                      Texte de remplacement
                      <input
                        type="text"
                        value={extension.fallback.literal}
                        onChange={(event) => {
                          const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                          extensions[index] = { ...extension, fallback: { literal: event.target.value } };
                          update({ extensions });
                        }}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      />
                    </label>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[10px] text-slate-500">
                      Taille (pt)
                      <input
                        type="number"
                        min="4"
                        max="96"
                        value={extension.style?.font_size_pt ?? 8}
                        onChange={(event) => {
                          const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                          extensions[index] = { ...extension, style: { ...extension.style, font_size_pt: parseFloat(event.target.value) || 8 } };
                          update({ extensions });
                        }}
                        className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      />
                    </label>
                    <label className="text-[10px] text-slate-500">
                      Couleur
                      <input
                        type="color"
                        value={extension.style?.text_color || '#000000'}
                        onChange={(event) => {
                          const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                          extensions[index] = { ...extension, style: { ...extension.style, text_color: event.target.value } };
                          update({ extensions });
                        }}
                        className="w-full mt-0.5 h-7"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[10px] text-slate-600 pt-4">
                      <input
                        type="checkbox"
                        checked={Boolean(extension.strikethrough)}
                        onChange={(event) => {
                          const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                          extensions[index] = { ...extension, strikethrough: event.target.checked };
                          update({ extensions });
                        }}
                      />
                      Barré
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['prefix_text', 'suffix_text'] as const).map((key) => (
                      <label key={key} className="text-[10px] text-slate-500">
                        {key === 'prefix_text' ? 'Préfixe' : 'Suffixe'}
                        <input
                          type="text"
                          value={extension[key] || ''}
                          onChange={(event) => {
                            const extensions = [...((selectedItem as PriceBlockItemProperties).extensions || [])];
                            extensions[index] = { ...extension, [key]: event.target.value || undefined };
                            update({ extensions });
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                        />
                      </label>
                    ))}
                  </div>
                  </div>
                </details>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Prix Test / Fallback</label>
                <input
                  type="number"
                  step="0.01"
                  value={(selectedItem as PriceBlockItemProperties).fallback_price ?? 29.99}
                  onChange={(e) => update({ fallback_price: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Séparateur Décimal</label>
                <select
                  value={(selectedItem as PriceBlockItemProperties).decimal_separator || ','}
                  onChange={(e) => update({ decimal_separator: e.target.value as any })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                >
                  <option value=",">Virgule (ex: 29,99)</option>
                  <option value=".">Point (ex: 29.99)</option>
                </select>
              </div>
            </div>

            {/* Currency Symbol & Position */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500">Symbole Monnaie</label>
                <input
                  type="text"
                  value={(selectedItem as PriceBlockItemProperties).currency_symbol || '€'}
                  onChange={(e) => update({ currency_symbol: e.target.value })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Position Devise</label>
                <select
                  value={(selectedItem as PriceBlockItemProperties).currency_position || 'after'}
                  onChange={(e) => update({ currency_position: e.target.value as any })}
                  className="w-full mt-0.5 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                >
                  <option value="after">Après les centimes (29,99 €)</option>
                  <option value="before">Avant le prix (€ 29,99)</option>
                  <option value="superscript">En exposant haut (29,99 €^)</option>
                  <option value="subscript">En indice bas (29,99 €)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              {([
                { key: 'integer_style', label: 'Entier' },
                { key: 'decimal_style', label: 'Décimales' },
                { key: 'currency_style', label: 'Devise' },
                { key: 'prefix_style', label: 'Préfixe' },
                { key: 'suffix_style', label: 'Suffixe' },
              ] as const).map((segment) => {
                const priceItem = selectedItem as PriceBlockItemProperties;
                const style = priceItem[segment.key] || {};
                const changeStyle = (key: string, value: string | number | undefined) => {
                  update({
                    [segment.key]: { ...style, [key]: value },
                  } as any);
                };
                return (
                  <div key={segment.key} className="p-2 bg-white border border-slate-200 rounded space-y-2">
                    <span className="text-[10px] font-bold text-slate-600">{segment.label}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-slate-500">
                        Police
                        <input
                          type="text"
                          value={style.font_family || ''}
                          onChange={(event) => changeStyle('font_family', event.target.value || undefined)}
                          placeholder={priceItem.font_family || 'Héritée'}
                          className="w-full mt-0.5 px-2 py-1 border border-slate-300 rounded text-xs"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Taille (pt)
                        <input
                          type="number"
                          min="4"
                          max="144"
                          value={style.font_size_pt ?? ''}
                          onChange={(event) => changeStyle('font_size_pt', event.target.value ? parseFloat(event.target.value) : undefined)}
                          className="w-full mt-0.5 px-2 py-1 border border-slate-300 rounded text-xs"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Graisse
                        <select
                          value={style.font_weight || ''}
                          onChange={(event) => changeStyle('font_weight', event.target.value || undefined)}
                          className="w-full mt-0.5 px-2 py-1 border border-slate-300 rounded text-xs"
                        >
                          <option value="">Héritée</option>
                          <option value="normal">Normal</option>
                          <option value="500">500</option>
                          <option value="600">600</option>
                          <option value="bold">Gras</option>
                          <option value="800">800</option>
                        </select>
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Style
                        <select
                          value={style.font_style || ''}
                          onChange={(event) => changeStyle('font_style', event.target.value || undefined)}
                          className="w-full mt-0.5 px-2 py-1 border border-slate-300 rounded text-xs"
                        >
                          <option value="">Hérité</option>
                          <option value="normal">Normal</option>
                          <option value="italic">Italique</option>
                        </select>
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Couleur
                        <input
                          type="color"
                          value={style.text_color || '#000000'}
                          onChange={(event) => changeStyle('text_color', event.target.value)}
                          className="w-full mt-0.5 h-7"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Espacement (pt)
                        <input
                          type="number"
                          step="0.1"
                          value={style.letter_spacing_pt ?? ''}
                          onChange={(event) => changeStyle('letter_spacing_pt', event.target.value ? parseFloat(event.target.value) : undefined)}
                          className="w-full mt-0.5 px-2 py-1 border border-slate-300 rounded text-xs"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Ligne de base
                        <select
                          value={style.baseline_shift || 'normal'}
                          onChange={(event) => changeStyle('baseline_shift', event.target.value)}
                          className="w-full mt-0.5 px-2 py-1 border border-slate-300 rounded text-xs"
                        >
                          <option value="normal">Normale</option>
                          <option value="superscript">Exposant</option>
                          <option value="subscript">Indice</option>
                        </select>
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Décoration
                        <select
                          value={style.text_decoration || 'none'}
                          onChange={(event) => changeStyle('text_decoration', event.target.value)}
                          className="w-full mt-0.5 px-2 py-1 border border-slate-300 rounded text-xs"
                        >
                          <option value="none">Aucune</option>
                          <option value="line-through">Barré</option>
                        </select>
                      </label>
                    </div>
                    {style.text_decoration === 'line-through' && (
                      <label className="block text-[10px] text-slate-500">
                        Couleur du barré
                        <input
                          type="color"
                          value={style.strikethrough_color || style.text_color || '#000000'}
                          onChange={(event) => changeStyle('strikethrough_color', event.target.value)}
                          className="w-full mt-0.5 h-7"
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Integer Part Styling */}
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block">Partie Entière (Euros)</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">Taille (pt)</label>
                  <input
                    type="number"
                    step="1"
                    min="8"
                    max="144"
                    value={(selectedItem as PriceBlockItemProperties).integer_style?.font_size_pt || 28}
                    onChange={(e) =>
                      update({
                        integer_style: {
                          ...((selectedItem as PriceBlockItemProperties).integer_style || {}),
                          font_size_pt: parseFloat(e.target.value) || 28,
                        },
                      })
                    }
                    className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Graisse</label>
                  <select
                    value={(selectedItem as PriceBlockItemProperties).integer_style?.font_weight || 'bold'}
                    onChange={(e) =>
                      update({
                        integer_style: {
                          ...((selectedItem as PriceBlockItemProperties).integer_style || {}),
                          font_weight: e.target.value as any,
                        },
                      })
                    }
                    className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="normal">Normal (400)</option>
                    <option value="600">Demi-Gras (600)</option>
                    <option value="bold">Gras (700)</option>
                    <option value="800">Extra-Gras (800)</option>
                    <option value="900">Black (900)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Decimal Part Styling (Floating Centimes) */}
            <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-200 space-y-2">
              <span className="text-[11px] font-bold text-blue-900 block">Centimes Flottants (Décimales)</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">Taille (pt)</label>
                  <input
                    type="number"
                    step="1"
                    min="6"
                    max="96"
                    value={(selectedItem as PriceBlockItemProperties).decimal_style?.font_size_pt || 14}
                    onChange={(e) =>
                      update({
                        decimal_style: {
                          ...((selectedItem as PriceBlockItemProperties).decimal_style || {}),
                          font_size_pt: parseFloat(e.target.value) || 14,
                        },
                      })
                    }
                    className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Positionnement</label>
                  <select
                    value={(selectedItem as PriceBlockItemProperties).decimal_style?.baseline_shift || 'superscript'}
                    onChange={(e) =>
                      update({
                        decimal_style: {
                          ...((selectedItem as PriceBlockItemProperties).decimal_style || {}),
                          baseline_shift: e.target.value as any,
                        },
                      })
                    }
                    className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="superscript">Exposant (Flottant haut)</option>
                    <option value="baseline">Ligne de base</option>
                    <option value="subscript">Indice (bas)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Graisse</label>
                  <select
                    value={(selectedItem as PriceBlockItemProperties).decimal_style?.font_weight || 'bold'}
                    onChange={(e) =>
                      update({
                        decimal_style: {
                          ...((selectedItem as PriceBlockItemProperties).decimal_style || {}),
                          font_weight: e.target.value as any,
                        },
                      })
                    }
                    className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Gras</option>
                    <option value="800">Extra-Gras</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RICH TEXT INSPECTOR */}
        {selectedItem.type === 'rich_text' && (
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1">
                <Type className="w-3.5 h-3.5 text-blue-600" />
                <span>Texte Riche & Runs Typographiques</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  const runs = [...((selectedItem as RichTextItemProperties).runs || [])];
                  runs.push({
                    id: `run_${Date.now()}`,
                    text: 'Nouveau segment',
                    font_weight: 'normal',
                    font_style: 'normal',
                  });
                  update({ runs });
                }}
                className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Segment</span>
              </button>
            </div>

            <div className="space-y-2">
              {((selectedItem as RichTextItemProperties).runs || []).map((run, rIdx) => (
                <div key={run.id || rIdx} className="p-2 bg-slate-50 rounded border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500">Segment #{rIdx + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const runs = ((selectedItem as RichTextItemProperties).runs || []).filter((_, i) => i !== rIdx);
                        update({ runs });
                      }}
                      className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500">Texte</label>
                      <input
                        type="text"
                        value={run.text || ''}
                        onChange={(e) => {
                          const runs = [...((selectedItem as RichTextItemProperties).runs || [])];
                          runs[rIdx] = { ...runs[rIdx], text: e.target.value };
                          update({ runs });
                        }}
                        className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Ou Donnée Liée</label>
                      <select
                        value={run.binding_key || ''}
                        onChange={(e) => {
                          const runs = [...((selectedItem as RichTextItemProperties).runs || [])];
                          runs[rIdx] = { ...runs[rIdx], binding_key: e.target.value || undefined };
                          update({ runs });
                        }}
                        className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-xs"
                      >
                        <option value="">-- Aucun --</option>
                        {availableFields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.key}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500">Taille (pt)</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Défaut"
                        value={run.font_size_pt || ''}
                        onChange={(e) => {
                          const runs = [...((selectedItem as RichTextItemProperties).runs || [])];
                          runs[rIdx] = {
                            ...runs[rIdx],
                            font_size_pt: e.target.value ? parseFloat(e.target.value) : undefined,
                          };
                          update({ runs });
                        }}
                        className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Graisse</label>
                      <select
                        value={run.font_weight || 'normal'}
                        onChange={(e) => {
                          const runs = [...((selectedItem as RichTextItemProperties).runs || [])];
                          runs[rIdx] = { ...runs[rIdx], font_weight: e.target.value as any };
                          update({ runs });
                        }}
                        className="w-full px-1 py-1 bg-white border border-slate-300 rounded text-xs"
                      >
                        <option value="normal">Normal</option>
                        <option value="600">Demi-Gras</option>
                        <option value="bold">Gras</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Position</label>
                      <select
                        value={run.baseline_shift || 'normal'}
                        onChange={(e) => {
                          const runs = [...((selectedItem as RichTextItemProperties).runs || [])];
                          runs[rIdx] = { ...runs[rIdx], baseline_shift: e.target.value as any };
                          update({ runs });
                        }}
                        className="w-full px-1 py-1 bg-white border border-slate-300 rounded text-xs"
                      >
                        <option value="normal">Normale</option>
                        <option value="superscript">Exposant</option>
                        <option value="subscript">Indice</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {isTypedQrWizardOpen && selectedItem.type === 'qrcode' && (
        <TypedQrPayloadWizard
          onClose={() => setIsTypedQrWizardOpen(false)}
          onApply={(content) => {
            update({ content });
            setIsTypedQrWizardOpen(false);
          }}
        />
      )}
      {isGs1WizardOpen && selectedItem.type === 'barcode' && (
        <Gs1PayloadWizard
          initialPayload={selectedItem.code || ''}
          onClose={() => setIsGs1WizardOpen(false)}
          onApply={(payload) => {
            update({ code: payload });
            setIsGs1WizardOpen(false);
          }}
        />
      )}
    </div>
  );
};
