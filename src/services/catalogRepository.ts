import { ProductRecord } from '../types';
import { api } from './api';
import { applyCatalogImport, normalizeCatalogProduct } from '../utils/catalogImport';

export interface ImportReport {
  id: string;
  timestamp: string;
  filename: string;
  totalRowsRead: number;
  importedCount: number;
  updatedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  warnings: string[];
}

export interface WorkspaceExportData {
  version: string;
  exportedAt: string;
  catalog: {
    products: ProductRecord[];
    importHistory: ImportReport[];
  };
  templates?: any[];
}

class CatalogRepository {
  private products: ProductRecord[] = [];
  private listeners: Array<(products: ProductRecord[]) => void> = [];
  private importReports: ImportReport[] = [];
  private isLoaded = false;

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    try {
      const prods = await api.catalogSearch('');
      this.products = prods || [];
      try {
        const batches = await api.batchImportList();
        if (batches && batches.length > 0) {
          this.importReports = batches.map((b: any) => ({
            id: b.id || `batch_${Date.now()}`,
            timestamp: b.timestamp || b.created_at || new Date().toISOString(),
            filename: b.filename || 'import',
            totalRowsRead: b.totalRowsRead ?? b.total_rows ?? 0,
            importedCount: b.importedCount ?? b.imported_count ?? 0,
            updatedCount: b.updatedCount ?? b.updated_count ?? 0,
            rejectedCount: b.rejectedCount ?? b.rejected_count ?? 0,
            duplicateCount: b.duplicateCount ?? b.duplicate_count ?? 0,
            warnings: b.warnings || [],
          }));
        } else {
          const historyStr = await api.prefsGet('catalog_import_history');
          if (historyStr) {
            this.importReports = JSON.parse(historyStr);
          }
        }
      } catch {
        const historyStr = await api.prefsGet('catalog_import_history');
        if (historyStr) {
          try {
            this.importReports = JSON.parse(historyStr);
          } catch {}
        }
      }
      this.isLoaded = true;
      this.notify();
    } catch (e) {
      console.warn('Failed to load catalog from database', e);
      this.products = [];
      this.isLoaded = true;
      this.notify();
    }
  }

  private notify() {
    const list = [...this.products];
    this.listeners.forEach((l) => {
      try {
        l(list);
      } catch (err) {
        console.error('Error in catalog listener', err);
      }
    });
  }

  public subscribe(listener: (products: ProductRecord[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.products]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getProducts(): ProductRecord[] {
    return [...this.products];
  }

  public getProductById(id: string): ProductRecord | undefined {
    return this.products.find((p) => p.id === id || p.PRODUCT_SCAN === id || p.PARTNO === id);
  }

  public search(query: string, department?: string): ProductRecord[] {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery && !department) {
      return [...this.products];
    }

    const words = cleanQuery.split(/\s+/).filter(Boolean);
    return this.products.filter((prod) => {
      if (department && department !== 'all') {
        const prodDept = (prod.DEPT_NAME || prod.CATEGORY_NAME || '').toLowerCase();
        if (prodDept !== department.toLowerCase()) return false;
      }
      if (words.length === 0) return true;

      const searchable = [
        prod.ITEMNAME,
        prod.PRODUCT_SCAN,
        prod.PARTNO,
        prod.BRAND_INFO,
        prod.VENDOR_NAME,
        prod.DEPT_NAME,
        prod.CATEGORY_NAME,
        prod.STORE_NAME,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return words.every((w) => searchable.includes(w));
    });
  }

  public async saveToMasterDatabaseAsync(
    incomingProducts: ProductRecord[],
    mode: 'merge_update' | 'replace' | 'keep_existing' | 'update_upsert' | 'overwrite' | 'append' = 'merge_update'
  ): Promise<{ totalCount: number; updatedCount: number; addedCount: number }> {
    const normalized = incomingProducts.map(normalizeCatalogProduct);
    const isReplace = mode === 'replace' || mode === 'overwrite';
    let nextProducts: ProductRecord[];
    let addedCount = 0;
    let updatedCount = 0;

    if (isReplace) {
      const count = await api.catalogReplaceAll(normalized);
      if (count !== normalized.length) throw new Error(`Only ${count} of ${normalized.length} products were saved.`);
      nextProducts = normalized;
      addedCount = normalized.length;
    } else {
      const existingIds = new Set(this.products.map((product) => product.id));
      const skipIds = mode === 'append' || mode === 'keep_existing'
        ? new Set(normalized.filter((product) => existingIds.has(product.id)).map((product) => product.id))
        : new Set<string>();
      const merged = applyCatalogImport(this.products, normalized, 'merge_update', skipIds);
      const result = await api.catalogUpsert(merged.toPersist);
      if (result.rejected > 0) throw new Error(`The catalog rejected ${result.rejected} product(s).`);
      nextProducts = merged.products;
      addedCount = merged.toPersist.filter((product) => !existingIds.has(product.id)).length;
      updatedCount = merged.toPersist.length - addedCount;
    }

    this.products = nextProducts;
    this.notify();
    return { totalCount: nextProducts.length, updatedCount, addedCount };
  }

  public async commitImport(
    importedRecords: ProductRecord[],
    report: ImportReport,
    mode: 'merge_update' | 'replace' | 'review_collisions' = 'merge_update',
    skipKeys?: Set<string>
  ): Promise<void> {
    let nextProducts: ProductRecord[];
    let productsToCommit = importedRecords;
    const replaceAll = mode === 'replace';

    if (replaceAll) {
      nextProducts = [...importedRecords];
    } else {
      const mergeResult = applyCatalogImport(this.products, importedRecords, mode, skipKeys);
      nextProducts = mergeResult.products;
      productsToCommit = mergeResult.toPersist;
    }

    const persistedCount = await api.catalogCommitImport(productsToCommit, report, replaceAll);
    if (persistedCount !== productsToCommit.length) {
      throw new Error(`Only ${persistedCount} of ${productsToCommit.length} imported products were committed.`);
    }
    this.products = nextProducts;
    this.importReports.unshift(report);
    this.notify();
  }

  public deleteProduct(id: string) {
    this.products = this.products.filter((p) => p.id !== id);
    api.catalogReplaceAll(this.products).catch((err) => console.warn('Catalog SQLite sync failed:', err));
    this.notify();
  }

  public clearCatalog() {
    this.products = [];
    api.catalogReplaceAll([]).catch((err) => console.warn('Catalog SQLite sync failed:', err));
    this.notify();
  }

  public getImportReports(): ImportReport[] {
    return [...this.importReports];
  }

  public exportWorkspaceJson(): string {
    const data: WorkspaceExportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      catalog: {
        products: this.products,
        importHistory: this.importReports,
      },
    };
    return JSON.stringify(data, null, 2);
  }

  public async importWorkspaceJson(jsonStr: string): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.catalog && Array.isArray(parsed.catalog.products)) {
        const products = (parsed.catalog.products as ProductRecord[]).map(normalizeCatalogProduct);
        const count = await api.catalogReplaceAll(products);
        if (count !== products.length) throw new Error(`Seulement ${count} articles sur ${products.length} ont été enregistrés.`);
        const importReports = Array.isArray(parsed.catalog.importHistory) ? parsed.catalog.importHistory : this.importReports;
        await api.prefsSet('catalog_import_history', JSON.stringify(importReports.slice(0, 50)));
        this.products = products;
        this.importReports = importReports;
        this.notify();
        return {
          success: true,
          message: `Espace de travail importé avec succès (${this.products.length} articles).`,
          count: this.products.length,
        };
      }
      return { success: false, message: 'Structure de fichier de sauvegarde invalide.' };
    } catch (e: any) {
      return { success: false, message: `Erreur de lecture : ${e.message || 'JSON invalide'}` };
    }
  }
}

export const catalogRepository = new CatalogRepository();
export const databaseService = catalogRepository;
