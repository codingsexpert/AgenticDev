import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Code2, Eye, Play, Save, Sparkles, Bug, RefreshCw, MessageCircle, Terminal, Loader2, Folder, FileCode, FileJson, FileText, File, ExternalLink, Layers } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const getFileIcon = (filename = '', language = '') => {
  const name = (filename || '').toLowerCase();
  const lang = (language || '').toLowerCase();
  if (name.endsWith('.html') || lang === 'html') return <FileCode className="w-3.5 h-3.5 text-orange-500" />;
  if (name.endsWith('.css') || lang === 'css') return <FileCode className="w-3.5 h-3.5 text-sky-500" />;
  if (name.endsWith('.js') || name.endsWith('.jsx') || lang === 'javascript' || lang === 'js') return <FileJson className="w-3.5 h-3.5 text-amber-500" />;
  if (name.endsWith('.py') || lang === 'python') return <FileText className="w-3.5 h-3.5 text-blue-500" />;
  return <File className="w-3.5 h-3.5 text-slate-400" />;
};

function UnifiedProjectCard({ blocks, activeSandboxId, onOpenCodeBlock, onQuickAction }) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const previewRef = useRef(null);

  if (!blocks || blocks.length === 0) return null;

  const currentBlock = blocks[activeTabIndex] || blocks[0];
  const langLower = (currentBlock.language || '').toLowerCase();

  const hasWebBlocks = blocks.some(b => {
    const l = (b.language || '').toLowerCase();
    const f = (b.filename || '').toLowerCase();
    return l === 'html' || l === 'css' || l === 'javascript' || l === 'js' || f.endsWith('.html') || f.endsWith('.css') || f.endsWith('.js');
  });

  const isExecutable = ['python', 'py', 'python3', 'javascript', 'js', 'node', 'cpp', 'c++', 'c', 'bash', 'sh', 'zsh', 'java', 'go', 'rust', 'php'].includes(langLower) || true;

  const handleRunCode = async () => {
    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const res = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentBlock.code, language: langLower })
      });
      const data = await res.json();
      setExecutionResult(data);
    } catch (e) {
      setExecutionResult({ output: "Failed to execute code: " + e.message, images: [] });
    }
    setIsExecuting(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentBlock.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyAll = async () => {
    if (!activeSandboxId) return;
    try {
      await Promise.all(blocks.map(b =>
        fetch(`/api/sandboxes/${activeSandboxId}/file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: b.code, path: b.filename })
        })
      ));
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    } catch (e) {
      console.error('Failed to apply code files', e);
    }
  };

  const getCombinedSrcDoc = () => {
    let htmlBlock = blocks.find(b => b.language === 'html' || b.filename.endsWith('.html'));
    let cssBlock = blocks.find(b => b.language === 'css' || b.filename.endsWith('.css'));
    let jsBlock = blocks.find(b => b.language === 'javascript' || b.language === 'js' || b.filename.endsWith('.js'));

    let html = htmlBlock ? htmlBlock.code : (blocks.length === 1 && hasWebBlocks ? blocks[0].code : '<div id="root"></div>');
    let css = cssBlock ? cssBlock.code : '';
    let js = jsBlock ? jsBlock.code : '';

    if (htmlBlock || hasWebBlocks) {
      let combinedHtml = html;
      if (css) {
        if (combinedHtml.includes('</head>')) {
          combinedHtml = combinedHtml.replace('</head>', `<style>${css}</style></head>`);
        } else {
          combinedHtml = `<style>${css}</style>\n` + combinedHtml;
        }
      }
      if (js) {
        if (combinedHtml.includes('</body>')) {
          combinedHtml = combinedHtml.replace('</body>', `<script>${js}</script></body>`);
        } else {
          combinedHtml = combinedHtml + `\n<script>${js}</script>`;
        }
      }

      if (!combinedHtml.includes('<html') && !combinedHtml.includes('<!DOCTYPE')) {
        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, sans-serif; padding: 16px; background: #ffffff; color: #0f172a; }
    ${css}
  </style>
</head>
<body>
  ${combinedHtml}
  <script>
    try {
      ${js}
    } catch(e) {
      console.error(e);
    }
  </script>
</body>
</html>`;
      }
      return combinedHtml;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { font-family: system-ui, sans-serif; padding: 16px; background: #ffffff; color: #0f172a; }</style>
</head>
<body>
  <div id="root">${currentBlock.code.includes('<') ? currentBlock.code : ''}</div>
  <script>
    try {
      ${!currentBlock.code.includes('<') ? currentBlock.code : ''}
    } catch(e) {
      document.body.innerHTML += '<div style="color:red;padding:8px;margin-top:8px;background:#fee2e2;border-radius:6px;font-family:monospace;font-size:12px;">Runtime Error: ' + e.message + '</div>';
    }
  </script>
</body>
</html>`;
  };

  const projectTitle = blocks.length > 1
    ? `Workspace Project (${blocks.length} Files)`
    : (currentBlock.filename || `${currentBlock.language || 'Code'} File`);

  return (
    <div className="my-5 flex flex-col bg-[#0f1117] border border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:shadow-[0_25px_60px_rgba(99,102,241,0.2)] rounded-2xl overflow-hidden transition-all duration-300 transform hover:-translate-y-0.5">
      {/* Unified Main Card Top Bar Header */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-gradient-to-r from-[#0d0e15] via-[#16192b] to-[#0d0e15] border-b border-indigo-500/20 gap-3">
        <div className="flex items-center space-x-3.5">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur-xs opacity-50 group-hover:opacity-100 transition duration-300"></div>
            <div className="relative w-10 h-10 rounded-xl bg-slate-900 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <Folder className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white flex items-center space-x-2.5">
              <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent font-semibold">
                {projectTitle}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                CONNECTED
              </span>
            </div>
            <div className="text-[11.5px] text-slate-400 mt-1 flex items-center space-x-2 font-mono">
              <span className="text-indigo-300/80">Saved in workspace sandbox</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 truncate max-w-[240px] sm:max-w-md">{blocks.map(b => b.filename).join(', ')}</span>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-2">
          {/* Primary Glowing Run Code Button */}
          <button
            onClick={handleRunCode}
            disabled={isExecuting}
            className="relative group text-xs px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-semibold transition-all duration-200 shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center space-x-2 disabled:opacity-50 cursor-pointer border border-emerald-400/30 active:scale-95"
            title="Execute code natively and view output console"
          >
            {isExecuting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-white text-white" />
            )}
            <span className="tracking-wide">{isExecuting ? 'Executing...' : 'Run Code'}</span>
          </button>

          {hasWebBlocks && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 cursor-pointer border active:scale-95 ${
                showPreview
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                  : 'bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border-indigo-500/30'
              }`}
              title="Toggle interactive live web preview"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showPreview ? 'Hide Preview' : 'Live Preview'}</span>
            </button>
          )}

          {activeSandboxId && (
            <button
              onClick={handleApplyAll}
              className="text-xs px-3.5 py-1.5 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all duration-200 border border-indigo-400/30 flex items-center space-x-2 cursor-pointer active:scale-95"
              title="Save all files directly to sandbox workspace"
            >
              {applied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
              <span>{applied ? 'Saved All' : 'Save All'}</span>
            </button>
          )}

          <button
            onClick={() => onOpenCodeBlock && onOpenCodeBlock(blocks)}
            className="text-xs px-3.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-medium transition-all duration-200 border border-slate-700/80 hover:border-indigo-500/50 flex items-center space-x-2 shadow-sm cursor-pointer active:scale-95"
            title="Open full interactive Workspace IDE canvas"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Open Workspace IDE</span>
          </button>
        </div>
      </div>

      {/* Multi-File Tab Bar Strip */}
      <div className="flex items-center space-x-1 px-3 pt-2 bg-[#121319] border-b border-slate-800/80 overflow-x-auto no-scrollbar">
        {blocks.map((block, idx) => {
          const isActive = idx === activeTabIndex;
          return (
            <button
              key={idx}
              onClick={() => setActiveTabIndex(idx)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-xl text-xs font-mono transition-all duration-200 shrink-0 cursor-pointer relative ${
                isActive
                  ? 'bg-[#1e202e] text-indigo-300 font-semibold border-t border-x border-slate-700/80 shadow-md'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              {getFileIcon(block.filename, block.language)}
              <span>{block.filename}</span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* File Quick Actions & Run Toolbar */}
      <div className="flex items-center space-x-2 px-3.5 py-2 border-b border-slate-800/60 bg-[#161822] overflow-x-auto no-scrollbar justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onQuickAction && onQuickAction('Explain', currentBlock.code)}
            className="text-[11px] px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-400/50 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap cursor-pointer"
          >
            <MessageCircle className="w-3 h-3 text-amber-400" />
            <span>Explain</span>
          </button>
          <button
            onClick={() => onQuickAction && onQuickAction('Debug', currentBlock.code)}
            className="text-[11px] px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-400/50 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap cursor-pointer"
          >
            <Bug className="w-3 h-3 text-rose-400" />
            <span>Debug</span>
          </button>
          <button
            onClick={() => onQuickAction && onQuickAction('Refactor', currentBlock.code)}
            className="text-[11px] px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 text-indigo-400" />
            <span>Refactor</span>
          </button>
        </div>

        <button
          onClick={handleRunCode}
          disabled={isExecuting}
          className="text-[11px] px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap shadow-xs disabled:opacity-50 cursor-pointer border border-emerald-400/30"
        >
          {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-white" />}
          <span>{isExecuting ? 'Running...' : 'Run Code'}</span>
        </button>
      </div>

      {/* Code Viewer Container */}
      <div className="bg-[#0b0c10] relative">
        <div className="bg-[#12141c] px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-slate-300 font-mono text-[11px]">
          <span className="flex items-center space-x-2 font-semibold uppercase text-indigo-400 tracking-wider">
            {getFileIcon(currentBlock.filename, currentBlock.language)}
            <span>FILE: {currentBlock.filename}</span>
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-200 text-[11px] transition-all cursor-pointer font-sans active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-400" />
                <span>Copy code</span>
              </>
            )}
          </button>
        </div>

        <div className="overflow-x-auto selection:bg-indigo-500/40 font-mono text-[13px] p-2">
          <SyntaxHighlighter
            language={langLower === 'html' ? 'xml' : langLower === 'jsx' ? 'javascript' : langLower || 'javascript'}
            style={vscDarkPlus}
            customStyle={{ margin: 0, padding: '16px', background: 'transparent', fontSize: '13px', lineHeight: '1.6' }}
            wrapLines={true}
          >
            {currentBlock.code}
          </SyntaxHighlighter>
        </div>

        {/* Integrated High-Tech Terminal Execution Box */}
        {executionResult !== null && (
          <div className="border-t border-slate-800/80 bg-[#07080b] p-4 font-mono text-[11.5px] sm:text-xs">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800/60">
              <div className="flex items-center space-x-2 text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Terminal className="w-3.5 h-3.5" />
                <span className="font-semibold uppercase tracking-wider text-[11px]">TERMINAL OUTPUT</span>
              </div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                {executionResult.exit_code === 0 ? 'STATUS: SUCCESS (0)' : executionResult.exit_code ? `EXIT CODE: ${executionResult.exit_code}` : 'EXECUTED'}
              </span>
            </div>
            <div className="text-slate-200 whitespace-pre-wrap font-mono p-3 bg-[#0d0f17] rounded-xl border border-slate-800/80 max-h-[320px] overflow-y-auto leading-relaxed shadow-inner">
              {executionResult.output || 'No output produced.'}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Combined Live Preview Panel */}
      {showPreview && (
        <div ref={previewRef} className="border-t border-slate-800/80 bg-slate-900">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border-b border-slate-800 text-xs text-slate-200 font-mono">
            <span className="flex items-center space-x-2 font-semibold text-white">
              <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
              <span>Interactive Live Web Sandbox Preview ({blocks.length} File{blocks.length > 1 ? 's' : ''})</span>
            </span>
          </div>
          <iframe
            srcDoc={getCombinedSrcDoc()}
            title="Combined Live Code Preview"
            className="w-full h-80 sm:h-96 border-none bg-white shadow-2xl"
            sandbox="allow-scripts allow-modals"
          />
        </div>
      )}
    </div>
  );
}

const markdownComponents = {
  h1: ({ node, ...props }) => <h1 className="text-base sm:text-lg font-bold text-slate-900 mt-3.5 mb-1.5 tracking-tight border-b border-slate-200/80 pb-1" {...props} />,
  h2: ({ node, ...props }) => <h2 className="text-sm sm:text-base font-bold text-slate-900 mt-3 mb-1 tracking-tight" {...props} />,
  h3: ({ node, ...props }) => <h3 className="text-xs sm:text-sm font-bold text-slate-900 mt-2.5 mb-1 tracking-tight" {...props} />,
  h4: ({ node, ...props }) => <h4 className="text-xs font-bold text-slate-900 mt-2 mb-0.5 tracking-tight" {...props} />,
  p: ({ node, ...props }) => <p className="mb-2 text-slate-800 leading-normal text-xs sm:text-sm" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold text-slate-950" {...props} />,
  em: ({ node, ...props }) => <em className="italic text-slate-800" {...props} />,
  a: ({ node, ...props }) => <a className="text-indigo-600 hover:text-indigo-700 hover:underline font-medium" target="_blank" rel="noreferrer" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5 text-xs sm:text-sm text-slate-800" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5 text-xs sm:text-sm text-slate-800" {...props} />,
  li: ({ node, ...props }) => <li className="leading-normal pl-0.5 text-xs sm:text-sm" {...props} />,
  blockquote: ({ node, ...props }) => <blockquote className="border-l-3 border-indigo-400 bg-indigo-50/40 pl-3 py-1.5 my-2 rounded-r-lg text-slate-700 text-xs sm:text-sm font-medium italic" {...props} />,
  table: ({ node, ...props }) => <div className="overflow-x-auto my-2 rounded-xl border border-slate-200 shadow-xs"><table className="w-full border-collapse text-xs text-left" {...props} /></div>,
  thead: ({ node, ...props }) => <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-200" {...props} />,
  tbody: ({ node, ...props }) => <tbody className="divide-y divide-slate-100 bg-white" {...props} />,
  tr: ({ node, ...props }) => <tr className="hover:bg-slate-50/80 transition-colors" {...props} />,
  th: ({ node, ...props }) => <th className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10.5px] text-slate-700" {...props} />,
  td: ({ node, ...props }) => <td className="px-3 py-1.5 text-slate-800 text-xs" {...props} />,
  hr: ({ node, ...props }) => <hr className="my-3 border-t border-slate-200/70" {...props} />,
};

export default function FormattedMessage({ content = '', isUser = false, activeSandboxId, onOpenCodeBlock, onQuickAction }) {
  if (!content) return null;

  let sanitizedContent = content;

  // If there's an unclosed code block at the end during streaming, close it
  if ((sanitizedContent.match(/```/g) || []).length % 2 !== 0) {
    sanitizedContent += '\n```';
  }

  // Pre-parse <thinking> blocks to render them natively
  const parts = sanitizedContent.split(/(<thinking>[\s\S]*?<\/thinking>|<thinking>[\s\S]*$)/g);

  // Helper to extract all code blocks from text
  const extractAllCodeBlocks = (str) => {
    const blocks = [];
    const regex = /```([a-zA-Z0-9_+\-#]*)[ \t]*\r?\n?([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(str)) !== null) {
      const lang = (match[1] || '').toLowerCase().trim();
      const code = (match[2] || '').trim();
      if (!code) continue;
      let filename = '';
      const firstLine = code.split('\n')[0].trim();
      if (firstLine.startsWith('//') || firstLine.startsWith('<!--') || firstLine.startsWith('/*') || firstLine.startsWith('#')) {
        filename = firstLine.replace(/[\/\*<\!#>\-]/g, '').replace(/^file:\s*/i, '').trim();
      }
      if (!filename) {
        if (lang === 'html') filename = 'index.html';
        else if (lang === 'css') filename = 'style.css';
        else if (lang === 'js' || lang === 'javascript') filename = 'script.js';
        else if (lang === 'py' || lang === 'python') filename = 'main.py';
        else filename = `file_${blocks.length + 1}.${lang || 'txt'}`;
      }
      blocks.push({ language: lang, code, filename });
    }
    return blocks;
  };

  return (
    <div className={`space-y-1.5 text-xs sm:text-sm leading-normal font-sans ${isUser ? 'text-slate-900 font-medium' : 'text-slate-800 font-normal'} markdown-body break-words [overflow-wrap:anywhere] overflow-hidden max-w-full`}>
      {parts.map((part, index) => {
        if (part.startsWith('<thinking>')) {
          const thinkingText = part.replace(/<\/?thinking>/g, '').trim();
          return (
            <details key={index} className="group my-3 bg-zinc-50 border border-zinc-200/80 rounded-xl overflow-hidden shadow-sm" open>
              <summary className="flex items-center space-x-2 px-4 py-2.5 bg-zinc-100/50 cursor-pointer select-none hover:bg-zinc-100 transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span className="text-amber-600 font-medium tracking-tight text-[13px] uppercase flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Reasoning Process</span>
                </span>
              </summary>
              <div className="px-4 py-3 text-[13.5px] text-zinc-600 bg-zinc-50 border-t border-zinc-200/80 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {thinkingText}
              </div>
            </details>
          );
        }

        if (!part.trim()) return null;

        const allBlocks = extractAllCodeBlocks(part);

        if (allBlocks.length > 0) {
          // Replace code blocks in markdown with a marker
          let markerIndex = 0;
          const textWithMarker = part.replace(/```([a-zA-Z0-9_+\-#]*)[ \t]*\r?\n?([\s\S]*?)```/g, () => {
            markerIndex++;
            return markerIndex === 1 ? '___PROJECT_ARTIFACT_MARKER___' : '';
          });

          const subParts = textWithMarker.split('___PROJECT_ARTIFACT_MARKER___');

          return (
            <React.Fragment key={index}>
              {subParts[0] && subParts[0].trim() && (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {subParts[0]}
                </ReactMarkdown>
              )}

              <UnifiedProjectCard
                blocks={allBlocks}
                activeSandboxId={activeSandboxId}
                onOpenCodeBlock={onOpenCodeBlock}
                onQuickAction={onQuickAction}
              />

              {subParts[1] && subParts[1].trim() && (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {subParts[1]}
                </ReactMarkdown>
              )}
            </React.Fragment>
          );
        }

        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {part}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

