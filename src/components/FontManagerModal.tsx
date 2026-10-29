import React, { useState } from 'react';
import { CustomFont } from '../types';
import { getLoadedFonts, saveCustomFont, removeCustomFont, registerFontFromFile } from '../utils/fontManager';
import { Type, Plus, Trash2, X, Upload } from 'lucide-react';

interface FontManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFontAdded?: (font: CustomFont) => void;
}

export const FontManagerModal: React.FC<FontManagerModalProps> = ({
  isOpen,
  onClose,
  onFontAdded,
}) => {
  const [fonts, setFonts] = useState<CustomFont[]>(() => getLoadedFonts());
  const [fontName, setFontName] = useState('');
  const [fontUrl, setFontUrl] = useState('');
  const [category, setCategory] = useState<'sans-serif' | 'serif' | 'display' | 'monospace'>('sans-serif');
  const [previewText, setPreviewText] = useState('12.99 € - PRIX PROMO 2+1 OFFERT');
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const font = await registerFontFromFile(files[i]);
        if (onFontAdded) onFontAdded(font);
      }
      setFonts(getLoadedFonts());
    } catch (err: any) {
      setError(`Erreur lors de l'importation de la police : ${err.message || 'Fichier invalide'}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleAddFont = () => {
    if (!fontName.trim()) {
      setError('Veuillez saisir un nom de police.');
      return;
    }

    const newFont: CustomFont = {
      id: `font_${Date.now()}`,
      name: fontName.trim(),
      family: fontName.trim(),
      url: fontUrl.trim() || undefined,
      category,
      source: 'custom_upload',
    };

    saveCustomFont(newFont);
    setFonts(getLoadedFonts());
    if (onFontAdded) onFontAdded(newFont);

    setFontName('');
    setFontUrl('');
    setError(null);
  };

  const handleDeleteFont = (id: string) => {
    removeCustomFont(id);
    setFonts(getLoadedFonts());
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <Type className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Gestionnaire de Polices Typographiques</h2>
              <p className="text-[11px] text-slate-500">Ajoutez des polices web ou personnalisées pour vos étiquettes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Add Font Section */}
          <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
            <div className="font-bold text-indigo-900 text-xs flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ajouter une nouvelle typographie</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Nom de la police *</label>
                <input
                  type="text"
                  value={fontName}
                  onChange={(e) => setFontName(e.target.value)}
                  placeholder="Ex: Montserrat, Oswald..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="sans-serif">Sans-Serif (Bâton)</option>
                  <option value="serif">Serif (Classique)</option>
                  <option value="display">Display / Titrage</option>
                  <option value="monospace">Monospace (Code)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">URL Webfont / Google Font</label>
                <input
                  type="text"
                  value={fontUrl}
                  onChange={(e) => setFontUrl(e.target.value)}
                  placeholder="https://fonts.googleapis.com/..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono text-[11px]"
                />
              </div>
            </div>

            {error && <div className="text-red-600 text-xs font-semibold">{error}</div>}

            <div className="flex items-center justify-between pt-1 border-t border-indigo-100">
              <label className="cursor-pointer px-3 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition">
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploading ? 'Chargement...' : 'Importer fichier (.ttf, .otf, .woff2)'}</span>
                <input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>

              <button
                onClick={handleAddFont}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Installer la Webfont</span>
              </button>
            </div>
          </div>

          {/* Font Preview Controls */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Texte de prévisualisation :</label>
            <input
              type="text"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          {/* Installed Fonts List */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Polices Disponibles ({fonts.length}) :
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {fonts.map((f) => (
                <div
                  key={f.id}
                  className="p-3 border border-slate-200 rounded-xl bg-slate-50/60 hover:bg-white hover:border-slate-300 transition flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 text-xs">{f.name}</span>
                      <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded text-[10px] uppercase">
                        {f.category}
                      </span>
                      {f.source === 'custom_upload' && (
                        <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">
                          Personnalisée
                        </span>
                      )}
                    </div>
                    <div
                      className="text-base text-slate-800 truncate"
                      style={{ fontFamily: f.family }}
                    >
                      {previewText}
                    </div>
                  </div>

                  {f.source === 'custom_upload' && (
                    <button
                      onClick={() => handleDeleteFont(f.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition"
                      title="Supprimer la police"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
