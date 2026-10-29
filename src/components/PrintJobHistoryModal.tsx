import React, { useState, useEffect } from 'react';
import { ImpositionConfig, PrintJob, ProductRecord } from '../types';
import { api } from '../services/api';
import { desktopFileService } from '../services/desktopFileService';
import { ZplExporter } from '../utils/zplExporter';
import { renderImposedPdfJob } from '../utils/pdfJobRenderer';
import {
  Printer,
  History,
  X,
  RefreshCw,
  FileText,
  FileCode,
  Download,
} from 'lucide-react';

interface PrintJobHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrintJobHistoryModal: React.FC<PrintJobHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterFormat, setFilterFormat] = useState<'all' | 'pdf' | 'zpl'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const list = await api.jobList();
      const refreshed: PrintJob[] = [];
      const trackingErrors: string[] = [];
      for (const job of list) {
        if (job.target_kind === 'cups' && job.native_job_id && job.status === 'queued') {
          try {
            refreshed.push(await api.printRefreshJob(job.id));
          } catch (error) {
            refreshed.push(job);
            trackingErrors.push(`${job.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          refreshed.push(job);
        }
      }
      setJobs(refreshed);
      if (trackingErrors.length > 0) {
        setActionMessage(`État CUPS indisponible pour certains travaux : ${trackingErrors.join('; ')}`);
      }
    } catch (err) {
      setActionMessage(`Échec du chargement de l'historique : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadJobs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredJobs = jobs.filter((j) => {
    if (filterFormat !== 'all' && j.format !== filterFormat) return false;
    if (filterStatus !== 'all' && j.status !== filterStatus) return false;
    return true;
  });
  const actionMessageIsError = Boolean(actionMessage && (
    actionMessage.startsWith('Échec') ||
    actionMessage.includes('indisponible') ||
    actionMessage.includes('failed')
  ));

  const handleRetry = async (job: PrintJob) => {
    try {
      const retried = await api.printRetryJob(job.id);
      setJobs((previous) => previous.map((current) => current.id === retried.id ? retried : current));
      if (selectedJob?.id === retried.id) setSelectedJob(retried);
      setActionMessage(
        retried.status === 'queued'
          ? `CUPS a accepté la nouvelle soumission du travail ${job.id}.`
          : `Flux renvoyé au socket de l'imprimante pour ${job.id}; sortie physique non confirmée.`
      );
    } catch (error) {
      setActionMessage(`Échec de la nouvelle tentative : ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleReExport = async (job: PrintJob) => {
    try {
      const filename = `reexport_${job.id}.${job.format}`;
      if (job.format === 'pdf') {
        let artifact: Uint8Array | null = null;
        let artifactReadWarning: string | null = null;
        try {
          if (job.target) artifact = await desktopFileService.readBinaryPath(job.target);
        } catch (error) {
          artifact = null;
          artifactReadWarning = error instanceof Error ? error.message : String(error);
        }

        if (!artifact) {
          let template = job.template_snapshot;
          if (!template && job.template_id) {
            template = await api.templateGetRevision(job.template_id, job.template_revision);
          }
          let products = (job.products_snapshot || job.printed_products) as ProductRecord[] | undefined;
          if ((!products || products.length === 0) && job.product_ids?.length > 0) {
            const currentProducts = await api.catalogSearch('');
            const ids = new Set(job.product_ids);
            products = currentProducts.filter((product) => ids.has(product.id));
            setActionMessage('Snapshot indisponible : ré-export reconstruit depuis les données actuelles.');
          }
          if (!template || !products?.length) {
            throw new Error('Le travail ne contient pas de gabarit et de produits récupérables.');
          }
          const config = JSON.parse(job.imposition_json) as ImpositionConfig;
          if (job.rule_template_snapshots && job.rule_template_snapshots.length !== products.length) {
            throw new Error('The archived rule-processed templates do not match the product snapshot.');
          }
          const doc = renderImposedPdfJob(template, products, config, job.rule_template_snapshots);
          artifact = new Uint8Array(doc.output('arraybuffer'));
        }

        const path = await desktopFileService.saveBinary(
          filename,
          artifact,
          [{ name: 'Document PDF', extensions: ['pdf'] }]
        );
        if (path) {
          setActionMessage(`${artifactReadWarning ? `Fichier source inaccessible (${artifactReadWarning}); ` : ''}PDF ré-exporté vers ${path}. Le statut d'impression original reste inchangé.`);
        }
        return;
      }

      let template = job.template_snapshot;
      let isFallback = false;
      if (!template && job.template_id) {
        template = await api.templateGetRevision(job.template_id, job.template_revision);
        isFallback = true;
      }
      let products = (job.products_snapshot || job.printed_products) as ProductRecord[] | undefined;
      if ((!products || products.length === 0) && job.product_ids?.length > 0) {
        const allProds = await api.catalogSearch('');
        const idSet = new Set(job.product_ids);
        products = allProds.filter((p) => idSet.has(p.id));
        isFallback = true;
      }

      if (isFallback) {
        setActionMessage(`⚠️ Avertissement : ce travail ancien n'a pas de snapshot archivé. Ré-export effectué depuis le catalogue actuel.`);
      }

      if (job.format === 'zpl') {
        if (!template || !products?.length) {
          throw new Error('The job does not contain an archived template and products; a placeholder print file will not be generated.');
        }
        if (job.rule_template_snapshots && job.rule_template_snapshots.length !== products.length) {
          throw new Error('The archived rule-processed templates do not match the product snapshot.');
        }
        const content = ZplExporter.generateBatchZpl(
          template,
          products,
          {
            dpi: job.zpl_dpi || 203,
            quantity: 1,
            printSpeed: 4,
            darkness: 15,
            includeComments: true,
          },
          job.rule_template_snapshots
        );
        const path = await desktopFileService.saveText(
          filename,
          content,
          [{ name: 'Fichier ZPL', extensions: ['zpl', 'txt'] }]
        );
        if (path) {
          setActionMessage(`${isFallback ? 'Avertissement : reconstruction depuis les données disponibles. ' : ''}ZPL ré-exporté vers ${path}. Le statut d'impression original reste inchangé.`);
        }
      }
    } catch (err: any) {
      console.error('Failed to re-export job:', err);
      setActionMessage(`Échec du ré-export : ${err?.message || String(err)}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[85vh] overflow-hidden text-slate-100 font-sans">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Historique des Impressions & Spooler</span>
                <span className="text-xs text-slate-500 font-normal">({filteredJobs.length} travaux)</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Traçabilité des exports PDF et flux ZPL enregistrés dans SQLite
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadJobs}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Rafraîchir la liste"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-400 font-medium">Format:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(['all', 'pdf', 'zpl'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFilterFormat(fmt)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                    filterFormat === fmt
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>

            <span className="text-slate-400 font-medium ml-2">Statut:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {['all', 'ready', 'queued', 'submitted_unconfirmed', 'spooler_completed', 'unknown', 'failed'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                    filterStatus === st
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'all'
                    ? 'TOUS'
                    : st === 'submitted_unconfirmed'
                      ? 'ENVOYÉ · NON CONFIRMÉ'
                      : st === 'spooler_completed'
                        ? 'SPOOLER TERMINÉ'
                        : st.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {actionMessage && (
            <span className={`text-xs px-3 py-1 rounded-lg truncate max-w-sm ${
              actionMessageIsError
                ? 'text-rose-300 bg-rose-950/40 border border-rose-800/60'
                : 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/60'
            }`}>
              {actionMessage}
            </span>
          )}
        </div>

        {/* Job List Viewport */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {filteredJobs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <Printer className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p>Aucun travail d'impression enregistré dans cette vue.</p>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className={`px-6 py-3.5 flex items-center justify-between hover:bg-slate-800/40 cursor-pointer transition ${
                  selectedJob?.id === job.id ? 'bg-slate-800/60' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                    {job.format === 'pdf' ? (
                      <FileText className="w-4 h-4 text-red-400" />
                    ) : (
                      <FileCode className="w-4 h-4 text-purple-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-white">{job.id}</span>
                      <span className="text-slate-500 text-[11px]">·</span>
                      <span className="text-slate-400 text-xs truncate">{job.target || 'Fichier exporté'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>{new Date(job.created_at).toLocaleString()}</span>
                      <span aria-hidden="true">·</span>
                      <span>{job.product_ids?.length || 0} étiquettes</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          job.status === 'ready' || job.status === 'spooler_completed'
                            ? 'text-emerald-400'
                            : job.status === 'queued' || job.status === 'submitted_unconfirmed'
                              ? 'text-blue-400'
                              : job.status === 'failed'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                        }
                      >
                        {job.status === 'submitted_unconfirmed'
                          ? 'ENVOYÉ · NON CONFIRMÉ'
                          : job.status === 'spooler_completed'
                            ? 'SPOOLER TERMINÉ · SORTIE NON VÉRIFIÉE'
                            : job.status.toUpperCase()}
                      </span>
                    </div>
                    {job.status_detail && (
                      <p className="text-[10px] text-slate-500 mt-1 max-w-2xl">{job.status_detail}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReExport(job);
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                    title="Ré-exporter ce travail"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ré-exporter</span>
                  </button>

                  {job.retry_allowed && job.status === 'failed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRetry(job);
                      }}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                      title="Nouvelle tentative avec l'artefact archivé"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Réessayer</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-500">
          <span>Base SQLite locale : estudio.sqlite / table print_jobs</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
