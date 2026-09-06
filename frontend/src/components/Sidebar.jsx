import React, { useState, useEffect } from 'react';
import { 
  MessageSquare,
  FolderKanban, 
  BookOpen, 
  Wrench, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  User
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
        style={{ width: `${sidebarWidth}px` }}
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Text Branding */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100">
          <div className="cursor-pointer" onClick={() => handleNavClick('Chat')}>
            <h1 className="font-bold text-base tracking-tight text-slate-900 leading-tight">PixiExpert</h1>
            <span className="text-[11px] font-medium text-slate-400">AI Assistant</span>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            title="Close Sidebar"
            className="w-9 h-9 rounded-full border border-slate-200/80 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all shrink-0 lg:hidden min-h-[44px] min-w-[44px]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Navigation Links */}
        <div className="px-3 py-4 space-y-1.5 flex-1 overflow-y-auto">
          {navItems.map((nav) => {
            const Icon = nav.icon;
            const isActive = activeNav === nav.name;
            return (
              <button
                key={nav.name}
                type="button"
                onClick={() => handleNavClick(nav.name)}
                className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all min-h-[44px] ${
                  isActive
                    ? 'bg-indigo-50/80 text-indigo-600 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{nav.name}</span>
              </button>
            );
          })}
        </div>

        {/* Bottom User Profile */}
        <div className="p-3 border-t border-slate-100 bg-white">
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


