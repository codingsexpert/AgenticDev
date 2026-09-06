import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import ChatTimeline from './components/ChatTimeline';
import PromptBar from './components/PromptBar';
import ArtifactsCanvas from './components/ArtifactsCanvas';
import GraphCanvas from './components/GraphCanvas';
import AuthModal from './components/AuthModal';
import { 
  Menu, 
  Layers, 
  Sparkles, 
  PanelLeft, 
  User, 
  LogOut, 
  ChevronDown, 
  ShieldCheck, 
  ExternalLink, 
  Activity, 
  Search,
  Crown,
  Sun,
  Moon,
  Bell,
  Code,
  FileText,
  ClipboardList,
  Globe,
  Plus
} from 'lucide-react';

export default function App() {
  // Collapsible Sidebar state (default open on desktop lg: 1024px+, closed on mobile)
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : false);
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
  const [activeChatCodeBlock, setActiveChatCodeBlock] = useState(null);
  const [chatWidth, setChatWidth] = useState(480);
  const [isResizingChat, setIsResizingChat] = useState(false);

  // Search & Theme State
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Authentication State & Top Profile Dropdown State
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const abortControllerRef = useRef(null);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };


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
    localStorage.removeItem('active_thread_id');
    setUser(null);
    handleNewProject();
    try {
      import('./utils/supabase').then(({ supabase }) => {
        if (supabase) supabase.auth.signOut().catch(() => {});
      });
    } catch (e) {}
  };

  // Dynamic Responsive Window Resize Listener
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => {
      const mobileStatus = window.innerWidth < 768;
      setIsMobile(mobileStatus);
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
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

        const sandboxNode = loadedHist.find((h) => h?.state_delta?.sandboxId);
        if (sandboxNode?.state_delta?.sandboxId) {
          setActiveSandboxId(sandboxNode.state_delta.sandboxId);
        } else {
          setActiveSandboxId(null);
        }
        setShowCanvas(false);
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

  const handleRenameProject = async (threadId, newTitle) => {
    if (!threadId || !newTitle.trim()) return;
    try {
      await fetch(`/api/chats/${threadId}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      setProjects((prev) =>
        prev.map((p) => (p.thread_id === threadId ? { ...p, title: newTitle.trim() } : p))
      );
    } catch (e) {
      console.error('Rename chat session error', e);
    }
  };

  const handleOpenCodeInIDE = async (input) => {
    const newSandboxId = 'sb_' + Date.now();
    const blocks = Array.isArray(input) ? input : [input];
    
    try {
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

    // Optimistically update local project list without triggering full refetch delay
    setProjects((prev) => {
      const exists = prev.some((p) => p.thread_id === tId);
      if (exists) {
        return prev.map((p) => (p.thread_id === tId ? { ...p, title, updated_at: new Date().toISOString() } : p));
      }
      return [{ thread_id: tId, title, messages: msgList, updated_at: new Date().toISOString() }, ...prev];
    });

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
    } catch (e) {
      console.error('Auto save error', e);
    }
  };

  const handlePromptSubmit = async (promptText, modelName, selectedMode, attachments = []) => {
    if (isLoading) return; // Disable duplicate submissions while processing

    setIsLoading(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const activeThread = currentThreadId || `session_${Date.now()}`;
    if (!currentThreadId) {
      setCurrentThreadId(activeThread);
      localStorage.setItem('active_thread_id', activeThread);
    }

    const newMsg = { role: 'user', content: promptText, attachments };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setStreamingText('');

    if (selectedMode === 'build') {
      fetch('/api/projects/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: promptText, model: modelName }),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.thread_id) connectEventSource(data.thread_id);
        })
        .catch((e) => {
          if (e.name !== 'AbortError') {
            console.error('Failed to start project build pipeline', e);
          }
          setIsLoading(false);
        });
        
      autoSaveChat(activeThread, updatedMessages, nodeHistory, selectedMode);
      return;
    }

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, model: modelName, thread_id: activeThread, mode: selectedMode }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
      if (e.name === 'AbortError') {
        console.log('Stream generation stopped by user.');
        setMessages((prevMsgs) => {
          if (streamingText) {
            return [...prevMsgs, { role: 'assistant', content: streamingText + ' _(Stopped)_' }];
          }
          return prevMsgs;
        });
        setStreamingText('');
      } else {
        console.error('Chat stream error', e);
        const errMsgs = [...updatedMessages, { role: 'assistant', content: '⚠️ Network connection interrupted. Please click retry.' }];
        setMessages(errMsgs);
        setStreamingText('');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 ambient-bg text-slate-900 font-sans">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        projects={projects}
        currentThreadId={currentThreadId}
        onSelectProject={handleSelectChat}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
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

      {/* 2. Main Content Area */}
      <div 
        style={{ paddingLeft: sidebarOpen && typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth}px` : '0px' }}
        className="flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out relative w-full"
      >
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between bg-white/80 backdrop-blur-xl z-20 shrink-0 shadow-xs gap-3">
          {/* Left: Mobile Drawer Button & Search Bar */}
          <div className="flex items-center space-x-3 flex-1 max-w-xl">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle Navigation Menu"
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all flex items-center justify-center shrink-0"
            >
              <Menu className="w-5 h-5 text-slate-700" />
            </button>

            {/* Responsive Search Input */}
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats, projects, files..."
                className="w-full pl-10 pr-12 py-2 rounded-2xl bg-slate-50 border border-slate-200/90 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded border border-slate-300/40">
                ⌘ K
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Pro Plan Button */}
            <button
              type="button"
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Pro Plan</span>
            </button>

            {/* Agent Graph Toggle */}
            <button
              onClick={() => { setShowGraph(!showGraph); setShowCanvas(false); }}
              className={`hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs ${showGraph ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}
            >
              <Activity className="w-3.5 h-3.5 text-indigo-500" />
              <span>{showGraph ? 'Hide Graph' : 'Agent Graph'}</span>
            </button>

            {/* Sandbox View App Toggle */}
            {activeSandboxId && (
              <button
                onClick={() => { setShowCanvas(!showCanvas); setShowGraph(false); }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs ${showCanvas ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>{showCanvas ? 'Hide App' : 'View App'}</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title="Toggle Theme Mode"
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 border border-slate-200 transition-all flex items-center justify-center"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Sun className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Notification Bell */}
            <button
              type="button"
              title="Notifications"
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 border border-slate-200 transition-all relative flex items-center justify-center"
            >
              <Bell className="w-4 h-4 text-slate-600" />
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5 ring-2 ring-white" />
            </button>

            {/* User Profile Avatar */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-1 p-0.5 rounded-full hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center border border-white shadow-2xs overflow-hidden">
                    {user.avatar ? (
                      <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      user.name?.charAt(0) || 'M'
                    )}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 pr-0.5" />
                </button>

                {/* Profile Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in space-y-1">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                        {user.name?.charAt(0) || 'M'}
                      </div>
                      <div className="truncate text-left leading-tight">
                        <div className="font-bold text-xs text-slate-900 truncate">{user.name || 'Mukesh Singh'}</div>
                        <div className="text-[10px] text-slate-500 truncate">{user.email || 'mukesh@example.com'}</div>
                      </div>
                    </div>

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
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-indigo-500/20"
              >
                MS
              </button>
            )}
          </div>
        </header>

        {/* 3. Main Center Workspace Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative min-h-0 bg-slate-50">
          {hasContent ? (
            /* Active Conversation View */
            <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0 bg-white shadow-[10px_0_15px_-3px_rgba(0,0,0,0.05)] z-30">
              <div className="p-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between px-4">
                <span className="text-xs font-bold text-slate-700">Active Chat Session</span>
                <button
                  type="button"
                  onClick={handleNewProject}
                  className="px-3 py-1 rounded-xl bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 hover:border-indigo-200 text-xs font-semibold shadow-2xs transition-all flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Chat</span>
                </button>
              </div>
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
              <div className="p-3 sm:p-4 max-w-4xl mx-auto w-full">
                <PromptBar onSubmit={handlePromptSubmit} isLoading={isLoading} onStop={handleStopGeneration} mode={mode} setMode={setMode} />
              </div>
            </div>
          ) : (
            /* Welcome Hero View (PixlExpert Dashboard Layout Matching Reference Image) */
            <div className="flex-1 flex flex-col items-center justify-between p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full h-full overflow-y-auto animate-fade-in">
              <div className="w-full flex-1 flex flex-col items-center justify-center my-auto py-6">
                {/* Hero Badge Sparkle Icon */}
                <div className="w-14 h-14 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-sm animate-bounce-subtle">
                  <Sparkles className="w-7 h-7 text-indigo-600 fill-indigo-600" />
                </div>

                {/* Sub-greeting */}
                <div className="flex items-center space-x-2 text-sm sm:text-base font-semibold text-slate-600 mb-2">
                  <span>Good morning, Mukesh</span>
                  <span className="text-lg">👋</span>
                </div>

                {/* Main Heading with Blue-Purple Gradient Text */}
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-3 text-center">
                  How can I{' '}
                  <span className="bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    help you
                  </span>{' '}
                  today?
                </h1>

                {/* Subtitle */}
                <p className="text-xs sm:text-sm text-slate-500 max-w-md text-center font-normal mb-8 leading-relaxed">
                  Ask anything, write code, solve problems, or create something amazing.
                </p>

                {/* Large Responsive AI Chat Input */}
                <div className="w-full max-w-3xl mb-8">
                  <PromptBar onSubmit={handlePromptSubmit} isLoading={isLoading} onStop={handleStopGeneration} mode={mode} setMode={setMode} />
                </div>

                {/* 4 Feature Suggestion Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full max-w-4xl">
                  {/* Card 1: Build a website */}
                  <div
                    onClick={() => handlePromptSubmit('Build a modern, responsive website with React + Tailwind', 'gemini-1.5-flash', 'build')}
                    className="p-4 rounded-2xl bg-white hover:bg-indigo-50/50 border border-slate-200/90 hover:border-indigo-200 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer group text-left flex flex-col justify-between"
                  >
                    <div className="flex items-center space-x-2.5 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 group-hover:scale-105 transition-transform">
                        <Globe className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors">
                        Build a website
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Create a modern, responsive website with React + Tailwind.
                    </p>
                  </div>

                  {/* Card 2: Analyze a document */}
                  <div
                    onClick={() => handlePromptSubmit('Analyze this document and provide a summary with key insights', 'gemini-1.5-flash', 'chat')}
                    className="p-4 rounded-2xl bg-white hover:bg-purple-50/50 border border-slate-200/90 hover:border-purple-200 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer group text-left flex flex-col justify-between"
                  >
                    <div className="flex items-center space-x-2.5 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100 group-hover:scale-105 transition-transform">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-xs text-slate-900 group-hover:text-purple-600 transition-colors">
                        Analyze a document
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Upload a PDF and get a summary with key insights.
                    </p>
                  </div>

                  {/* Card 3: Code & debug */}
                  <div
                    onClick={() => handlePromptSubmit('Write or debug Python code for data processing', 'gemini-1.5-flash', 'chat')}
                    className="p-4 rounded-2xl bg-white hover:bg-emerald-50/50 border border-slate-200/90 hover:border-emerald-200 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer group text-left flex flex-col justify-between"
                  >
                    <div className="flex items-center space-x-2.5 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 group-hover:scale-105 transition-transform">
                        <Code className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-xs text-slate-900 group-hover:text-emerald-600 transition-colors">
                        Code & debug
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Write or debug code in Python, JavaScript, or any language.
                    </p>
                  </div>

                  {/* Card 4: Create a project plan */}
                  <div
                    onClick={() => handlePromptSubmit('Create a comprehensive project plan with tasks and timeline', 'gemini-1.5-flash', 'chat')}
                    className="p-4 rounded-2xl bg-white hover:bg-amber-50/50 border border-slate-200/90 hover:border-amber-200 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer group text-left flex flex-col justify-between"
                  >
                    <div className="flex items-center space-x-2.5 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100 group-hover:scale-105 transition-transform">
                        <ClipboardList className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-xs text-slate-900 group-hover:text-amber-600 transition-colors">
                        Create a project plan
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Plan your next project with tasks and timeline.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Right Sidebar (Recent Activity, Quick Tools, Usage) */}
          <RightSidebar 
            onPromptAction={(p) => handlePromptSubmit(p, 'gemini-1.5-flash', mode)} 
            onUploadClick={() => {
              const fileInput = document.querySelector('input[type="file"]');
              if (fileInput) fileInput.click();
            }} 
          />

          {/* Sliding Code Canvas / Artifact Preview */}
          {showCanvas && activeSandboxId && (
            <ArtifactsCanvas
              sandboxId={activeSandboxId}
              onClose={() => setShowCanvas(false)}
            />
          )}

          {/* Agent Graph Panel */}
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
    </div>
  );
}
