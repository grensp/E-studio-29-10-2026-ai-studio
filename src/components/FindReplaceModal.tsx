import React, { useState, useMemo } from 'react';
import { TemplateItem, TextItemProperties, CurvedTextItemProperties, TierPriceItemProperties, BarcodeItemProperties, QRCodeItemProperties, RestrictedAreaItemProperties, ShapeItemProperties, EllipseItemProperties, LineItemProperties, PictogramItemProperties } from '../types';
import { Search, Replace, X, ArrowLeft, ArrowRight, Check, Type, Palette, FileText } from 'lucide-react';

interface FindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: TemplateItem[];
  selectedItemIds: string[];
  onSelectItems: (ids: string[]) => void;
  onUpdateMultipleItems: (updatedItems: TemplateItem[]) => void;
}

export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({
  isOpen,
  onClose,
  items,
  selectedItemIds,
  onSelectItems,
  onUpdateMultipleItems,
}) => {
  const [searchTarget, setSearchTarget] = useState<'text' | 'font' | 'color'>('text');
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  // Compute matching items
  const matchingItems = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = matchCase ? searchQuery : searchQuery.toLowerCase();

    return items.filter((item) => {
      if (searchTarget === 'text') {
        const textFields: string[] = [];
        if ('text' in item && typeof (item as TextItemProperties).text === 'string') {
          textFields.push((item as TextItemProperties).text);
        }
        if ('code' in item && typeof (item as BarcodeItemProperties).code === 'string') {
          textFields.push((item as BarcodeItemProperties).code);
        }
        if ('content' in item && typeof (item as QRCodeItemProperties).content === 'string') {
          textFields.push((item as QRCodeItemProperties).content);
        }
        if ('prefix_text' in item && typeof (item as TierPriceItemProperties).prefix_text === 'string') {
          textFields.push((item as TierPriceItemProperties).prefix_text);
        }
        if ('unit_label' in item && typeof (item as TierPriceItemProperties).unit_label === 'string') {
          textFields.push((item as TierPriceItemProperties).unit_label);
        }
        if ('label' in item && typeof (item as RestrictedAreaItemProperties).label === 'string') {
          textFields.push((item as RestrictedAreaItemProperties).label || '');
        }

        return textFields.some((val) => {
          const targetStr = matchCase ? val : val.toLowerCase();
          return targetStr.includes(query);
        });
      }

      if (searchTarget === 'font') {
        if ('font_family' in item && typeof (item as TextItemProperties).font_family === 'string') {
          const font = (item as TextItemProperties).font_family;
          const targetStr = matchCase ? font : font.toLowerCase();
          return targetStr.includes(query);
        }
      }

      if (searchTarget === 'color') {
        const colorFields: (string | undefined)[] = [
          (item as TextItemProperties).text_color,
          (item as ShapeItemProperties).fill_color,
          (item as ShapeItemProperties).border_color,
          (item as LineItemProperties).color,
          (item as BarcodeItemProperties).bar_color,
          (item as QRCodeItemProperties).module_color,
          (item as QRCodeItemProperties).background_color,
          (item as RestrictedAreaItemProperties).zone_color,
        ];
        return colorFields.some((c) => {
          if (!c) return false;
          const targetStr = matchCase ? c : c.toLowerCase();
          return targetStr.includes(query);
        });
      }

      return false;
    });
  }, [items, searchQuery, searchTarget, matchCase]);

  const handleNext = () => {
    if (matchingItems.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matchingItems.length;
    setCurrentMatchIndex(nextIdx);
    onSelectItems([matchingItems[nextIdx].id]);
  };

  const handlePrev = () => {
    if (matchingItems.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matchingItems.length) % matchingItems.length;
    setCurrentMatchIndex(prevIdx);
    onSelectItems([matchingItems[prevIdx].id]);
  };

  const performReplaceOnItem = (item: TemplateItem): TemplateItem => {
    const updated = { ...item } as any;

    const regex = new RegExp(
      searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      matchCase ? 'g' : 'gi'
    );

    if (searchTarget === 'text') {
      if (typeof updated.text === 'string') {
        updated.text = updated.text.replace(regex, replaceQuery);
      }
      if (typeof updated.code === 'string') {
        updated.code = updated.code.replace(regex, replaceQuery);
      }
      if (typeof updated.content === 'string') {
        updated.content = updated.content.replace(regex, replaceQuery);
      }
      if (typeof updated.prefix_text === 'string') {
        updated.prefix_text = updated.prefix_text.replace(regex, replaceQuery);
      }
      if (typeof updated.unit_label === 'string') {
        updated.unit_label = updated.unit_label.replace(regex, replaceQuery);
      }
      if (typeof updated.label === 'string') {
        updated.label = updated.label.replace(regex, replaceQuery);
      }
    } else if (searchTarget === 'font') {
      if (typeof updated.font_family === 'string') {
        updated.font_family = replaceQuery || updated.font_family;
      }
    } else if (searchTarget === 'color') {
      const colorProps = ['text_color', 'fill_color', 'border_color', 'color', 'bar_color', 'module_color', 'background_color', 'zone_color'];
      colorProps.forEach((prop) => {
        if (typeof updated[prop] === 'string') {
          updated[prop] = updated[prop].replace(regex, replaceQuery);
        }
      });
    }

    return updated as TemplateItem;
  };

  const handleReplaceCurrent = () => {
    if (matchingItems.length === 0) return;
    const targetItem = matchingItems[currentMatchIndex] || matchingItems[0];
    const updated = performReplaceOnItem(targetItem);
    onUpdateMultipleItems([updated]);

    setFeedback(`1 élément mis à jour`);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleReplaceAll = () => {
    if (matchingItems.length === 0) return;
    const updatedItems = matchingItems.map((item) => performReplaceOnItem(item));
    onUpdateMultipleItems(updatedItems);

    setFeedback(`${updatedItems.length} élément(s) remplacé(s)`);
    setTimeout(() => setFeedback(null), 2500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold">Rechercher & Remplacer Globale</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Target type switcher */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Cible de la recherche</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setSearchTarget('text')}
                className={`py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition ${
                  searchTarget === 'text'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Textes</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchTarget('font')}
                className={`py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition ${
                  searchTarget === 'font'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Polices</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchTarget('color')}
                className={`py-1.5 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition ${
                  searchTarget === 'color'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Couleurs</span>
              </button>
            </div>
          </div>

          {/* Search Query */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              {searchTarget === 'text' && 'Texte à rechercher'}
              {searchTarget === 'font' && 'Nom de la police originale (ex: Arial)'}
              {searchTarget === 'color' && 'Code couleur Hex d\'origine (ex: #000000)'}
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentMatchIndex(0);
              }}
              placeholder={
                searchTarget === 'text'
                  ? 'ex: FCFA ou Libellé'
                  : searchTarget === 'font'
                  ? 'ex: Arial, Inter'
                  : 'ex: #000000'
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
            />
          </div>

          {/* Replace Query */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Remplacer par
            </label>
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder={
                searchTarget === 'text'
                  ? 'ex: EUR ou Nouveau Nom'
                  : searchTarget === 'font'
                  ? 'ex: Plus Jakarta Sans'
                  : 'ex: #0f172a'
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
            />
          </div>

          {/* Options & Matches Count */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Respecter la casse (Match Case)</span>
            </label>

            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              {matchingItems.length > 0
                ? `${currentMatchIndex + 1} / ${matchingItems.length} résultat(s)`
                : '0 résultat'}
            </span>
          </div>

          {feedback && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                disabled={matchingItems.length === 0}
                className="p-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                title="Résultat précédent"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={matchingItems.length === 0}
                className="p-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                title="Résultat suivant"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReplaceCurrent}
                disabled={matchingItems.length === 0}
                className="px-3 py-2 border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold text-xs rounded-lg disabled:opacity-40 transition"
              >
                Remplacer
              </button>
              <button
                type="button"
                onClick={handleReplaceAll}
                disabled={matchingItems.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-xs disabled:opacity-40 transition"
              >
                <Replace className="w-3.5 h-3.5" />
                <span>Tout Remplacer</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
