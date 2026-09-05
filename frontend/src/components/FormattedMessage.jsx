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

  const isExecutable = ['python', 'py', 'python3', 'javascript', 'js', 'node'].includes(langLower);

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
    <div className="my-5 flex flex-col bg-white border border-slate-200/90 shadow-[0_15px_45px_-10px_rgba(15,23,42,0.1)] hover:shadow-[0_20px_55px_-10px_rgba(99,102,241,0.18)] rounded-2xl overflow-hidden transition-all duration-300 transform hover:-translate-y-0.5">
      {/* Unified Card Main Header */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white gap-3 border-b border-indigo-500/20">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 shadow-inner">
            <Folder className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white flex items-center space-x-2">
              <span>{projectTitle}</span>
              {blocks.length > 1 && (
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                  Connected
                </span>
              )}
            </div>
            <div className="text-[11.5px] text-slate-300 mt-0.5 flex items-center space-x-2">
              <span>Saved in workspace sandbox</span>
              <span className="text-slate-500">•</span>
              <span>{blocks.map(b => b.filename).join(', ')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {activeSandboxId && (
            <button
              onClick={handleApplyAll}
              className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-sm flex items-center space-x-1.5"
              title="Save all files directly to sandbox"
            >
              {applied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
              <span>{applied ? 'Saved All' : 'Save All'}</span>
            </button>
          )}

          {hasWebBlocks && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 shadow-sm ${
                showPreview ? 'bg-emerald-500 text-white' : 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showPreview ? 'Hide Preview' : 'Live Preview'}</span>
            </button>
          )}

          <button
            onClick={() => onOpenCodeBlock && onOpenCodeBlock(blocks)}
            className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all border border-white/20 flex items-center space-x-1.5 shadow-sm"
            title="Open full workspace IDE canvas"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-300" />
            <span>Open Workspace IDE</span>
          </button>
        </div>
      </div>

      {/* Multi-File Tab Bar */}
      <div className="flex items-center space-x-1 px-3 py-2 bg-slate-100/80 border-b border-slate-200 overflow-x-auto no-scrollbar">
        {blocks.map((block, idx) => {
          const isActive = idx === activeTabIndex;
          return (
            <button
              key={idx}
              onClick={() => setActiveTabIndex(idx)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all shrink-0 ${
                isActive
                  ? 'bg-white text-indigo-950 font-semibold shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              {getFileIcon(block.filename, block.language)}
              <span>{block.filename}</span>
            </button>
          );
        })}
      </div>

      {/* Active File Quick Actions Toolbar */}
      <div className="flex items-center space-x-2 px-3 py-1.5 border-b border-slate-100 bg-slate-50/50 overflow-x-auto no-scrollbar">
        <button
          onClick={() => onQuickAction && onQuickAction('Explain', currentBlock.code)}
          className="text-[11px] px-2.5 py-1 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-200 rounded-md transition-colors flex items-center space-x-1.5 whitespace-nowrap shadow-xs"
        >
          <MessageCircle className="w-3 h-3 text-amber-500" />
          <span>Explain</span>
        </button>
        <button
          onClick={() => onQuickAction && onQuickAction('Debug', currentBlock.code)}
          className="text-[11px] px-2.5 py-1 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-md transition-colors flex items-center space-x-1.5 whitespace-nowrap shadow-xs"
        >
          <Bug className="w-3 h-3 text-rose-500" />
          <span>Debug</span>
        </button>
        <button
          onClick={() => onQuickAction && onQuickAction('Refactor', currentBlock.code)}
          className="text-[11px] px-2.5 py-1 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-md transition-colors flex items-center space-x-1.5 whitespace-nowrap shadow-xs"
        >
          <RefreshCw className="w-3 h-3 text-indigo-500" />
          <span>Refactor</span>
        </button>
        {isExecutable && (
          <button
            onClick={handleRunCode}
            disabled={isExecuting}
            className="text-[11px] px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded-md transition-colors flex items-center space-x-1.5 whitespace-nowrap shadow-xs disabled:opacity-50 ml-auto"
          >
            {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            <span>{isExecuting ? 'Running...' : 'Run Code'}</span>
          </button>
        )}
      </div>

      {/* Code Editor/Viewer Body */}
      <div className="bg-[#1e1e1e] relative">
        <div className="bg-[#252526] px-4 py-1.5 border-b border-slate-700/60 flex items-center justify-between text-slate-300 font-mono text-[11px]">
          <span className="flex items-center space-x-2 font-semibold uppercase text-indigo-300 tracking-wider">
            {getFileIcon(currentBlock.filename, currentBlock.language)}
            <span>{currentBlock.filename}</span>
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-[10.5px] transition-colors font-sans"
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

        <div className="overflow-x-auto selection:bg-indigo-500/40 font-mono text-[13px]">
          <SyntaxHighlighter
            language={langLower === 'html' ? 'xml' : langLower === 'jsx' ? 'javascript' : langLower || 'javascript'}
            style={vscDarkPlus}
            customStyle={{ margin: 0, padding: '16px', background: 'transparent', fontSize: '13px', lineHeight: '1.5' }}
            wrapLines={true}
          >
            {currentBlock.code}
          </SyntaxHighlighter>
        </div>

        {/* Terminal Execution Result */}
        {executionResult !== null && (
          <div className="border-t border-zinc-700/60 bg-[#0d1117] p-3 font-mono text-[11px] sm:text-xs">
            <div className="flex items-center space-x-1.5 mb-2 text-emerald-400 opacity-90">
              <Terminal className="w-3.5 h-3.5" />
              <span className="font-semibold uppercase tracking-wider text-[10px]">Terminal Output</span>
            </div>
            <div className="text-zinc-300 whitespace-pre-wrap pl-1 overflow-x-auto max-h-[300px] overflow-y-auto no-scrollbar">
              {executionResult.output}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Combined Live Run Preview */}
      {showPreview && (
        <div ref={previewRef} className="border-t border-slate-200 bg-white">
          <div className="flex items-center justify-between px-3.5 py-2 bg-slate-100 border-b border-slate-200 text-xs text-slate-700 font-mono">
            <span className="flex items-center space-x-2 font-semibold text-slate-800">
              <Play className="w-3.5 h-3.5 text-emerald-600" />
              <span>Combined Interactive Preview ({blocks.length} File{blocks.length > 1 ? 's' : ''} Connected)</span>
            </span>
          </div>
          <iframe
            srcDoc={getCombinedSrcDoc()}
            title="Combined Live Code Preview"
            className="w-full h-80 sm:h-96 border-none bg-white"
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

