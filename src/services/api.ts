import { invoke } from '@tauri-apps/api/core';
import { publishWorkspaceChange, type WorkspaceResource } from './workspaceSync';
import {
  LabelProject,
  LabelTemplate,
  ProductRecord,
  PrintJob,
  TemplateSummary,
  UpsertResult,
  AuditRecord,
} from '../types';

export interface NativePrintCapabilities {
  platform: string;
  cups_supported: boolean;
  raw_zpl_tcp_supported: boolean;
  note: string;
}

export interface NativePrintQueue {
  name: string;
  state: string;
  is_default: boolean;
}

export interface ExternalDbConfig {
  driver: 'sqlite' | 'postgres' | 'mysql';
  host: string;
  port: number | null;
  database: string;
  schema: string;
  username: string;
  password: string;
  sslCaPath: string;
  path: string;
}

export interface ExternalDbPreview {
  headers: string[];
  rows: Array<Record<string, unknown>>;
  truncated: boolean;
}

export interface McpDraftSummary {
  id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  item_count: number;
}

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// In-memory fallback for test environments that do not provide IndexedDB.
const inMemoryStore = {
  templates: new Map<string, LabelTemplate>(),
  templateRevisions: new Map<string, LabelTemplate>(),
  projects: new Map<string, LabelProject>(),
  products: new Map<string, ProductRecord>(),
  jobs: new Map<string, PrintJob>(),
  audit: [] as AuditRecord[],
  kv: new Map<string, string>(),
  importBatches: [] as any[],
};

const PROJECT_LIBRARY_KEY = 'e_studio_project_library_v1';
const PROJECT_DATABASE_NAME = 'e-studio-project-library';
const PROJECT_DATABASE_VERSION = 2;

function notifyWorkspaceChange(resource: WorkspaceResource, recordId?: string): void {
  void publishWorkspaceChange({ resource, recordId }).catch((error) => {
    console.warn(`Unable to broadcast ${resource} update`, error);
  });
}

function openProjectDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PROJECT_DATABASE_NAME, PROJECT_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const stores: Record<string, string> = {
        projects: 'id',
        templates: 'id',
        template_revisions: 'key',
        products: 'id',
        jobs: 'id',
        audit: 'id',
        kv: 'key',
        import_batches: 'id',
      };
      Object.entries(stores).forEach(([name, keyPath]) => {
        if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, { keyPath });
      });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(new Error(`Unable to open the local project library: ${request.error?.message || 'IndexedDB error'}`));
    request.onblocked = () => reject(new Error('The local project library is blocked by another open database connection.'));
  });
}

type BrowserStoreName = 'projects' | 'templates' | 'template_revisions' | 'products' | 'jobs' | 'audit' | 'kv' | 'import_batches';

function hasBrowserDatabase(): boolean {
  return !isTauriEnvironment() && typeof indexedDB !== 'undefined';
}

async function readIndexedRecords<T>(storeName: BrowserStoreName): Promise<T[]> {
  const database = await openProjectDatabase();
  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(new Error(`Unable to read ${storeName}: ${request.error?.message || 'IndexedDB error'}`));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => {
      database.close();
      reject(new Error(`Reading ${storeName} was aborted: ${transaction.error?.message || 'IndexedDB error'}`));
    };
  });
}

async function readIndexedRecord<T>(storeName: BrowserStoreName, key: IDBValidKey): Promise<T | undefined> {
  const database = await openProjectDatabase();
  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(new Error(`Unable to read ${storeName} entry: ${request.error?.message || 'IndexedDB error'}`));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => {
      database.close();
      reject(new Error(`Reading ${storeName} was aborted: ${transaction.error?.message || 'IndexedDB error'}`));
    };
  });
}

async function writeIndexedRecords<T>(storeName: BrowserStoreName, records: T[], replace = false): Promise<void> {
  const database = await openProjectDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    if (replace) store.clear();
    records.forEach((record) => store.put(record));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(new Error(`Unable to save ${storeName}: ${transaction.error?.message || 'IndexedDB error'}`));
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error(`Saving ${storeName} was aborted: ${transaction.error?.message || 'IndexedDB error'}`));
    };
  });
}

