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
        className={`fixed inset-y-0 left-0 z-50 bg-zinc-50 border-r border-zinc-200 flex flex-col transition-transform duration-300 ease-in-out shadow-xl ${
          isVisible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sleek Professional Resizer Edge */}
        <div
          onMouseDown={handleMouseDown}
          className="hidden md:block absolute top-0 -right-1 w-2 h-full cursor-col-resize hover:bg-zinc-200 active:bg-zinc-300 transition-colors z-50"
          title="Drag to resize sidebar width"
        />

        {/* Brand Header inside Left Sidebar */}
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center space-x-2.5 truncate">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white shadow-sm shrink-0">
              <Sparkles className="w-4 h-4 text-zinc-100" />
            </div>
            <h1 className="font-semibold text-[17px] tracking-tight text-zinc-800 truncate">PixlExpert</h1>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            title="Collapse Sidebar"
            className="p-1.5 rounded-md hover:bg-zinc-200 text-zinc-500 transition-all shrink-0"
          >
            <PanelLeftClose className="w-4.5 h-4.5 text-zinc-600" />
          </button>
        </div>

        {/* Action Button */}
        <div className="p-3">
          <button
            onClick={onNewProject}
            className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-zinc-100 text-zinc-700 py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 shadow-sm border border-zinc-200/80 active:scale-[0.99]"
          >
            <Plus className="w-4 h-4 shrink-0 text-zinc-500" />
            <span className="truncate">New Chat / Project</span>
          </button>
        </div>

        {/* History / Recent Chat Sessions List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          <div className="px-2 pb-2 pt-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Chat History</div>
          {safeProjects.length === 0 ? (
            <div className="text-sm text-zinc-400 px-2 py-4 text-center">No saved chats yet</div>
          ) : (
            safeProjects.map((proj) => (
              <div
                key={proj.thread_id}
                onClick={() => {
                  if (onSelectProject) onSelectProject(proj.thread_id);
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                  currentThreadId === proj.thread_id
                    ? 'bg-zinc-200/60 text-zinc-900 font-medium'
                    : 'text-zinc-600 hover:bg-zinc-200/40 hover:text-zinc-900 font-normal'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate pr-1">
                  {proj.mode === 'build' ? (
                    <Wrench className={`w-3.5 h-3.5 shrink-0 ${currentThreadId === proj.thread_id ? 'text-zinc-700' : 'text-zinc-400'}`} />
                  ) : (
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${currentThreadId === proj.thread_id ? 'text-zinc-700' : 'text-zinc-400'}`} />
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
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-100 text-zinc-400 hover:text-red-600 transition-all shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Clean Sidebar Footer */}
        <div className="p-3 border-t border-zinc-200 space-y-2 bg-zinc-50">
          <a
            href="https://smith.langchain.com"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white hover:bg-zinc-100 text-xs text-zinc-600 transition-all border border-zinc-200 shadow-sm group"
          >
            <span className="flex items-center space-x-2 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="truncate font-medium">LangSmith Traces</span>
            </span>
            <ExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 transition-colors shrink-0" />
          </a>

          <div>
            {user ? (
              <div className="bg-white p-2 rounded-lg border border-zinc-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center space-x-2.5 truncate">
                  <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 font-semibold text-xs shrink-0 overflow-hidden">
                    {user.avatar ? (
                      <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      user.name?.charAt(0) || 'U'
                    )}
                  </div>
                  <div className="truncate text-left leading-tight">
                    <div className="font-medium text-xs text-zinc-800 truncate">{user.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{user.email}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 rounded-md hover:bg-red-50 text-zinc-400 hover:text-red-600 transition-colors shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full flex items-center justify-center space-x-2 bg-zinc-900 hover:bg-zinc-800 text-white py-2.5 px-3 rounded-lg font-medium text-xs transition-all shadow-sm"
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
