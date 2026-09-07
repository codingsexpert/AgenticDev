import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Search, 
  X, 
  FileText, 
  BrainCircuit, 
  Database, 
  ShieldCheck, 
  Cpu, 
  Code2, 
  Plus, 
  Sparkles,
  CheckCircle2,
  Bookmark,
  UploadCloud,
  Trash2,
  Loader2,
  HardDrive,
  RefreshCw,
  File
} from 'lucide-react';
import { useToast } from './Toast';

export default function KnowledgeModal({
  isOpen,
  onClose,
  onPromptAction
}) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [customContext, setCustomContext] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [kbFiles, setKbFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchKbFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch('/api/kb/files');
      if (res.ok) {
        const data = await res.json();
        setKbFiles(data.files || []);
      }
    } catch (err) {
      console.error('Failed to fetch KB files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchKbFiles();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
      const res = await fetch('/api/kb/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Files uploaded successfully to Knowledge Base');
        fetchKbFiles();
      } else {
        toast.error(data.detail || 'Failed to upload files');
      }
    } catch (err) {
      toast.error('Failed to upload to Knowledge Base');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (filename) => {
    try {
      const res = await fetch(`/api/kb/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Deleted ${filename} from Knowledge Base`);
        fetchKbFiles();
      } else {
        toast.error(data.detail || 'Delete failed');
      }
    } catch (err) {
      toast.error(`Failed to delete ${filename}`);
    }
  };

  const knowledgeItems = [
    {
      id: 'k1',
      category: 'architecture',
      title: 'FastAPI Web Backend & SSE Live Event Stream',
      description: 'Asynchronous event-driven backend handling REST endpoints, real-time Server-Sent Events (SSE), and CORS security middleware.',
      tags: ['FastAPI', 'Python', 'SSE', 'REST API'],
      icon: Cpu,
      color: 'bg-emerald-500'
    },
    {
      id: 'k2',
      category: 'agents',
      title: 'LangGraph 27-Node Multi-Agent State Machine',
      description: 'Structured state graph containing PM, Architect, Blueprint Validator, Planner, Coder, Reviewer, Executor, and Debugger agents.',
      tags: ['LangGraph', 'Python', 'State Graph', 'Pydantic'],
      icon: BrainCircuit,
      color: 'bg-indigo-500'
    },
    {
      id: 'k3',
      category: 'security',
      title: '3-Tier Guardrails Security Engine',
      description: 'Input prompt injection sanitizer, output Pydantic schema validator, and sandbox path boundary execution guardrail.',
      tags: ['Guardrails', 'Security', 'Path Boundary', 'Sanitizer'],
      icon: ShieldCheck,
      color: 'bg-blue-500'
    },
    {
      id: 'k4',
      category: 'sandbox',
      title: 'Docker-Free Pure Local Filesystem Sandbox',
      description: 'Isolated project workspace manager executing subprocesses safely inside isolated sandbox folders with Git snapshots.',
      tags: ['Sandbox', 'Filesystem', 'Local Git', 'Subprocess'],
      icon: Database,
      color: 'bg-purple-500'
    },
    {
      id: 'k5',
      category: 'stack',
      title: 'Frontend React + Vite + Monaco Code Viewer Stack',
      description: 'Modern glassmorphic React UI with Monaco editor support, SSE live event listener, and dynamic Tailwind styling.',
      tags: ['React', 'Vite', 'TailwindCSS', 'Monaco Editor'],
      icon: Code2,
      color: 'bg-amber-500'
    },
    {
      id: 'k6',
      category: 'ai-models',
      title: 'Gemini 2.0 Flash & LiteLLM Integration',
      description: 'Low-latency structured LLM execution supporting function calling, JSON schema enforcement, and cost budget limits.',
      tags: ['Gemini 2.0', 'LiteLLM', 'Token Budget', 'JSON Schema'],
      icon: Sparkles,
      color: 'bg-rose-500'
    }
  ];

  const filteredItems = knowledgeItems.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
                          item.description.toLowerCase().includes(search.toLowerCase()) ||
                          item.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const filteredKbFiles = kbFiles.filter((f) => 
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAddContext = (e) => {
    e.preventDefault();
    if (!customContext.trim()) return;
    
    setSavedSuccess(true);
    toast.success('Custom guidelines attached to active session context');
    if (onPromptAction) {
      onPromptAction(`Knowledge Base Update: Apply this developer guideline to upcoming code generation:\n\n${customContext.trim()}`);
    }

    setTimeout(() => {
      setSavedSuccess(false);
      setCustomContext('');
      onClose();
    }, 1200);
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
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-2xs">
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                <span>Knowledge Base & Context Memory</span>
                <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200/80 font-semibold px-2.5 py-0.5 rounded-full">
                  RAG Ingestion Engine
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Explore system documentation, manage uploaded RAG documents, and attach developer instructions.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories Bar */}
        <div className="px-6 py-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search knowledge docs, framework specs or uploaded files..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'all' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Docs
            </button>
            <button
              onClick={() => setActiveCategory('uploads')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                activeCategory === 'uploads' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>My RAG Files ({kbFiles.length})</span>
            </button>
            <button
              onClick={() => setActiveCategory('architecture')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'architecture' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Architecture
            </button>
            <button
              onClick={() => setActiveCategory('agents')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'agents' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Agents
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Uploaded RAG Files Section */}
          {activeCategory === 'uploads' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Uploaded RAG Knowledge Base Files</h3>
                  <p className="text-xs text-slate-500">Documents indexed into vector RAG memory for AI prompt context.</p>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  accept=".txt,.pdf,.docx,.csv,.json,.md,.py,.js,.ts,.css,.html"
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  <span>{uploading ? 'Uploading...' : 'Upload Document'}</span>
                </button>
              </div>

              {loadingFiles ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Loading knowledge base files...</span>
                </div>
              ) : filteredKbFiles.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center space-y-2 bg-slate-50/50">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-700">No RAG files uploaded yet</h4>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Upload PDF, TXT, DOCX, CSV, or code files to feed custom knowledge into PixiExpert AI.
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Select File to Upload
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredKbFiles.map((file) => (
                    <div
                      key={file.name}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-200 flex items-center justify-between transition-all group"
                    >
                      <div className="flex items-center space-x-3 min-w-0 pr-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-xs text-slate-900 truncate" title={file.name}>
                            {file.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatFileSize(file.size)} • Indexed
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteFile(file.name)}
                        title="Delete from Knowledge Base"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* System Knowledge Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (onPromptAction) {
                        onPromptAction(`Explain in detail and provide code examples for: ${item.title}`);
                        onClose();
                      }
                    }}
                    className="group p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-3 mb-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900 flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                          <Icon className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                          {item.title}
                        </h4>
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed mb-3">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-slate-100 text-slate-600 font-medium text-[10px] rounded-md"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Custom Developer Guidelines Section */}
          <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-3">
            <div className="flex items-center space-x-2">
              <Bookmark className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-sm text-indigo-950">
                Attach Custom Developer Context & Rules
              </h3>
            </div>
            <p className="text-xs text-indigo-900/80 leading-relaxed">
              Inject project-specific guidelines, custom coding rules, or database conventions into the AI Assistant's memory for this session.
            </p>

            <form onSubmit={handleAddContext} className="space-y-3 pt-1">
              <textarea
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                placeholder="Example: Always use async/await syntax, format dates in ISO 8601, use Supabase RLS policies for auth..."
                rows={3}
                className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-2xs"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-indigo-700/80 font-medium">
                  {savedSuccess ? (
                    <span className="text-emerald-600 font-semibold flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Context guidelines attached!</span>
                    </span>
                  ) : (
                    'Will be active for all subsequent prompts.'
                  )}
                </span>

                <button
                  type="submit"
                  disabled={!customContext.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Attach Guideline</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
