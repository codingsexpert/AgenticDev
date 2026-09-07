import React, { useState, useEffect } from 'react';
import { 
  MessageSquare,
  FolderKanban, 
  BookOpen, 
  Wrench, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  User,
  Code2,
  FileText,
  Folder,
  ArrowRight,
  Plus
} from 'lucide-react';

export default function Sidebar({
  projects = [],
  currentThreadId,
  onSelectProject,
  onDeleteProject,
  onRenameProject,
  onNewProject,
  sidebarOpen,
  setSidebarOpen,
  sidebarWidth = 260,
  setSidebarWidth,
  user,
  onOpenAuth,
  onLogout,
  onPromptAction
}) {
  const [activeNav, setActiveNav] = useState('Chat');

  // ESC key listener & body scroll lock on mobile
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [sidebarOpen, setSidebarOpen]);

  const navItems = [
    { name: 'Chat', icon: MessageSquare },
    { name: 'Projects', icon: FolderKanban },
    { name: 'Knowledge', icon: BookOpen },
    { name: 'Tools', icon: Wrench },
    { name: 'Settings', icon: Settings },
  ];

  const handleNavClick = (navName) => {
    setActiveNav(navName);
    if (navName === 'Chat') onNewProject();
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const safeProjects = Array.isArray(projects) ? projects : [];

  // Default Recent Chats if real conversation list is empty
  const defaultRecentChats = [
    {
      thread_id: 'chat-1',
      title: 'Build a calculator app',
      time: '2 hours ago',
      icon: Code2
    },
    {
      thread_id: 'chat-2',
      title: 'Explain React hooks',
      time: '4 hours ago',
      icon: MessageSquare
    },
    {
      thread_id: 'chat-3',
      title: 'Fix this code error',
      time: '6 hours ago',
      icon: Code2
    },
    {
      thread_id: 'chat-4',
      title: 'Summarize this document',
      time: '8 hours ago',
      icon: FileText
    },
  ];

  const recentChats = safeProjects.length > 0
    ? safeProjects.slice(0, 5).map((p, idx) => ({
      thread_id: p.thread_id,
      title: p.title || p.requirement || 'Chat Session',
      time: p.updated_at ? 'Recently' : `${(idx + 1) * 2} hours ago`,
      icon: idx % 2 === 0 ? Code2 : MessageSquare
    }))
    : defaultRecentChats;

  const sampleProjects = [
    { id: 'proj-1', title: 'College Management System', updated: 'Updated 2 days ago' },
    { id: 'proj-2', title: 'E-commerce Website', updated: 'Updated 3 days ago' },
    { id: 'proj-3', title: 'Portfolio Website', updated: 'Updated 5 days ago' },
    { id: 'proj-4', title: 'Task Manager', updated: 'Updated 1 week ago' },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto bg-white border-r border-slate-200/80 flex flex-col transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none shrink-0 ${
          sidebarOpen
            ? 'translate-x-0 w-72 lg:w-[270px] lg:opacity-100'
            : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:overflow-hidden lg:border-none'
        }`}
      >
        {/* Text Branding */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="cursor-pointer flex items-center space-x-2.5" onClick={() => handleNavClick('Chat')}>
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
              P
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-slate-900 leading-tight">PixiExpert</h1>
              <span className="text-[11px] font-medium text-slate-400">AI Assistant</span>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            title="Close Sidebar"
            className="w-9 h-9 rounded-full border border-slate-200/80 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all shrink-0 lg:hidden min-h-[44px] min-w-[44px]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Container containing Nav Links, Recent Chats & Sample Projects */}
        <div className="px-3 py-4 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
          {/* Main Navigation Links */}
          <div className="space-y-1">
            {navItems.map((nav) => {
              const Icon = nav.icon;
              const isActive = activeNav === nav.name;
              return (
                <button
                  key={nav.name}
                  type="button"
                  onClick={() => handleNavClick(nav.name)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all min-h-[40px] ${
                    isActive
                      ? 'bg-indigo-50/90 text-indigo-600 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{nav.name}</span>
                </button>
              );
            })}
          </div>

          {/* Recent Chats Section */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-bold text-xs text-slate-900 tracking-tight">Recent Chats</h3>
              <button
                type="button"
                onClick={onNewProject}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>

            <div className="space-y-1">
              {recentChats.map((chat) => {
                const Icon = chat.icon;
                const isSelected = currentThreadId === chat.thread_id;
                return (
                  <div
                    key={chat.thread_id}
                    onClick={() => {
                      if (onSelectProject) onSelectProject(chat.thread_id);
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
                    }}
                    className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer group border ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-200 text-indigo-700 font-semibold'
                        : 'border-transparent hover:bg-slate-100/70 hover:border-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600'} transition-colors`} />
                      <div className="truncate text-left leading-tight">
                        <div className={`font-medium text-xs truncate ${isSelected ? 'text-indigo-900 font-semibold' : 'text-slate-800 group-hover:text-indigo-600'} transition-colors`}>
                          {chat.title}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{chat.time}</div>
                      </div>
                    </div>

                    <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-500' : 'text-slate-300 group-hover:text-slate-500'} group-hover:translate-x-0.5 transition-all shrink-0 ml-1`} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sample Projects Section */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="px-1">
              <h3 className="font-bold text-xs text-slate-900 tracking-tight">Sample Projects</h3>
            </div>

            <div className="space-y-1">
              {sampleProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => {
                    if (onPromptAction) onPromptAction(`Open sample project: ${proj.title}`);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100/70 transition-all cursor-pointer group border border-transparent hover:border-slate-200/60"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Folder className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    <div className="truncate text-left leading-tight">
                      <div className="font-medium text-xs text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                        {proj.title}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{proj.updated}</div>
                    </div>
                  </div>

                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom User Profile */}
        <div className="p-3 border-t border-slate-100 bg-white shrink-0">
          <div 
            onClick={() => {
              if (!user && onOpenAuth) onOpenAuth();
              if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/60 transition-all cursor-pointer group min-h-[44px]"
          >
            <div className="flex items-center space-x-2.5 truncate">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user?.name?.charAt(0) || 'M'
                )}
              </div>
              <div className="truncate text-left leading-tight">
                <div className="font-semibold text-xs text-slate-900 truncate">
                  {user?.name || 'Mukesh Singh'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {user?.email || 'mukesh@gmail.com'}
                </div>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
        </div>
      </aside>
    </>
  );
}



