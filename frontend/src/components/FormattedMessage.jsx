import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Code2, Eye, Play, Save, Sparkles, Bug, RefreshCw, MessageCircle, Terminal, Loader2, Folder, FileCode, FileJson, FileText, File, ExternalLink, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getCleanFilename } from '../utils/fileUtils';
import { useToast } from './Toast';

const getFileIcon = (filename = '', language = '') => {
  const name = getCleanFilename(filename, language).toLowerCase();
  const lang = (language || '').toLowerCase();
  if (name.endsWith('.html') || lang === 'html') return <FileCode className="w-3.5 h-3.5 text-orange-400" />;
  if (name.endsWith('.css') || lang === 'css') return <FileCode className="w-3.5 h-3.5 text-sky-400" />;
  if (name.endsWith('.js') || name.endsWith('.jsx') || lang === 'javascript' || lang === 'js' || lang === 'jsx') return <FileJson className="w-3.5 h-3.5 text-amber-400" />;
  if (name.endsWith('.ts') || name.endsWith('.tsx') || lang === 'typescript' || lang === 'ts') return <FileCode className="w-3.5 h-3.5 text-blue-400" />;
  if (name.endsWith('.py') || lang === 'python' || lang === 'py') return <FileText className="w-3.5 h-3.5 text-emerald-400" />;
  if (name.endsWith('.cpp') || name.endsWith('.c') || name.endsWith('.h') || lang === 'cpp' || lang === 'c++' || lang === 'c') return <FileCode className="w-3.5 h-3.5 text-cyan-400" />;
  if (name.endsWith('.bash') || name.endsWith('.sh') || lang === 'bash' || lang === 'sh') return <Terminal className="w-3.5 h-3.5 text-purple-400" />;
  if (name.endsWith('.json') || lang === 'json') return <FileJson className="w-3.5 h-3.5 text-pink-400" />;
  if (name.endsWith('.java') || lang === 'java') return <FileCode className="w-3.5 h-3.5 text-red-400" />;
  return <File className="w-3.5 h-3.5 text-slate-400" />;
};

