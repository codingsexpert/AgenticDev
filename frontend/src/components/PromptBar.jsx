import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Layers, Database, ChevronDown, Cpu, MessageSquare, Wrench, Mic, MicOff, Volume2, Paperclip, X, FileText, Book, Image as ImageIcon } from 'lucide-react';

export default function PromptBar({ onSubmit, isLoading, mode, setMode }) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [selectedModel, setSelectedModel] = useState('gemini-flash-latest');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [dictationStatus, setDictationStatus] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const baseInputRef = useRef('');
  const timerIntervalRef = useRef(null);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const kbInputRef = useRef(null);
  const [isUploadingKb, setIsUploadingKb] = useState(false);

  // Close model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setModelDropdownOpen(false);
      }
    };

    if (modelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [modelDropdownOpen]);

  const startTimer = () => {
    setRecordingSeconds(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  useEffect(() => {
    return () => {
      stopTimer();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  const startFreshRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice dictation requires Google Chrome, Microsoft Edge, or Apple Safari browser.');
      setIsListening(false);
      isListeningRef.current = false;
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setDictationStatus('Listening... Speak now into mic');
        startTimer();
      };

      recognition.onresult = (event) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        if (fullTranscript) {
          const prefix = baseInputRef.current ? baseInputRef.current.trim() + ' ' : '';
          const newText = prefix + fullTranscript;
          setInput(newText);
          setDictationStatus('Live transcribing speech...');
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
          }
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech Recognition Event Note:', event.error);
        if (event.error === 'no-speech') {
          setDictationStatus('Listening... Speak now into mic');
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setDictationStatus('Microphone permission blocked. Please allow mic in browser settings.');
          isListeningRef.current = false;
          setIsListening(false);
          stopTimer();
        } else if (event.error !== 'aborted') {
          setDictationStatus(`Voice note: ${event.error}`);
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          // Restart fresh recognition instance on pause
          setTimeout(() => {
            if (isListeningRef.current) {
              startFreshRecognition();
            }
          }, 300);
        } else {
          setIsListening(false);
          setDictationStatus('');
          stopTimer();
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setIsListening(false);
      isListeningRef.current = false;
      stopTimer();
    }
  };

  const toggleListening = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice dictation requires Google Chrome, Microsoft Edge, or Apple Safari browser.');
      return;
    }

    if (isListening || isListeningRef.current) {
      isListeningRef.current = false;
      stopTimer();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      setDictationStatus('');
    } else {
      baseInputRef.current = input;
      isListeningRef.current = true;
      setDictationStatus('Requesting microphone access...');

      // Explicitly prompt browser for microphone permission via getUserMedia
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      } catch (micErr) {
        console.error('Microphone Permission Error:', micErr);
        alert('Microphone access is blocked! Please click the lock/camera icon in your browser URL bar and allow Microphone access.');
        setDictationStatus('Microphone access denied in browser.');
        isListeningRef.current = false;
        setIsListening(false);
        stopTimer();
        return;
      }

      startFreshRecognition();
    }
  };

  const models = [
    { id: 'gemini-flash-latest', label: 'Gemini Flash (Latest)', desc: 'Instant Speed & High Availability' },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', desc: 'Complex Multi-Agent Architecture' },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', desc: 'Standard Fast Model' },
    { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite', desc: 'Ultra-Fast Lightweight' },
  ];

  const presets = [
    { label: 'HTML/CSS Table', text: 'Create a single HTML webpage that displays a styled student table with 5 students data (ID, Name, Age, Course, Marks). Use only HTML and CSS.', icon: Layers, targetMode: 'build' },
    { label: 'FastAPI REST Server', text: 'Build a Python FastAPI REST backend server with CRUD endpoints for managing tasks with SQLite.', icon: Sparkles, targetMode: 'build' },
    { label: 'Supabase Web App', text: 'Build a task manager web app using FastAPI and Supabase database authentication.', icon: Database, targetMode: 'build' },
  ];

  const handleSubmit = (e) => {
    e?.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (err) {}
      setIsListening(false);
    }
    onSubmit(input.trim(), selectedModel, mode, attachments);
    setInput('');
    setAttachments([]);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachments(prev => [...prev, {
          name: file.name,
          type: file.type,
          size: file.size,
          data: event.target.result
        }]);
      };
      reader.readAsDataURL(file);
    });
    // Reset the input value so the same file can be selected again if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleKbUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    setIsUploadingKb(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    
    try {
      const res = await fetch('/api/kb/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(data.message);
      }
    } catch (err) {
      alert("Failed to upload to Knowledge Base.");
    }
    
    setIsUploadingKb(false);
    if (kbInputRef.current) kbInputRef.current.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const currentModelLabel = models.find((m) => m.id === selectedModel)?.label || 'Gemini 2.0 Flash';

  return (
    <div className="w-full max-w-3xl sm:max-w-4xl mx-auto px-3 sm:px-5 pb-3 sm:pb-6 pt-2 shrink-0">
      {/* Active Audio Dictation Wave Banner */}
      {isListening && (
        <div className="mb-3 px-3.5 py-2 bg-red-50/90 border border-red-100 rounded-xl flex items-center justify-between text-xs text-red-700 animate-fade-in shadow-sm">
          {/* Left Side: Pulsing Dot + Dictation Status */}
          <div className="flex items-center space-x-2.5 truncate pr-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
            </span>
            <span className="font-medium truncate">{dictationStatus || 'Listening... Speak into your mic'}</span>
          </div>

          {/* Right Side: REC MM:SS Timer Badge + Soundwave Animation */}
          <div className="flex items-center space-x-2.5 shrink-0">
            <span className="font-mono text-[11px] font-bold bg-red-100/90 text-red-900 px-2 py-0.5 rounded-md border border-red-200 shadow-sm flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
              <span>REC {formatTimer(recordingSeconds)}</span>
            </span>
            <div className="flex items-center space-x-1 h-4">
              <div className="w-1 bg-red-500 rounded-full h-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1 bg-red-500 rounded-full h-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1 bg-red-500 rounded-full h-full animate-bounce" />
              <div className="w-1 bg-red-500 rounded-full h-full animate-bounce [animation-delay:-0.4s]" />
            </div>
          </div>
        </div>
      )}

      {/* Mode Switcher Bar */}
      <div className="flex items-center justify-start mb-3 overflow-x-auto pb-1 no-scrollbar">
        {/* Triple Mode Switcher (Chat vs Reasoning vs Build) */}
        <div className="flex items-center bg-zinc-100/80 p-0.5 rounded-lg border border-zinc-200/80 text-xs font-medium shrink-0">
          <button
            type="button"
            onClick={() => setMode('chat')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all ${
              mode === 'chat' ? 'bg-white text-zinc-900 font-medium shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs sm:text-sm">Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('reasoning')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              mode === 'reasoning' ? 'bg-white text-amber-950 font-semibold shadow-xs border border-amber-200/80' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs sm:text-sm">Reasoning</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('build')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              mode === 'build' ? 'bg-white text-indigo-950 font-semibold shadow-xs border border-indigo-200/80' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs sm:text-sm">Build</span>
          </button>
        </div>
      </div>

      {/* Floating Prompt Box — Compact Sleek PixlExpert / Claude Style */}
      <form
        onSubmit={handleSubmit}
        className="bg-white/95 backdrop-blur-xl p-3 sm:p-4 rounded-3xl border border-indigo-100/90 shadow-[0_12px_40px_-8px_rgba(99,102,241,0.12)] focus-within:shadow-[0_20px_50px_-8px_rgba(99,102,241,0.22)] focus-within:border-indigo-400/80 transition-all duration-300 relative w-full"
      >
        {/* Attachments Preview Area */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5">
            {attachments.map((file, idx) => (
              <div key={idx} className="relative group flex items-center bg-slate-50 border border-slate-200/80 rounded-xl p-1.5 pr-2.5 shadow-xs animate-fade-in max-w-[180px]">
                {file.type.startsWith('image/') ? (
                  <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                    <img src={file.data} alt="preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-500 shrink-0 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="ml-2 overflow-hidden">
                  <p className="text-[10px] font-semibold text-slate-700 truncate w-full">{file.name}</p>
                  <p className="text-[9px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-slate-200 hover:bg-rose-500 hover:text-white text-slate-600 rounded-full flex items-center justify-center transition-colors shadow-xs opacity-0 group-hover:opacity-100"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start space-x-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-2xs">
            <Sparkles className="w-4 h-4 text-white fill-white" />
          </div>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message PixlExpert..."
            className="w-full bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none resize-none py-1 font-sans min-h-[36px] max-h-[160px] leading-relaxed"
          />
        </div>

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100/90 gap-2 flex-wrap sm:flex-nowrap">
          {/* Left Controls: Web & Tools dropdowns */}
          <div className="flex items-center space-x-2">
            {/* Web Search Dropdown Pill */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 border border-slate-200/80 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                <span className="text-sm">🌐</span>
                <span>Web</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {modelDropdownOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-64 bg-white border border-slate-200/90 rounded-2xl shadow-2xl shadow-slate-900/10 p-2 space-y-1 z-50 animate-fade-in">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1">Web Search Engine</div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m.id);
                        setModelDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex flex-col ${
                        selectedModel === m.id
                          ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-semibold text-xs">{m.label}</span>
                      <span className="text-[10px] text-slate-400">{m.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tools Dropdown Pill */}
            <button
              type="button"
              onClick={() => kbInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 border border-slate-200/80 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              <span className="text-sm">🛠️</span>
              <span>Tools</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          {/* Right Controls: Attachment + Microphone + Send */}
          <div className="flex items-center space-x-2 shrink-0 ml-auto">
            <input 
              type="file" 
              multiple 
              accept=".txt,.csv,.pdf,.docx,image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
            />
            
            <input 
              type="file" 
              multiple 
              accept=".txt,.csv,.pdf,.docx" 
              className="hidden" 
              ref={kbInputRef} 
              onChange={handleKbUpload} 
            />
            
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach File (Images, PDF, TXT, CSV, DOCX)"
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors border border-transparent hover:border-slate-200"
            >
              <Paperclip className="w-4 h-4 text-slate-500" />
            </button>

            {/* Voice Microphone Button */}
            <button
              type="button"
              onClick={toggleListening}
              title={isListening ? 'Listening... Click to stop recording' : 'Voice Dictation'}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'hover:bg-slate-100 text-slate-500 border border-transparent hover:border-slate-200'
              }`}
            >
              {isListening ? (
                <MicOff className="w-4 h-4 animate-pulse text-white" />
              ) : (
                <Mic className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={isLoading || (!input.trim() && attachments.length === 0)}
              className={`w-9 h-9 rounded-2xl transition-all duration-200 flex items-center justify-center ${
                (input.trim() || attachments.length > 0) && !isLoading
                  ? 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white hover:opacity-95 shadow-md shadow-indigo-500/30 active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4 text-white fill-white" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
