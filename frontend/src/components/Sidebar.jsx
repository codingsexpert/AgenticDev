import React, { useState } from 'react';
import { 
  Home, 
  FolderKanban, 
  BookOpen, 
  Brain, 
  Wrench, 
  Settings, 
  MessageSquare, 
  ChevronLeft, 
  Plus, 
  MoreHorizontal, 
  Trash2, 
  Pencil, 
  Check, 
  X, 
  Sparkles, 
  LogOut, 
  User,
  PanelLeftClose
} from 'lucide-react';

function ChatItem({
  proj,
  isActive,
  onSelectProject,
  onDeleteProject,
  onRenameProject,
  setSidebarOpen,
  timeAgo = '2m'
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [titleText, setTitleText] = useState(proj.title || proj.requirement || proj.thread_id);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    setTitleText(proj.title || proj.requirement || proj.thread_id);
  }, [proj.title, proj.requirement, proj.thread_id]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = (e) => {
    if (e) e.stopPropagation();
    if (titleText.trim() && titleText !== (proj.title || proj.requirement || proj.thread_id)) {
      if (onRenameProject) onRenameProject(proj.thread_id, titleText.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave(e);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTitleText(proj.title || proj.requirement || proj.thread_id);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="w-full flex items-center space-x-1.5 px-2 py-1.5 rounded-xl bg-white border border-indigo-300 shadow-xs text-xs">
        <input
          ref={inputRef}
          type="text"
          value={titleText}
          onChange={(e) => setTitleText(e.target.value)}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent text-slate-900 font-medium focus:outline-none text-xs px-1"
        />
        <button
          type="button"
          onClick={handleSave}
          title="Save Name"
          className="p-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors shrink-0"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTitleText(proj.title || proj.requirement || proj.thread_id);
            setIsEditing(false);
          }}
          title="Cancel"
          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        if (onSelectProject) onSelectProject(proj.thread_id);
        if (window.innerWidth < 768) setSidebarOpen(false);
      }}
      className={`group w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
        isActive
          ? 'bg-indigo-50/90 text-indigo-700 font-semibold border border-indigo-100'
          : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 font-medium border border-transparent'
      }`}
    >
      <div className="flex items-center space-x-2.5 truncate pr-1 flex-1 min-w-0">
        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
        <span className="truncate leading-tight flex-1">{proj.title || proj.requirement || proj.thread_id}</span>
      </div>

      <div className="flex items-center space-x-1 shrink-0">
        <span className="text-[10px] text-slate-400 group-hover:hidden font-mono">{timeAgo}</span>
        
        <div className="hidden group-hover:flex items-center space-x-1">
          <button
            type="button"
            title="Rename Chat"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="p-1 rounded-lg hover:bg-slate-200/80 text-slate-400 hover:text-slate-800 transition-all"
          >
            <Pencil className="w-3 h-3" />
          </button>

          <button
            type="button"
            title="Delete Chat"
            onClick={(e) => {
              e.stopPropagation();
              if (onDeleteProject) onDeleteProject(proj.thread_id);
            }}
            className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState('Home');
  const safeProjects = Array.isArray(projects) ? projects : [];

  // Default sample chats if none exist yet for initial wow factor matching image
  const defaultRecentChats = [
    { thread_id: 'sample-1', title: 'Build a modern portfolio website', time: '2m' },
    { thread_id: 'sample-2', title: 'RAG system for college syllabus', time: '15m' },
    { thread_id: 'sample-3', title: 'Python automation script', time: '1h' },
    { thread_id: 'sample-4', title: 'Study plan for BCA', time: '2h' },
    { thread_id: 'sample-5', title: 'Image generation for banner', time: '5h' },
    { thread_id: 'sample-6', title: 'Web development roadmap', time: '3h' },
  ];

  const displayChats = safeProjects.length > 0 ? safeProjects : defaultRecentChats;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-zinc-900/30 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      <aside
        style={{ width: `${sidebarWidth}px` }}
        className={`fixed inset-y-0 left-0 z-50 bg-slate-50 border-r border-slate-200/80 flex flex-col transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 flex items-center justify-between bg-slate-50 border-b border-slate-200/60">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={onNewProject}>
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 fill-white text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-slate-900 leading-none">PixlExpert</h1>
              <span className="text-[11px] font-medium text-slate-400">AI Assistant</span>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            title="Collapse Sidebar"
            className="w-7 h-7 rounded-full border border-slate-200 hover:bg-slate-200/70 text-slate-500 flex items-center justify-center transition-all shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Main Navigation Links */}
        <div className="px-3 py-3 space-y-1 border-b border-slate-200/60">
          {[
            { name: 'Home', icon: Home },
            { name: 'Projects', icon: FolderKanban },
            { name: 'Knowledge', icon: BookOpen },
            { name: 'Memories', icon: Brain },
            { name: 'Tools', icon: Wrench },
            { name: 'Settings', icon: Settings },
          ].map((nav) => {
            const Icon = nav.icon;
            const isActive = activeTab === nav.name;
            return (
              <button
                key={nav.name}
                type="button"
                onClick={() => {
                  setActiveTab(nav.name);
                  if (nav.name === 'Home') onNewProject();
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{nav.name}</span>
              </button>
            );
          })}
        </div>

        {/* Recent Chats Section */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[11px] font-bold text-slate-900 tracking-tight">Recent Chats</span>
            <button 
              type="button" 
              onClick={onNewProject}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              View all
            </button>
          </div>

          <div className="space-y-0.5">
            {displayChats.map((proj, idx) => (
              <ChatItem
                key={proj.thread_id || idx}
                proj={proj}
                timeAgo={proj.time || '2m'}
                isActive={currentThreadId === proj.thread_id}
                onSelectProject={onSelectProject}
                onDeleteProject={onDeleteProject}
                onRenameProject={onRenameProject}
                setSidebarOpen={setSidebarOpen}
              />
            ))}
          </div>
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-slate-200/80 bg-slate-50">
          {user ? (
            <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer">
              <div className="flex items-center space-x-2.5 truncate">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                  {user.avatar ? (
                    <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user.name?.charAt(0) || 'M'
                  )}
                </div>
                <div className="truncate text-left leading-tight">
                  <div className="font-bold text-xs text-slate-900 truncate">{user.name || 'Mukesh Singh'}</div>
                  <div className="text-[10px] text-slate-400 truncate">{user.email || 'mukesh@example.com'}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                title="Sign Out"
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div 
              onClick={onOpenAuth}
              className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-2.5 truncate">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  MS
                </div>
                <div className="truncate text-left leading-tight">
                  <div className="font-bold text-xs text-slate-900 truncate">Mukesh Singh</div>
                  <div className="text-[10px] text-slate-400 truncate">mukesh@example.com</div>
                </div>
              </div>

              <MoreHorizontal className="w-4 h-4 text-slate-400" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
