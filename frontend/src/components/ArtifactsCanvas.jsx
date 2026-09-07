import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Code, Eye, Copy, Check, FileText, Folder, RefreshCw, ExternalLink, Save, Rocket, LayoutList, ChevronRight, ChevronDown, FileJson, FileCode, FileType, File, FolderOpen, FilePlus, FolderPlus, Play, Terminal, Loader2, Maximize2, Minimize2, Trash2, GitCompare, Split, Columns, Undo2 } from 'lucide-react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getCleanFilename } from '../utils/fileUtils';
import { useToast } from './Toast';

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
        className={`flex items-center px-2 py-1.5 cursor-pointer transition-all duration-150 group rounded-md mx-1 my-0.5 ${
          isSelected 
            ? 'bg-[#292e45] text-white font-medium shadow-2xs border-l-2 border-indigo-400' 
            : 'hover:bg-[#1e2233] text-slate-300 hover:text-white'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
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
          <div className="flex items-center justify-center w-4 h-4 shrink-0 mr-1 text-slate-400 group-hover:text-amber-400">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
        ) : (
          <div className="w-4 h-4 shrink-0 mr-1" />
        )}
        
        <div className="flex items-center justify-center w-4 h-4 shrink-0 mr-2">
          {!isFile ? (
            isOpen ? <FolderOpen className="w-3.5 h-3.5 text-amber-400" fill="currentColor" /> : <Folder className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />
          ) : (
            getFileIcon(node.name)
          )}
        </div>
        
        <span className="text-[12.5px] truncate font-mono tracking-tight flex-1">{getCleanFilename(node.name)}</span>
        
        {isFile && isHovered && (
          <button 
            className="ml-auto mr-1 p-0.5 hover:bg-slate-700/70 rounded text-slate-400 hover:text-white transition-colors shrink-0"
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
          <span className="ml-auto w-2 h-2 rounded-full bg-blue-400 shrink-0 mr-1.5 animate-pulse" title="Unsaved changes"></span>
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
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(initialTab); // 'code' | 'preview'
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('index.html');
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [editorMode, setEditorMode] = useState('editor'); // 'editor' | 'diff'
  const [diffSideBySide, setDiffSideBySide] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState(null);
  const [previewKey, setPreviewKey] = useState(Date.now());
  const [terminalHeight, setTerminalHeight] = useState(130);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const editorRef = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = terminalHeight;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const deltaY = startYRef.current - e.clientY;
    const newHeight = Math.max(80, Math.min(500, startHeightRef.current + deltaY));
    setTerminalHeight(newHeight);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  const handleOpenFind = () => {
    if (editorRef.current) {
      editorRef.current.focus();
      editorRef.current.trigger('keyboard', 'actions.find', null);
    }
  };

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
      toast.success(`Renamed file to ${newName.trim()}`);
    } catch (e) {
      console.error('Failed to rename file', e);
      toast.error('Failed to rename file');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent || '');
    setCopied(true);
    toast.info('Code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleRunCode = async () => {
    if (!sandboxId || !selectedFile) return;
    setIsExecuting(true);
    setShowTerminal(true);
    setExecutionResult(null);

    try {
      // 1. Auto-save current file
      await fetch(`/api/sandboxes/${sandboxId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile, content: fileContent })
      });
      setOriginalContent(fileContent);
      setPreviewKey(Date.now());

      // 2. Execute code natively via /api/run-code
      const lang = getLanguage(selectedFile);
      const res = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: fileContent, language: lang })
      });
      const data = await res.json();
      setExecutionResult(data);

      // Auto-fit terminal height based on output lines
      const lines = (data.output || '').split('\n').length;
      const fitHeight = Math.max(90, Math.min(300, (lines * 22) + 65));
      setTerminalHeight(fitHeight);
    } catch (err) {
      setExecutionResult({ output: "Execution error: " + err.message, exit_code: 1 });
      setTerminalHeight(120);
    } finally {
      setIsExecuting(false);
    }
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
        setPreviewKey(Date.now());
        toast.success(`Saved ${selectedFile}`);
    } catch (err) {
        console.error("Save error:", err);
        toast.error("Failed to save file.");
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
      toast.success(`Created file ${filename.trim()}`);
    } catch (e) {
      console.error('Failed to create file', e);
      toast.error('Failed to create file');
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
      toast.success(`Created folder ${foldername.trim()}`);
    } catch (e) {
      console.error('Failed to create folder', e);
      toast.error('Failed to create folder');
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
      toast.success(`Deployment successful! URL: ${data.url}`, 8000);
    } catch (err) {
      console.error("Deploy error:", err);
      toast.error(`Deployment failed: ${err.message}`);
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
  const htmlFile = files.find(f => typeof f?.path === 'string' && f.path.endsWith('.html'));
  const mainHtmlPath = htmlFile ? htmlFile.path : (safeSelectedFile.endsWith('.html') ? safeSelectedFile : null);
  const rawPreviewUrl = (sandboxId && mainHtmlPath) ? `/api/sandboxes/${sandboxId}/preview/${mainHtmlPath}` : '';
  const previewUrl = rawPreviewUrl ? `${rawPreviewUrl}?t=${previewKey}` : '';

  const getLanguage = (path = '') => {
      const p = (path || '').toLowerCase();
      if (p.endsWith('.js') || p.endsWith('.jsx')) return 'javascript';
      if (p.endsWith('.ts') || p.endsWith('.tsx')) return 'typescript';
      if (p.endsWith('.html') || p.endsWith('.htm')) return 'html';
      if (p.endsWith('.css')) return 'css';
      if (p.endsWith('.json')) return 'json';
      if (p.endsWith('.py')) return 'python';
      if (p.endsWith('.cpp') || p.endsWith('.cxx') || p.endsWith('.cc') || p.endsWith('.c') || p.endsWith('.h') || p.endsWith('.hpp')) return 'cpp';
      if (p.endsWith('.java')) return 'java';
      if (p.endsWith('.bash') || p.endsWith('.sh') || p.endsWith('.zsh')) return 'shell';
      if (p.endsWith('.md')) return 'markdown';
      if (p.endsWith('.sql')) return 'sql';
      if (p.endsWith('.xml')) return 'xml';
      if (p.endsWith('.yaml') || p.endsWith('.yml')) return 'yaml';
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
    <div className="fixed inset-0 lg:relative lg:inset-auto z-40 lg:z-30 w-full h-full lg:flex-1 min-w-0 bg-[#181a24] text-slate-200 flex flex-col transition-all duration-300 select-none">
      {/* Header (VS Code Slate Theme) */}
      <div className="p-3 border-b border-[#282c3f] flex items-center justify-between bg-[#151722]">
        <div className="flex items-center space-x-2">
          <div className="flex bg-[#1d2030] p-1 rounded-lg border border-[#2b3044] text-xs shadow-inner overflow-x-auto hide-scrollbar whitespace-nowrap">
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all font-medium ${activeTab === 'code' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-[#262a3e]'}`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Code Editor</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all font-medium ${activeTab === 'preview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-[#262a3e]'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Web Preview</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'code' && (
            <>
              <button
                onClick={handleRunCode}
                disabled={isExecuting}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer border border-emerald-400/40 active:scale-95 disabled:opacity-50"
                title="Save & Run Code Natively"
              >
                {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                <span>{isExecuting ? 'Running...' : 'Run Code'}</span>
              </button>

              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || saving}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    hasUnsavedChanges 
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                        : 'bg-[#212434] text-slate-500 cursor-not-allowed border border-[#2b3044]'
                }`}
                title="Save Changes (Cmd+S)"
              >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save</span>
              </button>

              {rawPreviewUrl && (
                <a
                  href={rawPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/40 transition-colors"
                  title="Open Live Web Preview in New Browser Tab"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Open in New Tab</span>
                </a>
              )}
            </>
          )}
          
          {activeTab === 'code' && (
            <button
              onClick={handleOpenFind}
              className="p-1.5 rounded-lg hover:bg-[#25293d] text-slate-400 hover:text-white transition-colors"
              title="Find / Replace in Code (Cmd+F / Ctrl+F)"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-[#25293d] text-slate-400 hover:text-white transition-colors"
            title="Copy Code"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#25293d] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas View */}
      {activeTab === 'code' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* File Tree Drawer */}
          <div className="w-56 bg-[#141622] border-r border-[#262a3c] p-0 overflow-y-auto flex flex-col shrink-0">
            <div className="text-[10px] text-slate-400 px-4 py-2 uppercase tracking-widest flex items-center justify-between font-mono font-medium shrink-0 border-b border-[#212435]">
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

          {/* Editor Viewer */}
          <div className="flex-1 flex flex-col bg-[#1e202e] overflow-hidden relative">
            <div className="text-[10px] font-mono text-slate-300 px-4 py-2 border-b border-[#262a3c] bg-[#171926] flex items-center justify-between gap-2 flex-wrap">
              {/* Left Side: Filename, Unsaved Badge & View Switcher (Editor vs Git Diff) */}
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-2">
                   <span className="font-semibold text-slate-200">{getCleanFilename(safeSelectedFile)}</span>
                   {hasUnsavedChanges && <span className="w-2 h-2 rounded-full bg-blue-400 inline-block animate-pulse" title="Unsaved changes"></span>}
                </span>

                {/* View Mode Switcher Pills */}
                <div className="flex items-center space-x-1 bg-[#10121d] p-0.5 rounded-lg border border-[#2b3044]">
                  <button
                    type="button"
                    onClick={() => setEditorMode('editor')}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-sans font-semibold transition-all ${
                      editorMode === 'editor'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1d2e]'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>Editor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditorMode('diff')}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-sans font-semibold transition-all ${
                      editorMode === 'diff'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1d2e]'
                    }`}
                    title="View Git-style code differences between original and modified code"
                  >
                    <GitCompare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Git Diff View</span>
                  </button>
                </div>
              </div>

              {/* Right Side: Diff Format Switcher, Revert Button & Actions */}
              <div className="flex items-center space-x-3">
                 {editorMode === 'diff' && (
                   <>
                     <button
                       type="button"
                       onClick={() => setDiffSideBySide(!diffSideBySide)}
                       className="text-xs text-slate-300 hover:text-white flex items-center space-x-1 font-sans bg-[#282c40] px-2 py-1 rounded-md border border-[#373d57] transition-all"
                       title={diffSideBySide ? "Switch to Unified inline diff view" : "Switch to Side-by-Side split diff view"}
                     >
                       {diffSideBySide ? <Split className="w-3 h-3 text-indigo-400" /> : <Columns className="w-3 h-3 text-indigo-400" />}
                       <span>{diffSideBySide ? 'Split' : 'Unified'}</span>
                     </button>

                     {hasUnsavedChanges && (
                       <button
                         type="button"
                         onClick={() => setFileContent(originalContent)}
                         className="text-xs text-rose-300 hover:text-rose-200 flex items-center space-x-1 font-sans bg-rose-950/40 border border-rose-900/60 px-2 py-1 rounded-md transition-all"
                         title="Discard all changes and revert to original code"
                       >
                         <Undo2 className="w-3 h-3 text-rose-400" />
                         <span>Revert</span>
                       </button>
                     )}
                   </>
                 )}

                 <button
                   onClick={handleOpenFind}
                   className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center space-x-1 font-mono font-medium hover:underline cursor-pointer"
                   title="Open VS Code Find & Replace Widget (Cmd+F)"
                 >
                   <Search className="w-3.5 h-3.5" />
                   <span>Find</span>
                 </button>

                 {executionResult !== null && (
                   <button
                     onClick={() => setShowTerminal(!showTerminal)}
                     className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 font-mono font-medium"
                   >
                     <Terminal className="w-3 h-3" />
                     <span>{showTerminal ? 'Hide Console' : 'Show Console'}</span>
                   </button>
                 )}
                 <span className="text-slate-400">{fileContent.length} bytes</span>
              </div>
            </div>

            <div className="flex-1 min-h-0 w-full relative">
              {editorMode === 'editor' ? (
                <Editor
                  height="100%"
                  width="100%"
                  language={getLanguage(safeSelectedFile)}
                  theme="vs-dark"
                  value={fileContent}
                  onChange={(val) => setFileContent(val || '')}
                  onMount={handleEditorDidMount}
                  options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      padding: { top: 16 },
                      find: {
                        addExtraSpaceOnTop: false,
                        autoFindInSelection: 'never',
                        seedSearchStringFromSelection: 'always'
                      }
                  }}
                />
              ) : (
                <DiffEditor
                  height="100%"
                  width="100%"
                  language={getLanguage(safeSelectedFile)}
                  theme="vs-dark"
                  original={originalContent}
                  modified={fileContent}
                  options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                      renderSideBySide: diffSideBySide,
                      readOnly: false,
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      padding: { top: 16 }
                  }}
                />
              )}
            </div>

            {/* Integrated Terminal Console Drawer (VS Code Resizable Panel) */}
            {(showTerminal && executionResult !== null) && (
              <div 
                style={{ height: isTerminalMaximized ? '65%' : `${terminalHeight}px` }}
                className="border-t border-[#2b3044] bg-[#141622] px-3.5 py-2 font-mono text-xs overflow-hidden flex flex-col shrink-0 relative transition-all duration-150"
              >
                {/* Drag Handle Top Border */}
                <div 
                  onMouseDown={handleMouseDown}
                  className="absolute top-0 left-0 right-0 h-2 cursor-row-resize hover:bg-indigo-500/40 transition-colors flex items-center justify-center z-10 group"
                  title="Drag up or down to resize terminal panel"
                >
                  <div className="w-10 h-1 rounded-full bg-slate-600 group-hover:bg-indigo-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="flex items-center justify-between mb-1.5 pb-1 pt-1 border-b border-[#262a3d] select-none">
                  <div className="flex items-center space-x-2 text-slate-300">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-200">Terminal Console Output</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-slate-300 uppercase tracking-widest font-mono font-semibold bg-[#1d2030] px-2 py-0.5 rounded border border-[#2b3044]">
                      {executionResult.exit_code === 0 ? 'EXIT CODE: 0 (SUCCESS)' : executionResult.exit_code ? `EXIT CODE: ${executionResult.exit_code}` : 'EXECUTED'}
                    </span>

                    <button
                      onClick={() => setIsTerminalMaximized(!isTerminalMaximized)}
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#282d42] transition-colors"
                      title={isTerminalMaximized ? "Restore Terminal Panel" : "Maximize Terminal Panel"}
                    >
                      {isTerminalMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => setExecutionResult(null)}
                      className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-[#282d42] transition-colors"
                      title="Clear Terminal Output"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setShowTerminal(false)}
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#282d42] transition-colors"
                      title="Close Terminal Console"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-slate-100 whitespace-pre-wrap font-mono p-3 bg-[#191c2b] rounded-xl border border-[#272b40] overflow-y-auto leading-relaxed shadow-inner flex-1 select-text">
                  {executionResult.output || 'No output produced.'}
                </div>
              </div>
            )}
          </div>
        </div>

      ) : (
        /* Live Web Preview Iframe */
        <div className="flex-1 flex flex-col bg-slate-100">
          {rawPreviewUrl ? (
            <>
              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono truncate text-[11px] flex items-center space-x-2">
                    <span className="font-semibold text-slate-700">Preview: {previewUrl}</span>
                    <button onClick={() => document.getElementById('preview-iframe')?.contentWindow?.location?.reload()} className="hover:text-slate-800 p-1 rounded-full hover:bg-slate-200 transition-colors" title="Reload Frame">
                        <RefreshCw className="w-3 h-3 text-slate-600" />
                    </button>
                </span>
                <div className="flex items-center space-x-3">
                  <a
                    href={rawPreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-indigo-700 flex items-center space-x-1.5 font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-md border border-indigo-200 transition-colors"
                    title="Open Web App in New Browser Tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in New Tab</span>
                  </a>

                  <button
                    onClick={handleDeploy}
                    disabled={isDeploying}
                    className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded-md font-medium transition-colors disabled:opacity-70 shadow-2xs"
                  >
                    {isDeploying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                    <span>Deploy to Vercel</span>
                  </button>
                </div>
              </div>
              <iframe
                id="preview-iframe"
                src={previewUrl}
                title="Generated App Web Preview"
                className="w-full flex-1 border-none bg-white shadow-inner"
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#151722] text-slate-400 p-8 text-center">
              <Code className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-sm font-bold text-slate-200 mb-1">No Web Preview Available</h3>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                This project contains native code (<span className="text-indigo-400 font-mono font-semibold">{getCleanFilename(safeSelectedFile)}</span>). Use the <span className="text-emerald-400 font-bold">▶ Run Code</span> button in the top toolbar to execute the code and view output in the Terminal Console.
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
