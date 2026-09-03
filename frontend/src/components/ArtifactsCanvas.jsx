import React, { useState, useEffect, useRef } from 'react';
import { X, Code, Eye, Copy, Check, FileText, Folder, RefreshCw, ExternalLink, Save, Rocket, LayoutList, ChevronRight, ChevronDown, FileJson, FileCode, FileType, File, FolderOpen, FilePlus, FolderPlus } from 'lucide-react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const getFileIcon = (name) => {
  if (name.endsWith('.js') || name.endsWith('.jsx')) return <FileJson className="w-3.5 h-3.5 text-[#cbcb41]" />;
  if (name.endsWith('.html')) return <FileCode className="w-3.5 h-3.5 text-[#e34c26]" />;
  if (name.endsWith('.css')) return <FileCode className="w-3.5 h-3.5 text-[#563d7c]" />;
  if (name.endsWith('.json')) return <FileJson className="w-3.5 h-3.5 text-[#859900]" />;
  if (name.endsWith('.py')) return <FileType className="w-3.5 h-3.5 text-[#3572A5]" />;
  if (name.endsWith('.md')) return <FileText className="w-3.5 h-3.5 text-[#083fa1]" />;
  return <File className="w-3.5 h-3.5 text-slate-400" />;
};

const FileTreeNode = ({ node, level, selectedFile, onSelect, onRename, hasUnsavedChanges }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const isFile = node.type === 'file';
  const isSelected = selectedFile === node.path;
  
  return (
    <div className="select-none">
      <div 
        className={`flex items-center px-1 py-1 cursor-pointer transition-colors group ${isSelected ? 'bg-[#37373d] text-white' : 'hover:bg-[#2a2d2e] text-[#cccccc]'}`}
        style={{ paddingLeft: `${level * 12 + 4}px` }}
        onClick={() => {
          if (isFile) {
            onSelect(node.path);
          } else {
            setIsOpen(!isOpen);
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {!isFile ? (
          <div className="flex items-center justify-center w-4 h-4 shrink-0 mr-0.5">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
        ) : (
          <div className="w-4 h-4 shrink-0 mr-0.5" />
        )}
        
        <div className="flex items-center justify-center w-4 h-4 shrink-0 mr-1.5">
          {!isFile ? (
            isOpen ? <FolderOpen className="w-3.5 h-3.5 text-[#dcb67a]" fill="currentColor" /> : <Folder className="w-3.5 h-3.5 text-[#dcb67a]" fill="currentColor" />
          ) : (
            getFileIcon(node.name)
          )}
        </div>
        
        <span className="text-[13px] truncate font-sans tracking-wide flex-1">{node.name}</span>
        
        {isFile && isHovered && (
          <button 
            className="ml-auto mr-1 p-0.5 hover:bg-slate-600 rounded text-slate-300 transition-colors shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onRename(node.path);
            }}
            title="Rename file"
          >
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </button>
        )}
        
        {isFile && isSelected && hasUnsavedChanges && !isHovered && (
          <span className="ml-auto w-2 h-2 rounded-full bg-[#1e88e5] shrink-0 mr-2"></span>
        )}
      </div>
      
      {!isFile && isOpen && (
        <div>
          {Object.keys(node.children).sort((a,b) => {
             const isAFolder = node.children[a].type === 'folder';
             const isBFolder = node.children[b].type === 'folder';
             if (isAFolder && !isBFolder) return -1;
             if (!isAFolder && isBFolder) return 1;
             return a.localeCompare(b);
          }).map(key => (
            <FileTreeNode 
              key={key} 
              node={node.children[key]} 
              level={level + 1} 
              selectedFile={selectedFile} 
              onSelect={onSelect} 
              onRename={onRename}
              hasUnsavedChanges={hasUnsavedChanges}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function ArtifactsCanvas({ sandboxId, onClose, initialTab = 'code' }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'code' | 'preview'
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('index.html');
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState(null);
  
  const editorRef = useRef(null);

  useEffect(() => {
    if (sandboxId) {
      fetchFiles();
    }
  }, [sandboxId]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sandboxes/${sandboxId}/files`);
      const data = await res.json();
      const rawFiles = Array.isArray(data?.files) ? data.files : [];
      const safeFileList = rawFiles.map(f => typeof f === 'string' ? { path: f } : f);
      setFiles(safeFileList);

      if (safeFileList.length > 0) {
        const htmlFile = safeFileList.find((f) => f?.path?.endsWith('.html'));
        const targetPath = htmlFile ? htmlFile.path : safeFileList[0].path;
        if (safeFileList.find(f => f.path === selectedFile)) {
            fetchFileContent(selectedFile);
        } else {
            setSelectedFile(targetPath);
            fetchFileContent(targetPath);
        }
      }
    } catch (e) {
      console.error('Failed to fetch sandbox files', e);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFileContent = async (filePath) => {
    try {
      const res = await fetch(`/api/sandboxes/${sandboxId}/file?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      setFileContent(data?.content || '');
      setOriginalContent(data?.content || '');
    } catch (e) {
      setFileContent('// Failed to load file content');
      setOriginalContent('// Failed to load file content');
    }
  };

  const handleRenameFile = async (oldPath) => {
    const newName = window.prompt(`Rename ${oldPath} to:`, oldPath);
    if (!newName || newName.trim() === '' || newName === oldPath) return;
    
    try {
      const res = await fetch(`/api/sandboxes/${sandboxId}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_path: oldPath, new_path: newName.trim() })
      });
      if (!res.ok) throw new Error('Rename failed');
      
      if (selectedFile === oldPath) {
        setSelectedFile(newName.trim());
      }
      fetchFiles();
    } catch (e) {
      console.error('Failed to rename file', e);
      alert('Failed to rename file');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleSave = async () => {
    if (!sandboxId || !selectedFile) return;
    setSaving(true);
    try {
        const res = await fetch(`/api/sandboxes/${sandboxId}/file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: selectedFile,
                content: fileContent
            })
        });
        if (!res.ok) throw new Error("Failed to save");
        setOriginalContent(fileContent);
    } catch (err) {
        console.error("Save error:", err);
        alert("Failed to save file.");
    } finally {
        setSaving(false);
    }
  };

  const handleCreateNewFile = async () => {
    const filename = window.prompt("Enter new file path (e.g., src/components/Button.jsx):");
    if (!filename || filename.trim() === '') return;
    
    try {
      await fetch(`/api/sandboxes/${sandboxId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filename.trim(), content: '' })
      });
      fetchFiles();
      setSelectedFile(filename.trim());
    } catch (e) {
      console.error('Failed to create file', e);
    }
  };

  const handleCreateNewFolder = async () => {
    const foldername = window.prompt("Enter new folder path (e.g., src/components):");
    if (!foldername || foldername.trim() === '') return;
    
    try {
      const keepPath = foldername.trim().endsWith('/') 
        ? `${foldername.trim()}.gitkeep` 
        : `${foldername.trim()}/.gitkeep`;
        
      await fetch(`/api/sandboxes/${sandboxId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: keepPath, content: '' })
      });
      fetchFiles();
    } catch (e) {
      console.error('Failed to create folder', e);
    }
  };

  const handleDeploy = async () => {
    if (!sandboxId) return;
    setIsDeploying(true);
    setDeployedUrl(null);
    try {
      const res = await fetch(`/api/sandboxes/${sandboxId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Deploy failed');
      setDeployedUrl(data.url);
      alert(`Deployment successful! URL: ${data.url}`);
    } catch (err) {
      console.error("Deploy error:", err);
      alert(`Deployment failed: ${err.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  // Keyboard shortcut for saving (Ctrl+S or Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeTab === 'code' && fileContent !== originalContent) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fileContent, originalContent, activeTab, sandboxId, selectedFile]);

  const safeSelectedFile = selectedFile || 'index.html';
  const previewUrl = `/api/sandboxes/${sandboxId}/preview/${safeSelectedFile.endsWith('.html') ? safeSelectedFile : 'index.html'}`;

  const getLanguage = (path) => {
      if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
      if (path.endsWith('.html')) return 'html';
      if (path.endsWith('.css')) return 'css';
      if (path.endsWith('.json')) return 'json';
      if (path.endsWith('.py')) return 'python';
      if (path.endsWith('.md')) return 'markdown';
      return 'plaintext';
  };
  const hasUnsavedChanges = fileContent !== originalContent;

  const fileTree = React.useMemo(() => {
    const root = {};
    files.forEach(file => {
      if (!file?.path) return;
      const parts = file.path.split('/');
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          current[part] = { name: part, type: 'file', path: file.path };
        } else {
          if (!current[part]) {
            current[part] = { name: part, type: 'folder', children: {} };
          }
          current = current[part].children;
        }
      }
    });
    return root;
  }, [files]);

  return (
    <div className="flex-1 h-full bg-white flex flex-col z-30 transition-all duration-300 min-w-0">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center space-x-2">
          <div className="flex bg-white p-0.5 rounded-lg border border-slate-200 text-xs shadow-2xs overflow-x-auto hide-scrollbar whitespace-nowrap">
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-colors ${activeTab === 'code' ? 'bg-slate-900 text-white font-medium shadow-2xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Code Editor</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-colors ${activeTab === 'preview' ? 'bg-slate-900 text-white font-medium shadow-2xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Web Preview</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200/50"
            title="Open Preview in New Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Preview</span>
          </a>
          {(activeTab === 'code' || activeTab === 'review') && (
             <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || saving}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  hasUnsavedChanges 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title="Save Changes (Cmd+S)"
             >
                 {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                 <span>Save</span>
             </button>
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
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas View */}
      {activeTab === 'code' || activeTab === 'review' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* File Tree Drawer */}
          <div className="w-56 bg-[#181818] border-r border-[#2b2b2b] p-0 overflow-y-auto flex flex-col shrink-0">
            <div className="text-[10px] text-[#cccccc] px-4 py-2 uppercase tracking-widest flex items-center justify-between font-medium shrink-0">
              <span>Explorer</span>
              <div className="flex items-center space-x-2">
                <button onClick={handleCreateNewFile} className="hover:text-white transition-colors" title="New File"><FilePlus className="w-3.5 h-3.5" /></button>
                <button onClick={handleCreateNewFolder} className="hover:text-white transition-colors" title="New Folder"><FolderPlus className="w-3.5 h-3.5" /></button>
                <button onClick={fetchFiles} className="hover:text-white transition-colors ml-1" title="Refresh Explorer"><RefreshCw className="w-3 h-3" /></button>
              </div>
            </div>
            
            <div className="flex-1 py-1">
               {Object.keys(fileTree).sort((a,b) => {
                 const isAFolder = fileTree[a].type === 'folder';
                 const isBFolder = fileTree[b].type === 'folder';
                 if (isAFolder && !isBFolder) return -1;
                 if (!isAFolder && isBFolder) return 1;
                 return a.localeCompare(b);
               }).map(key => (
                 <FileTreeNode 
                   key={key} 
                   node={fileTree[key]} 
                   level={0} 
                   selectedFile={selectedFile} 
                   onSelect={(path) => {
                      if (hasUnsavedChanges) {
                          const confirmLeave = window.confirm("You have unsaved changes. Discard them?");
                          if (!confirmLeave) return;
                      }
                      setSelectedFile(path);
                      fetchFileContent(path);
                   }}
                   onRename={handleRenameFile}
                   hasUnsavedChanges={hasUnsavedChanges}
                 />
               ))}
            </div>
          </div>

          {/* Editor / Reviewer Viewer */}
          {activeTab === 'code' ? (
          <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden">
            <div className="text-[10px] font-mono text-slate-400 px-4 py-2 border-b border-[#333] flex items-center justify-between">
              <span className="flex items-center space-x-2">
                 <span>{safeSelectedFile}</span>
                 {hasUnsavedChanges && <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse" title="Unsaved changes"></span>}
              </span>
              <span>{fileContent.length} bytes</span>
            </div>
            <div className="flex-1 w-full h-full relative">
              <Editor
                height="100%"
                width="100%"
                language={getLanguage(safeSelectedFile)}
                theme="vs-dark"
                value={fileContent}
                onChange={(val) => setFileContent(val || '')}
                options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    padding: { top: 16 }
                }}
              />
            </div>
          </div>
          ) : (
            <div className="flex-1 overflow-y-auto bg-white p-6 md:p-8">
               {safeSelectedFile.endsWith('.md') ? (
                 <div className="max-w-3xl mx-auto prose prose-slate prose-sm md:prose-base prose-pre:bg-slate-900 prose-pre:text-slate-50 prose-a:text-indigo-600">
                    <ReactMarkdown
                      components={{
                        code({node, inline, className, children, ...props}) {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <SyntaxHighlighter
                              {...props}
                              children={String(children).replace(/\n$/, '')}
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                            />
                          ) : (
                            <code {...props} className={className}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {fileContent}
                    </ReactMarkdown>
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                    <FileText className="w-12 h-12 opacity-20" />
                    <p className="text-sm text-center">Select a Markdown (.md) file to view Code Review.<br/>(e.g., plan.md, review.md)</p>
                 </div>
               )}
            </div>
          )}
        </div>
      ) : (
        /* Live Web Preview Iframe */
        <div className="flex-1 flex flex-col bg-slate-100">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono truncate text-[11px] flex items-center space-x-2">
                <span>{previewUrl}</span>
                <button onClick={() => document.getElementById('preview-iframe')?.contentWindow?.location?.reload()} className="hover:text-slate-800 p-1 rounded-full hover:bg-slate-200 transition-colors" title="Reload Frame">
                    <RefreshCw className="w-3 h-3" />
                </button>
            </span>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleDeploy}
                disabled={isDeploying}
                className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded-md font-medium transition-colors disabled:opacity-70 shadow-2xs"
              >
                {isDeploying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                <span>Deploy to Vercel</span>
              </button>
              {deployedUrl && (
                <a
                  href={deployedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-slate-900 flex items-center space-x-1 font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100"
                >
                  <span>Live App</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {!deployedUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-slate-900 flex items-center space-x-1 font-medium"
                >
                  <span>Open in new tab</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          <iframe
            id="preview-iframe"
            src={previewUrl}
            title="Generated App Web Preview"
            className="w-full flex-1 border-none bg-white"
          />
        </div>
      )}
    </div>
  );
}