async function writeTemplateWithRevision(template: LabelTemplate): Promise<LabelTemplate> {
  const database = await openProjectDatabase();
  return await new Promise<LabelTemplate>((resolve, reject) => {
    const transaction = database.transaction(['templates', 'template_revisions'], 'readwrite');
    const templates = transaction.objectStore('templates');
    const existingRequest = templates.get(template.id);
    let saved: LabelTemplate | undefined;
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result as LabelTemplate | undefined;
      const now = new Date().toISOString();
      saved = {
        ...template,
        revision: existing ? existing.revision + 1 : 1,
        updated_at: now,
        created_at: template.created_at || now,
      };
      templates.put(saved);
      transaction.objectStore('template_revisions').put({
        key: `${saved.id}_v${saved.revision}`,
        id: saved.id,
        revision: saved.revision,
        template: saved,
      });
    };
    transaction.oncomplete = () => {
      database.close();
      if (saved) resolve(saved);
      else reject(new Error('Template save transaction completed without producing a saved template.'));
    };
    transaction.onerror = () => {
      database.close();
      reject(new Error(`Unable to save template revision: ${transaction.error?.message || 'IndexedDB error'}`));
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error(`Saving template revision was aborted: ${transaction.error?.message || 'IndexedDB error'}`));
    };
  });
}

async function deleteTemplateRecords(id: string): Promise<void> {
  const database = await openProjectDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(['templates', 'template_revisions'], 'readwrite');
    transaction.objectStore('templates').delete(id);
    const revisions = transaction.objectStore('template_revisions');
    const request = revisions.indexNames.contains('id') ? revisions.index('id').openCursor(id) : revisions.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if ((cursor.value as { id?: string }).id === id) cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(new Error(`Unable to delete template records: ${transaction.error?.message || 'IndexedDB error'}`));
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error(`Deleting template records was aborted: ${transaction.error?.message || 'IndexedDB error'}`));
    };
  });
}

async function readIndexedProjects(): Promise<LabelProject[]> {
  const database = await openProjectDatabase();
  return await new Promise((resolve, reject) => {
    const transaction = database.transaction('projects', 'readonly');
    const request = transaction.objectStore('projects').getAll();
    let projects: LabelProject[] = [];
    request.onsuccess = () => {
      projects = request.result as LabelProject[];
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(projects);
    };
    transaction.onerror = () => {
      database.close();
      reject(new Error(`Unable to read the local project library: ${transaction.error?.message || request.error?.message || 'IndexedDB error'}`));
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error(`Reading the local project library was aborted: ${transaction.error?.message || 'IndexedDB error'}`));
    };
  });
}