function UnifiedProjectCard({ blocks, activeSandboxId, onOpenCodeBlock, onQuickAction, isStreaming = false }) {
  const { addToast } = useToast();
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showCode, setShowCode] = useState(isStreaming);
  const [userToggledCode, setUserToggledCode] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const previewRef = useRef(null);

  useEffect(() => {
    if (!userToggledCode) {
      setShowCode(isStreaming);
    }
  }, [isStreaming, userToggledCode]);

  if (!blocks || blocks.length === 0) return null;

  // Filter out .bash and .sh helper blocks from the tab bar unless they are the only code blocks
  const displayBlocks = blocks.filter(b => {
    const f = (b.filename || '').toLowerCase();
    const l = (b.language || '').toLowerCase();
    return !f.endsWith('.bash') && !f.endsWith('.sh') && l !== 'bash' && l !== 'sh';
  });
  const validBlocks = displayBlocks.length > 0 ? displayBlocks : blocks;

  const currentBlock = validBlocks[activeTabIndex] || validBlocks[0] || blocks[0];
  const langLower = (currentBlock.language || '').toLowerCase();
  const cleanCurrentFilename = getCleanFilename(currentBlock.filename, currentBlock.language);

  const hasWebBlocks = validBlocks.some(b => {
    const l = (b.language || '').toLowerCase();
    const f = (b.filename || '').toLowerCase();
    return l === 'html' || l === 'css' || l === 'javascript' || l === 'js' || f.endsWith('.html') || f.endsWith('.css') || f.endsWith('.js');
  });

  const isExecutable = true;

  const handleRunCode = async () => {
    setIsExecuting(true);
    setExecutionResult(null);
    setShowCode(true);
    setUserToggledCode(true);
    try {
      const res = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentBlock.code, language: langLower })
      });
      const data = await res.json();
      setExecutionResult(data);
      addToast('Code executed successfully', 'success');
    } catch (e) {
      setExecutionResult({ output: "Failed to execute code: " + e.message, images: [] });
      addToast('Execution error: ' + e.message, 'error');
    }
    setIsExecuting(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentBlock.code);
    setCopied(true);
    addToast('Code copied to clipboard', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyAll = async () => {
    if (!activeSandboxId) {
      addToast('No active sandbox workspace selected', 'warning');
      return;
    }
    try {
      await Promise.all(validBlocks.map(b =>
        fetch(`/api/sandboxes/${activeSandboxId}/file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: b.code, path: getCleanFilename(b.filename, b.language) })
        })
      ));
      setApplied(true);
      addToast('All code files synced to Sandbox workspace!', 'success');
      setTimeout(() => setApplied(false), 2000);
    } catch (e) {
      console.error('Failed to apply code files', e);
      addToast('Failed to sync code to sandbox', 'error');
    }
  };

  const getCombinedSrcDoc = () => {
    let htmlBlock = validBlocks.find(b => b.language === 'html' || b.filename.endsWith('.html'));
    let cssBlock = validBlocks.find(b => b.language === 'css' || b.filename.endsWith('.css'));
    let jsBlock = validBlocks.find(b => b.language === 'javascript' || b.language === 'js' || b.filename.endsWith('.js'));

    let html = htmlBlock ? htmlBlock.code : (validBlocks.length === 1 && hasWebBlocks ? validBlocks[0].code : '<div id="root"></div>');
    let css = cssBlock ? cssBlock.code : '';
    let js = jsBlock ? jsBlock.code : '';

    const tailwindCdn = `<script src="https://cdn.tailwindcss.com"></script>`;
    const baseHref = activeSandboxId ? `<base href="/api/sandboxes/${activeSandboxId}/preview/">` : '';

    let combinedHtml = html;

    // Inject base tag & Tailwind CDN if missing
    if (!combinedHtml.includes('cdn.tailwindcss.com')) {
      if (combinedHtml.includes('<head>')) {
        combinedHtml = combinedHtml.replace('<head>', `<head>${baseHref}\n${tailwindCdn}`);
      } else if (combinedHtml.includes('<html')) {
        combinedHtml = combinedHtml.replace(/<html[^>]*>/, `$&<head>${baseHref}\n${tailwindCdn}</head>`);
      } else {
        combinedHtml = `<head>${baseHref}\n${tailwindCdn}</head>\n` + combinedHtml;
      }
    } else if (baseHref && !combinedHtml.includes('<base')) {
      if (combinedHtml.includes('<head>')) {
        combinedHtml = combinedHtml.replace('<head>', `<head>${baseHref}`);
      }
    }

    // Embed CSS directly so relative <link rel="stylesheet"> references don't fail inside srcDoc
    if (css) {
      if (combinedHtml.includes('</head>')) {
        combinedHtml = combinedHtml.replace('</head>', `<style>\n${css}\n</style></head>`);
      } else {
        combinedHtml = `<style>\n${css}\n</style>\n` + combinedHtml;
      }
    }

    // Embed JS directly into script tag if external link or at end of body
    if (js) {
      if (combinedHtml.includes('<script src="script.js"></script>')) {
        combinedHtml = combinedHtml.replace('<script src="script.js"></script>', `<script>\ntry {\n${js}\n} catch(e) { console.error(e); }\n</script>`);
      } else if (combinedHtml.includes('</body>')) {
        combinedHtml = combinedHtml.replace('</body>', `<script>\ntry {\n${js}\n} catch(e) { console.error(e); }\n</script></body>`);
      } else {
        combinedHtml = combinedHtml + `\n<script>\ntry {\n${js}\n} catch(e) { console.error(e); }\n</script>`;
      }
    }

    if (!combinedHtml.includes('<html') && !combinedHtml.includes('<!DOCTYPE')) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseHref}
  ${tailwindCdn}
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; background: #0f172a; color: #f8fafc; }
    ${css}
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4">
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
  };

  const projectTitle = validBlocks.length > 1
    ? `Workspace Project (${validBlocks.length} Files)`
    : cleanCurrentFilename;

  return (
    <div className="my-4 flex flex-col bg-[#0d0f17] border border-slate-800/80 shadow-xl rounded-2xl overflow-hidden transition-all duration-200">
      {/* Top Card Header (Claude Artifact Style Card) */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-[#131625] border-b border-slate-800/80 gap-3">
        <div className="flex items-center space-x-3">
          {/* Mac Window Controls */}
          <div className="flex items-center space-x-1.5 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>

          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center shrink-0 shadow-inner">
            <Folder className="w-4 h-4 text-indigo-300" />
          </div>

          <div>
            <div className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center space-x-2">
              <span>{projectTitle}</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono border border-indigo-500/30">
                {validBlocks.length} File{validBlocks.length > 1 ? 's' : ''}
              </span>
            </div>
            {/* File pills summary row */}
            <div className="flex items-center space-x-1.5 mt-1 overflow-x-auto no-scrollbar">
              {validBlocks.map((b, i) => (
                <span key={i} className="inline-flex items-center space-x-1 text-[11px] font-mono bg-slate-900/90 text-slate-300 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                  {getFileIcon(getCleanFilename(b.filename, b.language), b.language)}
                  <span>{getCleanFilename(b.filename, b.language)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {hasWebBlocks && (
            <button
              onClick={() => {
                setShowPreview(!showPreview);
                if (!showPreview) setShowCode(false);
              }}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all duration-150 shrink-0 flex items-center space-x-1.5 cursor-pointer border active:scale-95 ${
                showPreview
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                  : 'bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-200 border-indigo-500/40 shadow-sm'
              }`}
              title="Show interactive live web preview"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showPreview ? 'Hide Preview' : 'Show Preview'}</span>
            </button>
          )}

          <button
            onClick={() => onOpenCodeBlock && onOpenCodeBlock(validBlocks)}
            className="text-xs px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-semibold transition-all duration-150 shrink-0 border border-indigo-400/40 flex items-center space-x-1.5 shadow-md cursor-pointer active:scale-95"
            title="Open full interactive Workspace IDE"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-200" />
            <span>Open Workspace IDE</span>
          </button>

          <button
            onClick={() => setShowCode(!showCode)}
            className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all duration-150 shrink-0 flex items-center space-x-1.5 cursor-pointer border active:scale-95 ${
              showCode
                ? 'bg-slate-800 text-white border-slate-600'
                : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
            title="Toggle raw code drawer in chat"
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>{showCode ? 'Hide Code' : 'Show Code'}</span>
            {showCode ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
          </button>

          {isExecutable && (
            <button
              onClick={handleRunCode}
              disabled={isExecuting}
              className="text-xs px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all duration-150 shadow-md flex items-center space-x-1.5 shrink-0 border border-emerald-400/40 cursor-pointer active:scale-95"
              title="Execute code natively"
            >
              {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
              <span>{isExecuting ? 'Running...' : 'Run Code'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Live Web Sandbox Preview (If showPreview is ON) */}
      {showPreview && (
        <div ref={previewRef} className="border-t border-slate-800/80 bg-slate-900">
          <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border-b border-slate-800 text-xs text-slate-200 font-mono">
            <span className="flex items-center space-x-2 font-bold text-white">
              <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
              <span>Live Web Preview ({validBlocks.length} File{validBlocks.length > 1 ? 's' : ''})</span>
            </span>
            {activeSandboxId && (
              <a
                href={`/api/sandboxes/${activeSandboxId}/preview/index.html`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white flex items-center space-x-1 font-semibold text-indigo-300 bg-indigo-900/60 hover:bg-indigo-800 px-2.5 py-1 rounded-md border border-indigo-500/40 text-[11px] transition-colors"
                title="Open Web App in New Tab"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open in New Tab</span>
              </a>
            )}
          </div>
          <iframe
            srcDoc={getCombinedSrcDoc()}
            title="Live Code Preview"
            className="w-full h-80 sm:h-96 border-none bg-white shadow-2xl"
            sandbox="allow-scripts allow-modals"
          />
        </div>
      )}

      {/* Code Drawer Container (Only visible when showCode is TRUE) */}
      {showCode && (
        <div className="border-t border-slate-800/80 bg-[#07080c]">
          {/* Multi-File Tab Bar */}
          <div className="flex items-center space-x-1 px-3 pt-2 bg-[#0c0d12] border-b border-slate-800/80 overflow-x-auto no-scrollbar">
            {validBlocks.map((block, idx) => {
              const isActive = idx === activeTabIndex;
              const cleanName = getCleanFilename(block.filename, block.language);
              return (
                <button
                  key={idx}
                  onClick={() => setActiveTabIndex(idx)}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-t-xl text-xs font-mono transition-all duration-200 shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#181b28] text-white font-semibold border-t border-x border-slate-700/80 shadow-md'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  {getFileIcon(cleanName, block.language)}
                  <span>{cleanName}</span>
                </button>
              );
            })}
          </div>

          <div className="bg-[#13151f] px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-slate-300 font-mono text-[11px]">
            <span className="flex items-center space-x-2 font-bold text-indigo-300 tracking-wider">
              {getFileIcon(cleanCurrentFilename, currentBlock.language)}
              <span>{cleanCurrentFilename}</span>
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 hover:border-indigo-500/50 text-slate-200 text-[11px] transition-all cursor-pointer font-sans active:scale-95 shadow-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto selection:bg-indigo-500/40 font-mono text-[13px] p-2 max-h-[450px]">
            <SyntaxHighlighter
              language={langLower === 'html' ? 'xml' : langLower === 'jsx' ? 'javascript' : langLower || 'javascript'}
              style={vscDarkPlus}
              customStyle={{ margin: 0, padding: '18px', background: 'transparent', fontSize: '13px', lineHeight: '1.6' }}
              wrapLines={true}
            >
              {currentBlock.code}
            </SyntaxHighlighter>
          </div>

          {/* Integrated Terminal Console */}
          {executionResult !== null && (
            <div className="border-t border-slate-800/80 bg-[#050609] p-4 font-mono text-[11.5px] sm:text-xs">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800/60">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-200">Terminal Output</span>
                </div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {executionResult.exit_code === 0 ? 'EXIT CODE: 0 (SUCCESS)' : executionResult.exit_code ? `EXIT CODE: ${executionResult.exit_code}` : 'EXECUTED'}
                </span>
              </div>
              <div className="text-slate-200 whitespace-pre-wrap font-mono p-4 bg-[#0c0e17] rounded-xl border border-slate-800/80 max-h-[320px] overflow-y-auto leading-relaxed shadow-inner">
                {executionResult.output || 'No output produced.'}
              </div>
            </div>
          )}
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

export default function FormattedMessage({ content = '', isUser = false, activeSandboxId, onOpenCodeBlock, onQuickAction, isStreaming = false }) {
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
        filename = getCleanFilename(firstLine, lang);
      }
      filename = getCleanFilename(filename, lang);
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
          // Completely strip out all code block definitions from the markdown text
          // so ReactMarkdown only renders prose text before or after the artifact card.
          let hasPlacedMarker = false;
          const textWithMarker = part.replace(/```([a-zA-Z0-9_+\-#]*)[ \t]*\r?\n?([\s\S]*?)(?:```|$)/g, () => {
            if (!hasPlacedMarker) {
              hasPlacedMarker = true;
              return '___PROJECT_ARTIFACT_MARKER___';
            }
            return '';
          });

          // Clean up leftover language labels or stray whitespace between stripped blocks
          const subParts = textWithMarker.split('___PROJECT_ARTIFACT_MARKER___').map(s => {
            return s.replace(/^\s*(?:html|css|javascript|js|jsx|tsx|python|py|cpp|c|java|json|bash|sh)\b/gi, '').trim();
          });

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
                isStreaming={isStreaming}
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

