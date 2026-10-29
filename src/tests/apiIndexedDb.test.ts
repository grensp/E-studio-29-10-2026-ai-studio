import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { api } from '../services/api';
import { LabelProject, LabelTemplate } from '../types';
import { importZplTemplate } from '../utils/zplTemplateImport';

vi.stubGlobal('indexedDB', indexedDB);

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('e-studio-project-library');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('The test database could not be reset because a connection remained open.'));
  });
}

function openVersionOneDatabase(project: LabelProject): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('e-studio-project-library', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('projects', { keyPath: 'id' });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('projects', 'readwrite');
      transaction.objectStore('projects').put(project);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    };
  });
}

const project: LabelProject = {
  id: 'idb-project',
  name: 'Legacy project',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  templates: [],
  data_sources: [],
};

const template: LabelTemplate = {
  id: 'idb-template',
  name: 'Persistent template',
  revision: 1,
  schema_version: 1,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  width_mm: 80,
  height_mm: 40,
  inner_margins_mm: { top: 1, bottom: 1, left: 1, right: 1 },
  outer_margins_mm: { top: 0, bottom: 0, left: 0, right: 0 },
  bg_color: '#ffffff',
  bg_opacity: 1,
  items: [],
};

describe('browser IndexedDB persistence', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  it('upgrades an existing v1 project database without losing project data', async () => {
    await openVersionOneDatabase(project);

    expect(await api.projectGet(project.id)).toMatchObject({ id: project.id, name: project.name });
    await api.templateSave(template);
    expect(await api.templateGet(template.id)).toMatchObject({ id: template.id, name: template.name });

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('e-studio-project-library');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(database.version).toBe(2);
    expect(database.objectStoreNames.contains('projects')).toBe(true);
    expect(database.objectStoreNames.contains('templates')).toBe(true);
    database.close();
  });

  it('keeps independently created projects when saves happen concurrently', async () => {
    await Promise.all([
      api.projectSave({ ...project, id: 'parallel-a', name: 'Project A' }),
      api.projectSave({ ...project, id: 'parallel-b', name: 'Project B' }),
    ]);

    expect((await api.projectList()).map(({ id }) => id).sort()).toEqual(['parallel-a', 'parallel-b']);
  });

  it('persists imported ZPL source metadata with the editable template and its revision', async () => {
    const imported = importZplTemplate('^XA\n^PW406\n^LL203\n^FO10,20^A0N,24,18^FH^FDSource-backed^FS\n^XZ').template;

    await api.templateSave(imported);

    expect((await api.templateGet(imported.id)).zpl_source).toEqual(imported.zpl_source);
    expect((await api.templateGetRevision(imported.id, 1)).zpl_source).toEqual(imported.zpl_source);
  });

  it('merges concurrent catalog imports without dropping either batch', async () => {
    await Promise.all([
      api.catalogUpsert([{ id: 'parallel-product-a', ITEMNAME: 'A' }]),
      api.catalogUpsert([{ id: 'parallel-product-b', ITEMNAME: 'B' }]),
    ]);

    expect((await api.catalogSearch('')).map(({ id }) => id).sort()).toEqual([
      'parallel-product-a',
      'parallel-product-b',
    ]);
  });

  it('commits catalog rows and import history together and supports an atomic replace', async () => {
    const firstReport = {
      id: 'batch-atomic-1',
      filename: 'first.csv',
      timestamp: '2026-01-01T00:00:00.000Z',
      importedCount: 1,
    };
    await api.catalogCommitImport([{ id: 'first-product', ITEMNAME: 'First' }], firstReport, false);

    expect(await api.catalogSearch('')).toMatchObject([{ id: 'first-product' }]);
    expect(await api.batchImportList()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstReport.id, filename: firstReport.filename }),
    ]));

    const replaceReport = {
      id: 'batch-atomic-2',
      filename: 'replacement.csv',
      timestamp: '2026-01-02T00:00:00.000Z',
      importedCount: 1,
    };
    await api.catalogCommitImport([{ id: 'replacement-product', ITEMNAME: 'Replacement' }], replaceReport, true);

    expect(await api.catalogSearch('')).toMatchObject([{ id: 'replacement-product' }]);
    expect(await api.batchImportList()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: replaceReport.id, filename: replaceReport.filename }),
    ]));
  });

  it('rejects invalid catalog commits before mutating the catalog', async () => {
    await api.catalogCommitImport([{ id: 'existing-product', ITEMNAME: 'Existing' }], {
      id: 'existing-batch',
      filename: 'existing.csv',
    }, false);

    await expect(api.catalogCommitImport([{ id: 'replacement-product', ITEMNAME: 'Replacement' }], {
      id: '',
      filename: 'invalid.csv',
    }, true)).rejects.toThrow('id and filename');
    await expect(api.catalogCommitImport([
      { id: 'duplicate-product', ITEMNAME: 'First row' },
      { id: 'duplicate-product', ITEMNAME: 'Second row' },
    ], {
      id: 'duplicate-batch',
      filename: 'duplicate.csv',
    }, true)).rejects.toThrow('duplicate product id');

    expect(await api.catalogSearch('')).toMatchObject([{ id: 'existing-product' }]);
  });

  it('persists templates, catalog, jobs, audit, preferences, and import history', async () => {
    const savedTemplate = await api.templateSave(template);
    await api.catalogUpsert([{ id: 'persistent-product', ITEMNAME: 'Persistent item', SELLING_PRICE: 12 }]);
    await api.jobInsert({
      id: 'persistent-job',
      template_id: savedTemplate.id,
      template_revision: savedTemplate.revision,
      product_ids: ['persistent-product'],
      format: 'pdf',
      imposition_json: '{}',
      target: 'labels.pdf',
      status: 'ready',
      error: null,
      created_at: new Date().toISOString(),
    });
    await api.auditAppend('PERSISTED', savedTemplate.id, 'indexeddb test');
    await api.prefsSet('indexeddb-test', 'persisted');
    await api.batchImportRecord('persistent-batch', 'products.csv', '{}');

    expect(await api.templateGet(savedTemplate.id)).toMatchObject({ name: template.name, revision: 1 });
    expect(await api.templateGetRevision(savedTemplate.id, 1)).toMatchObject({ revision: 1 });
    expect(await api.catalogSearch('Persistent item')).toMatchObject([{ id: 'persistent-product' }]);
    expect(await api.jobList()).toMatchObject([expect.objectContaining({ id: 'persistent-job' })]);
    expect(await api.auditList()).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'PERSISTED' })]));
    expect(await api.prefsGet('indexeddb-test')).toBe('persisted');
    expect(await api.batchImportList()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'persistent-batch' })]));
  });

  it('assigns distinct revisions when the same template is saved concurrently', async () => {
    const [first, second] = await Promise.all([
      api.templateSave({ ...template, name: 'First concurrent edit' }),
      api.templateSave({ ...template, name: 'Second concurrent edit' }),
    ]);

    expect([first.revision, second.revision].sort()).toEqual([1, 2]);
    expect(await api.templateGetRevision(template.id, 1)).toMatchObject({ revision: 1 });
    expect(await api.templateGetRevision(template.id, 2)).toMatchObject({ revision: 2 });
  });

  it('restores browser records atomically and keeps the project library', async () => {
    await api.projectSave(project);
    const dump = JSON.stringify({
      version: 1,
      templates: [template],
      products: [{ id: 'restored-product', ITEMNAME: 'Restored' }],
      jobs: [],
      audit: [],
      import_batches: [],
      preferences: { restored: 'yes' },
    });

    await api.importDatabase(dump);

    expect(await api.templateGet(template.id)).toMatchObject({ id: template.id });
    expect(await api.catalogSearch('')).toMatchObject([{ id: 'restored-product' }]);
    expect(await api.prefsGet('restored')).toBe('yes');
    expect(await api.projectGet(project.id)).toMatchObject({ id: project.id });
  });

  it('rejects duplicate backup IDs without replacing existing browser records', async () => {
    await api.templateSave(template);
    const duplicateTemplate = { ...template, name: 'Duplicate' };
    const dump = JSON.stringify({
      version: 1,
      templates: [template, duplicateTemplate],
      products: [],
      jobs: [],
      audit: [],
      import_batches: [],
      preferences: {},
    });

    await expect(api.importDatabase(dump)).rejects.toThrow('duplicate template id');
    expect(await api.templateGet(template.id)).toMatchObject({ name: template.name });
  });
});
