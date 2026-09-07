import React, { useState } from 'react';
import { 
  FolderKanban, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  Code2, 
  Clock, 
  CheckCircle2, 
  X, 
  Layers, 
  Play, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function ProjectsModal({
  isOpen,
  onClose,
  projects = [],
  currentThreadId,
  onSelectProject,
  onDeleteProject,
  onRenameProject,
  onNewProject,
  onOpenCanvas
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'completed'
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  if (!isOpen) return null;

  const safeProjects = Array.isArray(projects) ? projects : [];

  const filteredProjects = safeProjects.filter((p) => {
    const title = (p.title || p.requirement || 'Project Task').toLowerCase();
    const matchesSearch = title.includes(search.toLowerCase());
    if (filter === 'active') return matchesSearch && p.thread_id === currentThreadId;
    return matchesSearch;
  });

  const handleStartRename = (proj, e) => {
    e.stopPropagation();
    setEditingId(proj.thread_id);
    setEditTitle(proj.title || proj.requirement || 'Project Task');
  };

  const handleSaveRename = (threadId, e) => {
    e.stopPropagation();
    if (editTitle.trim() && onRenameProject) {
      onRenameProject(threadId, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center justify-center shadow-2xs">
              <FolderKanban className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                <span>Projects & Workspaces</span>
                <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200/80 font-semibold px-2.5 py-0.5 rounded-full">
                  {safeProjects.length} Total
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Manage your multi-agent AI project builds, code sandboxes, and chat sessions.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onClose();
                onNewProject();
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-6 py-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project by name or prompt..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === 'all' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Projects
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === 'active' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Session
            </button>
          </div>
        </div>

        {/* Projects List Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          {filteredProjects.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <FolderKanban className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">No projects found</h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                {search ? 'No matching projects match your search query.' : 'You haven’t created any AI project builds yet.'}
              </p>
              <button
                onClick={() => {
                  onClose();
                  onNewProject();
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-sm hover:bg-indigo-700 transition-all"
              >
                Start First Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProjects.map((proj) => {
                const isSelected = currentThreadId === proj.thread_id;
                const isEditing = editingId === proj.thread_id;
                const titleText = proj.title || proj.requirement || 'Untitled AI Project';
                const msgCount = proj.messages ? proj.messages.length : 0;
                const updatedTime = proj.updated_at 
                  ? new Date(proj.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Recently';

                return (
                  <div
                    key={proj.thread_id}
                    className={`group relative p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-50/60 border-indigo-300 shadow-md ring-1 ring-indigo-200'
                        : 'bg-white border-slate-200/80 hover:border-indigo-200 hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {proj.thread_id ? proj.thread_id.slice(0, 16) : 'Sandbox'}
                          </span>
                        </div>

                        {isSelected && (
                          <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                            Active Session
                          </span>
                        )}
                      </div>

                      {/* Title Edit or Display */}
                      {isEditing ? (
                        <div className="flex items-center space-x-2 my-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="flex-1 px-2.5 py-1 text-xs border border-indigo-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            autoFocus
                          />
                          <button
                            onClick={(e) => handleSaveRename(proj.thread_id, e)}
                            className="px-2 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <h4 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2 mb-1 group-hover:text-indigo-600 transition-colors">
                          {titleText}
                        </h4>
                      )}

                      {/* Meta information */}
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-2">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{updatedTime}</span>
                        </span>
                        {msgCount > 0 && (
                          <span className="flex items-center space-x-1">
                            <Code2 className="w-3 h-3 text-indigo-500" />
                            <span>{msgCount} messages</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => handleStartRename(proj, e)}
                          title="Rename Project"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteProject && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteProject(proj.thread_id);
                            }}
                            title="Delete Project"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          onSelectProject(proj.thread_id);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
