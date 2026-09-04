import React from 'react';
import { Plus, MessageSquare, ExternalLink, Cpu, ShieldCheck, Database, Bot, Brain, Wrench, X, PanelLeftClose, Sparkles, Trash2, LogOut, User } from 'lucide-react';

export default function Sidebar({
  projects = [],
  currentThreadId,
  onSelectProject,
  onDeleteProject,
  onNewProject,
  statusInfo,
  tokenUsage,
  sidebarOpen,
  setSidebarOpen,
  sidebarWidth = 280,
  setSidebarWidth,
  user,
  onOpenAuth,
  onLogout,
}) {
  const [isResizing, setIsResizing] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (e.clientX >= 220 && e.clientX <= 500) {
      if (setSidebarWidth) setSidebarWidth(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const safeProjects = Array.isArray(projects) ? projects : [];
  const isVisible = sidebarOpen || isHovered;

  return (
    <>
      {/* Hover Trigger Zone */}
      {!sidebarOpen && (
        <div 
          className="fixed inset-y-0 left-0 w-3 z-40 bg-transparent cursor-e-resize"
          onMouseEnter={() => setIsHovered(true)}
        />
      )}

      {/* Mobile Backdrop Overlay */}
      {isVisible && (
        <div
          onClick={() => {
            setSidebarOpen(false);
            setIsHovered(false);
          }}
          className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      <aside
        onMouseLeave={() => setIsHovered(false)}
        style={{ width: `${sidebarWidth}px` }}
        className={`fixed inset-y-0 left-0 z-50 bg-slate-50/95 backdrop-blur-xl border-r border-slate-200/90 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl ${
          isVisible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sleek Professional Resizer Edge */}
        <div
          onMouseDown={handleMouseDown}
          className="hidden md:block absolute top-0 -right-1 w-2 h-full cursor-col-resize hover:bg-indigo-500/20 active:bg-indigo-500/40 transition-colors z-50"
          title="Drag to resize sidebar width"
        />

        {/* Brand Header inside Left Sidebar */}
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-white/60 backdrop-blur-md">
          <div className="truncate">
            <h1 className="font-bold text-[17px] tracking-tight text-slate-900 truncate">PixlExpert</h1>
            <div className="text-[9.5px] font-mono text-slate-400 -mt-0.5 tracking-widest uppercase">AI Dev Suite</div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            title="Collapse Sidebar"
            className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-all shrink-0"
          >
            <PanelLeftClose className="w-4.5 h-4.5 text-slate-600" />
          </button>
        </div>

        {/* Action Button */}
        <div className="p-3.5">
          <button
            onClick={onNewProject}
            className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-xl font-semibold text-xs tracking-wide transition-all duration-200 shadow-sm border border-slate-800 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 shrink-0 text-slate-300" />
            <span className="truncate">New Chat / Project</span>
          </button>
        </div>

        {/* History / Recent Chat Sessions List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-2 pb-2 pt-1 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Chat History</div>
          {safeProjects.length === 0 ? (
            <div className="text-xs text-slate-400 px-2 py-6 text-center border border-dashed border-slate-200 rounded-xl my-2">No saved chats yet</div>
          ) : (
            safeProjects.map((proj) => {
              const isActive = currentThreadId === proj.thread_id;
              return (
                <div
                  key={proj.thread_id}
                  onClick={() => {
                    if (onSelectProject) onSelectProject(proj.thread_id);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-indigo-950 font-semibold shadow-xs border border-indigo-200/90'
                      : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 font-normal border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate pr-1">
                    {proj.mode === 'build' ? (
                      <Wrench className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    ) : (
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    )}
                    <span className="truncate leading-tight">{proj.title || proj.requirement || proj.thread_id}</span>
                  </div>

                  <button
                    type="button"
                    title="Delete Chat Session"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDeleteProject) onDeleteProject(proj.thread_id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Clean Sidebar Footer */}
        <div className="p-3.5 border-t border-slate-200/80 space-y-2.5 bg-white/60 backdrop-blur-md">
          <a
            href="https://smith.langchain.com"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-slate-100/80 text-xs text-slate-600 transition-all border border-slate-200/80 shadow-xs group"
          >
            <span className="flex items-center space-x-2 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="truncate font-medium text-slate-700">LangSmith Traces</span>
            </span>
            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
          </a>

          <div>
            {user ? (
              <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div className="flex items-center space-x-2.5 truncate">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-semibold text-xs shrink-0 overflow-hidden">
                    {user.avatar ? (
                      <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      user.name?.charAt(0) || 'U'
                    )}
                  </div>
                  <div className="truncate text-left leading-tight">
                    <div className="font-semibold text-xs text-slate-800 truncate">{user.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-3 rounded-xl font-semibold text-xs transition-all shadow-md shadow-slate-900/10"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In / Register</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
