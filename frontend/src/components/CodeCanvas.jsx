import React, { useState } from 'react';
import { X, Code, Eye, Copy, Check } from 'lucide-react';
import Editor from '@monaco-editor/react';

export default function CodeCanvas({ code, language, filename, onClose }) {
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'preview'
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPreviewable =
    ['html', 'htm', 'jsx', 'js', 'javascript', 'svg', 'xml', 'css'].includes((language || '').toLowerCase()) ||
    code.includes('<html') ||
    code.includes('<div') ||
    code.includes('<svg');

  const getSrcDoc = () => {
    const langLower = (language || '').toLowerCase();
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

  return (
    <div className="flex-1 h-full bg-white flex flex-col z-30 transition-all duration-300 min-w-0 border-r border-slate-200 shadow-[10px_0_15px_-3px_rgba(0,0,0,0.05)]">
      {/* Header */}
      <div className="h-14 border-b border-slate-200/90 flex items-center justify-between px-4 bg-slate-50/50 backdrop-blur-md shrink-0">
        <div className="flex items-center space-x-1 bg-slate-200/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
              activeTab === 'code' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Code</span>
          </button>
          
          {isPreviewable && (
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'preview' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Preview</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {filename && (
            <span className="text-xs font-mono text-slate-500 mr-2 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">{filename}</span>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
            title="Copy Code"
          >
            {copied ? <Check className="w-4 h-4 text-slate-900" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'code' ? (
          <div className="flex-1 relative bg-[#1e1e1e]">
            <Editor
              height="100%"
              language={language === 'html' ? 'html' : language === 'css' ? 'css' : 'javascript'}
              theme="vs-dark"
              value={code}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                wordWrap: 'on',
                padding: { top: 16 }
              }}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-slate-100 relative">
            <iframe
              srcDoc={getSrcDoc()}
              title="Code Preview"
              className="w-full flex-1 border-none bg-white shadow-inner"
              sandbox="allow-scripts allow-modals"
            />
          </div>
        )}
      </div>
    </div>
  );
}
