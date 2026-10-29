import React from 'react';
import { Keyboard, X, Command, Zap } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Édition & Historique',
      shortcuts: [
        { keys: ['Ctrl', 'Z'], label: 'Annuler la dernière action' },
        { keys: ['Ctrl', 'Y'], label: 'Rétablir l\'action annulée' },
        { keys: ['Ctrl', 'F'], label: 'Rechercher & Remplacer global' },
        { keys: ['Ctrl', 'D'], label: 'Dupliquer les éléments sélectionnés' },
        { keys: ['Suppr'], label: 'Supprimer la sélection' },
      ],
    },
    {
      title: 'Sélection & Style',
      shortcuts: [
        { keys: ['Ctrl', 'A'], label: 'Tout sélectionner sur le canevas' },
        { keys: ['Shift', 'Clic'], label: 'Sélection multiple personnalisée' },
        { keys: ['Ctrl', 'Alt', 'C'], label: 'Copier le style de l\'élément' },
        { keys: ['Ctrl', 'Alt', 'V'], label: 'Appliquer le style copié' },
        { keys: ['Ctrl', 'G'], label: 'Verrouiller / Déverrouiller la sélection' },
      ],
    },
    {
      title: 'Positionnement & Alignement',
      shortcuts: [
        { keys: ['Flèches'], label: 'Déplacement précis (1 px ≈ 0.26 mm)' },
        { keys: ['Shift', 'Flèches'], label: 'Déplacement rapide (10 px ≈ 2.65 mm)' },
        { keys: ['Alt', 'Flèches'], label: 'Micro-ajustement (0.10 mm)' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-bold">Raccourcis Clavier Pro</h2>
              <p className="text-[11px] text-slate-400">Guide de productivité studio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {shortcutGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-blue-600" />
                <span>{group.title}</span>
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200/60 overflow-hidden">
                {group.shortcuts.map((sc, sIdx) => (
                  <div key={sIdx} className="px-3.5 py-2 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">{sc.label}</span>
                    <div className="flex items-center gap-1">
                      {sc.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 bg-white border border-slate-300 rounded shadow-2xs font-mono text-[10px] font-bold text-slate-800"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Conseil: Sur macOS, vous pouvez aussi utiliser la touche <Command className="w-3 h-3 inline mx-0.5" /> Cmd</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
