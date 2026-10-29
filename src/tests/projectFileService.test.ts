import { describe, expect, it } from 'vitest';
import { LabelProject } from '../types';
import { projectFileService } from '../services/projectFileService';

const project: LabelProject = {
  id: 'project-1',
  name: 'Boutique Alpha',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  templates: [],
  data_sources: [{
    id: 'source-1',
    name: 'Catalogue local',
    source_file_name: 'articles.csv',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    records: [{
      id: 'product-1',
      ITEMNAME: 'Article isolé',
      SELLING_PRICE: 14.5,
    }],
  }],
};

describe('project file service', () => {
  it('round-trips unencrypted .eproj files', async () => {
    const contents = await projectFileService.exportEproj(project);
    await expect(projectFileService.importEproj(contents)).resolves.toEqual(project);
  });

  it('encrypts and authenticates .eproj project contents', async () => {
    const contents = await projectFileService.exportEproj(project, 'correct-horse-battery');
    expect(contents).not.toContain(project.name);
    await expect(projectFileService.importEproj(contents, 'correct-horse-battery')).resolves.toEqual(project);
    await expect(projectFileService.importEproj(contents, 'wrong-password')).rejects.toThrow(
      'The password is incorrect or the project file is damaged.'
    );
    await expect(projectFileService.importEproj(contents)).rejects.toThrow('This project is password-protected.');
  });

  it('exports and imports an unencrypted ZIP alternative', async () => {
    const contents = await projectFileService.exportZip(project);
    await expect(projectFileService.importZip(contents)).resolves.toEqual(project);
  });

  it('supports password protection in ZIP project archives', async () => {
    const contents = await projectFileService.exportZip(project, 'correct-horse-battery');
    await expect(projectFileService.importZip(contents, 'correct-horse-battery')).resolves.toEqual(project);
    await expect(projectFileService.importZip(contents, 'wrong-password')).rejects.toThrow(
      'The password is incorrect or the project file is damaged.'
    );
  });

  it('rejects invalid project shapes and malformed archives', async () => {
    await expect(projectFileService.exportEproj({ ...project, templates: null as any })).rejects.toThrow(
      'The project file is missing required project metadata, templates, or data sources.'
    );
    await expect(projectFileService.importZip(new Uint8Array([1, 2, 3]))).rejects.toThrow(
      'The ZIP project is missing its central directory.'
    );
  });

  it('requires a minimum password length', async () => {
    await expect(projectFileService.exportEproj(project, 'short')).rejects.toThrow(
      'Project passwords must contain at least 8 characters.'
    );
  });
});
