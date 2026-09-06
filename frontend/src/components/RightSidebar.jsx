import React from 'react';
import {
  Code2,
  MessageSquare,
  FileText,
  Folder,
  ChevronRight,
  ArrowRight
} from 'lucide-react';

export default function RightSidebar({ projects = [], onSelectProject, onPromptAction }) {
  const safeProjects = Array.isArray(projects) ? projects : [];

  // 4 Default Recent Chats if real conversation list is empty
  const defaultRecentChats = [
    {
      thread_id: 'chat-1',
      title: 'Build a calculator app',
      time: '2 hours ago',
      icon: Code2,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100'
    },
    {
      thread_id: 'chat-2',
      title: 'Explain React hooks',
      time: '4 hours ago',
      icon: MessageSquare,
      color: 'bg-purple-50 text-purple-600 border-purple-100'
    },
    {
      thread_id: 'chat-3',
      title: 'Fix this code error',
      time: '6 hours ago',
      icon: Code2,
      color: 'bg-blue-50 text-blue-600 border-blue-100'
    },
    {
      thread_id: 'chat-4',
      title: 'Summarize this document',
      time: '8 hours ago',
      icon: FileText,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100'
    },
  ];

  // Map real user chats if present to clean display rows
  const recentChats = safeProjects.length > 0
    ? safeProjects.slice(0, 4).map((p, idx) => ({
      thread_id: p.thread_id,
      title: p.title || p.requirement || 'Chat Session',
      time: p.updated_at ? 'Recently' : `${(idx + 1) * 2} hours ago`,
      icon: idx % 2 === 0 ? Code2 : MessageSquare,
      color: idx % 3 === 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : idx % 3 === 1 ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'
    }))
    : defaultRecentChats;

  const sampleProjects = [
    { id: 'proj-1', title: 'College Management System', updated: 'Updated 2 days ago', color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { id: 'proj-2', title: 'E-commerce Website', updated: 'Updated 3 days ago', color: 'bg-purple-50 text-purple-600 border-purple-100' },
    { id: 'proj-3', title: 'Portfolio Website', updated: 'Updated 5 days ago', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { id: 'proj-4', title: 'Task Manager', updated: 'Updated 1 week ago', color: 'bg-amber-50 text-amber-600 border-amber-100' },
  ];

  return (
    <aside className="hidden lg:flex lg:w-80 shrink-0 flex-col gap-6 p-6 border-l border-slate-200/70 overflow-y-auto max-h-full">

      {/* 1. Recent Chats Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-xs text-slate-900 tracking-tight">Recent Chats</h3>
          <button
            type="button"
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1 transition-colors"
          >
            <span>View all</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-1 pt-0.5">
          {recentChats.map((chat) => {
            const Icon = chat.icon;
            return (
              <div
                key={chat.thread_id}
                onClick={() => onSelectProject && onSelectProject(chat.thread_id)}
                className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100/70 transition-all cursor-pointer group border border-transparent hover:border-slate-200/60"
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${chat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate text-left leading-tight">
                    <div className="font-semibold text-xs text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                      {chat.title}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{chat.time}</div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Sample Projects Section */}
      <div className="space-y-3 pt-2">
        <div className="px-1">
          <h3 className="font-bold text-xs text-slate-900 tracking-tight">Sample Projects</h3>
        </div>

        <div className="space-y-1 pt-0.5">
          {sampleProjects.map((proj) => (
            <div
              key={proj.id}
              onClick={() => onPromptAction && onPromptAction(`Open sample project: ${proj.title}`)}
              className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100/70 transition-all cursor-pointer group border border-transparent hover:border-slate-200/60"
            >
              <div className="flex items-center space-x-3 truncate">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${proj.color}`}>
                  <Folder className="w-4 h-4" />
                </div>
                <div className="truncate text-left leading-tight">
                  <div className="font-semibold text-xs text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                    {proj.title}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{proj.updated}</div>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </div>
          ))}
        </div>
      </div>

    </aside>
  );
}

