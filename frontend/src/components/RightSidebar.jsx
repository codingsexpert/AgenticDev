import React, { useState, useEffect } from 'react';
import {
  Code2,
  MessageSquare,
  FileText,
  Folder,
  ChevronRight,
  ArrowRight,
  Activity,
  Cpu,
  Zap,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Terminal,
  Database
} from 'lucide-react';
import { useToast } from './Toast';

export default function RightSidebar({ projects = [], onSelectProject, onPromptAction }) {
  const { addToast } = useToast();
  const [sysStatus, setSysStatus] = useState({ status: 'Operational', model: 'Gemini 1.5 Flash', sandboxes: 0, loading: false });
  const safeProjects = Array.isArray(projects) ? projects : [];

  const fetchSysStatus = async () => {
    setSysStatus(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setSysStatus({
          status: data.status || 'Operational',
          model: data.model || 'Gemini 1.5 Flash',
          sandboxes: data.sandboxes !== undefined ? data.sandboxes : safeProjects.length,
          loading: false
        });
      } else {
        setSysStatus(prev => ({ ...prev, loading: false }));
      }
    } catch (e) {
      setSysStatus(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchSysStatus();
  }, []);

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

  const recentChats = safeProjects.length > 0
    ? safeProjects.slice(0, 4).map((p, idx) => ({
      thread_id: p.thread_id,
      title: p.title || p.requirement || 'Chat Session',
      time: p.updated_at ? new Date(p.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
      icon: idx % 2 === 0 ? Code2 : MessageSquare,
      color: idx % 3 === 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : idx % 3 === 1 ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'
    }))
    : defaultRecentChats;

  const quickStarters = [
    { id: 'qs-1', title: 'Fullstack React App', prompt: 'Build a responsive fullstack React component with state management', icon: Code2, color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { id: 'qs-2', title: 'FastAPI Microservice', prompt: 'Create a production FastAPI backend service with Pydantic validation', icon: Terminal, color: 'bg-purple-50 text-purple-600 border-purple-100' },
    { id: 'qs-3', title: 'RAG Knowledge Search', prompt: 'Analyze uploaded documents using vector RAG indexing', icon: Database, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { id: 'qs-4', title: 'AI Code Refactoring', prompt: 'Refactor current codebase for modular clean architecture', icon: Zap, color: 'bg-amber-50 text-amber-600 border-amber-100' },
  ];

  return (
    <aside className="hidden xl:flex xl:w-80 shrink-0 flex-col gap-6 p-6 border-l border-slate-200/70 overflow-y-auto max-h-full bg-slate-50/30">

      {/* 1. Live System Diagnostics Status Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            <h3 className="font-bold text-xs text-slate-900 tracking-tight">System Status</h3>
          </div>
          <button
            onClick={() => {
              fetchSysStatus();
              addToast('System status refreshed', 'info');
            }}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="Refresh Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${sysStatus.loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[10px]">Backend Engine</span>
            <span className="font-bold text-emerald-600 flex items-center space-x-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3" />
              <span>{sysStatus.status}</span>
            </span>
          </div>

          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[10px]">Active Model</span>
            <span className="font-bold text-indigo-600 truncate block mt-0.5">
              {sysStatus.model}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Recent Chats Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-xs text-slate-900 tracking-tight">Recent Chats</h3>
          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {recentChats.length} Active
          </span>
        </div>

        <div className="space-y-1.5 pt-0.5">
          {recentChats.map((chat) => {
            const Icon = chat.icon;
            return (
              <div
                key={chat.thread_id}
                onClick={() => {
                  if (onSelectProject) {
                    onSelectProject(chat.thread_id);
                    addToast('Loaded project session', 'info');
                  }
                }}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-white hover:bg-indigo-50/50 transition-all cursor-pointer group border border-slate-200/70 hover:border-indigo-200 shadow-2xs"
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${chat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate text-left leading-tight">
                    <div className="font-semibold text-xs text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      {chat.title}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{chat.time}</div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Quick Action Templates Section */}
      <div className="space-y-3 pt-2">
        <div className="px-1 flex items-center justify-between">
          <h3 className="font-bold text-xs text-slate-900 tracking-tight flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Quick Prompt Starters</span>
          </h3>
        </div>

        <div className="space-y-1.5 pt-0.5">
          {quickStarters.map((starter) => {
            const Icon = starter.icon;
            return (
              <div
                key={starter.id}
                onClick={() => {
                  if (onPromptAction) {
                    onPromptAction(starter.prompt);
                    addToast(`Loaded template: ${starter.title}`, 'success');
                  }
                }}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-white hover:bg-slate-100/80 transition-all cursor-pointer group border border-slate-200/70 hover:border-slate-300 shadow-2xs"
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${starter.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate text-left leading-tight">
                    <div className="font-semibold text-xs text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      {starter.title}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">{starter.prompt}</div>
                  </div>
                </div>

                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </div>
            );
          })}
        </div>
      </div>

    </aside>
  );
}


