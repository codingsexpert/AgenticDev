import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Code2, Eye, Play, Save, Sparkles, Bug, RefreshCw, MessageCircle, Terminal, Loader2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function CodeBlock({ language, code, activeSandboxId, onOpenCodeBlock, onQuickAction }) {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const previewRef = useRef(null);

  const langLower = (language || '').toLowerCase();
  const isPreviewable =
    ['html', 'htm', 'jsx', 'js', 'javascript', 'svg', 'xml', 'css'].includes(langLower) ||
    code.includes('<html') ||
    code.includes('<div') ||
    code.includes('<svg');
    
  const isExecutable = ['python', 'py', 'python3', 'javascript', 'js', 'node'].includes(langLower);

  const handleRunCode = async () => {
    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const res = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: langLower })
      });
      const data = await res.json();
      setExecutionResult(data);
    } catch (e) {
      setExecutionResult({ output: "Failed to execute code: " + e.message, images: [] });
    }
    setIsExecuting(false);
    setIsExpanded(true); // Auto expand to show terminal
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const firstLine = code.split('\n')[0].trim();
  let filename = '';
  if (firstLine.startsWith('//') || firstLine.startsWith('<!--') || firstLine.startsWith('/*') || firstLine.startsWith('#')) {
    filename = firstLine.replace(/[\/\*<\!#>\-]/g, '').replace(/^file:\s*/i, '').trim();
  }

  const handleApply = async () => {
    if (!activeSandboxId || !filename) return;
    try {
      await fetch(`/api/sandboxes/${activeSandboxId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: code, path: filename })
      });
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    } catch (e) {
      console.error('Failed to apply code', e);
    }
  };

  const handleTogglePreview = () => {
    const nextState = !showPreview;
    setShowPreview(nextState);
    if (nextState) {
      setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    }
  };

  const getSrcDoc = () => {
    if (code.includes('<html') || code.includes('<!DOCTYPE')) {
      return code;
    }
    if (langLower === 'svg' || code.trim().startsWith('<svg')) {
      return `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#fff;">${code}</body></html>`;
    }
    if (langLower === 'css') {
      return `<!DOCTYPE html><html><head><style>${code}</style></head><body><div className="demo"><h1>CSS Preview</h1><p>Sample styled component preview paragraph.</p><button>Sample Button</button></div></body></html>`;
    }
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { font-family: system-ui, sans-serif; padding: 16px; background: #ffffff; color: #0f172a; }</style>
</head>
<body>
  <div id="root">${code.includes('<') ? code : ''}</div>
  <script>
    try {
      ${!code.includes('<') ? code : ''}
    } catch(e) {
      document.body.innerHTML += '<div style="color:red;padding:8px;margin-top:8px;background:#fee2e2;border-radius:6px;font-family:monospace;font-size:12px;">Runtime Error: ' + e.message + '</div>';
    }
  </script>
</body>
</html>`;
  };

  // Removed manual regex highlight

  return (
    <div className="my-3 flex flex-col bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden transition-all">
      {/* Collapsed Card Header */}
      <div className="flex items-center justify-between p-3 bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Code2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800 tracking-tight">
              {language || 'Code'} Generated
            </div>
            <div className="text-[11.5px] text-slate-500 mt-0.5">
              Code has been saved to sandbox. {filename ? `(${filename})` : ''}
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          {activeSandboxId && filename && (
            <button
              onClick={handleApply}
              className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center space-x-1"
              title="Save directly to sandbox"
            >
              {applied ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{applied ? 'Saved' : 'Save'}</span>
            </button>
          )}
          {isPreviewable && (
            <button
              onClick={() => {
                setShowPreview(!showPreview);
                if (!showPreview) setIsExpanded(false);
              }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center space-x-1 ${showPreview ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200/50'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showPreview ? 'Hide Preview' : 'Live Preview'}</span>
            </button>
          )}
          <button
            onClick={() => {
              if (onOpenCodeBlock) {
                onOpenCodeBlock({ code, language, filename });
              } else {
                setIsExpanded(!isExpanded);
                if (!isExpanded) setShowPreview(false);
              }
            }}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors border border-slate-200 flex items-center space-x-1 hidden sm:flex"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Open Editor</span>
          </button>
        </div>
      </div>
      
      {/* Quick Actions Toolbar */}
      <div className="flex items-center space-x-2 px-3 py-2 border-t border-slate-100 bg-slate-50/50 overflow-x-auto no-scrollbar">
        <button
          onClick={() => onQuickAction && onQuickAction('Explain', code)}
          className="text-[11px] px-2.5 py-1.5 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-200 rounded-md transition-colors flex items-center space-x-1.5 whitespace-nowrap shadow-sm"
          title="Explain this code"
        >
          <MessageCircle className="w-3 h-3 text-amber-500" />
          <span>Explain</span>
        </button>
        <button
          onClick={() => onQuickAction && onQuickAction('Debug', code)}
          className="text-[11px] px-2.5 py-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-md transition-colors flex items-center space-x-1.5 whitespace-nowrap shadow-sm"
          title="Debug this code"
        >
          <Bug className="w-3 h-3 text-rose-500" />
          <span>Debug</span>
        </button>
        <button
          onClick={() => onQuickAction && onQuickAction('Refactor', code)}
          className="text-[11px] px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-md transition-colors flex items-center space-x-1.5 whitespace-nowrap shadow-sm"
          title="Refactor this code"
        >
          <RefreshCw className="w-3 h-3 text-indigo-500" />
          <span>Refactor</span>
        </button>
        {isExecutable && (
          <button
            onClick={handleRunCode}
            disabled={isExecuting}
            className="text-[11px] px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-md transition-colors flex items-center space-x-1.5 whitespace-nowrap shadow-sm disabled:opacity-50"
            title="Run this code securely on the backend"
          >
            {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            <span>{isExecuting ? 'Running...' : 'Run Code'}</span>
          </button>
        )}
      </div>

      {/* Code Body Container */}
      {isExpanded && (
        <div className="border-t border-slate-200 bg-[#21252b]">
          <div className="bg-[#282c34] border-b border-slate-700/60 px-4 py-2 flex items-center justify-between text-slate-300 font-mono text-[11px]">
            <span className="flex items-center space-x-1.5 font-semibold uppercase text-indigo-300 tracking-wider">
              <Code2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{language || 'code'}</span>
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-[10px] transition-colors font-sans"
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
          <div className="overflow-x-auto selection:bg-indigo-500/40 font-mono text-[13px] bg-[#1e1e1e]">
            <SyntaxHighlighter 
              language={langLower === 'html' ? 'xml' : langLower === 'jsx' ? 'javascript' : langLower || 'javascript'} 
              style={vscDarkPlus}
              customStyle={{ margin: 0, padding: '16px', background: 'transparent', fontSize: '13px', lineHeight: '1.5' }}
              wrapLines={true}
            >
              {code}
              </SyntaxHighlighter>
            </div>
            {/* Live Terminal Output Window */}
            {executionResult !== null && (
              <div className="border-t border-zinc-700/60 bg-[#0d1117] p-3 animate-fade-in font-mono text-[11px] sm:text-xs">
                <div className="flex items-center space-x-1.5 mb-2 text-emerald-400 opacity-90">
                  <Terminal className="w-3.5 h-3.5" />
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Terminal Output</span>
                </div>
                <div className="text-zinc-300 whitespace-pre-wrap pl-1 overflow-x-auto max-h-[300px] overflow-y-auto no-scrollbar">
                  {executionResult.output}
                </div>
                
                {/* Generated Charts/Images Render */}
                {executionResult.images && executionResult.images.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-2 flex items-center space-x-1.5">
                      <ImageIcon className="w-3.5 h-3.5"/> 
                      <span>Generated Charts</span>
                    </div>
                    {executionResult.images.map((imgSrc, idx) => (
                      <div key={idx} className="bg-white p-2 rounded-lg inline-block shadow-lg">
                        <img src={imgSrc} alt={`Generated Chart ${idx}`} className="max-w-full h-auto rounded" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
        </div>
      )}

      {/* Interactive Live Run Preview Container */}
      {showPreview && (
        <div ref={previewRef} className="border-t border-slate-200 bg-white">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-xs text-slate-600 font-mono">
            <span className="flex items-center space-x-1.5 font-semibold text-slate-800">
              <Play className="w-3.5 h-3.5 text-emerald-600" />
              <span>Live Run Preview</span>
            </span>
          </div>
          <iframe
            srcDoc={getSrcDoc()}
            title="Live Code Run Preview"
            className="w-full h-80 sm:h-96 border-none bg-white"
            sandbox="allow-scripts allow-modals"
          />
        </div>
      )}
    </div>
  );
}

export default function FormattedMessage({ content = '', isUser = false, activeSandboxId, onOpenCodeBlock, onQuickAction }) {
  if (!content) return null;

  let sanitizedContent = content;
  
  // If there's an unclosed code block at the end, close it so our block extractor can find it
  if ((sanitizedContent.match(/```/g) || []).length % 2 !== 0) {
    sanitizedContent += '\n```';
  }

  // Pre-parse <thinking> blocks to render them natively
  const parts = sanitizedContent.split(/(<thinking>[\s\S]*?<\/thinking>|<thinking>[\s\S]*$)/g);

  return (
    <div className={`space-y-2 text-base sm:text-[16.5px] leading-relaxed font-sans ${isUser ? 'text-zinc-900 font-normal' : 'text-zinc-800 font-normal'} markdown-body break-words [overflow-wrap:anywhere] overflow-hidden max-w-full`}>
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

        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeContent = String(children).replace(/\n$/, '');
                if (!inline && match) {
                  return (
                    <CodeBlock 
                      language={match[1]} 
                      code={codeContent} 
                      activeSandboxId={activeSandboxId} 
                      onOpenCodeBlock={() => {
                        if (!onOpenCodeBlock) return;
                        
                        const allBlocks = [];
                        const allParts = sanitizedContent.split(/(```[\s\S]*?```)/g);
                        allParts.forEach(p => {
                            if (p.startsWith('```') && p.endsWith('```')) {
                                const m = p.match(/^```([a-zA-Z0-9_+\-#]*)[ \t]*\r?\n?([\s\S]*?)```$/);
                                if (m) {
                                    const l = m[1].toLowerCase();
                                    const c = m[2].trim();
                                    let f = '';
                                    const fl = c.split('\n')[0].trim();
                                    if (fl.startsWith('//') || fl.startsWith('<!--') || fl.startsWith('/*')) {
                                        f = fl.replace(/[\/\*<\!#>\-]/g, '').replace(/^file:\s*/i, '').trim();
                                    }
                                    allBlocks.push({ language: l, code: c, filename: f });
                                }
                            }
                        });
                        
                        if (allBlocks.length === 0) {
                          allBlocks.push({ language: match[1], code: codeContent, filename: '' });
                        }
                        onOpenCodeBlock(allBlocks);
                      }} 
                      onQuickAction={onQuickAction}
                    />
                  );
                }
                return (
                  <code className={`${className} bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded text-[13px] font-mono`} {...props}>
                    {children}
                  </code>
                );
              },
              p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
              a: ({ node, ...props }) => <a className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-2" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-2" {...props} />,
              li: ({ node, ...props }) => <li className="mb-1" {...props} />
            }}
          >
            {part}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
