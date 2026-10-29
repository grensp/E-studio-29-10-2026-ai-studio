import React, { useMemo, useState } from 'react';
import { buildGs1ElementString, COMMON_GS1_AI_VALUES, parseGs1ElementString, type Gs1AiValue } from '../utils/gs1Payload';

interface Gs1PayloadWizardProps {
  initialPayload: string;
  onApply: (payload: string) => void;
  onClose: () => void;
}

const FIELD_CLASS = 'w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';

export const Gs1PayloadWizard: React.FC<Gs1PayloadWizardProps> = ({ initialPayload, onApply, onClose }) => {
  const [segments, setSegments] = useState<Gs1AiValue[]>(
    () => parseGs1ElementString(initialPayload)
      || (initialPayload
        ? [{ ai: '', value: initialPayload }]
        : COMMON_GS1_AI_VALUES.map((segment) => ({ ...segment }))),
  );
  const result = useMemo(() => {
    try {
      return { payload: buildGs1ElementString(segments), error: '' };
    } catch (error) {
      return { payload: '', error: error instanceof Error ? error.message : 'Unable to build GS1 content.' };
    }
  }, [segments]);

  const updateSegment = (index: number, patch: Partial<Gs1AiValue>) => {
    setSegments((current) => current.map((segment, at) => at === index ? { ...segment, ...patch } : segment));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="gs1-payload-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="border-b border-slate-200 px-5 py-4">
          <h2 id="gs1-payload-title" className="text-base font-bold text-slate-900">Build GS1 content</h2>
          <p className="mt-1 text-xs text-slate-500">Compose application identifiers and validate the payload with E-studio’s GS1 encoder before applying it.</p>
        </header>
        <div className="space-y-3 overflow-y-auto p-5">
          <datalist id="gs1-ai-suggestions">
            {[...new Set(COMMON_GS1_AI_VALUES.map(({ ai }) => ai).concat([
              '00', '02', '11', '15', '20', '21', '30', '37', '3103', '3922', '414', '420', '422', '423', '8005', '8008',
            ]))].map((ai) => <option key={ai} value={ai} />)}
          </datalist>
          {segments.map((segment, index) => (
            <div key={index} className="grid grid-cols-[6rem_1fr_auto] items-end gap-2">
              <label className="block text-xs font-semibold text-slate-600">
                AI
                <input
                  value={segment.ai}
                  list="gs1-ai-suggestions"
                  inputMode="numeric"
                  aria-label={`Application identifier ${index + 1}`}
                  onChange={(event) => updateSegment(index, { ai: event.target.value })}
                  className={`${FIELD_CLASS} mt-1 font-mono`}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Value
                <input
                  value={segment.value}
                  aria-label={`Value for application identifier ${index + 1}`}
                  onChange={(event) => updateSegment(index, { value: event.target.value })}
                  className={`${FIELD_CLASS} mt-1 font-mono`}
                />
              </label>
              <button
                type="button"
                aria-label={`Remove application identifier ${index + 1}`}
                disabled={segments.length === 1}
                onClick={() => setSegments((current) => current.filter((_, at) => at !== index))}
                className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSegments((current) => [...current, { ai: '10', value: '' }])}
            className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
          >
            Add application identifier
          </button>
          <div aria-live="polite" className={`rounded-lg border p-3 ${result.error ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <p className={`text-xs font-semibold ${result.error ? 'text-rose-800' : 'text-emerald-800'}`}>{result.error || 'Valid GS1 element string'}</p>
            {result.payload && <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-slate-700">{result.payload}</pre>}
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Cancel</button>
          <button type="button" disabled={!result.payload} onClick={() => onApply(result.payload)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Apply GS1 content</button>
        </footer>
      </section>
    </div>
  );
};
