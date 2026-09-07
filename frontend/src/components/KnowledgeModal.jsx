import React, { useState } from 'react';
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
  Bookmark
} from 'lucide-react';

export default function KnowledgeModal({
  isOpen,
  onClose,
  onPromptAction
}) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [customContext, setCustomContext] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

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

  const handleAddContext = (e) => {
    e.preventDefault();
    if (!customContext.trim()) return;
    
    setSavedSuccess(true);
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
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                <span>Knowledge Base & Context Memory</span>
                <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full">
                  System Context
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Explore system documentation, tech stack rules, and attach custom developer instructions.
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
              placeholder="Search knowledge docs, framework specs or tags..."
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
            <button
              onClick={() => setActiveCategory('security')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'security' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Guardrails
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Knowledge Grid */}
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
                      <div className={`w-8 h-8 rounded-xl ${item.color} text-white flex items-center justify-center shrink-0 shadow-xs`}>
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

          {/* Add Custom Developer Guidelines Section */}
          <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-3">
            <div className="flex items-center space-x-2">
              <Bookmark className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-sm text-indigo-950">
                Attach Custom Developer Context & Rules
              </h3>
            </div>
            <p className="text-xs text-slate-600">
              Add coding standards, database preferences, or custom rules that all AI agents in PixiExpert will follow.
            </p>

            <form onSubmit={handleAddContext} className="space-y-3">
              <textarea
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                placeholder="Example: Always write TypeScript with explicit interfaces, use Tailwind CSS for styling, and use SQLite for local database..."
                rows={3}
                className="w-full p-3 rounded-xl bg-white border border-indigo-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
              />

              <div className="flex items-center justify-between">
                {savedSuccess ? (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Developer context saved into Agent Memory!</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Will be appended to current project session context.
                  </span>
                )}

                <button
                  type="submit"
                  disabled={!customContext.trim() || savedSuccess}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Context Rule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
