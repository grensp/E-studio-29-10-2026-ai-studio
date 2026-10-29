import React from 'react';
import { LabelTemplate } from '../types';
import { LayoutIssue, analyzeLayoutIssues, autoFixAllLayoutIssues } from '../utils/layoutAutoFix';
import { ShieldCheck, AlertTriangle, AlertCircle, Wand2, CheckCircle2, Eye, RefreshCw } from 'lucide-react';
import { ContextTooltip } from '../context/TooltipContext';

interface LiveValidationSidebarProps {
  template: LabelTemplate;
  onApplyTemplateFix: (updatedTemplate: LabelTemplate) => void;
  onSelectItem?: (itemId: string) => void;
  selectedItemId?: string | null;
}

export const LiveValidationSidebar: React.FC<LiveValidationSidebarProps> = ({
  template,
  onApplyTemplateFix,
  onSelectItem,
  selectedItemId,
}) => {
  const issues = analyzeLayoutIssues(template);

  // Density calculation
  const totalLabelArea = Math.max(1, template.width_mm * template.height_mm);
  const totalItemArea = (template.items || []).reduce((acc, item) => acc + (item.w_mm * item.h_mm), 0);
  const densityPct = Math.min(100, Math.round((totalItemArea / totalLabelArea) * 100));

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  const handleFixSingleIssue = (issue: LayoutIssue) => {
    if (issue.applyFix) {
      const updated = issue.applyFix(template);
      onApplyTemplateFix(updated);
    }
  };

  const handleFixAll = () => {
    const updated = autoFixAllLayoutIssues(template);
    onApplyTemplateFix(updated);
  };

  return (
    <aside className="w-72 bg-white border-l border-slate-200 flex flex-col h-full shadow-xs z-10 shrink-0 select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Validation Directe
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          {errorCount > 0 ? (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errorCount}
            </span>
          ) : null}
          {warningCount > 0 ? (
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {warningCount}
            </span>
          ) : null}
          {errorCount === 0 && warningCount === 0 ? (
            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              0 défaut
            </span>
          ) : null}
        </div>
      </div>

      {/* Metrics & Density Overview */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/50 space-y-2.5">
        <div>
          <div className="flex justify-between items-center text-xs text-slate-600 mb-1 font-medium">
            <span>Densité d'Occupation</span>
            <span className="font-bold text-slate-800">{densityPct}%</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                densityPct > 85 ? 'bg-amber-500' : densityPct > 95 ? 'bg-red-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${densityPct}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
            <span>{template.items?.length || 0} éléments</span>
            <span>{template.width_mm}×{template.height_mm} mm</span>
          </div>
        </div>

        {issues.length > 0 && (
          <ContextTooltip
            title="Auto-Correction Intelligente"
            content="Ajuste automatiquement les débordements, superpositions et contrastes de tous les éléments"
            category="Assistance"
          >
            <button
              onClick={handleFixAll}
              className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Auto-Corriger Tout ({issues.length})</span>
            </button>
          </ContextTooltip>
        )}
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {issues.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 stroke-[1.5]" />
            <p className="text-xs font-semibold text-slate-700">Mise en page optimale</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Aucune collision, débordement ou anomalie de contraste détectée sur le gabarit.
            </p>
          </div>
        ) : (
          issues.map((issue) => {
            const isSelected = selectedItemId === issue.itemId;
            return (
              <div
                key={issue.id}
                className={`p-2.5 rounded-lg border text-xs transition-all ${
                  issue.severity === 'error'
                    ? 'bg-red-50/70 border-red-200 text-red-900'
                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                } ${isSelected ? 'ring-2 ring-indigo-500 shadow-xs' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {issue.severity === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-xs leading-tight">{issue.message}</div>
                    {issue.fixDescription && (
                      <div className="text-[11px] opacity-80 mt-1 italic">
                        Action : {issue.fixDescription}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-200/60">
                  {onSelectItem && (
                    <button
                      onClick={() => onSelectItem(issue.itemId)}
                      className="text-[11px] text-slate-600 hover:text-indigo-600 flex items-center gap-1 font-medium transition"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Cibler</span>
                    </button>
                  )}

                  {issue.autoFixAvailable && (
                    <button
                      onClick={() => handleFixSingleIssue(issue)}
                      className="px-2 py-0.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded font-semibold text-[11px] flex items-center gap-1 shadow-2xs transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Corriger</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
