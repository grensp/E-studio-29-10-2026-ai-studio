import React, { useState } from 'react';
import { LabelTemplate, TemplateItem, ProductRecord } from '../types';
import { catalogRepository as databaseService } from '../services/catalogRepository';
import {
  Layers,
  Database,
  Sliders,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Plus,
  Type,
  Square,
  Circle,
  Barcode,
  QrCode,
  Image as ImageIcon,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  MoveUp,
  MoveDown,
  Tag,
  Search,
  Sparkles,
} from 'lucide-react';
import { ContextTooltip } from '../context/TooltipContext';

interface SmartNavTreeSidebarProps {
  template: LabelTemplate;
  selectedItemIds: string[];
  onSelectItem: (itemId: string, multi?: boolean) => void;
  onUpdateItem: (itemId: string, patch: Partial<TemplateItem>) => void;
  onDeleteItem: (itemId: string) => void;
  onDuplicateItem: (itemId: string) => void;
  onReorderItem: (itemId: string, direction: 'up' | 'down') => void;
  onAddNewItem: (itemType: string, customField?: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

function getItemTitle(item: TemplateItem): string {
  if (item.type === 'text') return item.text || 'Texte';
  if (item.type === 'curved_text') return item.text || 'Texte courbé';
  if (item.type === 'barcode') return item.binding_key ? `Barcode: ${item.binding_key}` : `EAN (${item.code})`;
  if (item.type === 'qrcode') return item.binding_key ? `QR: ${item.binding_key}` : 'QR Code';
  if (item.type === 'price_block') return `Prix: ${item.binding_key}`;
  if (item.type === 'pictogram') return `Picto: ${item.pictogram_type}`;
  if (item.type === 'restricted_area') return `Zone: ${item.label}`;
  if (item.binding_key) return `{{${item.binding_key}}}`;
  return item.type;
}

export const SmartNavTreeSidebar: React.FC<SmartNavTreeSidebarProps> = ({
  template,
  selectedItemIds,
  onSelectItem,
  onUpdateItem,
  onDeleteItem,
  onDuplicateItem,
  onReorderItem,
  onAddNewItem,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'data' | 'rules'>('layers');
  const [searchTerm, setSearchTerm] = useState('');

  const sampleProduct: ProductRecord = databaseService.getProducts()[0] || ({} as ProductRecord);

  // Available data catalog fields
  const dataCatalogFields = [
    { key: 'ITEMNAME', label: 'Désignation Produit', sample: sampleProduct.ITEMNAME || 'Café Pur Arabica 250g', type: 'text' },
    { key: 'REGPRICE', label: 'Prix Normal (€)', sample: sampleProduct.REGPRICE ? `${sampleProduct.REGPRICE} €` : '4.50 €', type: 'price' },
    { key: 'DISCPRICE', label: 'Prix Promotionnel (€)', sample: sampleProduct.DISCPRICE ? `${sampleProduct.DISCPRICE} €` : '3.20 €', type: 'price' },
    { key: 'UNIT_PRICE_TEXT', label: 'Prix / Unité (Kilo/Litre)', sample: sampleProduct.UNIT_PRICE_TEXT || '12.80 €/kg', type: 'text' },
    { key: 'PROMOTEXT', label: 'Texte Promotion / Avantage', sample: sampleProduct.PROMOTEXT || '-30% Immédiat', type: 'text' },
    { key: 'BARCODE', label: 'Code-Barres EAN13', sample: sampleProduct.BARCODE || '3250390123456', type: 'barcode' },
    { key: 'QR_CODE_URL', label: 'QR Code Traçabilité / Web', sample: 'https://monmagasin.fr/p/12345', type: 'qrcode' },
    { key: 'ORIGIN', label: 'Origine / Provenance', sample: sampleProduct.ORIGIN || 'France', type: 'text' },
    { key: 'BRAND_INFO', label: 'Marque / Producteur', sample: sampleProduct.BRAND_INFO || 'BioTerroir', type: 'text' },
    { key: 'ECO_TAX', label: 'Éco-Participation', sample: sampleProduct.ECO_TAX ? `${sampleProduct.ECO_TAX} €` : '0.15 €', type: 'text' },
    { key: 'NUTRISCORE', label: 'Nutri-Score', sample: 'A', type: 'badge' },
    { key: 'ENERGY_CLASS', label: 'Classe Énergétique', sample: 'A+++', type: 'badge' },
  ];

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'text':
      case 'curved_text':
        return <Type className="w-3.5 h-3.5 text-blue-400" />;
      case 'price_block':
        return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
      case 'barcode':
        return <Barcode className="w-3.5 h-3.5 text-purple-400" />;
      case 'qrcode':
        return <QrCode className="w-3.5 h-3.5 text-indigo-400" />;
      case 'shape':
        return <Square className="w-3.5 h-3.5 text-amber-400" />;
      case 'ellipse':
        return <Circle className="w-3.5 h-3.5 text-amber-300" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-teal-400" />;
      default:
        return <Tag className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const filteredItems = (template.items || []).filter((it) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const title = getItemTitle(it).toLowerCase();
    return title.includes(term) || it.type.toLowerCase().includes(term);
  });

  const filteredDataFields = dataCatalogFields.filter((f) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return f.key.toLowerCase().includes(term) || f.label.toLowerCase().includes(term);
  });

  // Collapsed Minimalist Dock
  if (isCollapsed) {
    return (
      <aside className="designer-tree w-12 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 select-none shrink-0 z-20 transition-all duration-300">
        <ContextTooltip title="Déplier le panneau latéral" content="Afficher l'arborescence des calques, le catalogue de données et les règles" category="Navigation">
          <button
            onClick={onToggleCollapse}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg mb-4 transition"
            aria-label="Expand Navigation"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </ContextTooltip>

        <div className="flex flex-col gap-2 w-full px-1.5">
          <ContextTooltip title="Calques & Objets" content={`${template.items.length} éléments sur le gabarit`} category="Navigation">
            <button
              onClick={() => {
                setActiveTab('layers');
                onToggleCollapse();
              }}
              className={`w-full py-2.5 rounded-lg flex items-center justify-center transition ${
                activeTab === 'layers' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
            </button>
          </ContextTooltip>

          <ContextTooltip title="Catalogue de Données" content="Champs dynamiques liés au produit" category="Données">
            <button
              onClick={() => {
                setActiveTab('data');
                onToggleCollapse();
              }}
              className={`w-full py-2.5 rounded-lg flex items-center justify-center transition ${
                activeTab === 'data' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Database className="w-4 h-4" />
            </button>
          </ContextTooltip>

          <ContextTooltip title="Règles TCA" content="Conditions d'affichage & promotions" category="Règles">
            <button
              onClick={() => {
                setActiveTab('rules');
                onToggleCollapse();
              }}
              className={`w-full py-2.5 rounded-lg flex items-center justify-center transition ${
                activeTab === 'rules' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4" />
            </button>
          </ContextTooltip>
        </div>

        {/* Quick Add floating trigger */}
        <div className="mt-auto flex flex-col gap-1.5 w-full px-1.5">
          <ContextTooltip title="Ajouter Texte" content="Insérer un nouveau champ texte" category="Ajout">
            <button
              onClick={() => onAddNewItem('text')}
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white flex items-center justify-center transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </ContextTooltip>
        </div>
      </aside>
    );
  }

  // Expanded Smart Tree & Catalog Sidebar
  return (
    <aside className="designer-tree w-72 bg-slate-900 border-r border-slate-800 flex flex-col text-slate-200 select-none shrink-0 z-20 transition-all duration-300 shadow-none">
      {/* Header & Tabs */}
      <div className="p-3 border-b border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <h2 className="font-bold text-xs uppercase tracking-wider text-slate-300">Structure</h2>
          </div>
          <ContextTooltip title="Replier le panneau" content="Gagner plus d'espace sur le canevas (Raccourci: [ )" category="Navigation">
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Collapse Navigation"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </ContextTooltip>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-0.5 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setActiveTab('layers')}
            className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
              activeTab === 'layers'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Calques</span>
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
              activeTab === 'data'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Données</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
              activeTab === 'rules'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Règles</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={activeTab === 'layers' ? 'Filtrer les calques...' : 'Chercher un champ...'}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* Tab 1: Calques & Arborescence */}
      {activeTab === 'layers' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs italic">
              Aucun élément trouvé
            </div>
          ) : (
            // Display items in reverse rendering order (top layer first)
            [...filteredItems].reverse().map((item) => {
              const isSelected = selectedItemIds.includes(item.id);
              const isLocked = !!item.locked;

              return (
                <div
                  key={item.id}
                  onClick={(e) => onSelectItem(item.id, e.shiftKey || e.metaKey || e.ctrlKey)}
                  className={`group px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-1.5 cursor-pointer transition border ${
                    isSelected
                      ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-xs'
                      : 'bg-slate-800/40 border-transparent hover:bg-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="p-1 rounded bg-slate-950/60 shrink-0">
                      {getItemIcon(item.type)}
                    </span>
                    <div className="truncate min-w-0">
                      <div className="font-semibold text-xs truncate leading-tight">
                        {getItemTitle(item)}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {item.type} • {item.x_mm}×{item.y_mm} mm
                      </div>
                    </div>
                  </div>

                  {/* Layer Quick Actions */}
                  <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateItem(item.id, { locked: !isLocked });
                      }}
                      className={`p-1 rounded hover:bg-slate-700 transition ${
                        isLocked ? 'text-amber-400' : 'text-slate-400 hover:text-white'
                      }`}
                      title={isLocked ? 'Déverrouiller' : 'Verrouiller'}
                    >
                      {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderItem(item.id, 'up');
                      }}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
                      title="Monter le calque"
                    >
                      <MoveUp className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderItem(item.id, 'down');
                      }}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
                      title="Descendre le calque"
                    >
                      <MoveDown className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateItem(item.id);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
                      title="Dupliquer"
                    >
                      <Copy className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(item.id);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700 transition"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Catalogue de Données Dynamiques */}
      {activeTab === 'data' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          <div className="p-2 rounded bg-indigo-950/40 border border-indigo-900/60 text-[11px] text-indigo-300 mb-2">
            Cliquez sur un champ pour l'insérer instantanément sur le gabarit.
          </div>

          {filteredDataFields.map((field) => (
            <div
              key={field.key}
              onClick={() => onAddNewItem(field.type, field.key)}
              className="p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 cursor-pointer transition flex items-center justify-between group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-indigo-400 font-bold bg-slate-950 px-1 py-0.5 rounded">
                    {field.key}
                  </span>
                  <span className="text-xs font-semibold text-slate-200 truncate">{field.label}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate italic">
                  Ex: {field.sample}
                </div>
              </div>

              <button
                type="button"
                className="p-1 bg-indigo-600/80 group-hover:bg-indigo-600 text-white rounded opacity-0 group-hover:opacity-100 transition shrink-0"
                title="Insérer ce champ"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Règles TCA & Conditions d'affichage */}
      {activeTab === 'rules' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Condition Promo Active
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                Auto
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Affiche le prix barré et le badge promotionnel uniquement si <code className="text-indigo-300">DISCPRICE &gt; 0</code>.
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-400" />
                Origine & Traçabilité
              </span>
              <span className="text-[10px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                TCA-2
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Positionne automatiquement le pictogramme drapeau selon la valeur du champ <code className="text-indigo-300">ORIGIN</code>.
            </p>
          </div>
        </div>
      )}

      {/* Footer Add Tool */}
      <div className="p-2 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
        <span className="text-slate-400 text-[11px]">
          {template.items.length} élément{template.items.length > 1 ? 's' : ''}
        </span>
        <button
          onClick={() => onAddNewItem('text')}
          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-md flex items-center gap-1 text-[11px] transition shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ajouter</span>
        </button>
      </div>
    </aside>
  );
};
