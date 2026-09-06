import React from 'react';
import { 
  FolderPlus, 
  FileText, 
  Brain, 
  MessageSquare, 
  Globe, 
  UploadCloud, 
  Code, 
  Database, 
  ChevronRight, 
  Clock, 
  BarChart3, 
  Zap, 
  Sparkles,
  ExternalLink
} from 'lucide-react';

export default function RightSidebar({ onPromptAction, onUploadClick }) {
  return (
    <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-5 p-4 lg:p-5 bg-white/60 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none border-t lg:border-t-0 lg:border-l border-slate-200/80 overflow-y-auto max-h-full">
      
      {/* 1. Recent Activity Section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-700" />
            <h3 className="font-bold text-xs text-slate-900 tracking-tight">Recent Activity</h3>
          </div>
          <button type="button" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            View all
          </button>
        </div>

        <div className="space-y-2.5 pt-1">
          {/* Item 1 */}
          <div className="flex items-start space-x-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100 group-hover:scale-105 transition-transform">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div className="truncate text-left leading-tight">
              <div className="font-semibold text-xs text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                Created project: College Research
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">2 hours ago</div>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex items-start space-x-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <div className="truncate text-left leading-tight">
              <div className="font-semibold text-xs text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                Uploaded file: BCA Syllabus.pdf
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">4 hours ago</div>
            </div>
          </div>

          {/* Item 3 */}
          <div className="flex items-start space-x-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 group-hover:scale-105 transition-transform">
              <Brain className="w-4 h-4" />
            </div>
            <div className="truncate text-left leading-tight">
              <div className="font-semibold text-xs text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                Updated memory
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">6 hours ago</div>
            </div>
          </div>

          {/* Item 4 */}
          <div className="flex items-start space-x-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="truncate text-left leading-tight">
              <div className="font-semibold text-xs text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                New conversation
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">8 hours ago</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Quick Tools Section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-slate-700" />
          <h3 className="font-bold text-xs text-slate-900 tracking-tight">Quick Tools</h3>
        </div>

        <div className="space-y-2 pt-1">
          {/* Tool 1 */}
          <button
            type="button"
            onClick={() => onPromptAction && onPromptAction('Search web for latest AI news and updates')}
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 hover:border-indigo-200 hover:bg-indigo-50/40 text-left transition-all group"
          >
            <div className="flex items-center space-x-3 truncate">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Globe className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">Web Search</div>
                <div className="text-[10px] text-slate-400 truncate">Search the internet for latest info</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>

          {/* Tool 2 */}
          <button
            type="button"
            onClick={() => onUploadClick && onUploadClick()}
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 hover:border-indigo-200 hover:bg-indigo-50/40 text-left transition-all group"
          >
            <div className="flex items-center space-x-3 truncate">
              <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100">
                <UploadCloud className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">Upload File</div>
                <div className="text-[10px] text-slate-400 truncate">PDF, DOCX, TXT, images and more</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>

          {/* Tool 3 */}
          <button
            type="button"
            onClick={() => onPromptAction && onPromptAction('Run Python code interpreter: create a plot of sine and cosine waves using matplotlib')}
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 hover:border-indigo-200 hover:bg-indigo-50/40 text-left transition-all group"
          >
            <div className="flex items-center space-x-3 truncate">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <Code className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">Code Interpreter</div>
                <div className="text-[10px] text-slate-400 truncate">Run Python code in sandbox</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>

          {/* Tool 4 */}
          <button
            type="button"
            onClick={() => onPromptAction && onPromptAction('Search RAG knowledge base for uploaded notes')}
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 hover:border-indigo-200 hover:bg-indigo-50/40 text-left transition-all group"
          >
            <div className="flex items-center space-x-3 truncate">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                <Database className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">RAG Knowledge Base</div>
                <div className="text-[10px] text-slate-400 truncate">Search your uploaded documents</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        </div>
      </div>

      {/* 3. Usage Statistics Section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-slate-700" />
            <h3 className="font-bold text-xs text-slate-900 tracking-tight">Usage</h3>
          </div>
          <button type="button" className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            View details
          </button>
        </div>

        <div className="space-y-3 pt-1">
          {/* Requests Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-medium text-slate-700">
              <span>Requests</span>
              <span className="font-semibold text-slate-900">42 / 1000</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-indigo-600 h-full rounded-full w-[4.2%] transition-all" />
            </div>
          </div>

          {/* Tokens Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-medium text-slate-700">
              <span>Tokens</span>
              <span className="font-semibold text-slate-900">12,450 / 200,000</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full w-[6.2%] transition-all" />
            </div>
          </div>

          {/* Reset Notice */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-400">
            <span className="flex items-center space-x-1">
              <span>📅</span>
              <span>Resets in 12 days</span>
            </span>
            <span className="font-semibold text-indigo-600">Pro Plan</span>
          </div>
        </div>
      </div>

    </aside>
  );
}
