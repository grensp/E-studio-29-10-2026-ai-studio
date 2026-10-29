import React, { useMemo, useRef, useState } from 'react';
import { Download, FileCode2, Upload, X } from 'lucide-react';
import { desktopFileService } from '../services/desktopFileService';
import { parseZplSource } from '../utils/zplSourceDocument';
import { parseZplVisualModel, updateZplPageSize, updateZplVisualText, ZplVisualTextObject } from '../utils/zplVisualModel';

interface ZplSourceWorkbenchProps {
  isOpen: boolean;
  onClose: () => void;
  initialSource?: string;
  initialFilename?: string;
  onApplySource?: (source: string) => string | void;
  onSourceDraftChange?: (source: string, hasEdits: boolean) => void;
}

export const ZplSourceWorkbench: React.FC<ZplSourceWorkbenchProps> = ({
  isOpen,
  onClose,
  initialSource = '',
  initialFilename = 'label',
  onApplySource,
  onSourceDraftChange,
}) => {
  const previewRef = useRef<SVGSVGElement>(null);
  const dragStartRef = useRef<{
    pointerId: number;
    object: ZplVisualTextObject;
    xDots: number;
    yDots: number;
  } | null>(null);
  const [source, setSource] = useState(initialSource);
  const [originalSource, setOriginalSource] = useState(initialSource);
  const [filename, setFilename] = useState(initialFilename);
  const [message, setMessage] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const document = useMemo(() => parseZplSource(source), [source]);
  const visualModel = useMemo(() => parseZplVisualModel(document), [document]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const hasUnsavedEdits = source !== originalSource;
  const selectedObject = visualModel.objects.find(({ id }) => id === selectedObjectId) || visualModel.objects[0];

  React.useEffect(() => {
    if (!isOpen || !onSourceDraftChange) return;
    const timeout = window.setTimeout(() => onSourceDraftChange(source, source !== originalSource), 250);
    return () => window.clearTimeout(timeout);
  }, [isOpen, onSourceDraftChange, originalSource, source]);

  if (!isOpen) return null;

  const close = () => {
    if (hasUnsavedEdits && !window.confirm('Les modifications source ne sont pas exportées. Fermer quand même ?')) return;
    setSource('');
    setOriginalSource('');
    setMessage(null);
    setSelectedObjectId(null);
    onClose();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (hasUnsavedEdits && !window.confirm('Les modifications source ne sont pas exportées. Remplacer la source actuelle ?')) return;

    setIsReading(true);
    setMessage(null);
    try {
      const bytes = await file.arrayBuffer();
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      setSource(text);
      setOriginalSource(text);
      setSelectedObjectId(null);
      setFilename(file.name.replace(/\.(zpl|txt)$/i, '') || 'label');
      setMessage(`Source chargée : ${file.name}`);
    } catch (error) {
      setMessage(`Impossible de lire le fichier comme UTF-8 valide : ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsReading(false);
    }
  };

  const handleExport = async () => {
    try {
      const path = await desktopFileService.saveText(
        `${filename.replace(/[\\/:*?"<>|]/g, '_')}.zpl`,
        source,
        [{ name: 'Source ZPL', extensions: ['zpl', 'txt'] }]
      );
      if (path) {
        setOriginalSource(source);
        setMessage(`Source ZPL exportée vers ${path}`);
      } else {
        setMessage('Export annulé ou indisponible. La source reste ouverte.');
      }
    } catch (error) {
      setMessage(`Échec de l’export : ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleApplySource = () => {
    if (!onApplySource) return;
    try {
      const result = onApplySource(source);
      setOriginalSource(source);
      setMessage(result || 'La source a été appliquée au canevas.');
    } catch (error) {
      setMessage(`Impossible d’appliquer la source au canevas : ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const updateObject = (object: ZplVisualTextObject, patch: { xDots?: number; yDots?: number; text?: string }) => {
    try {
      setSource(updateZplVisualText(source, object, patch));
      setMessage(null);
    } catch (error) {
      setMessage(`Modification visuelle refusée : ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const updatePageSize = (patch: { widthDots?: number; heightDots?: number }) => {
    try {
      setSource(updateZplPageSize(source, visualModel, patch));
      setMessage(null);
    } catch (error) {
      setMessage(`Modification de page refusée : ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const pointerInDots = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const transformed = point.matrixTransform(matrix.inverse());
    return { xDots: transformed.x, yDots: transformed.y };
  };

  const finishObjectDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragStartRef.current;
    dragStartRef.current = null;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const pointer = pointerInDots(event.currentTarget, event.clientX, event.clientY);
    if (!pointer) return;
    const xDots = Math.max(0, Math.round(drag.object.xDots + pointer.xDots - drag.xDots));
    const yDots = Math.max(0, Math.round(drag.object.yDots + pointer.yDots - drag.yDots));
    if (xDots !== drag.object.xDots || yDots !== drag.object.yDots) {
      updateObject(drag.object, { xDots, yDots });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/25" role="presentation">
      <section
        className="flex h-full w-full flex-col overflow-hidden border-l border-slate-700 bg-slate-900 shadow-2xl sm:w-[68vw] sm:max-w-6xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zpl-source-title"
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <FileCode2 className="h-5 w-5 text-blue-400" />
            <div>
              <h2 id="zpl-source-title" className="font-semibold text-white">Éditeur de source ZPL</h2>
              <p className="text-xs text-slate-400">La source reste autoritaire ; l’aperçu visuel est limité aux commandes prises en charge</p>
            </div>
          </div>
          <button onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-5 py-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">
            <Upload className="h-3.5 w-3.5" />
            {isReading ? 'Lecture…' : 'Importer .zpl / .txt'}
            <input type="file" accept=".zpl,.txt,text/plain" className="hidden" onChange={handleImport} disabled={isReading} />
          </label>
          <input
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
            aria-label="Nom du fichier exporté"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
          />
          <button
            onClick={handleExport}
            disabled={!source}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter la source
          </button>
          {onApplySource && (
            <button
              onClick={handleApplySource}
              disabled={!source}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Appliquer au canevas
            </button>
          )}
          <span className={`text-xs ${hasUnsavedEdits ? 'text-amber-300' : 'text-slate-500'}`}>
            {hasUnsavedEdits ? 'Modifications non exportées' : 'Aucune modification'}
          </span>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
          <div className="grid min-h-0 lg:grid-cols-2">
            <textarea
              value={source}
              onChange={(event) => setSource(event.target.value)}
              aria-label="Contenu source ZPL"
              spellCheck={false}
              placeholder="Importer un fichier ZPL ou coller sa source ici…"
              className="min-h-[16rem] w-full resize-none border-b border-slate-800 bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-200 outline-none lg:border-b-0 lg:border-r"
            />
            <div className="min-h-[16rem] overflow-auto bg-slate-800/50 p-4">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                <span>Aperçu source (dimensions en points imprimante)</span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1">L
                    <input
                      aria-label="Largeur de page en dots"
                      type="number"
                      min="1"
                      value={visualModel.widthDots}
                      disabled={!visualModel.widthRange}
                      onChange={(event) => updatePageSize({ widthDots: Number(event.target.value) })}
                      className="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-1 text-slate-100 disabled:opacity-50"
                    />
                  </label>
                  <label className="flex items-center gap-1">H
                    <input
                      aria-label="Hauteur de page en dots"
                      type="number"
                      min="1"
                      value={visualModel.heightDots}
                      disabled={!visualModel.heightRange}
                      onChange={(event) => updatePageSize({ heightDots: Number(event.target.value) })}
                      className="w-16 rounded border border-slate-600 bg-slate-950 px-1 py-1 text-slate-100 disabled:opacity-50"
                    />
                  </label>
                </div>
              </div>
              <svg
                ref={previewRef}
                viewBox={`0 0 ${visualModel.widthDots} ${visualModel.heightDots}`}
                role="img"
                aria-label="Aperçu des objets texte source ZPL"
                className="mx-auto max-h-64 w-full rounded border border-slate-600 bg-white shadow"
                onPointerUp={finishObjectDrag}
                onPointerCancel={() => { dragStartRef.current = null; }}
              >
                {visualModel.objects.map((object) => (
                  <text
                    key={object.id}
                    x={object.xDots}
                    y={object.yDots + object.fontHeightDots}
                    fontFamily="monospace"
                    fontSize={object.fontHeightDots}
                    transform={object.rotationDegrees ? `rotate(${object.rotationDegrees} ${object.xDots} ${object.yDots})` : undefined}
                    fill="#111827"
                    className={object.editable ? 'cursor-move' : 'cursor-pointer'}
                    onPointerDown={(event) => {
                      setSelectedObjectId(object.id);
                      if (!object.editable) return;
                      event.preventDefault();
                      previewRef.current?.setPointerCapture(event.pointerId);
                      const pointer = previewRef.current && pointerInDots(previewRef.current, event.clientX, event.clientY);
                      if (!pointer) return;
                      dragStartRef.current = {
                        pointerId: event.pointerId,
                        object,
                        xDots: pointer.xDots,
                        yDots: pointer.yDots,
                      };
                    }}
                    aria-label={`${object.text}${object.editable ? '' : ', unsupported for editing'}`}
                  >
                    {object.text}
                  </text>
                ))}
              </svg>
              {selectedObject && (
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_6rem_6rem]">
                  <label className="text-xs text-slate-300">
                    Texte
                    <input
                      value={selectedObject.text}
                      disabled={!selectedObject.editable}
                      onChange={(event) => updateObject(selectedObject, { text: event.target.value })}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-white disabled:opacity-50"
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    X
                    <input
                      type="number"
                      min="0"
                      value={selectedObject.xDots}
                      disabled={!selectedObject.editable}
                      onChange={(event) => updateObject(selectedObject, { xDots: Number(event.target.value) })}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-white disabled:opacity-50"
                    />
                  </label>
                  <label className="text-xs text-slate-300">
                    Y
                    <input
                      type="number"
                      min="0"
                      value={selectedObject.yDots}
                      disabled={!selectedObject.editable}
                      onChange={(event) => updateObject(selectedObject, { yDots: Number(event.target.value) })}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-white disabled:opacity-50"
                    />
                  </label>
                </div>
              )}
              {visualModel.objects.length === 0 && (
                <p className="py-12 text-center text-xs text-slate-500">Aucun objet texte pris en charge pour l’aperçu.</p>
              )}
            </div>
          </div>
          <div className="max-h-36 overflow-auto border-t border-slate-800 px-5 py-3 text-xs">
            <p className="mb-2 text-slate-300">
              {document.segments.length} segments source · {visualModel.objects.length} objet(s) texte · {visualModel.diagnostics.length} avertissement(s)
            </p>
            {visualModel.diagnostics.length > 0 && (
              <ul className="space-y-1 text-amber-300" aria-label="Avertissements de structure">
                {visualModel.diagnostics.map((diagnostic, index) => <li key={`${index}-${diagnostic}`}>{diagnostic}</li>)}
              </ul>
            )}
            <p className="mt-2 text-slate-500">
              Les fichiers UTF-8 valides sont conservés textuellement, y compris leurs espaces et fins de ligne. Les encodages non UTF-8 sont refusés pour éviter une conversion silencieuse.
              L’aperçu visuel ne couvre que les champs texte ^FO/^A0N/^FD sûrs ; les autres commandes restent préservées comme source brute. Les dimensions ne sont modifiables que si ^PW et ^LL sont uniques et numériques.
            </p>
            {onApplySource && (
              <p className="mt-2 text-amber-300">
                L’application réinterprète les objets pris en charge ; les liaisons dynamiques peuvent devenir des valeurs statiques et les champs composites peuvent être aplatis. Vérifiez le canevas avant d’enregistrer ; les commandes non prises en charge restent conservées dans la source ZPL.
              </p>
            )}
            {message && <p className="mt-2 text-slate-300" role="status">{message}</p>}
          </div>
        </div>
      </section>
    </div>
  );
};
