import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatTimeline from './components/ChatTimeline';
import PromptBar from './components/PromptBar';
import ArtifactsCanvas from './components/ArtifactsCanvas';
import GraphCanvas from './components/GraphCanvas';
import CodeCanvas from './components/CodeCanvas';
import AuthModal from './components/AuthModal';
import { Menu, Layers, Sparkles, PanelLeft, User, LogOut, ChevronDown, ShieldCheck, ExternalLink, Activity, Plus } from 'lucide-react';

export default function App() {
  // Collapsible Sidebar state (default open on desktop, closed on mobile)
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [projects, setProjects] = useState([]);
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [nodeHistory, setNodeHistory] = useState([]);
  const [pmQuestions, setPmQuestions] = useState([]);
  const [streamingText, setStreamingText] = useState('');
  const [mode, setMode] = useState('chat'); // 'chat' | 'build'
  const [isLoading, setIsLoading] = useState(false);
  const [statusInfo, setStatusInfo] = useState(null);
  const [tokenUsage, setTokenUsage] = useState({ totalInput: 0, totalOutput: 0, estimatedCost: 0 });
  const [activeSandboxId, setActiveSandboxId] = useState(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [activeChatCodeBlock, setActiveChatCodeBlock] = useState(null); // { code, language, filename }
  const [chatWidth, setChatWidth] = useState(480);
  const [isResizingChat, setIsResizingChat] = useState(false);

  // Authentication State & Top Profile Dropdown State
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Click outside to close top profile dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    const savedUser = localStorage.getItem('pixlexpert_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {}
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('pixlexpert_user');
    setUser(null);
  };

  // Dynamic Responsive Window Resize Listener
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => {
      const mobileStatus = window.innerWidth < 768;
      setIsMobile(mobileStatus);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    fetchChatsAndRestore(user);
  }, [user]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatusInfo(data);
    } catch (e) {
      console.error('Failed to fetch status', e);
    }
  };

  const fetchChatsAndRestore = async (currentUser) => {
    try {
      const u = currentUser !== undefined ? currentUser : user;
      const url = u?.id ? `/api/chats?user_id=${encodeURIComponent(u.id)}` : '/api/chats';
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);

        // Auto-restore active thread or target first thread for this specific user
        const savedThreadId = localStorage.getItem('active_thread_id');
        const userThreadExists = data.some((p) => p.thread_id === savedThreadId);
        const targetThreadId = userThreadExists ? savedThreadId : (data.length > 0 ? data[0].thread_id : null);

        if (targetThreadId) {
          handleSelectChat(targetThreadId);
        } else {
          handleNewProject();
        }
      }
    } catch (e) {
      console.error('Failed to fetch chat history', e);
    }
  };

  const handleSelectChat = async (threadId) => {
    try {
      const res = await fetch(`/api/chats/${threadId}`);
      const data = await res.json();
      if (data) {
        setCurrentThreadId(data.thread_id);
        localStorage.setItem('active_thread_id', data.thread_id);
        setMessages(data.messages || []);
        const loadedHist = data.node_history || [];
        setNodeHistory(loadedHist);
        setMode(data.mode || 'chat');
        setStreamingText('');

        // Find if any sandboxId exists in node history
        const sandboxNode = loadedHist.find((h) => h?.state_delta?.sandboxId);
        if (sandboxNode?.state_delta?.sandboxId) {
          setActiveSandboxId(sandboxNode.state_delta.sandboxId);
          setShowCanvas(true);
        } else {
          setActiveSandboxId(null);
          setShowCanvas(false);
        }
      }
    } catch (e) {
      console.error('Failed to load chat detail', e);
    }
  };

  const handleNewProject = () => {
    localStorage.removeItem('active_thread_id');
    setCurrentThreadId(null);
    setMessages([]);
    setNodeHistory([]);
    setPmQuestions([]);
    setStreamingText('');
    setActiveSandboxId(null);
    setShowCanvas(false);
    setShowGraph(false);
  };

  const handleDeleteProject = async (threadId) => {
    if (!threadId) return;
    try {
      await fetch(`/api/chats/${threadId}`, { method: 'DELETE' });
      const updatedList = projects.filter((p) => p.thread_id !== threadId);
      setProjects(updatedList);
      if (currentThreadId === threadId) {
        handleNewProject();
      }
    } catch (e) {
      console.error('Delete chat session error', e);
    }
  };

  const handleOpenCodeInIDE = async (input) => {
    // Generate a temporary sandbox ID
    const newSandboxId = 'sb_' + Date.now();
    const blocks = Array.isArray(input) ? input : [input];
    
    try {
      // Post all files in parallel
      await Promise.all(blocks.map(block => {
        const filename = block.filename || (block.language === 'html' ? 'index.html' : block.language === 'css' ? 'style.css' : block.language === 'javascript' || block.language === 'js' ? 'script.js' : 'file.txt');
        
        return fetch(`/api/sandboxes/${newSandboxId}/file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filename, content: block.code })
        });
      }));
      setActiveSandboxId(newSandboxId);
      setShowCanvas(true);
      
      // Persist this new sandbox in the chat history so it applies to old projects permanently
      if (currentThreadId) {
        const newNode = { state_delta: { sandboxId: newSandboxId } };
        const updatedHistory = [...nodeHistory, newNode];
        setNodeHistory(updatedHistory);
        autoSaveChat(currentThreadId, messages, updatedHistory, mode);
      }
    } catch (e) {
      console.error('Failed to create sandbox for code block', e);
    }
  };
  const triggerQuickAction = (action, code) => {
    setMode('chat');
    handlePromptSubmit(`${action} this code:\n\n\`\`\`\n${code}\n\`\`\``, 'gemini-1.5-flash', 'chat');
  };

  const handleRegenerate = (msgIdx, overridePrompt = null) => {
    let lastPrompt = overridePrompt || '';
    if (!lastPrompt && typeof msgIdx === 'number') {
      if (messages[msgIdx]?.role === 'user') {
        lastPrompt = messages[msgIdx].content;
      } else {
        for (let i = msgIdx - 1; i >= 0; i--) {
          if (messages[i]?.role === 'user') {
            lastPrompt = messages[i].content;
            break;
          }
        }
      }
    }
    if (lastPrompt) {
      handlePromptSubmit(lastPrompt, 'gemini-1.5-flash', mode);
    }
  };

  const autoSaveChat = async (tId, msgList, nHist, mMode) => {
    if (!tId || msgList.length === 0) return;
    const title = msgList[0]?.content?.slice(0, 32) || 'Chat Session';
    try {
      await fetch('/api/chats/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: tId,
          title,
          messages: msgList,
          node_history: nHist,
          mode: mMode,
          user_id: user?.id || null,
        }),
      });
      // Refresh sidebar list
      fetchChatsAndRestore();
    } catch (e) {
      console.error('Auto save error', e);
    }
  };

  const handlePromptSubmit = async (promptText, modelName, selectedMode, attachments = []) => {
    setIsLoading(true);
    const activeThread = currentThreadId || `session_${Date.now()}`;
    if (!currentThreadId) {
      setCurrentThreadId(activeThread);
      localStorage.setItem('active_thread_id', activeThread);
    }

    const newMsg = { role: 'user', content: promptText, attachments };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setStreamingText('');

    // Trigger Build Mode Pipeline in parallel immediately (non-blocking)
    if (selectedMode === 'build') {
      fetch('/api/projects/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: promptText, model: modelName }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.thread_id) connectEventSource(data.thread_id);
        })
        .catch((e) => {
          console.error('Failed to start project build pipeline', e);
          setIsLoading(false);
        });
        
      autoSaveChat(activeThread, updatedMessages, nodeHistory, selectedMode);
      return; // DO NOT proceed to standard chat stream
    }

    // Stream AI Response word-by-word INSTANTLY with 0 delay
    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, model: modelName, thread_id: activeThread, mode: selectedMode }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let streamBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const payload = JSON.parse(trimmed.slice(6));
              if (payload.text) {
                accumulatedText += payload.text;
                setStreamingText(accumulatedText);
              }
            } catch (e) {
              console.warn('SSE line parse skip:', e);
            }
          }
        }
      }

      const finalAns = accumulatedText || 'Code generation completed successfully.';
      const finalMsgs = [...updatedMessages, { role: 'assistant', content: finalAns }];
      setMessages(finalMsgs);
      setStreamingText('');
      autoSaveChat(activeThread, finalMsgs, nodeHistory, selectedMode);
    } catch (e) {
      console.error('Chat stream error', e);
    } finally {
      setIsLoading(false);
    }
  };

  const connectEventSource = (threadId) => {
    const sse = new EventSource(`/api/stream/${threadId}`);

    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'node_update') {
          const { node, state_delta } = payload.data;
          setNodeHistory((prev) => {
            const nextHist = [...prev, { node, status: 'complete', state_delta }];
            autoSaveChat(threadId, messages, nextHist, mode);
            return nextHist;
          });

          if (state_delta?.pmQuestions?.length > 0) {
            setPmQuestions(state_delta.pmQuestions);
          }
          if (state_delta?.sandboxId) {
            setActiveSandboxId(state_delta.sandboxId);
            setShowCanvas(true);
          }
        } else if (payload.type === 'complete') {
          setIsLoading(false);
          sse.close();
        } else if (payload.type === 'error') {
          setIsLoading(false);
          sse.close();
        }
      } catch (e) {
        console.error('SSE parse error', e);
      }
    };

    sse.onerror = () => {
      setIsLoading(false);
      sse.close();
    };
  };

  const [sidebarWidth, setSidebarWidth] = useState(260);

  const handleAnswerQuestions = (answers) => {
    setPmQuestions([]);
  };

  const hasContent = messages.length > 0 || nodeHistory.length > 0 || streamingText !== '';

  // Resizing logic for Chat Pane
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingChat) return;
      let newWidth = e.clientX;
      if (sidebarOpen && window.innerWidth >= 768) {
        newWidth -= sidebarWidth; // offset for sidebar
      }
      if (newWidth < 300) newWidth = 300;
      if (newWidth > window.innerWidth - 300) newWidth = window.innerWidth - 300;
      setChatWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizingChat(false);
    
    if (isResizingChat) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingChat, sidebarOpen, sidebarWidth]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 ambient-bg text-slate-900">
      {/* Sidebar */}
      <Sidebar
        projects={projects}
        currentThreadId={currentThreadId}
        onSelectProject={handleSelectChat}
        onDeleteProject={handleDeleteProject}
        onNewProject={handleNewProject}
        statusInfo={statusInfo}
        tokenUsage={tokenUsage}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        sidebarWidth={sidebarWidth}
        setSidebarWidth={setSidebarWidth}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div 
        style={{ paddingLeft: sidebarOpen && typeof window !== 'undefined' && window.innerWidth >= 768 ? `${sidebarWidth}px` : '0px' }}
        className="flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out relative w-full"
      >
        {/* Top App Header with Glassmorphism & Subtle Shadow */}
        <header className="h-14 border-b border-slate-200/80 px-4 flex items-center justify-between bg-white/80 backdrop-blur-xl z-20 shrink-0 shadow-xs">
          <div className="flex items-center space-x-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Expand Sidebar"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 border border-slate-200 transition-all flex items-center justify-center animate-fade-in mr-1"
              >
                <PanelLeft className="w-4 h-4 text-slate-700" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => { setShowGraph(!showGraph); setShowCanvas(false); }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-xs ${showGraph ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}
            >
              <Activity className="w-3.5 h-3.5 text-indigo-500" />
              <span>{showGraph ? 'Hide Graph' : 'Agent Graph'}</span>
            </button>

            {activeSandboxId && (
              <button
                onClick={() => { setShowCanvas(!showCanvas); setShowGraph(false); }}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg border text-sm transition-all shadow-md font-medium ${showCanvas ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{showCanvas ? 'Hide App' : 'View App'}</span>
              </button>
            )}

            {/* Top Right Auth Control (Claude / ChatGPT / Codex style) */}
            {user ? (
              <div className="relative pl-2" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-1.5 p-1 rounded-full hover:bg-slate-100 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all cursor-pointer focus:outline-none"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center border border-slate-700 overflow-hidden shrink-0">
                    {user.avatar ? (
                      <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      user.name?.charAt(0) || 'U'
                    )}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 pr-0.5 shrink-0" />
                </button>

                {/* Claude / ChatGPT Style Profile Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200/90 rounded-2xl shadow-2xl shadow-slate-900/15 p-2 z-50 animate-fade-in space-y-1">
                    {/* User Card Header */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center border border-slate-700 overflow-hidden shrink-0">
                        {user.avatar ? (
                          <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
                        ) : (
                          user.name?.charAt(0) || 'U'
                        )}
                      </div>
                      <div className="truncate text-left leading-tight">
                        <div className="font-bold text-xs text-slate-900 truncate">{user.name || 'Developer'}</div>
                        <div className="text-[10px] text-slate-500 truncate">{user.email || 'user@example.com'}</div>
                        <span className="inline-block mt-1 text-[9px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.2 rounded border border-emerald-200">
                          Pro Developer
                        </span>
                      </div>
                    </div>

                    {/* LangSmith Direct Traces */}
                    <a
                      href="https://smith.langchain.com"
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <span className="flex items-center space-x-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="font-medium">LangSmith Traces</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </a>

                    {/* Divider */}
                    <div className="border-t border-slate-100 my-1" />

                    {/* Sign Out Action */}
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-md shadow-slate-900/20 transition-all flex items-center space-x-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Body (Chat Timeline + Claude Artifacts Side Panel) */}
        <div className="flex-1 flex overflow-hidden relative min-h-0 bg-slate-50">
          {hasContent ? (
            /* Active Conversation / Build Feed (Chat Left Pane) */
            <div 
              style={{ width: showCanvas && activeSandboxId && window.innerWidth >= 768 ? `${chatWidth}px` : '100%' }}
              className={`flex flex-col h-full overflow-hidden min-h-0 bg-white shadow-[10px_0_15px_-3px_rgba(0,0,0,0.05)] z-40 transition-none ${showCanvas && activeSandboxId ? 'shrink-0' : 'flex-1'}`}
            >
              <ChatTimeline
                messages={messages}
                nodeHistory={nodeHistory}
                pmQuestions={pmQuestions}
                streamingText={streamingText}
                isLoading={isLoading}
                activeSandboxId={activeSandboxId}
                onAnswerQuestions={handleAnswerQuestions}
                onRegenerate={handleRegenerate}
                onOpenCodeBlock={handleOpenCodeInIDE}
                onQuickAction={triggerQuickAction}
                onOpenArtifacts={(sbId) => {
                  setActiveChatCodeBlock(null);
                  setActiveSandboxId(sbId);
                  setShowCanvas(true);
                }}
              />
              <PromptBar onSubmit={handlePromptSubmit} isLoading={isLoading} mode={mode} setMode={setMode} />
            </div>
          ) : (
            /* Perfectly Centered Hero + Input Box View (Unified Claude / ChatGPT Style Layout Width) */
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 text-center max-w-3xl sm:max-w-4xl mx-auto w-full h-full my-auto overflow-y-auto px-3 sm:px-5 animate-fade-in">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 shrink-0 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 bg-clip-text text-transparent">
                What do you want to build today?
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mb-6 font-normal max-w-md">
                Generate full-stack web applications, python scripts, debug code, or analyze data with the AI Dev Team.
              </p>

              {/* Centered Large Prompt Bar */}
              <div className="w-full shrink-0">
                <PromptBar onSubmit={handlePromptSubmit} isLoading={isLoading} mode={mode} setMode={setMode} />
              </div>

              {/* Quick Starter Suggestion Chips */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6 max-w-2xl shrink-0">
                {[
                  'Build simple calculator using html , css , javascript',
                  'Build a interactive snake game in python',
                  'Create a modern to-do list app with local storage',
                  'Build a sleek portfolio website layout',
                ].map((suggestion, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => handlePromptSubmit(suggestion, 'gemini-1.5-flash', mode)}
                    className="text-xs px-3.5 py-2 rounded-xl bg-white hover:bg-indigo-50/80 text-slate-600 hover:text-indigo-700 border border-slate-200/90 hover:border-indigo-200 shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center space-x-1.5 font-medium"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Claude-Style Sliding Artifacts Canvas Panel (Right Pane) */}
          {showCanvas && activeSandboxId && (
            <>
              {/* Drag Handle for Resizing */}
              {window.innerWidth >= 768 && (
                <div 
                  className="w-1.5 hover:w-2 bg-slate-200 hover:bg-indigo-400 cursor-col-resize z-50 transition-all flex items-center justify-center group"
                  onMouseDown={(e) => { setIsResizingChat(true); e.preventDefault(); }}
                >
                  <div className="h-8 w-0.5 bg-slate-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
              
              <ArtifactsCanvas
                sandboxId={activeSandboxId}
                onClose={() => setShowCanvas(false)}
              />
            </>
          )}



          {/* Sliding Live Agent Graph Panel */}
          {showGraph && (
            <GraphCanvas 
              nodeHistory={nodeHistory} 
              onClose={() => setShowGraph(false)} 
            />
          )}
        </div>
      </div>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(userData) => setUser(userData)}
      />

      {/* Resize Overlay to prevent iframes from stealing mouse events */}
      {isResizingChat && (
        <div className="fixed inset-0 z-[9999] cursor-col-resize" />
      )}
    </div>
  );
}
