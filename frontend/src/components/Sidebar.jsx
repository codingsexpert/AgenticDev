import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare,
  FolderKanban, 
  BookOpen, 
  Wrench, 
  Settings, 
  ChevronDown,
  User,
  Code2,
  FileText,
  Plus,
  PanelLeftClose,
  Trash2,
  Pin,
  MoreHorizontal,
  Edit3,
  Share2,
  Archive,
  Check,
  X
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
  onPromptAction,
  activeNav = 'Chat',
  onSelectNav
}) {
  const [pinnedThreadIds, setPinnedThreadIds] = useState(() => {
    try {
      const saved = localStorage.getItem('pixlexpert_pinned_chats');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [openMenuThreadId, setOpenMenuThreadId] = useState(null);
  const [editingThreadId, setEditingThreadId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const menuRef = useRef(null);

  const startResizing = (e) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(500, e.clientX));
      if (setSidebarWidth) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        try {
          localStorage.setItem('pixlexpert_sidebar_width', sidebarWidth.toString());
        } catch (err) {}
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarWidth, setSidebarWidth]);

  // ESC key listener & body scroll lock on mobile
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (sidebarOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
          setSidebarOpen(false);
        }
        setOpenMenuThreadId(null);
        setEditingThreadId(null);
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

  // Click outside to close context menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuThreadId(null);
      }
    };

    if (openMenuThreadId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [openMenuThreadId]);

  const navItems = [
    { name: 'Chat', icon: MessageSquare },
    { name: 'Projects', icon: FolderKanban },
    { name: 'Knowledge', icon: BookOpen },
    { name: 'Tools', icon: Wrench },
    { name: 'Settings', icon: Settings },
  ];

  const handleNavClick = (navName) => {
    if (onSelectNav) {
      onSelectNav(navName);
    }
    if (navName === 'Chat' && onNewProject && !currentThreadId) {
      onNewProject();
    }

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const togglePinThread = (threadId, e) => {
    e?.stopPropagation();
    setPinnedThreadIds((prev) => {
      const next = prev.includes(threadId)
        ? prev.filter((id) => id !== threadId)
        : [...prev, threadId];
      try {
        localStorage.setItem('pixlexpert_pinned_chats', JSON.stringify(next));
      } catch (err) {}
      return next;
    });
    setOpenMenuThreadId(null);
  };

  const handleStartRename = (chat, e) => {
    e?.stopPropagation();
    setEditingThreadId(chat.thread_id);
    setEditingTitle(chat.title);
    setOpenMenuThreadId(null);
  };

  const handleSaveRename = (threadId, e) => {
    e?.stopPropagation();
    if (editingTitle.trim() && onRenameProject) {
      onRenameProject(threadId, editingTitle.trim());
    }
    setEditingThreadId(null);
  };

  const handleShareThread = (chat, e) => {
    e?.stopPropagation();
    setOpenMenuThreadId(null);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}?chat=${chat.thread_id}`);
      alert(`Chat link copied to clipboard: "${chat.title}"`);
    }
  };

  const safeProjects = Array.isArray(projects) ? projects : [];

  const defaultChats = [
    { thread_id: 'chat-1', title: 'Improve AI Response Speed', time: 'Recently', mode: 'chat' },
    { thread_id: 'chat-2', title: 'Python Array Practice', time: '2 hours ago', mode: 'chat' },
    { thread_id: 'chat-3', title: 'AI Capabilities Overview', time: '4 hours ago', mode: 'chat' },
    { thread_id: 'chat-4', title: 'React Hooks & State Guide', time: '6 hours ago', mode: 'chat' },
  ];

  const allChats = safeProjects.length > 0
    ? safeProjects.map((p, idx) => ({
        thread_id: p.thread_id,
        title: p.title || p.requirement || 'Chat Session',
        time: p.updated_at ? 'Recently' : `${(idx + 1) * 2} hours ago`,
        mode: p.mode || 'chat'
      }))
    : defaultChats;

  // Separate pinned chats and unpinned chats
  const pinnedChats = allChats.filter((c) => pinnedThreadIds.includes(c.thread_id));
  const unpinnedChats = allChats.filter((c) => !pinnedThreadIds.includes(c.thread_id));
  const sortedChats = [...pinnedChats, ...unpinnedChats];

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
        style={typeof window !== 'undefined' && window.innerWidth >= 1024 ? {
          width: sidebarOpen ? `${sidebarWidth}px` : '0px'
        } : undefined}
        className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto bg-white/90 backdrop-blur-md border-r border-slate-200/70 flex flex-col relative shrink-0 shadow-2xl lg:shadow-none ${
          isResizing ? 'transition-none select-none' : 'transition-all duration-300 ease-in-out'
        } ${
          sidebarOpen
            ? 'translate-x-0 opacity-100'
            : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:overflow-hidden lg:border-none'
        }`}
      >
        {/* Right Drag Resizer Edge Handle (ChatGPT / IDE Style) */}
        <div
          onMouseDown={startResizing}
          onDoubleClick={() => setSidebarWidth && setSidebarWidth(260)}
          title="Drag edge to resize sidebar width (Double click to reset to 260px)"
          className={`absolute right-0 top-0 bottom-0 w-2 hover:w-2.5 bg-transparent hover:bg-indigo-500/30 cursor-col-resize cursor-ew-resize z-40 transition-all group flex items-center justify-center ${
            isResizing ? 'bg-indigo-600/40 w-2.5 opacity-100' : ''
          }`}
        >
          <div className={`w-1 h-8 rounded-full transition-all ${
            isResizing ? 'bg-indigo-600' : 'bg-slate-300 opacity-0 group-hover:opacity-100 group-hover:bg-indigo-500'
          }`} />
        </div>
        {/* Branding & Sidebar Collapse Button */}
        <div className="p-4 sm:p-4.5 flex items-center justify-between border-b border-slate-100/80 shrink-0">
          <div className="cursor-pointer flex items-center space-x-2.5" onClick={() => handleNavClick('Chat')}>
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
              P
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-slate-900 leading-tight">PixiExpert</h1>
              <span className="text-[10px] font-medium text-slate-400">AI Studio</span>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            title="Collapse Sidebar"
            className="p-1.5 rounded-lg border border-slate-200/70 hover:bg-slate-100/80 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all shrink-0 cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Container for Navigation & ChatGPT-Style Recents List */}
        <div className="px-3 py-3 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          {/* Main Top Navigation Tabs */}
          <div className="space-y-0.5">
            {navItems.map((nav) => {
              const Icon = nav.icon;
              const isActive = activeNav === nav.name;
              return (
                <button
                  key={nav.name}
                  type="button"
                  onClick={() => handleNavClick(nav.name)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all min-h-[36px] ${
                    isActive
                      ? 'bg-indigo-50/90 text-indigo-600 font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{nav.name}</span>
                </button>
              );
            })}
          </div>

          {/* ChatGPT-Style Recents List Section */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            {/* Header: Recents ∨ & + New Chat */}
            <div className="flex items-center justify-between px-2 py-1">
              <div className="flex items-center space-x-1 text-slate-500 font-semibold text-xs cursor-pointer hover:text-slate-800 transition-colors">
                <span>Recents</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onSelectNav) onSelectNav('Chat');
                  if (onNewProject) onNewProject();
                }}
                title="Start New Chat"
                className="p-1 rounded-lg text-indigo-600 hover:bg-indigo-50 font-semibold text-xs flex items-center space-x-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[11px]">New</span>
              </button>
            </div>

            {/* Chat Items Vertical List (ChatGPT Style) */}
            <div className="space-y-0.5">
              {sortedChats.map((chat) => {
                const isSelected = currentThreadId === chat.thread_id;
                const isPinned = pinnedThreadIds.includes(chat.thread_id);
                const isMenuOpen = openMenuThreadId === chat.thread_id;
                const isEditing = editingThreadId === chat.thread_id;

                return (
                  <div
                    key={chat.thread_id}
                    onClick={() => {
                      if (!isEditing) {
                        if (onSelectNav) onSelectNav('Chat');
                        if (onSelectProject) onSelectProject(chat.thread_id);
                        if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
                      }
                    }}
                    className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-slate-100/90 text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100/60 hover:text-slate-900'
                    }`}
                  >
                    {/* Title Text or Inline Title Editing Field */}
                    {isEditing ? (
                      <div className="flex items-center space-x-1.5 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(chat.thread_id, e);
                            if (e.key === 'Escape') setEditingThreadId(null);
                          }}
                          className="w-full px-2 py-0.5 text-xs border border-indigo-400 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                          autoFocus
                        />
                        <button
                          onClick={(e) => handleSaveRename(chat.thread_id, e)}
                          className="p-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shrink-0"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingThreadId(null)}
                          className="p-1 rounded-md bg-slate-200 text-slate-600 hover:bg-slate-300 shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 truncate min-w-0 flex-1 pr-1">
                        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className="truncate text-xs font-normal leading-snug">
                          {chat.title}
                        </span>
                      </div>
                    )}

                    {/* Right Hover Actions (Pin icon & Three Dots Menu) */}
                    {!isEditing && (
                      <div className="flex items-center space-x-1 shrink-0">
                        {/* Pin Indicator Badge or Hover Pin Button */}
                        {isPinned && (
                          <button
                            type="button"
                            onClick={(e) => togglePinThread(chat.thread_id, e)}
                            title="Unpin Chat"
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                          >
                            <Pin className="w-3 h-3 fill-slate-500 text-slate-500 rotate-45" />
                          </button>
                        )}

                        {/* Three Dots Button (...) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuThreadId(isMenuOpen ? null : chat.thread_id);
                            }}
                            className={`p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-opacity ${
                              isMenuOpen ? 'opacity-100 bg-slate-200/70 text-slate-700' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>

                          {/* ChatGPT-Style Three Dots Context Menu Dropdown */}
                          {isMenuOpen && (
                            <div
                              ref={menuRef}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-44 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50 animate-fade-in space-y-0.5 text-xs text-slate-700"
                            >
                              <button
                                type="button"
                                onClick={(e) => handleShareThread(chat, e)}
                                className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors"
                              >
                                <Share2 className="w-3.5 h-3.5 text-slate-400" />
                                <span>Share</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleStartRename(chat, e)}
                                className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                                <span>Rename</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => togglePinThread(chat.thread_id, e)}
                                className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors"
                              >
                                <Pin className="w-3.5 h-3.5 text-slate-400" />
                                <span>{isPinned ? 'Unpin chat' : 'Pin chat'}</span>
                              </button>

                              {onDeleteProject && !chat.thread_id.startsWith('chat-') && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuThreadId(null);
                                    onDeleteProject(chat.thread_id);
                                  }}
                                  className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 text-rose-600 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom User Profile */}
        <div className="p-3 border-t border-slate-100/80 bg-transparent shrink-0">
          <div 
            onClick={() => {
              if (!user && onOpenAuth) onOpenAuth();
              if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className="flex items-center justify-between p-2 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/60 transition-all cursor-pointer group min-h-[44px]"
          >
            <div className="flex items-center space-x-2.5 truncate">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
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
          </div>
        </div>
      </aside>
    </>
  );
}
