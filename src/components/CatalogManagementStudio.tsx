import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ProductRecord, LabelTemplate } from '../types';
import { catalogRepository, ImportReport } from '../services/catalogRepository';
import { AuditLogService } from '../services/auditLogService';
import { parseWorkbookFile } from '../utils/excelCleaner';
import {
  FileSpreadsheet,
  Search,
  Plus,
  Upload,
  Download,
  Trash2,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  FileCheck,
  RefreshCw,
  FolderArchive,
  Eye,
  Database,
} from 'lucide-react';
import { desktopFileService } from '../services/desktopFileService';
import { resolveCanonicalKey } from '../utils/mappingDictionary';
import { CatalogImportCollision, prepareCatalogImport } from '../utils/catalogImport';
import { api, ExternalDbConfig, isTauriEnvironment } from '../services/api';
import { open } from '@tauri-apps/plugin-dialog';
import { useLocalization } from '../context/LocalizationContext';
import { translateDatabaseImport } from '../i18n/localization';

export interface CollisionItem extends CatalogImportCollision {}

interface CatalogManagementStudioProps {
  onBack: () => void;
  templates: LabelTemplate[];
  onGenerateFromDatabase: (selectedProducts: ProductRecord[]) => void;
}

export const CatalogManagementStudio: React.FC<CatalogManagementStudioProps> = ({
  onBack,
  templates,
  onGenerateFromDatabase,
}) => {
  const { locale } = useLocalization();
  const databaseText = (key: Parameters<typeof translateDatabaseImport>[1]) => translateDatabaseImport(locale, key);
  const [activeTab, setActiveTab] = useState<'catalog' | 'import_wizard' | 'reports'>('catalog');
  const [products, setProducts] = useState<ProductRecord[]>(() => catalogRepository.getProducts());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Import wizard state
  const [importFile, setImportFile] = useState<Pick<File, 'name'> | null>(null);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [importMode, setImportMode] = useState<'merge_update' | 'replace' | 'review_collisions'>('merge_update');
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [collisions, setCollisions] = useState<CollisionItem[]>([]);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingWorksheetImport, setPendingWorksheetImport] = useState<{
    data: Uint8Array;
    fileName: string;
    names: string[];
  } | null>(null);
  const [selectedWorksheet, setSelectedWorksheet] = useState('');
  const [dbConfig, setDbConfig] = useState<ExternalDbConfig>({
    driver: 'postgres',
    host: '',
    port: 5432,
    database: '',
    schema: 'public',
    username: '',
    password: '',
    sslCaPath: '',
    path: '',
  });
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [dbTable, setDbTable] = useState('');
  const [isDbBusy, setIsDbBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = catalogRepository.subscribe((updated) => {
      setProducts(updated);
    });
    return () => unsub();
  }, []);

  const departments = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const d = p.DEPT_NAME || p.CATEGORY_NAME;
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return catalogRepository.search(searchQuery, selectedDept);
  }, [products, searchQuery, selectedDept]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const processWorkbookData = async (data: Uint8Array, fileName: string, worksheetName?: string) => {
    try {
      const { headers, rows, worksheetNames } = await parseWorkbookFile(data, fileName, worksheetName);
      if (!worksheetName && worksheetNames.length > 1) {
        setPendingWorksheetImport({ data, fileName, names: worksheetNames });
        setSelectedWorksheet(worksheetNames[0]);
        return;
      }

      if (headers.length === 0 || rows.length === 0) {
        setActionFeedback('Le fichier sélectionné est vide ou ne contient aucune ligne valide.');
        return;
      }

      setParsedHeaders(headers);
      setParsedRows(rows);

      // Auto-match headers via persistent dictionary first, followed by retail heuristics
      const autoMap: Record<string, string> = {};
      headers.forEach((h) => {
        const canonical = resolveCanonicalKey(h);
        if (canonical && !autoMap[canonical]) {
          autoMap[canonical] = h;
          return;
        }

        const lower = h.toLowerCase();
        if (
          (lower.includes('ean') || lower.includes('gencod') || lower.includes('barcode') || lower.includes('scan')) &&
          !autoMap['PRODUCT_SCAN']
        ) {
          autoMap['PRODUCT_SCAN'] = h;
        } else if (
          (lower.includes('designation') || lower.includes('libelle') || lower.includes('nom') || lower.includes('item')) &&
          !autoMap['ITEMNAME']
        ) {
          autoMap['ITEMNAME'] = h;
        } else if (lower.includes('prix') || lower.includes('price') || lower.includes('pv')) {
          if (lower.includes('promo') && !autoMap['PROMOPRICE']) autoMap['PROMOPRICE'] = h;
          else if (!autoMap['SELLING_PRICE']) autoMap['SELLING_PRICE'] = h;
        } else if (
          (lower.includes('sku') || lower.includes('ref') || lower.includes('art') || lower.includes('partno')) &&
          !autoMap['PARTNO']
        ) {
          autoMap['PARTNO'] = h;
        } else if (
          (lower.includes('rayon') || lower.includes('dept') || lower.includes('departement')) &&
          !autoMap['DEPT_NAME']
        ) {
          autoMap['DEPT_NAME'] = h;
        } else if (
          (lower.includes('categ') || lower.includes('famille')) &&
          !autoMap['CATEGORY_NAME']
        ) {
          autoMap['CATEGORY_NAME'] = h;
        }
      });

      setFieldMappings(autoMap);
      setWizardStep(2);
    } catch (err: any) {
      setActionFeedback(`Erreur lors de la lecture du fichier : ${err.message || 'Format non supporté'}`);
    }
  };

  const handleListDatabaseTables = async () => {
    setIsDbBusy(true);
    setActionFeedback(null);
    try {
      const tables = await api.externalDbListTables(dbConfig);
      setDbTables(tables);
      setDbTable(tables[0] || '');
      setActionFeedback(tables.length ? `${tables.length} table(s) trouvée(s).` : 'Aucune table importable trouvée.');
    } catch (error) {
      setActionFeedback(`Connexion à la base impossible : ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDbBusy(false);
    }
  };

  const handleSelectSqliteFile = async () => {
    try {
      const selection = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'Base SQLite', extensions: ['sqlite', 'sqlite3', 'db'] }],
      });
      if (typeof selection === 'string') {
        setDbConfig({ ...dbConfig, path: selection });
        setDbTables([]);
        setDbTable('');
      }
    } catch (error) {
      setActionFeedback(`Sélection du fichier SQLite impossible : ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleImportDatabaseTable = async () => {
    if (!dbTable) {
      setActionFeedback('Sélectionnez une table à importer.');
      return;
    }
    setIsDbBusy(true);
    setActionFeedback(null);
    try {
      const preview = await api.externalDbFetchTable(dbConfig, dbTable);
      if (preview.truncated) {
        setActionFeedback('La table dépasse la limite de sécurité de 5 000 lignes. Utilisez une vue ou filtrez la source; aucun import partiel n’a été préparé.');
        return;
      }
      if (preview.headers.length === 0 || preview.rows.length === 0) {
        setActionFeedback('La table sélectionnée ne contient aucune ligne importable.');
        return;
      }
      setParsedHeaders(preview.headers);
      setParsedRows(preview.rows);
      setFieldMappings({});
      setImportFile({ name: `${dbConfig.database || dbConfig.path} · ${dbTable}` });
      setWizardStep(2);
    } catch (error) {
      setActionFeedback(`Lecture de la table impossible : ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDbBusy(false);
    }
  };

  const handlePickNativeFile = async () => {
    try {
      const res = await desktopFileService.openBinary([
        { name: 'Feuille de calcul', extensions: ['xlsx', 'csv'] },
      ]);
      if (res) {
        setImportFile({ name: res.name } as any);
        processWorkbookData(res.data, res.name);
        return;
      }
    } catch (err) {
      console.warn('Native open failed, falling back to input:', err);
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      processWorkbookData(data, file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleValidateImport = () => {
    if (!fieldMappings['ITEMNAME']) {
      setActionFeedback('Veuillez au minimum mapper la colonne de Désignation (Nom de l\'article).');
      return;
    }
    const prepared = prepareCatalogImport(parsedHeaders, parsedRows, fieldMappings, products);
    setCollisions(prepared.collisions);
    setValidationIssues(prepared.issues);
    setWizardStep(3);
  };

  const handleCommitImport = async () => {
    const prepared = prepareCatalogImport(parsedHeaders, parsedRows, fieldMappings, catalogRepository.getProducts());
    setValidationIssues(prepared.issues);
    if (prepared.issues.length > 0) return;

    setIsImporting(true);
    setActionFeedback(null);
    try {
      const skipKeys = new Set<string>();
      if (importMode === 'review_collisions') {
        collisions.filter((collision) => !collision.overwrite).forEach((collision) => skipKeys.add(collision.id));
      }

      const accepted = prepared.products.filter((product) => !skipKeys.has(product.id));
      const existingIds = new Set(catalogRepository.getProducts().map((product) => product.id));
      const report: ImportReport = {
        id: `IMP-${Date.now()}`,
        timestamp: new Date().toISOString(),
        filename: importFile?.name || 'import.xlsx',
        totalRowsRead: parsedRows.length,
        importedCount: accepted.length,
        updatedCount: accepted.filter((product) => existingIds.has(product.id)).length,
        rejectedCount: parsedRows.length - prepared.products.length,
        duplicateCount: prepared.collisions.length,
        warnings: [],
      };

      await catalogRepository.commitImport(prepared.products, report, importMode, skipKeys);
      await AuditLogService.append({
        action: 'IMPORT_CATALOGUE',
        details: `Importation de ${accepted.length} articles depuis ${importFile?.name} (mode: ${importMode})`,
      });

      setActionFeedback(`Import terminé : ${accepted.length} article(s) enregistré(s).`);
      setWizardStep(1);
      setImportFile(null);
      setParsedHeaders([]);
      setParsedRows([]);
      setActiveTab('catalog');
    } catch (err: any) {
      setActionFeedback(`Échec de l'import : ${err?.message || String(err)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportWorkspace = async () => {
    const jsonStr = catalogRepository.exportWorkspaceJson();
    const filename = `estudio_catalogue_workspace_${Date.now()}.json`;
    await desktopFileService.saveText(filename, jsonStr, [
      { name: 'Catalogue E-Studio', extensions: ['json'] },
    ]);
  };

  const handleRestoreWorkspaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const res = await catalogRepository.importWorkspaceJson(event.target?.result as string);
      setActionFeedback(res.message);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div data-studio-workspace="catalog" className="flex-1 flex flex-col bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Top Header Toolbar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Retour au Tableau de Bord"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <h1 className="text-sm font-bold tracking-tight text-white">Catalogue & Résolution Produits</h1>
            </div>
            <p className="text-[10px] text-slate-400">Dépôt local vérifié · Importation Excel/CSV déterministe</p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              activeTab === 'catalog' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Articles ({products.length})
          </button>
          <button
            onClick={() => {
              setWizardStep(1);
              setActiveTab('import_wizard');
            }}
            className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'import_wizard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3 h-3" />
            <span>Assistant d'Importation</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              activeTab === 'reports' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Historique d'Imports
          </button>
        </div>

        {/* Workspace Backup / Restore */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={handleExportWorkspace}
            className="px-2.5 py-1.5 border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg flex items-center gap-1.5 transition"
            title="Sauvegarder l'espace de travail au format JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sauvegarder</span>
          </button>

          <input
            type="file"
            accept=".json"
            ref={restoreInputRef}
            onChange={handleRestoreWorkspaceFile}
            className="hidden"
          />
          <button
            onClick={() => restoreInputRef.current?.click()}
            className="px-2.5 py-1.5 border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg flex items-center gap-1.5 transition"
            title="Restaurer un fichier de sauvegarde JSON"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restaurer</span>
          </button>
        </div>
      </header>

      {actionFeedback && (
        <div
          role={/^(Échec|Erreur|Veuillez)/.test(actionFeedback) ? 'alert' : 'status'}
          className={`px-5 py-2 text-xs border-b ${/^(Échec|Erreur|Veuillez)/.test(actionFeedback)
            ? 'bg-red-950/40 border-red-900 text-red-200'
            : 'bg-emerald-950/30 border-emerald-900 text-emerald-200'}`}
        >
          {actionFeedback}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
        {/* TAB 1: CATALOG VIEW */}
        {activeTab === 'catalog' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Search & Actions Bar */}
            <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/60">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par désignation, EAN ou référence..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300"
                  >
                    <option value="all">Tous les rayons ({products.length})</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Batch Actions */}
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => {
                      const selected = products.filter((p) => selectedIds.has(p.id));
                      onGenerateFromDatabase(selected);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Générer étiquettes ({selectedIds.size})</span>
                  </button>
                )}

                {products.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Êtes-vous sûr de vouloir vider le catalogue local ?')) {
                        catalogRepository.clearCatalog();
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                    title="Vider le catalogue local"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Table or Genuine Empty State */}
            {products.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400 mb-4">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Aucun article dans le catalogue</h3>
                <p className="text-xs text-slate-400 max-w-md mb-6">
                  Le catalogue est vierge. Importez un fichier Excel (.xlsx) ou CSV contenant vos articles, prix et codes-barres pour commencer la production d'étiquettes.
                </p>
                <button
                  onClick={() => {
                    setWizardStep(1);
                    setActiveTab('import_wizard');
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
                >
                  <Upload className="w-4 h-4" />
                  <span>Importer un fichier Excel / CSV</span>
                </button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <Search className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-xs text-slate-400">Aucun article ne correspond aux filtres de recherche.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 sticky top-0 z-10 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                          onChange={handleSelectAll}
                          className="rounded border-slate-700"
                        />
                      </th>
                      <th className="p-3">Référence / SKU</th>
                      <th className="p-3">Code-Barre (EAN-13)</th>
                      <th className="p-3">Désignation</th>
                      <th className="p-3">Rayon</th>
                      <th className="p-3 text-right">Prix Vente</th>
                      <th className="p-3 text-right">Prix Promo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                    {filteredProducts.map((p) => {
                      const isSelected = selectedIds.has(p.id);
                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-900/50 transition cursor-pointer ${
                            isSelected ? 'bg-blue-950/20' : ''
                          }`}
                          onClick={() => handleToggleSelect(p.id)}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(p.id)}
                              className="rounded border-slate-700"
                            />
                          </td>
                          <td className="p-3 font-semibold text-slate-200">{p.PARTNO || '—'}</td>
                          <td className="p-3 text-slate-400">{p.PRODUCT_SCAN || '—'}</td>
                          <td className="p-3 font-sans font-medium text-white max-w-xs truncate">{p.ITEMNAME}</td>
                          <td className="p-3 font-sans text-slate-400">{p.DEPT_NAME || '—'}</td>
                          <td className="p-3 text-right font-bold text-emerald-400">
                            {p.SELLING_PRICE !== undefined ? `${p.SELLING_PRICE.toFixed(2)} €` : '—'}
                          </td>
                          <td className="p-3 text-right font-bold text-rose-400">
                            {p.PROMOPRICE ? `${p.PROMOPRICE.toFixed(2)} €` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: IMPORT WIZARD */}
        {activeTab === 'import_wizard' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl overflow-y-auto">
            <div className="max-w-2xl mx-auto w-full space-y-6">
              {/* Stepper */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className={`flex items-center gap-2 ${wizardStep >= 1 ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>
                  <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">1</span>
                  <span className="text-xs">Fichier</span>
                </div>
                <div className="h-0.5 w-12 bg-slate-800" />
                <div className={`flex items-center gap-2 ${wizardStep >= 2 ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>
                  <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">2</span>
                  <span className="text-xs">Mapping</span>
                </div>
                <div className="h-0.5 w-12 bg-slate-800" />
                <div className={`flex items-center gap-2 ${wizardStep >= 3 ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>
                  <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">3</span>
                  <span className="text-xs">Validation</span>
                </div>
              </div>

              {/* STEP 1: CHOOSE FILE */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div
                    onClick={handlePickNativeFile}
                    className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-900/40"
                  >
                    <Upload className="w-10 h-10 text-slate-500 mb-3" />
                    <p className="text-sm font-semibold text-white">Cliquez pour sélectionner un fichier Excel (.xlsx, .xls) ou CSV</p>
                    <p className="text-xs text-slate-500 mt-1">Lecture directe en local sans transfert réseau</p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                    />
                  </div>
                  <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <div className="flex items-start gap-3">
                      <Database className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
                      <div>
                        <h3 className="text-sm font-bold text-white">{databaseText('title')}</h3>
                        <p className="mt-1 text-xs text-slate-400">
                          {databaseText('readOnlyNotice')}
                        </p>
                      </div>
                    </div>
                    {!isTauriEnvironment() ? (
                      <p className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-xs text-amber-200">
                        {databaseText('browserNotice')}
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="space-y-1 text-xs text-slate-300">
                            {databaseText('databaseType')}
                            <select
                              value={dbConfig.driver}
                              onChange={(event) => {
                                const driver = event.target.value as ExternalDbConfig['driver'];
                                setDbConfig({
                                  ...dbConfig,
                                  driver,
                                  port: driver === 'postgres' ? 5432 : driver === 'mysql' ? 3306 : null,
                                });
                                setDbTables([]);
                                setDbTable('');
                              }}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                            >
                              <option value="sqlite">SQLite</option>
                              <option value="postgres">PostgreSQL</option>
                              <option value="mysql">MySQL</option>
                            </select>
                          </label>
                          {dbConfig.driver === 'sqlite' ? (
                            <label className="space-y-1 text-xs text-slate-300">
                              {databaseText('databasePath')}
                              <div className="flex gap-2">
                                <input
                                  value={dbConfig.path}
                                  onChange={(event) => setDbConfig({ ...dbConfig, path: event.target.value })}
                                  placeholder="/chemin/vers/catalogue.sqlite"
                                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleSelectSqliteFile()}
                                  className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
                                >
                                  {databaseText('chooseFile')}
                                </button>
                              </div>
                            </label>
                          ) : (
                            <>
                              <label className="space-y-1 text-xs text-slate-300">
                                {databaseText('host')}
                                <input
                                  value={dbConfig.host}
                                  onChange={(event) => setDbConfig({ ...dbConfig, host: event.target.value })}
                                  autoComplete="off"
                                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                                />
                              </label>
                              <label className="space-y-1 text-xs text-slate-300">
                                {databaseText('port')}
                                <input
                                  type="number"
                                  min="1"
                                  max="65535"
                                  value={dbConfig.port ?? ''}
                                  onChange={(event) => setDbConfig({ ...dbConfig, port: event.target.value ? Number(event.target.value) : null })}
                                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                                />
                              </label>
                              <label className="space-y-1 text-xs text-slate-300">
                                {databaseText('databaseName')}
                                <input
                                  value={dbConfig.database}
                                  onChange={(event) => setDbConfig({ ...dbConfig, database: event.target.value })}
                                  autoComplete="off"
                                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                                />
                              </label>
                              {dbConfig.driver === 'postgres' && (
                                <label className="space-y-1 text-xs text-slate-300">
                                  {databaseText('schema')}
                                  <input
                                    value={dbConfig.schema}
                                    onChange={(event) => setDbConfig({ ...dbConfig, schema: event.target.value })}
                                    autoComplete="off"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                                  />
                                </label>
                              )}
                              <label className="space-y-1 text-xs text-slate-300">
                                {databaseText('username')}
                                <input
                                  value={dbConfig.username}
                                  onChange={(event) => setDbConfig({ ...dbConfig, username: event.target.value })}
                                  autoComplete="off"
                                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                                />
                              </label>
                              <label className="space-y-1 text-xs text-slate-300">
                                {databaseText('password')}
                                <input
                                  type="password"
                                  value={dbConfig.password}
                                  onChange={(event) => setDbConfig({ ...dbConfig, password: event.target.value })}
                                  autoComplete="new-password"
                                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                                />
                              </label>
                              <label className="space-y-1 text-xs text-slate-300 sm:col-span-2">
                                {databaseText('tlsAuthority')}
                                <div className="flex gap-2">
                                  <input
                                    value={dbConfig.sslCaPath}
                                    onChange={(event) => setDbConfig({ ...dbConfig, sslCaPath: event.target.value })}
                                    placeholder="/chemin/vers/ca.pem"
                                    autoComplete="off"
                                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const selected = await open({
                                        multiple: false,
                                        filters: [{ name: 'Certificat CA', extensions: ['pem', 'crt', 'cer'] }],
                                      });
                                      if (typeof selected === 'string') {
                                        setDbConfig((current) => ({ ...current, sslCaPath: selected }));
                                      }
                                    }}
                                    className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
                                  >
                                    {databaseText('chooseFile')}
                                  </button>
                                </div>
                                <span className="block text-[10px] text-slate-500">
                                  {databaseText('tlsVerification')}
                                </span>
                              </label>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleListDatabaseTables}
                            disabled={isDbBusy}
                            className="rounded-lg border border-blue-700 px-4 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-950/50 disabled:opacity-50"
                          >
                            {isDbBusy ? databaseText('connecting') : databaseText('listTables')}
                          </button>
                          {dbTables.length > 0 && (
                            <>
                              <select
                                value={dbTable}
                                onChange={(event) => setDbTable(event.target.value)}
                                className="min-w-48 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                              >
                                {dbTables.map((table) => <option key={table} value={table}>{table}</option>)}
                              </select>
                              <button
                                type="button"
                                onClick={handleImportDatabaseTable}
                                disabled={isDbBusy || !dbTable}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                {databaseText('loadMapping')}
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </section>
                </div>
              )}

              {/* STEP 2: FIELD MAPPING */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Correspondance des Colonnes</h3>
                      <p className="text-xs text-slate-400">
                        {parsedRows.length} lignes détectées dans <span className="font-mono text-blue-400">{importFile?.name}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => setWizardStep(1)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Changer de fichier
                    </button>
                  </div>

                  <div className="space-y-3 bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs">
                    {[
                      { key: 'ITEMNAME', label: 'Désignation / Nom article * (Requis)' },
                      { key: 'PRODUCT_SCAN', label: 'Code-Barre / EAN-13' },
                      { key: 'PARTNO', label: 'Référence interne / SKU' },
                      { key: 'SELLING_PRICE', label: 'Prix de Vente Normal' },
                      { key: 'PROMOPRICE', label: 'Prix Promotionnel' },
                      { key: 'DEPT_NAME', label: 'Rayon / Département' },
                      { key: 'CATEGORY_NAME', label: 'Famille / Catégorie' },
                    ].map((target) => (
                      <div key={target.key} className="flex items-center justify-between gap-4">
                        <span className="font-semibold text-slate-300">{target.label}</span>
                        <select
                          value={fieldMappings[target.key] || ''}
                          onChange={(e) =>
                            setFieldMappings({ ...fieldMappings, [target.key]: e.target.value })
                          }
                          className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs max-w-xs w-full"
                        >
                          <option value="">-- Ignorer cette colonne --</option>
                          {parsedHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <button
                      onClick={() => setWizardStep(1)}
                      className="px-4 py-2 border border-slate-700 text-slate-300 rounded-xl text-xs"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={handleValidateImport}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      <span>Valider les données</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: PREVIEW & COMMIT */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">Validation et Confirmation d'Importation</h3>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total de lignes analysées :</span>
                      <span className="font-bold text-white">{parsedRows.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Mode d'intégration :</span>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="mergeMode"
                            checked={importMode === 'merge_update'}
                            onChange={() => setImportMode('merge_update')}
                          />
                          <span>Fusionner (Mise à jour)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="mergeMode"
                            checked={importMode === 'replace'}
                            onChange={() => setImportMode('replace')}
                          />
                          <span>Remplacer tout</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="mergeMode"
                            checked={importMode === 'review_collisions'}
                            onChange={() => setImportMode('review_collisions')}
                          />
                          <span>Examiner les collisions ({collisions.length})</span>
                        </label>
                      </div>
                    </div>

                    {importMode === 'review_collisions' && collisions.length > 0 && (
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">Résolution des {collisions.length} collisions détectées</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setCollisions((prev) => prev.map((c) => ({ ...c, overwrite: true })))}
                              className="text-blue-400 hover:text-blue-300 font-semibold"
                            >
                              Tout écraser
                            </button>
                            <span className="text-slate-600">·</span>
                            <button
                              type="button"
                              onClick={() => setCollisions((prev) => prev.map((c) => ({ ...c, overwrite: false })))}
                              className="text-slate-400 hover:text-white"
                            >
                              Tout conserver
                            </button>
                          </div>
                        </div>
                        <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/80 text-xs">
                          {collisions.map((col, idx) => (
                            <div key={idx} className="py-2 flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <span className="font-mono text-slate-400 text-[11px] block">{col.key}</span>
                                <span className="text-slate-300 truncate block">
                                  {col.existingName} → <strong className="text-white">{col.incomingName}</strong>
                                </span>
                                <span className="text-slate-500 text-[11px]">
                                  {col.existingPrice.toFixed(2)} € → {col.incomingPrice.toFixed(2)} €
                                </span>
                              </div>
                              <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                                <input
                                  type="checkbox"
                                  checked={col.overwrite}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setCollisions((prev) =>
                                      prev.map((c, i) => (i === idx ? { ...c, overwrite: checked } : c))
                                    );
                                  }}
                                  className="rounded"
                                />
                                <span className={col.overwrite ? 'text-blue-400 font-semibold' : 'text-slate-400'}>
                                  {col.overwrite ? 'Écraser' : 'Conserver'}
                                </span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {validationIssues.length > 0 && (
                      <div className="bg-amber-950/30 border border-amber-800/50 p-3 rounded-lg text-amber-300">
                        <div className="flex items-center gap-1.5 font-bold mb-1">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>{validationIssues.length} avertissement(s) détecté(s)</span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200/80 max-h-24 overflow-y-auto">
                          {validationIssues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="px-4 py-2 border border-slate-700 text-slate-300 rounded-xl text-xs"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={handleCommitImport}
                      disabled={validationIssues.length > 0 || isImporting}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isImporting ? 'Enregistrement…' : 'Confirmer et Enregistrer dans le Catalogue'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: IMPORT HISTORY REPORTS */}
        {activeTab === 'reports' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl overflow-y-auto">
            <h3 className="text-sm font-bold text-white mb-4">Rapports de Traçabilité des Importations</h3>
            {catalogRepository.getImportReports().length === 0 ? (
              <p className="text-xs text-slate-400">Aucun rapport d'importation enregistré pour le moment.</p>
            ) : (
              <div className="space-y-3">
                {catalogRepository.getImportReports().map((rep) => (
                  <div key={rep.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>Fichier : {rep.filename}</span>
                      <span className="text-slate-400 text-[11px]">{new Date(rep.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-slate-400 text-[11px] flex gap-4 pt-1 font-mono">
                      <span>Articles importés : {rep.importedCount}</span>
                      <span>Total lignes : {rep.totalRowsRead}</span>
                      {rep.warnings.length > 0 && <span className="text-amber-400">Avertissements : {rep.warnings.length}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      {pendingWorksheetImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <section className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-white">Choisir une feuille Excel</h2>
            <p className="mt-1 text-sm text-slate-300">
              Sélectionnez la feuille qui contient les données du catalogue.
            </p>
            <select
              aria-label="Feuille Excel du catalogue"
              className="mt-4 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
              value={selectedWorksheet}
              onChange={(event) => setSelectedWorksheet(event.target.value)}
            >
              {pendingWorksheetImport.names.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {actionFeedback && <p role="alert" className="mt-3 text-sm text-amber-300">{actionFeedback}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
                onClick={() => setPendingWorksheetImport(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                onClick={async () => {
                  await processWorkbookData(
                    pendingWorksheetImport.data,
                    pendingWorksheetImport.fileName,
                    selectedWorksheet
                  );
                  setPendingWorksheetImport(null);
                }}
              >
                Importer la feuille
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
