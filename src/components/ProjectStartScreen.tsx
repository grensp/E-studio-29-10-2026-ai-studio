import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Copy,
  FilePlus2,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { LabelProject } from '../types';

interface ProjectStartScreenProps {
  projects: LabelProject[];
  newProjectRequested?: boolean;
  onNewProjectRequestHandled?: () => void;
  onCreateProject: (name: string) => void;
  onOpenProject: (project: LabelProject) => void;
  onOpenProjectFile: (file: File) => void;
  onRenameProject: (projectId: string, name: string) => void;
  onDuplicateProject: (project: LabelProject) => void;
  onDeleteProject: (projectId: string) => void;
  onExportProject: (project: LabelProject, format: 'eproj' | 'zip') => void;
}

function formatProjectDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date inconnue'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export const ProjectStartScreen: React.FC<ProjectStartScreenProps> = ({
  projects,
  newProjectRequested = false,
  onNewProjectRequestHandled,
  onCreateProject,
  onOpenProject,
  onOpenProjectFile,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
  onExportProject,
}) => {
  const [search, setSearch] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  useEffect(() => {
    if (newProjectRequested) {
      setShowNewProject(true);
      onNewProjectRequestHandled?.();
    }
  }, [newProjectRequested, onNewProjectRequestHandled]);
  const filteredProjects = useMemo(
    () => projects.filter((project) => project.name.toLowerCase().includes(search.trim().toLowerCase())),
    [projects, search]
  );

  const createProject = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newProjectName.trim();
    if (!name) return;
    onCreateProject(name);
    setNewProjectName('');
    setShowNewProject(false);
  };

  return (
    <div data-studio-workspace="projects" className="flex-1 overflow-y-auto bg-[#111318] text-slate-100">
      <div className="w-full px-6 py-5">
        <header className="mb-5 flex items-center justify-between gap-6 border-b border-slate-700 pb-4">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-blue-400">E-Studio Desktop</div>
            <h1 className="text-xl font-semibold text-white">Projets récents</h1>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>{projects.length} projet{projects.length === 1 ? '' : 's'} local{projects.length === 1 ? '' : 'aux'}</span>
            <span className="hidden lg:inline text-slate-500">Bibliothèque de travail</span>
          </div>
        </header>

        <section className="mb-5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowNewProject(true)}
            className="group flex h-10 items-center gap-2 rounded-md border border-slate-600 bg-slate-900/70 px-3 text-left text-sm transition hover:border-blue-500/70 hover:bg-slate-900"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-blue-400">
              <FilePlus2 className="h-4 w-4" />
            </span>
            <span className="font-semibold text-white">Nouveau projet</span>
          </button>

          <label className="group flex h-10 cursor-pointer items-center gap-2 rounded-md border border-slate-600 bg-slate-900/70 px-3 text-left text-sm transition hover:border-emerald-500/70 hover:bg-slate-900">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-emerald-500">
              <FolderOpen className="h-4 w-4" />
            </span>
            <span className="font-semibold text-white">Ouvrir un projet</span>
            <input
              type="file"
              accept=".eproj,.zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onOpenProjectFile(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </section>

        {showNewProject && (
          <form onSubmit={createProject} className="mb-5 flex flex-wrap items-end gap-3 rounded-md border border-blue-500/30 bg-blue-500/5 p-4">
            <label className="min-w-64 flex-1 text-sm font-medium text-slate-300">
              Nom du projet
              <input
                autoFocus
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="Ex. Étiquettes magasin"
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
              />
            </label>
            <button type="submit" disabled={!newProjectName.trim()} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
              Créer
            </button>
            <button type="button" onClick={() => setShowNewProject(false)} className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white">
              Annuler
            </button>
          </form>
        )}

        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Nom · Gabarits · Sources · Dernière ouverture</h2>
            </div>
            <label className="flex w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 sm:w-64">
              <Search className="h-4 w-4 text-slate-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un projet" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
            </label>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-700 px-6 py-12 text-center">
              <Clock3 className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-300">{projects.length ? 'Aucun projet ne correspond à cette recherche.' : 'Aucun projet récent'}</p>
              {!projects.length && <p className="mt-1 text-xs text-slate-500">Créez un projet ou ouvrez un fichier .eproj pour commencer.</p>}
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-900/50">
              {filteredProjects.map((project) => (
                <div key={project.id} className="group flex min-h-14 items-center gap-4 border-b border-slate-800 px-4 py-2 last:border-b-0 hover:bg-slate-800/50">
                  <button onClick={() => onOpenProject(project)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-800 text-blue-400">
                      <FolderOpen className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-100">{project.name}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {project.templates.length} gabarit{project.templates.length === 1 ? '' : 's'} · {project.data_sources.length} source{project.data_sources.length === 1 ? '' : 's'} · {formatProjectDate(project.last_opened_at || project.updated_at)}
                      </span>
                    </span>
                  </button>
                  <button onClick={() => onOpenProject(project)} className="hidden rounded-md px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/10 sm:block">Ouvrir</button>
                  <div className="relative">
                    <button onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)} className="rounded-md p-2 text-slate-500 hover:bg-slate-700 hover:text-white" aria-label={`Actions pour ${project.name}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {openMenuId === project.id && (
                      <>
                        <button className="fixed inset-0 z-10 cursor-default" aria-label="Fermer le menu" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-10 z-20 w-44 rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl">
                          <button onClick={() => { const name = window.prompt('Renommer le projet', project.name); if (name?.trim()) onRenameProject(project.id, name.trim()); setOpenMenuId(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white"><Pencil className="h-3.5 w-3.5" />Renommer</button>
                          <button onClick={() => { onDuplicateProject(project); setOpenMenuId(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white"><Copy className="h-3.5 w-3.5" />Dupliquer</button>
                          <button onClick={() => { onExportProject(project, 'eproj'); setOpenMenuId(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white"><Upload className="h-3.5 w-3.5" />Exporter .eproj</button>
                          <button onClick={() => { onExportProject(project, 'zip'); setOpenMenuId(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white"><Upload className="h-3.5 w-3.5" />Exporter ZIP</button>
                          <button onClick={() => { if (window.confirm(`Supprimer le projet « ${project.name} » ?`)) onDeleteProject(project.id); setOpenMenuId(null); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" />Supprimer</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