async function saveIndexedProject(project: LabelProject): Promise<LabelProject> {
  const database = await openProjectDatabase();
  return await new Promise<LabelProject>((resolve, reject) => {
    const transaction = database.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');
    const existingRequest = store.get(project.id);
    let saved: LabelProject | undefined;
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result as LabelProject | undefined;
      const now = new Date().toISOString();
      saved = {
        ...project,
        id: project.id || `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: project.name || 'Nouveau projet',
        created_at: project.created_at || existing?.created_at || now,
        updated_at: now,
        templates: Array.isArray(project.templates) ? project.templates : [],
        data_sources: Array.isArray(project.data_sources) ? project.data_sources : [],
      };
      store.put(saved);
    };
    transaction.oncomplete = () => {
      database.close();
      if (saved) resolve(saved);
      else reject(new Error('Project save transaction completed without producing a saved project.'));
    };
    transaction.onerror = () => {
      database.close();
      reject(new Error(`Unable to save the local project: ${transaction.error?.message || 'IndexedDB error'}`));
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error(`Saving the local project was aborted: ${transaction.error?.message || 'IndexedDB error'}`));
    };
  });
}

async function deleteIndexedProject(id: string): Promise<void> {
  const database = await openProjectDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('projects', 'readwrite');
    transaction.objectStore('projects').delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(new Error(`Unable to delete the local project: ${transaction.error?.message || 'IndexedDB error'}`));
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error(`Deleting the local project was aborted: ${transaction.error?.message || 'IndexedDB error'}`));
    };
  });
}

async function readProjectLibrary(): Promise<Map<string, LabelProject>> {
  let serialized: string | null = null;
  if (isTauriEnvironment()) {
    serialized = await invoke<string | null>('prefs_get', { key: PROJECT_LIBRARY_KEY });
  } else if (typeof indexedDB !== 'undefined') {
    const projects = await readIndexedProjects();
    const library = new Map(projects.map((project) => [project.id, project]));
    inMemoryStore.projects.clear();
    library.forEach((project, id) => inMemoryStore.projects.set(id, project));
    return library;
  }

  if (serialized === null) return new Map(inMemoryStore.projects);
  let decoded: unknown;
  try {
    decoded = JSON.parse(serialized);
  } catch {
    throw new Error('The local project library is damaged and could not be read.');
  }
  if (!Array.isArray(decoded) || decoded.some((project) =>
    !project ||
    typeof project.id !== 'string' ||
    typeof project.name !== 'string' ||
    !Array.isArray(project.templates) ||
    !Array.isArray(project.data_sources)
  )) {
    throw new Error('The local project library has an invalid format.');
  }
  const library = new Map<string, LabelProject>(decoded.map((project: LabelProject) => [project.id, project]));
  inMemoryStore.projects.clear();
  library.forEach((project, id) => inMemoryStore.projects.set(id, project));
  return library;
}

async function writeProjectLibrary(projects: Map<string, LabelProject>): Promise<void> {
  const serialized = JSON.stringify(Array.from(projects.values()));
  if (isTauriEnvironment()) {
    await invoke('prefs_set', { key: PROJECT_LIBRARY_KEY, value: serialized });
  }
  inMemoryStore.projects.clear();
  projects.forEach((project, id) => inMemoryStore.projects.set(id, project));
}

async function replaceIndexedBackup(data: {
  templates: LabelTemplate[];
  products: ProductRecord[];
  jobs: PrintJob[];
  audit: AuditRecord[];
  importBatches: Array<Record<string, unknown> & { id: string }>;
  preferences: Record<string, string>;
}): Promise<void> {
  const database = await openProjectDatabase();
  await new Promise<void>((resolve, reject) => {
    const storeNames: BrowserStoreName[] = [
      'templates', 'template_revisions', 'products', 'jobs', 'audit', 'import_batches', 'kv',
    ];
    const transaction = database.transaction(storeNames, 'readwrite');
    storeNames.forEach((name) => transaction.objectStore(name).clear());
    data.templates.forEach((template) => {
      transaction.objectStore('templates').put(template);
      transaction.objectStore('template_revisions').put({
        key: `${template.id}_v${template.revision}`,
        id: template.id,
        revision: template.revision,
        template,
      });
    });
    data.products.forEach((product) => transaction.objectStore('products').put(product));
    data.jobs.forEach((job) => transaction.objectStore('jobs').put(job));
    data.audit.forEach((record) => transaction.objectStore('audit').put(record));
    data.importBatches.forEach((batch) => transaction.objectStore('import_batches').put(batch));
    Object.entries(data.preferences).forEach(([key, value]) => transaction.objectStore('kv').put({ key, value }));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(new Error(`Unable to restore browser database: ${transaction.error?.message || 'IndexedDB error'}`));
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error(`Browser database restore was aborted: ${transaction.error?.message || 'IndexedDB error'}`));
    };
  });
}

function assertUniqueRecordIds(records: Array<{ id?: unknown }>, collection: string): void {
  const ids = new Set<string>();
  records.forEach((record) => {
    if (!record || typeof record.id !== 'string' || !record.id.trim()) {
      throw new Error(`Backup contains a ${collection} entry without a valid id.`);
    }
    if (ids.has(record.id)) throw new Error(`Backup contains a duplicate ${collection} id: ${record.id}`);
    ids.add(record.id);
  });
}

function mergeCatalogRows(rows: ProductRecord[], products: Map<string, ProductRecord>): UpsertResult {
  let inserted = 0;
  let updated = 0;
  let rejected = 0;
  const rejections: UpsertResult['rejections'] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== 'object') {
      rejected++;
      rejections.push({ index: i, reason: 'not_an_object' });
      continue;
    }
    const id = String(row.id || row.PARTNO || row.PRODUCT_SCAN || '').trim();
    if (!id) {
      rejected++;
      rejections.push({ index: i, reason: 'missing_id' });
      continue;
    }
    if (row.SELLING_PRICE !== undefined && row.SELLING_PRICE !== null && (row.SELLING_PRICE as any) !== '') {
      const raw: unknown = row.SELLING_PRICE;
      let isValid = false;
      if (typeof raw === 'number') {
        isValid = !isNaN(raw) && isFinite(raw);
      } else if (typeof raw === 'string') {
        const clean = raw.replace(/[€$]/g, '').replace('FCFA', '').replace(/\s+/g, '').replace(',', '.');
        const num = parseFloat(clean);
        isValid = !isNaN(num) && isFinite(num);
      }
      if (!isValid) {
        rejected++;
        rejections.push({ index: i, reason: 'invalid_price' });
        continue;
      }
    }
    if (products.has(id)) updated++;
    else inserted++;
    products.set(id, { ...row, id });
  }
  return { inserted, updated, rejected, rejections };
}

async function upsertIndexedCatalogRows(rows: ProductRecord[]): Promise<UpsertResult> {
  const database = await openProjectDatabase();
  return await new Promise<UpsertResult>((resolve, reject) => {
    const transaction = database.transaction('products', 'readwrite');
    const store = transaction.objectStore('products');
    const request = store.getAll();
    let result: UpsertResult | undefined;
    request.onsuccess = () => {
      const products = new Map<string, ProductRecord>(
        (request.result as ProductRecord[]).map((product) => [product.id, product])
      );
      result = mergeCatalogRows(rows, products);
      store.clear();
      products.forEach((product) => store.put(product));
    };
    transaction.oncomplete = () => {
      database.close();
      if (result) resolve(result);
      else reject(new Error('Catalog update completed without a result.'));
    };
    transaction.onerror = () => {
      database.close();
      reject(new Error(`Unable to update the browser catalog: ${transaction.error?.message || 'IndexedDB error'}`));
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error(`Browser catalog update was aborted: ${transaction.error?.message || 'IndexedDB error'}`));
    };
  });
}

let auditIdCounter = 0;

export const api = {
  async mcpDraftList(): Promise<McpDraftSummary[]> {
    if (!isTauriEnvironment()) throw new Error('MCP drafts can only be reviewed in the native desktop application.');
    return await invoke<McpDraftSummary[]>('mcp_draft_list');
  },

  async mcpDraftRead(id: string): Promise<LabelTemplate> {
    if (!isTauriEnvironment()) throw new Error('MCP drafts can only be reviewed in the native desktop application.');
    return await invoke<LabelTemplate>('mcp_draft_read', { id });
  },

  async mcpDraftRemove(id: string): Promise<void> {
    if (!isTauriEnvironment()) throw new Error('MCP drafts can only be reviewed in the native desktop application.');
    await invoke<void>('mcp_draft_remove', { id });
  },

  async externalDbListTables(config: ExternalDbConfig): Promise<string[]> {
    if (!isTauriEnvironment()) {
      throw new Error('External database imports require the native desktop application.');
    }
    return await invoke<string[]>('external_db_list_tables', { config });
  },

  async externalDbFetchTable(config: ExternalDbConfig, table: string): Promise<ExternalDbPreview> {
    if (!isTauriEnvironment()) {
      throw new Error('External database imports require the native desktop application.');
    }
    return await invoke<ExternalDbPreview>('external_db_fetch_table', { config, table });
  },

  async printCapabilities(): Promise<NativePrintCapabilities> {
    if (!isTauriEnvironment()) {
      throw new Error('Physical printer integrations are available only in the native desktop application.');
    }
    return await invoke<NativePrintCapabilities>('print_capabilities');
  },

  async printListQueues(): Promise<NativePrintQueue[]> {
    if (!isTauriEnvironment()) {
      throw new Error('CUPS printer discovery requires the native desktop application.');
    }
    return await invoke<NativePrintQueue[]>('print_list_queues');
  },

  async printSubmitPdf(job: PrintJob, queue: string, pdfBytes: Uint8Array): Promise<PrintJob> {
    if (!isTauriEnvironment()) {
      throw new Error('PDF printer submission requires the native desktop application and an installed CUPS service.');
    }
    return await invoke<PrintJob>('print_submit_pdf', { job, queue, pdfBytes });
  },

  async printSubmitZpl(job: PrintJob, host: string, port: number, zplContent: string): Promise<PrintJob> {
    if (!isTauriEnvironment()) {
      throw new Error('ZPL printer submission requires the native desktop application.');
    }
    return await invoke<PrintJob>('print_submit_zpl', { job, host, port, zplContent });
  },

  async printRefreshJob(id: string): Promise<PrintJob> {
    if (!isTauriEnvironment()) {
      throw new Error('Print job tracking requires the native desktop application.');
    }
    return await invoke<PrintJob>('print_refresh_job', { id });
  },

  async printRetryJob(id: string): Promise<PrintJob> {
    if (!isTauriEnvironment()) {
      throw new Error('Print job retry requires the native desktop application.');
    }
    return await invoke<PrintJob>('print_retry_job', { id });
  },

  async templateList(): Promise<TemplateSummary[]> {
    if (isTauriEnvironment()) {
      return await invoke<TemplateSummary[]>('template_list');
    }
    const templates = hasBrowserDatabase()
      ? await readIndexedRecords<LabelTemplate>('templates')
      : Array.from(inMemoryStore.templates.values());
    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      width_mm: t.width_mm,
      height_mm: t.height_mm,
      revision: t.revision,
      updated_at: t.updated_at,
    }));
  },

  async templateGet(id: string): Promise<LabelTemplate> {
    if (isTauriEnvironment()) {
      return await invoke<LabelTemplate>('template_get', { id });
    }
    if (hasBrowserDatabase()) {
      const template = await readIndexedRecord<LabelTemplate>('templates', id);
      if (!template) throw new Error(`Template not found: ${id}`);
      return template;
    }
    const t = inMemoryStore.templates.get(id);
    if (!t) throw new Error(`Template not found: ${id}`);
    return t;
  },

  async templateGetRevision(id: string, revision: number): Promise<LabelTemplate> {
    if (isTauriEnvironment()) {
      return await invoke<LabelTemplate>('template_get_revision', { id, revision });
    }
    const revKey = `${id}_v${revision}`;
    if (hasBrowserDatabase()) {
      const stored = await readIndexedRecord<{ template: LabelTemplate }>('template_revisions', revKey);
      if (stored) return stored.template;
      const current = await readIndexedRecord<LabelTemplate>('templates', id);
      if (current) return current;
      throw new Error(`Template not found: ${id} (rev ${revision})`);
    }
    const t = inMemoryStore.templateRevisions.get(revKey) || inMemoryStore.templates.get(id);
    if (!t) throw new Error(`Template not found: ${id} (rev ${revision})`);
    return t;
  },

  async templateSave(doc: LabelTemplate): Promise<LabelTemplate> {
    if (isTauriEnvironment()) {
      const saved = await invoke<LabelTemplate>('template_save', { doc });
      notifyWorkspaceChange('templates', saved.id);
      return saved;
    }
    if (hasBrowserDatabase()) {
      const saved = await writeTemplateWithRevision(doc);
      notifyWorkspaceChange('templates', saved.id);
      return saved;
    }

    const existing = inMemoryStore.templates.get(doc.id);
    const revision = existing ? existing.revision + 1 : 1;
    const now = new Date().toISOString();
    const saved: LabelTemplate = {
      ...doc,
      revision,
      updated_at: now,
      created_at: doc.created_at || now,
    };
    inMemoryStore.templates.set(doc.id, saved);
    inMemoryStore.templateRevisions.set(`${saved.id}_v${saved.revision}`, saved);
    notifyWorkspaceChange('templates', saved.id);
    return saved;
  },

  async templateDelete(id: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('template_delete', { id });
      notifyWorkspaceChange('templates', id);
      return;
    }
    if (hasBrowserDatabase()) {
      await deleteTemplateRecords(id);
    } else {
      inMemoryStore.templates.delete(id);
      for (const key of inMemoryStore.templateRevisions.keys()) {
        if (key.startsWith(`${id}_v`)) inMemoryStore.templateRevisions.delete(key);
      }
    }
    notifyWorkspaceChange('templates', id);
  },

  async projectList(): Promise<LabelProject[]> {
    const library = await readProjectLibrary();
    return Array.from(library.values()).sort((a, b) =>
      (b.last_opened_at || b.updated_at).localeCompare(a.last_opened_at || a.updated_at)
    );
  },

  async projectGet(id: string): Promise<LabelProject> {
    const project = (await readProjectLibrary()).get(id);
    if (!project) throw new Error(`Project not found: ${id}`);
    return project;
  },

  async projectSave(project: LabelProject): Promise<LabelProject> {
    if (!isTauriEnvironment() && hasBrowserDatabase()) {
      const saved = await saveIndexedProject(project);
      notifyWorkspaceChange('projects', saved.id);
      return saved;
    }
    const library = await readProjectLibrary();
    const now = new Date().toISOString();
    const existing = library.get(project.id);
    const normalized: LabelProject = {
      ...project,
      id: project.id || `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: project.name || 'Nouveau projet',
      created_at: project.created_at || existing?.created_at || now,
      updated_at: now,
      templates: Array.isArray(project.templates) ? project.templates : [],
      data_sources: Array.isArray(project.data_sources) ? project.data_sources : [],
    };
    library.set(normalized.id, normalized);
    await writeProjectLibrary(library);
    notifyWorkspaceChange('projects', normalized.id);
    return normalized;
  },

  async projectDelete(id: string): Promise<void> {
    if (!isTauriEnvironment() && hasBrowserDatabase()) {
      await deleteIndexedProject(id);
      notifyWorkspaceChange('projects', id);
      return;
    }
    const library = await readProjectLibrary();
    library.delete(id);
    await writeProjectLibrary(library);
    notifyWorkspaceChange('projects', id);
  },

  async catalogSearch(q: string, limit?: number): Promise<ProductRecord[]> {
    if (isTauriEnvironment()) {
      return await invoke<ProductRecord[]>('catalog_search', { q, limit });
    }
    const lower = q.toLowerCase();
    const products = hasBrowserDatabase()
      ? await readIndexedRecords<ProductRecord>('products')
      : Array.from(inMemoryStore.products.values());
    const all = products.filter((p) => {
      if (!lower) return true;
      const name = (p.ITEMNAME || '').toLowerCase();
      const scan = (p.PRODUCT_SCAN || p.scan || '').toLowerCase();
      const partno = (p.PARTNO || p.partno || '').toLowerCase();
      return name.includes(lower) || scan.includes(lower) || partno.includes(lower);
    });
    return limit ? all.slice(0, limit) : all;
  },

  async catalogUpsert(rows: ProductRecord[]): Promise<UpsertResult> {
    if (isTauriEnvironment()) {
      const result = await invoke<UpsertResult>('catalog_upsert', { rows });
      notifyWorkspaceChange('catalog');
      return result;
    }
    const result = hasBrowserDatabase()
      ? await upsertIndexedCatalogRows(rows)
      : mergeCatalogRows(rows, inMemoryStore.products);
    notifyWorkspaceChange('catalog');
    return result;
  },

  async catalogReplaceAll(rows: ProductRecord[]): Promise<number> {
    if (isTauriEnvironment()) {
      const count = await invoke<number>('catalog_replace_all', { rows });
      notifyWorkspaceChange('catalog');
      return count;
    }
    const products = hasBrowserDatabase() ? new Map<string, ProductRecord>() : inMemoryStore.products;
    products.clear();
    let count = 0;
    for (const r of rows) {
      const id = String(r.id || r.PARTNO || r.PRODUCT_SCAN || '').trim();
      if (!id) continue;
      products.set(id, { ...r, id });
      count++;
    }
    if (hasBrowserDatabase()) await writeIndexedRecords('products', Array.from(products.values()), true);
    notifyWorkspaceChange('catalog');
    return count;
  },

  async catalogCommitImport(
    rows: ProductRecord[],
    report: {
      id: string;
      filename: string;
      timestamp?: string;
      totalRowsRead?: number;
      importedCount?: number;
      updatedCount?: number;
      rejectedCount?: number;
      duplicateCount?: number;
      warnings?: string[];
    },
    replaceAll: boolean
  ): Promise<number> {
    if (!report.id.trim() || !report.filename.trim()) {
      throw new Error('Catalog import report must include an id and filename.');
    }
    const createdAt = typeof report.timestamp === 'string' ? report.timestamp : new Date().toISOString();
    const batch = {
      ...report,
      id: report.id,
      filename: report.filename,
      timestamp: createdAt,
      created_at: createdAt,
      report_json: JSON.stringify(report),
    };
    const seenIds = new Set<string>();
    const normalizedRows = rows.map((row) => {
      const id = String(row.id || row.PARTNO || row.PRODUCT_SCAN || '').trim();
      if (!id) throw new Error('Catalog import contains a product without an identifier.');
      if (seenIds.has(id)) throw new Error(`Catalog import contains duplicate product id "${id}".`);
      seenIds.add(id);
      return { ...row, id };
    });

    if (isTauriEnvironment()) {
      const count = await invoke<number>('catalog_commit_import', {
        rows: normalizedRows,
        reportJson: JSON.stringify(report),
        replaceAll,
      });
      notifyWorkspaceChange('catalog');
      return count;
    }
    if (hasBrowserDatabase()) {
      const database = await openProjectDatabase();
      return await new Promise<number>((resolve, reject) => {
        const transaction = database.transaction(['products', 'import_batches'], 'readwrite');
        const productStore = transaction.objectStore('products');
        if (replaceAll) productStore.clear();
        normalizedRows.forEach((row) => productStore.put(row));
        transaction.objectStore('import_batches').put(batch);
        transaction.oncomplete = () => {
          database.close();
          notifyWorkspaceChange('catalog');
          resolve(normalizedRows.length);
        };
        transaction.onerror = () => {
          database.close();
          reject(new Error(`Unable to commit catalog import: ${transaction.error?.message || 'IndexedDB error'}`));
        };
        transaction.onabort = () => {
          database.close();
          reject(new Error(`Catalog import transaction was aborted: ${transaction.error?.message || 'IndexedDB error'}`));
        };
      });
    }

    const nextProducts = replaceAll ? new Map<string, ProductRecord>() : new Map(inMemoryStore.products);
    normalizedRows.forEach((row) => nextProducts.set(row.id, row));
    const nextBatches = [batch, ...inMemoryStore.importBatches.filter((existing) => existing.id !== batch.id)];
    inMemoryStore.products = nextProducts;
    inMemoryStore.importBatches = nextBatches;
    notifyWorkspaceChange('catalog');
    return normalizedRows.length;
  },

  async jobInsert(job: PrintJob): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('job_insert', { job });
      return;
    }
    if (hasBrowserDatabase()) {
      await writeIndexedRecords('jobs', [job]);
      return;
    }
    inMemoryStore.jobs.set(job.id, job);
  },

  async jobList(limit?: number): Promise<PrintJob[]> {
    if (isTauriEnvironment()) {
      return await invoke<PrintJob[]>('job_list', { limit: limit ?? null });
    }
    const records = hasBrowserDatabase()
      ? await readIndexedRecords<PrintJob>('jobs')
      : Array.from(inMemoryStore.jobs.values());
    const jobs = records.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return limit ? jobs.slice(0, limit) : jobs.slice(0, 100);
  },

  async auditAppend(action: string, entityId: string | undefined, details: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('audit_append', {
        action,
        entityId: entityId ?? null,
        entity_id: entityId ?? null,
        details,
      });
      return;
    }
    auditIdCounter++;
    const entry: AuditRecord = {
      id: `aud_${Date.now()}_${auditIdCounter}`,
      at: new Date().toISOString(),
      os_user: 'system',
      action,
      entity_id: entityId ?? null,
      details,
    };
    if (hasBrowserDatabase()) {
      await writeIndexedRecords('audit', [entry]);
      return;
    }
    inMemoryStore.audit.unshift(entry);
  },

  async auditList(limit?: number): Promise<AuditRecord[]> {
    if (isTauriEnvironment()) {
      return await invoke<AuditRecord[]>('audit_list', { limit });
    }
    const entries = hasBrowserDatabase()
      ? await readIndexedRecords<AuditRecord>('audit')
      : inMemoryStore.audit;
    return entries.slice(0, limit || 200);
  },

  async prefsGet(key: string): Promise<string | null> {
    if (isTauriEnvironment()) {
      return await invoke<string | null>('prefs_get', { key });
    }
    if (hasBrowserDatabase()) {
      return (await readIndexedRecord<{ key: string; value: string }>('kv', key))?.value ?? null;
    }
    return inMemoryStore.kv.get(key) ?? null;
  },

  async prefsSet(key: string, value: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('prefs_set', { key, value });
      return;
    }
    if (hasBrowserDatabase()) {
      await writeIndexedRecords('kv', [{ key, value }]);
      return;
    }
    inMemoryStore.kv.set(key, value);
  },

  async prefsList(): Promise<Record<string, string>> {
    if (isTauriEnvironment()) {
      const entries = await invoke<[string, string][]>('prefs_list');
      return Object.fromEntries(entries);
    }
    if (hasBrowserDatabase()) {
      const entries = await readIndexedRecords<{ key: string; value: string }>('kv');
      return Object.fromEntries(entries.map(({ key, value }) => [key, value]));
    }
    return Object.fromEntries(inMemoryStore.kv);
  },

  async batchImportRecord(id: string, filename: string, reportJson: string): Promise<void> {
    if (isTauriEnvironment()) {
      await invoke('batch_import_record', {
        id,
        filename,
        reportJson,
        report_json: reportJson,
      });
      return;
    }
    let batch: Record<string, unknown>;
    try {
      const parsed = JSON.parse(reportJson);
      batch = {
        id,
        filename,
        report_json: reportJson,
        created_at: new Date().toISOString(),
        ...parsed,
      };
    } catch {
      batch = {
        id,
        filename,
        report_json: reportJson,
        created_at: new Date().toISOString(),
      };
    }
    if (hasBrowserDatabase()) {
      await writeIndexedRecords('import_batches', [batch]);
      return;
    }
    inMemoryStore.importBatches.unshift(batch);
  },

  async batchImportList(limit?: number): Promise<any[]> {
    if (isTauriEnvironment()) {
      return await invoke<any[]>('batch_import_list', { limit: limit ?? null });
    }
    const batches = hasBrowserDatabase()
      ? await readIndexedRecords<Record<string, unknown>>('import_batches')
      : inMemoryStore.importBatches;
    return limit ? batches.slice(0, limit) : batches.slice(0, 100);
  },

  async exportDatabase(): Promise<string> {
    const summaries = await api.templateList();
    const fullTemplates = await Promise.all(
      summaries.map(async (s) => {
        try {
          return await api.templateGet(s.id);
        } catch {
          return null;
        }
      })
    );
    const validTemplates = fullTemplates.filter((t): t is LabelTemplate => t !== null);
    const allRows = Number.MAX_SAFE_INTEGER;
    const products = await api.catalogSearch('', allRows);
    const jobs = await api.jobList(allRows);
    const audit = await api.auditList(allRows);
    const importBatches = await api.batchImportList(allRows);
    const preferences = await api.prefsList();
    const dump = {
      version: 1,
      exported_at: new Date().toISOString(),
      templates: validTemplates,
      products,
      jobs,
      audit,
      import_batches: importBatches,
      preferences,
    };
    return JSON.stringify(dump, null, 2);
  },

  async importDatabase(jsonStr: string): Promise<{
    templates: number;
    products: number;
    jobs: number;
    audit: number;
    import_batches: number;
    preferences: number;
  }> {
    const data = JSON.parse(jsonStr);
    if (!data || data.version !== 1 || typeof data !== 'object') {
      throw new Error('Unsupported database backup format.');
    }

    const current = JSON.parse(await api.exportDatabase());
    const backup = {
      ...current,
      ...data,
      templates: Array.isArray(data.templates) ? data.templates : current.templates,
      products: Array.isArray(data.products) ? data.products : current.products,
      jobs: Array.isArray(data.jobs) ? data.jobs : current.jobs,
      audit: Array.isArray(data.audit) ? data.audit : current.audit,
      import_batches: Array.isArray(data.import_batches) ? data.import_batches : current.import_batches,
      preferences: data.preferences && typeof data.preferences === 'object' ? data.preferences : current.preferences,
    };

    const templates = backup.templates.map((template: any) => {
      if (!template || typeof template !== 'object' || typeof template.id !== 'string' || !template.id.trim() || typeof template.name !== 'string' || !template.name.trim()) {
        throw new Error('Backup contains a template without an id or name.');
      }
      return template as LabelTemplate;
    });
    const { normalizeCatalogProduct } = await import('../utils/catalogImport');
    const products = backup.products.map((product: any) => {
      if (!product || typeof product !== 'object') throw new Error('Backup contains an invalid product.');
      return normalizeCatalogProduct(product as ProductRecord);
    });
    const jobs = backup.jobs as PrintJob[];
    const audit = backup.audit as AuditRecord[];
    const importBatches = backup.import_batches as any[];
    const preferences = backup.preferences as Record<string, string>;
    assertUniqueRecordIds(templates, 'template');
    assertUniqueRecordIds(products, 'product');
    assertUniqueRecordIds(jobs, 'job');
    assertUniqueRecordIds(audit, 'audit');
    assertUniqueRecordIds(importBatches, 'import batch');
    if (!preferences || Object.values(preferences).some((value) => typeof value !== 'string')) {
      throw new Error('Backup contains invalid preferences.');
    }

    if (isTauriEnvironment()) {
      return await invoke<{
        templates: number;
        products: number;
        jobs: number;
        audit: number;
        import_batches: number;
        preferences: number;
      }>('database_restore', {
        backup: { ...backup, templates, products, jobs, audit, import_batches: importBatches },
      });
    }

    if (hasBrowserDatabase()) {
      await replaceIndexedBackup({
        templates,
        products,
        jobs,
        audit,
        importBatches,
        preferences,
      });
      return {
        templates: templates.length,
        products: products.length,
        jobs: jobs.length,
        audit: audit.length,
        import_batches: importBatches.length,
        preferences: Object.keys(preferences).length,
      };
    }

    const uniqueTemplates = new Map<string, LabelTemplate>();
    templates.forEach((template) => {
      if (uniqueTemplates.has(template.id)) throw new Error(`Duplicate template id: ${template.id}`);
      uniqueTemplates.set(template.id, template);
    });
    const uniqueProducts = new Map<string, ProductRecord>();
    products.forEach((product) => {
      if (uniqueProducts.has(product.id)) throw new Error(`Duplicate product id: ${product.id}`);
      uniqueProducts.set(product.id, product);
    });

    inMemoryStore.templates.clear();
    inMemoryStore.templateRevisions.clear();
    uniqueTemplates.forEach((template) => {
      inMemoryStore.templates.set(template.id, template);
      inMemoryStore.templateRevisions.set(`${template.id}_v${template.revision}`, template);
    });
    inMemoryStore.products.clear();
    uniqueProducts.forEach((product) => inMemoryStore.products.set(product.id, product));
    inMemoryStore.jobs.clear();
    jobs.forEach((job) => inMemoryStore.jobs.set(job.id, job));
    inMemoryStore.audit = audit;
    inMemoryStore.importBatches = importBatches;
    inMemoryStore.kv.clear();
    Object.entries(preferences).forEach(([key, value]) => inMemoryStore.kv.set(key, value));

    return {
      templates: templates.length,
      products: products.length,
      jobs: jobs.length,
      audit: audit.length,
      import_batches: importBatches.length,
      preferences: Object.keys(preferences).length,
    };
  },

  async backupDb(destPath: string): Promise<string> {
    if (isTauriEnvironment()) {
      return await invoke<string>('backup_db', { destPath });
    }
    return destPath;
  },

  async restoreDb(sourcePath: string): Promise<string> {
    if (isTauriEnvironment()) {
      return await invoke<string>('restore_db', { sourcePath });
    }
    return 'Base locale restaurée';
  },
};
