import { describe, it, expect } from 'vitest';
import { api } from '../services/api';
import { LabelProject, LabelTemplate, ProductRecord } from '../types';

describe('API Services & In-Memory Store Unit Tests', () => {
  it('persists project library entries across project API operations', async () => {
    const project: LabelProject = {
      id: 'project_api_library_test',
      name: 'Project Library Test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      templates: [],
      data_sources: [],
    };

    const saved = await api.projectSave(project);
    expect(await api.projectGet(project.id)).toMatchObject({ id: project.id, name: project.name });
    expect((await api.projectList()).some((item) => item.id === project.id)).toBe(true);

    await api.projectSave({ ...saved, name: 'Renamed Project' });
    expect((await api.projectGet(project.id)).name).toBe('Renamed Project');
    await api.projectDelete(project.id);
    await expect(api.projectGet(project.id)).rejects.toThrow(`Project not found: ${project.id}`);
  });

  it('saves and retrieves templates accurately with revision increment', async () => {
    const tpl: LabelTemplate = {
      id: 'tpl_unit_test',
      name: 'Test Template API',
      revision: 1,
      schema_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      width_mm: 80,
      height_mm: 40,
      inner_margins_mm: { top: 1, bottom: 1, left: 1, right: 1 },
      outer_margins_mm: { top: 0, bottom: 0, left: 0, right: 0 },
      bg_color: '#ffffff',
      bg_opacity: 1,
      items: [],
    };

    const saved1 = await api.templateSave(tpl);
    expect(saved1.revision).toBe(1);

    const saved2 = await api.templateSave(saved1);
    expect(saved2.revision).toBe(2);

    const fetched = await api.templateGet(tpl.id);
    expect(fetched.name).toBe('Test Template API');
    expect(fetched.revision).toBe(2);
  });

  it('catalogUpsert returns structured UpsertResult with inserted, updated, and rejections', async () => {
    const rows: ProductRecord[] = [
      {
        id: 'p_valid_1',
        ITEMNAME: 'Article Valide 1',
        SELLING_PRICE: 12.5,
      },
      {
        id: '',
        ITEMNAME: 'Article Sans ID',
        SELLING_PRICE: 5.0,
      },
      {
        id: 'p_invalid_price',
        ITEMNAME: 'Article Prix Invalide',
        SELLING_PRICE: 'abc' as any,
      },
    ];

    const result = await api.catalogUpsert(rows);
    expect(result.inserted).toBe(1);
    expect(result.rejected).toBe(2);
    expect(result.rejections.length).toBe(2);
    expect(result.rejections.some((r) => r.reason === 'missing_id')).toBe(true);
    expect(result.rejections.some((r) => r.reason === 'invalid_price')).toBe(true);
  });

  it('exports and restores templates, products, jobs, audit, and import history', async () => {
    await api.jobInsert({
      id: 'job_restore_test',
      template_id: 'tpl_unit_test',
      template_revision: 2,
      product_ids: ['p_valid_1'],
      format: 'pdf',
      imposition_json: '{}',
      target: '/tmp/test.pdf',
      status: 'ready',
      error: null,
      created_at: new Date().toISOString(),
    });
    await api.auditAppend('RESTORE_TEST', 'entity-1', 'restore roundtrip');
    await api.batchImportRecord('batch_restore_test', 'catalog.xlsx', JSON.stringify({ importedCount: 1 }));
    await api.prefsSet('restore_test_preference', 'enabled');

    const dump = await api.exportDatabase();
    expect(dump).toBeDefined();
    const parsed = JSON.parse(dump);
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.templates)).toBe(true);
    expect(Array.isArray(parsed.jobs)).toBe(true);
    expect(Array.isArray(parsed.audit)).toBe(true);
    expect(Array.isArray(parsed.import_batches)).toBe(true);
    expect(parsed.preferences.restore_test_preference).toBe('enabled');

    const restoreRes = await api.importDatabase(dump);
    expect(restoreRes).toMatchObject({ templates: expect.any(Number), products: expect.any(Number) });
    expect((await api.jobList()).some((job) => job.id === 'job_restore_test')).toBe(true);
    expect((await api.auditList()).some((record) => record.action === 'RESTORE_TEST')).toBe(true);
    expect((await api.batchImportList()).some((batch) => batch.id === 'batch_restore_test')).toBe(true);
    expect(await api.prefsGet('restore_test_preference')).toBe('enabled');
  });
});
