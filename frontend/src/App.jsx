import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import ChatTimeline from './components/ChatTimeline';
import PromptBar from './components/PromptBar';
import ArtifactsCanvas from './components/ArtifactsCanvas';
import GraphCanvas from './components/GraphCanvas';
import AuthModal from './components/AuthModal';
import ProjectsModal from './components/ProjectsModal';
import KnowledgeModal from './components/KnowledgeModal';
import ToolsModal from './components/ToolsModal';
import SettingsModal from './components/SettingsModal';
import ProfileModal from './components/ProfileModal';
import { getCleanFilename } from './utils/fileUtils';
import {
  Menu,
  Layers,
  Sparkles,
  PanelLeft,
  PanelLeftClose,
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
  Plus,
  Settings
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

  // Active Sidebar Navigation Tab ('Chat' | 'Projects' | 'Knowledge' | 'Tools' | 'Settings')
  const [activeNav, setActiveNav] = useState('Chat');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('pixlexpert_theme');
  }, []);

  // Authentication State & Top Profile Dropdown State
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const searchInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Cmd + K Keyboard Shortcut listener for search focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const getGuestId = () => {
    let guestId = localStorage.getItem('pixlexpert_guest_id');
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('pixlexpert_guest_id', guestId);
    }
    return guestId;
  };

  const getAuthHeaders = (currentUser) => {
    const u = currentUser !== undefined ? currentUser : user;
    const token = u?.token || u?.access_token || localStorage.getItem('pixlexpert_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const uid = u?.id || getGuestId();
    headers['x-user-id'] = uid;
    return headers;
  };

  const handleLogout = () => {
    localStorage.removeItem('pixlexpert_user');
    localStorage.removeItem('pixlexpert_token');
    localStorage.removeItem('active_thread_id');
    localStorage.setItem('pixlexpert_guest_id', 'guest_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now());
    setUser(null);
    handleNewProject();
    fetchChatsAndRestore(null);
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
      const headers = getAuthHeaders(u);
      const uid = headers['x-user-id'];
      const url = `/api/chats?user_id=${encodeURIComponent(uid)}`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);

        // Auto-restore active thread or target first thread for this specific user
        const savedThreadId = localStorage.getItem(`active_thread_id_${uid}`) || localStorage.getItem('active_thread_id');
        const userThreadExists = data.some((p) => p.thread_id === savedThreadId);
        const targetThreadId = userThreadExists ? savedThreadId : (data.length > 0 ? data[0].thread_id : null);

        if (targetThreadId) {
          handleSelectChat(targetThreadId, u);
        } else {
          handleNewProject();
        }
      } else {
        setProjects([]);
        handleNewProject();
      }
    } catch (e) {
      console.error('Failed to fetch chat history', e);
      setProjects([]);
    }
  };

  const handleSelectChat = async (threadId, currentUser) => {
    try {
      const headers = getAuthHeaders(currentUser);
      const res = await fetch(`/api/chats/${threadId}`, { headers });
      const data = await res.json();
      if (data && data.thread_id) {
        setCurrentThreadId(data.thread_id);
        const uid = headers['x-user-id'];
        localStorage.setItem(`active_thread_id_${uid}`, data.thread_id);
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
      await fetch(`/api/chats/${threadId}`, { method: 'DELETE', headers: getAuthHeaders() });
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
        headers: getAuthHeaders(),
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
        const cleanPath = getCleanFilename(block.filename, block.language);

        return fetch(`/api/sandboxes/${newSandboxId}/file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: cleanPath, content: block.code })
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
    const headers = getAuthHeaders();
    const currentUserId = headers['x-user-id'];

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
        headers,
        body: JSON.stringify({
          thread_id: tId,
          title,
          messages: msgList,
          node_history: nHist,
          mode: mMode,
          user_id: currentUserId,
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
      const uid = getAuthHeaders()['x-user-id'];
      localStorage.setItem(`active_thread_id_${uid}`, activeThread);
      localStorage.setItem('active_thread_id', activeThread);
    }

    const newMsg = { role: 'user', content: promptText, attachments };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    if (selectedMode === 'build') {
      fetch('/api/projects/start', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ requirement: promptText, model: modelName }),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.thread_id) connectEventSource(data.thread_id);
        })
        .catch((e) => {
          console.warn('Background graph trace:', e);
        });
    }

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          messages: updatedMessages,
          model: modelName,
          thread_id: activeThread,
          mode: selectedMode,
          user_id: getAuthHeaders()['x-user-id']
        }),
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
        const errMsgs = [...updatedMessages, { role: 'assistant', content: '️ Network connection interrupted. Please click retry.' }];
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

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('pixlexpert_sidebar_width');
      return saved ? Math.max(200, Math.min(500, parseInt(saved, 10))) : 260;
    } catch (e) {
      return 260;
    }
  });

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
        onPromptAction={(p) => handlePromptSubmit(p, 'gemini-1.5-flash', mode)}
        activeNav={activeNav}
        onSelectNav={(nav) => setActiveNav(nav)}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative w-full min-w-0">
        {/* Minimal Professional Top Header Bar */}
        <header className="h-14 border-b border-slate-200/70 px-4 sm:px-6 flex items-center justify-between bg-white/90 backdrop-blur-md z-40 shrink-0 gap-3 relative">
          {/* Left: Expand Sidebar Button (only when sidebar is closed) & Session Title */}
          <div className="flex items-center space-x-3 shrink-0">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Expand Sidebar"
                className="p-1.5 rounded-xl border border-slate-200/70 hover:bg-slate-100 text-indigo-600 transition-all shrink-0 cursor-pointer shadow-2xs"
              >
                <PanelLeft className="w-4 h-4 text-indigo-600" />
              </button>
            )}

            {/* Active Session Status Title (No duplicate PixiExpert text!) */}
            <div className="hidden sm:flex items-center space-x-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span className="font-semibold text-slate-800 truncate max-w-[200px] md:max-w-[320px]">
                {currentThreadId
                  ? (projects.find(p => p.thread_id === currentThreadId)?.title || 'Active Chat')
                  : 'New Workspace'
                }
              </span>
            </div>
          </div>

          {/* Center: Search Command Bar with Cmd+K */}
          <div className="flex-1 max-w-md mx-2">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects, files, or ask anything..."
                className="w-full pl-9 pr-12 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                ⌘ K
              </kbd>
            </div>
          </div>

          {/* Right Header Quick Actions - Profile Section ONLY */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* ChatGPT-Style User Profile Avatar Button (ONLY Photo Avatar, No Name) */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-bold text-sm flex items-center justify-center overflow-hidden shadow-xs hover:ring-4 hover:ring-indigo-100 ring-2 ring-indigo-50 transition-all cursor-pointer shrink-0"
                title="Profile & Account Settings"
              >
                {user?.avatar && !user.avatar.includes('dicebear.com') ? (
                  <img src={user.avatar} alt="User Profile" className="w-full h-full object-cover" />
                ) : (
                  (user?.name?.trim()?.charAt(0) || user?.email?.trim()?.charAt(0) || 'M').toUpperCase()
                )}
              </button>

              {/* ChatGPT-Style Profile Dropdown Menu (Solid High-Contrast Readable Box) */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-[100] animate-fade-in space-y-1 text-slate-900 font-sans">
                  {/* User Profile Card */}
                  <div
                    onClick={() => {
                      setUserMenuOpen(false);
                      setActiveNav('Profile');
                    }}
                    className="p-2.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 rounded-xl flex items-center space-x-3 cursor-pointer transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                      {user?.avatar && !user.avatar.includes('dicebear.com') ? (
                        <img src={user.avatar} alt="User" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        (user?.name?.trim()?.charAt(0) || user?.email?.trim()?.charAt(0) || 'M').toUpperCase()
                      )}
                    </div>
                    <div className="truncate text-left leading-tight flex-1">
                      <div className="font-bold text-xs text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                        {user?.name || 'Mukesh Singh'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium truncate">{user?.email || 'mukesh@gmail.com'}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      PRO
                    </span>
                  </div>

                  {/* Navigation & Feature Links */}
                  <div className="space-y-0.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setActiveNav('Profile');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-800 hover:bg-slate-100 hover:text-indigo-600 transition-colors text-xs font-semibold cursor-pointer text-left"
                    >
                      <div className="flex items-center space-x-2.5">
                        <User className="w-4 h-4 text-slate-600 shrink-0" />
                        <span className="text-slate-800 font-semibold">My Account & Plan</span>
                      </div>
                      <Crown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setActiveNav('Settings');
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-slate-800 hover:bg-slate-100 hover:text-indigo-600 transition-colors text-xs font-semibold cursor-pointer text-left"
                    >
                      <Settings className="w-4 h-4 text-slate-600 shrink-0" />
                      <span className="text-slate-800 font-semibold">Settings</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setActiveNav('Projects');
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-slate-800 hover:bg-slate-100 hover:text-indigo-600 transition-colors text-xs font-semibold cursor-pointer text-left"
                    >
                      <Layers className="w-4 h-4 text-slate-600 shrink-0" />
                      <span className="text-slate-800 font-semibold">My Projects</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setActiveNav('Knowledge');
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-slate-800 hover:bg-slate-100 hover:text-indigo-600 transition-colors text-xs font-semibold cursor-pointer text-left"
                    >
                      <Sparkles className="w-4 h-4 text-slate-600 shrink-0" />
                      <span className="text-slate-800 font-semibold">Knowledge Base</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setActiveNav('Tools');
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-slate-800 hover:bg-slate-100 hover:text-indigo-600 transition-colors text-xs font-semibold cursor-pointer text-left"
                    >
                      <Activity className="w-4 h-4 text-slate-600 shrink-0" />
                      <span className="text-slate-800 font-semibold">Custom Tools</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-200/80 my-1"></div>

                  {/* Sign Out / Sign In Action */}
                  {user ? (
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setAuthModalOpen(true);
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer text-left"
                    >
                      <User className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Sign In / Register</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 3. Main Center Workspace Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative min-h-0 clean-ambient-bg">
          {hasContent ? (
            /* Active Conversation View */
            <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0 bg-white/90 backdrop-blur-md border-r border-slate-200/70 z-10">
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
              <div className="p-3 sm:p-4 max-w-3xl mx-auto w-full shrink-0">
                <PromptBar onSubmit={handlePromptSubmit} isLoading={isLoading} onStop={handleStopGeneration} mode={mode} setMode={setMode} />
              </div>
            </div>
          ) : (
            /* Welcome Hero View with Crisp Minimal Glassmorphic Aesthetics */
            <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10 max-w-4xl mx-auto w-full h-full overflow-y-auto">
              <div className="w-full flex flex-col items-center justify-center my-auto py-4">
                {/* Flowing Crisp Greeting */}
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-2 text-center">
                  Good morning, Mukesh
                </h1>

                {/* Short Description */}
                <p className="text-xs sm:text-sm text-slate-500 text-center font-normal mb-8 max-w-md">
                  Ask me anything, write code, solve problems, or explore ideas.
                </p>

                {/* Centered Message Composer */}
                <div className="w-full max-w-3xl mb-8">
                  <PromptBar onSubmit={handlePromptSubmit} isLoading={isLoading} onStop={handleStopGeneration} mode={mode} setMode={setMode} />
                </div>

                {/* 4 Clean Glassmorphic Action Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full max-w-3xl">
                  {/* Card 1: Write Code */}
                  <div
                    onClick={() => handlePromptSubmit('Write and debug Python code for data processing', 'gemini-1.5-flash', 'chat')}
                    className="clean-glass-card p-3.5 rounded-2xl cursor-pointer group text-left flex flex-col justify-between"
                  >
                    <div>
                      <Code className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors mb-2.5" />
                      <h3 className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors mb-1">
                        Write Code
                      </h3>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Create, edit and debug code in your project.
                      </p>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Search className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  {/* Card 2: Analyze Document */}
                  <div
                    onClick={() => handlePromptSubmit('Analyze this document and extract key insights', 'gemini-1.5-flash', 'chat')}
                    className="clean-glass-card p-3.5 rounded-2xl cursor-pointer group text-left flex flex-col justify-between"
                  >
                    <div>
                      <FileText className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors mb-2.5" />
                      <h3 className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors mb-1">
                        Analyze Document
                      </h3>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Upload and get insights from your files.
                      </p>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Search className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  {/* Card 3: Solve Problem */}
                  <div
                    onClick={() => handlePromptSubmit('Help me solve this logic problem step by step', 'gemini-1.5-flash', 'chat')}
                    className="clean-glass-card p-3.5 rounded-2xl cursor-pointer group text-left flex flex-col justify-between"
                  >
                    <div>
                      <Sparkles className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors mb-2.5" />
                      <h3 className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors mb-1">
                        Solve Problem
                      </h3>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Get help with complex questions and logic.
                      </p>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Search className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  {/* Card 4: Research */}
                  <div
                    onClick={() => handlePromptSubmit('Search and research information on this topic', 'gemini-1.5-flash', 'chat')}
                    className="clean-glass-card p-3.5 rounded-2xl cursor-pointer group text-left flex flex-col justify-between"
                  >
                    <div>
                      <Search className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors mb-2.5" />
                      <h3 className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors mb-1">
                        Research
                      </h3>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Find information and explore topics.
                      </p>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Search className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right Sidebar Widget for System Diagnostics, Quick Starters & Recent Chats */}
          {!showCanvas && !showGraph && (
            <RightSidebar
              projects={projects}
              onSelectProject={handleSelectChat}
              onPromptAction={(promptText) => handlePromptSubmit(promptText, 'gemini-1.5-flash', 'chat')}
            />
          )}

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
        onAuthSuccess={(userData) => {
          setUser(userData);
          handleNewProject();
          fetchChatsAndRestore(userData);
        }}
      />

      {/* Projects Explorer Modal */}
      <ProjectsModal
        isOpen={activeNav === 'Projects'}
        onClose={() => setActiveNav('Chat')}
        projects={projects}
        currentThreadId={currentThreadId}
        onSelectProject={(id) => {
          handleSelectChat(id);
          setActiveNav('Chat');
        }}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
        onNewProject={() => {
          handleNewProject();
          setActiveNav('Chat');
        }}
        onOpenCanvas={() => {
          setShowCanvas(true);
          setActiveNav('Chat');
        }}
      />

      {/* Knowledge Base Modal */}
      <KnowledgeModal
        isOpen={activeNav === 'Knowledge'}
        onClose={() => setActiveNav('Chat')}
        onPromptAction={(p) => {
          setActiveNav('Chat');
          handlePromptSubmit(p, 'gemini-1.5-flash', mode);
        }}
      />

      {/* Tools & Capabilities Modal */}
      <ToolsModal
        isOpen={activeNav === 'Tools'}
        onClose={() => setActiveNav('Chat')}
        onPromptAction={(p) => {
          setActiveNav('Chat');
          handlePromptSubmit(p, 'gemini-1.5-flash', mode);
        }}
      />

      {/* Settings & Configuration Modal */}
      <SettingsModal
        isOpen={activeNav === 'Settings'}
        onClose={() => setActiveNav('Chat')}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        tokenUsage={tokenUsage}
      />

      {/* Profile & Account Modal */}
      <ProfileModal
        isOpen={activeNav === 'Profile'}
        onClose={() => setActiveNav('Chat')}
        user={user}
        onUpdateUser={(updatedUser) => setUser(updatedUser)}
        onLogout={handleLogout}
        tokenUsage={tokenUsage}
      />
    </div>
  );
}
