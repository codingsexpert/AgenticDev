import React, { useState } from 'react';
import { Bot, CheckCircle2, AlertTriangle, Clock, ChevronDown, ChevronUp, Code, ShieldCheck, Terminal, Cpu } from 'lucide-react';

export default function AgentNodeCard({ nodeName, status, data, onOpenArtifacts }) {
  const [expanded, setExpanded] = useState(true);

  const agentMeta = {
    pmAgent: { title: 'PM Agent', icon: Bot, desc: 'Analyzing requirements & specification' },
    architectStep1: { title: 'Architect: Naming Map', icon: Cpu, desc: 'Designing entities & terminology' },
    architectStep2: { title: 'Architect: Database Schema', icon: Cpu, desc: 'Designing database tables & relations' },
    architectStep3: { title: 'Architect: REST Endpoints', icon: Cpu, desc: 'Designing API routes & handlers' },
    architectStep4: { title: 'Architect: Frontend Pages', icon: Cpu, desc: 'Designing UI layout & page structures' },
    architectStep5: { title: 'Architect: Folder Tree', icon: Cpu, desc: 'Structuring folder hierarchy' },
    blueprintValidator: { title: 'Blueprint Validator', icon: ShieldCheck, desc: 'Validating architecture blueprint consistency' },
    plannerAgent: { title: 'Planner Agent', icon: Bot, desc: 'Creating step-by-step dev task breakdown' },
    setupSandbox: { title: 'Sandbox Environment', icon: Terminal, desc: 'Provisioning local docker-free sandbox' },
    coderAgent: { title: 'Coder Agent', icon: Code, desc: 'Writing production code & templates' },
    reviewerAgent: { title: 'Reviewer Agent', icon: ShieldCheck, desc: 'Performing code review & security checks' },
    executorAgent: { title: 'Executor Agent', icon: Terminal, desc: 'Running syntax checks & automated verification' },
    debuggerAgent: { title: 'Debugger Agent', icon: AlertTriangle, desc: 'Analyzing errors & applying 3-Tier repair' },
  };

  const meta = agentMeta[nodeName] || { title: nodeName || 'Agent', icon: Bot, desc: 'Agent processing' };
  const Icon = meta.icon || Bot;

  const currentTaskTitle = data?.currentTask
    ? (typeof data.currentTask === 'string' ? data.currentTask : data.currentTask?.title || JSON.stringify(data.currentTask))
    : null;

  const reviewVerdict = data?.reviewResult
    ? (data.reviewResult?.verdict || (typeof data.reviewResult === 'string' ? data.reviewResult : '')).toString()
    : null;

  const isApproved = reviewVerdict?.toLowerCase().includes('approved');

  return (
    <div className={`p-4 rounded-xl border transition-all duration-300 ${
      status === 'running'
        ? 'bg-white border-emerald-500 shadow-md shadow-emerald-500/10 active-pulse'
        : status === 'complete'
        ? 'bg-white border-slate-200 shadow-2xs'
        : 'bg-slate-50 border-slate-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            status === 'running'
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              : status === 'complete'
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              : 'bg-slate-100 text-slate-500'
          }`}>
            <Icon className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-semibold text-slate-900">{meta.title}</h3>
              {status === 'running' && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-mono animate-pulse">
                  ACTIVE
                </span>
              )}
              {status === 'complete' && (
                <span className="text-[10px] text-emerald-600 flex items-center space-x-0.5 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Done</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">{meta.desc}</p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && data && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-700 space-y-2">
          {currentTaskTitle && (
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 font-mono block uppercase">CURRENT TASK:</span>
              <span className="text-emerald-700 font-medium">{currentTaskTitle}</span>
            </div>
          )}

          {reviewVerdict && (
            <div className="text-[11px] flex items-center space-x-2">
              <span className="text-slate-500">Review Verdict:</span>
              <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {reviewVerdict}
              </span>
            </div>
          )}

          {data?.sandboxId && onOpenArtifacts && (
            <button
              onClick={() => onOpenArtifacts(data.sandboxId)}
              className="w-full flex items-center justify-center space-x-2 py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs border border-emerald-200 transition-colors mt-2 font-medium"
            >
              <Code className="w-3.5 h-3.5" />
              <span>View Generated Code in Artifacts Canvas</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
