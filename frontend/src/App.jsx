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
  const [routingInfo, setRoutingInfo] = useState(null);
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
      } catch (e) { }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('pixlexpert_user');
    localStorage.removeItem('active_thread_id');
    setUser(null);
    handleNewProject();
    try {
      import('./utils/supabase').then(({ supabase }) => {
        if (supabase) supabase.auth.signOut().catch(() => { });
      });
    } catch (e) { }
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
              if (payload.routing) {
                setRoutingInfo(payload.routing);
              }
              if (payload.sandbox && payload.sandbox.sandbox_id) {
                setActiveSandboxId(payload.sandbox.sandbox_id);
              }
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
        {/* Minimal Top Header Bar matching Reference UI */}
        <header className="h-14 border-b border-slate-200/70 px-4 sm:px-6 flex items-center justify-between bg-white z-20 shrink-0 gap-4">
          {/* Left: Sidebar Toggle Button & Wide Search Bar */}
          <div className="flex items-center space-x-3 flex-1 max-w-lg">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle Navigation Menu"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-all shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Clean Search Input with ⌘ K badge */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects, files, or ask anything..."
                className="w-full pl-9 pr-12 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-300 focus:bg-white transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                ⌘ K
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center space-x-3">
            {/* Sandbox App Toggle Button (when active chat sandbox exists) */}
            {activeSandboxId && (
              <button
                onClick={() => { setShowCanvas(!showCanvas); setShowGraph(false); }}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-all ${showCanvas ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{showCanvas ? 'Hide App' : 'View App'}</span>
              </button>
            )}

            {/* Clean User Profile Avatar */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-1 p-0.5 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center overflow-hidden">
                    {user.avatar ? (
                      <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      user.name?.charAt(0) || 'M'
                    )}
                  </div>
                </button>

                {/* Profile Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-fade-in space-y-1">
                    <div className="p-2 bg-slate-50 rounded-xl flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {user.name?.charAt(0) || 'M'}
                      </div>
                      <div className="truncate text-left leading-tight">
                        <div className="font-semibold text-xs text-slate-900 truncate">{user.name || 'Mukesh Singh'}</div>
                        <div className="text-[10px] text-slate-400 truncate">{user.email || 'mukesh@gmail.com'}</div>
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
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center"
              >
                M
              </button>
            )}
          </div>
        </header>

        {/* 3. Main Center Workspace Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative min-h-0 bg-[#f8fafc]">
          {hasContent ? (
            /* Active Conversation View */
            <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0 bg-white border-r border-slate-200/70 z-30">
              <div className="p-2 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between px-4">
                <span className="text-xs font-semibold text-slate-600">Active Chat</span>
                <button
                  type="button"
                  onClick={handleNewProject}
                  className="px-3 py-1 rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-all flex items-center space-x-1"
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
                routingInfo={routingInfo}
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
              <div className="p-3 sm:p-4 max-w-3xl mx-auto w-full">
                <PromptBar onSubmit={handlePromptSubmit} isLoading={isLoading} onStop={handleStopGeneration} mode={mode} setMode={setMode} />
              </div>
            </div>
          ) : (
            /* Welcome Hero View (Matching Reference UI Exactly) */
            <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10 max-w-4xl mx-auto w-full h-full overflow-y-auto">
              <div className="w-full flex flex-col items-center justify-center my-auto py-4">
                {/* Very minimal AI Sparkle icon above greeting (NO large colorful background) */}
                <div className="w-10 h-10 rounded-2xl bg-blue-50/80 border border-blue-100/60 flex items-center justify-center text-blue-500 mb-4 shadow-2xs">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                </div>

                {/* Elegant Greeting Heading */}
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-2 text-center">
                  Good morning, <span className="text-blue-600">Mukesh</span> 👋
                </h1>

                {/* Short Description */}
                <p className="text-xs sm:text-sm text-slate-500 text-center font-normal mb-8 max-w-md">
                  Ask me anything, write code, solve problems, or explore ideas.
                </p>

                {/* Centered Message Composer */}
                <div className="w-full max-w-2xl mb-8">
                  <PromptBar onSubmit={handlePromptSubmit} isLoading={isLoading} onStop={handleStopGeneration} mode={mode} setMode={setMode} />
                </div>

                {/* 4 Compact Action Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full max-w-3xl">
                  {/* Card 1: Write Code */}
                  <div
                    onClick={() => handlePromptSubmit('Write and debug Python code for data processing', 'gemini-1.5-flash', 'chat')}
                    className="p-3.5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 shadow-2xs transition-all duration-200 cursor-pointer group text-left flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 mb-2.5">
                        <Code className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="font-semibold text-xs text-slate-900 group-hover:text-blue-600 transition-colors mb-1">
                        Write Code
                      </h3>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Create, edit and debug code in your project.
                      </p>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Search className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  {/* Card 2: Analyze Document */}
                  <div
                    onClick={() => handlePromptSubmit('Analyze this document and extract key insights', 'gemini-1.5-flash', 'chat')}
                    className="p-3.5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 shadow-2xs transition-all duration-200 cursor-pointer group text-left flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 mb-2.5">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="font-semibold text-xs text-slate-900 group-hover:text-emerald-600 transition-colors mb-1">
                        Analyze Document
                      </h3>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Upload and get insights from your files.
                      </p>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Search className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  {/* Card 3: Solve Problem */}
                  <div
                    onClick={() => handlePromptSubmit('Help me solve this logic problem step by step', 'gemini-1.5-flash', 'chat')}
                    className="p-3.5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 shadow-2xs transition-all duration-200 cursor-pointer group text-left flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100 mb-2.5">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="font-semibold text-xs text-slate-900 group-hover:text-amber-600 transition-colors mb-1">
                        Solve Problem
                      </h3>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Get help with complex questions and logic.
                      </p>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Search className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  {/* Card 4: Research */}
                  <div
                    onClick={() => handlePromptSubmit('Search and research information on this topic', 'gemini-1.5-flash', 'chat')}
                    className="p-3.5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 shadow-2xs transition-all duration-200 cursor-pointer group text-left flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100 mb-2.5">
                        <Search className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="font-semibold text-xs text-slate-900 group-hover:text-purple-600 transition-colors mb-1">
                        Research
                      </h3>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Find information and explore topics.
                      </p>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Search className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Right Sidebar (Recent Chats & Sample Projects) */}
          <RightSidebar
            projects={projects}
            onSelectProject={handleSelectChat}
            onPromptAction={(p) => handlePromptSubmit(p, 'gemini-1.5-flash', mode)}
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
