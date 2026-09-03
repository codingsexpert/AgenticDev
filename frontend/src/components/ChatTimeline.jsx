import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, Copy, Check, Volume2, VolumeX, ThumbsUp, ThumbsDown, RotateCw, Pencil, Send, X } from 'lucide-react';
import FormattedMessage from './FormattedMessage';

function UserMessageActions({ msg, onStartEdit, onRetry }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!msg?.content) return;
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedTime = React.useMemo(() => {
    const ts = msg?.timestamp ? new Date(msg.timestamp * 1000) : new Date();
    return ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [msg?.timestamp]);

  return (
    <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono mt-2.5 pt-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 justify-end pr-1.5">
      <span className="text-[11px] text-slate-400 font-sans font-medium tracking-tight mr-1">{formattedTime}</span>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          title="Retry / Resend Prompt"
          className="p-1 rounded-md hover:bg-slate-200/80 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      )}

      {onStartEdit && (
        <button
          type="button"
          onClick={onStartEdit}
          title="Edit Prompt"
          className="p-1 rounded-md hover:bg-slate-200/80 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        type="button"
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy Prompt'}
        className="p-1 rounded-md hover:bg-slate-200/80 text-slate-500 hover:text-slate-900 transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function MessageActions({ content, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'like' | 'dislike' | null

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel(); // Stop any ongoing speech
    const cleanText = content.replace(/```[\s\S]*?```/g, ' Code snippet omitted. ').replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleLike = () => {
    setFeedback((prev) => (prev === 'like' ? null : 'like'));
  };

  const handleDislike = () => {
    setFeedback((prev) => (prev === 'dislike' ? null : 'dislike'));
  };

  return (
    <div className="flex items-center space-x-1 pt-2 text-slate-400">
      {/* 1. Copy Icon */}
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy response'}
        className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-700 transition-colors"
      >
        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
      </button>

      {/* 2. Text-to-Speech Icon */}
      <button
        type="button"
        onClick={handleSpeak}
        title={speaking ? 'Stop reading' : 'Read aloud'}
        className={`p-1.5 rounded-lg transition-colors ${
          speaking ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100 hover:text-slate-700'
        }`}
      >
        {speaking ? <VolumeX className="w-4 h-4 text-indigo-600 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {/* 3. Thumbs Up Icon */}
      <button
        type="button"
        onClick={handleLike}
        title="Good response"
        className={`p-1.5 rounded-lg transition-colors ${
          feedback === 'like' ? 'text-indigo-600 bg-indigo-50' : 'hover:bg-slate-100 hover:text-slate-700'
        }`}
      >
        <ThumbsUp className="w-4 h-4" />
      </button>

      {/* 4. Thumbs Down Icon */}
      <button
        type="button"
        onClick={handleDislike}
        title="Bad response"
        className={`p-1.5 rounded-lg transition-colors ${
          feedback === 'dislike' ? 'text-rose-600 bg-rose-50' : 'hover:bg-slate-100 hover:text-slate-700'
        }`}
      >
        <ThumbsDown className="w-4 h-4" />
      </button>

      {/* 5. Regenerate Icon */}
      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          title="Regenerate response"
          className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function ChatTimeline({
  messages = [],
  nodeHistory = [],
  pmQuestions = [],
  streamingText = '',
  isLoading = false,
  activeSandboxId,
  onAnswerQuestions,
  onRegenerate,
  onOpenCodeBlock,
  onOpenArtifacts,
  onQuickAction,
  onPromptSubmit,
}) {
  const [answers, setAnswers] = React.useState({});
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState('');
  const chatEndRef = useRef(null);

  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeQuestions = Array.isArray(pmQuestions) ? pmQuestions : [];

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [safeMessages.length, streamingText, safeQuestions.length]);

  const handleAnswerSubmit = (e) => {
    e?.preventDefault();
    if (onAnswerQuestions) {
      onAnswerQuestions(answers);
    }
  };

  const handleSaveEdit = (idx) => {
    if (!editText.trim()) return;
    if (onRegenerate) {
      // Re-dispatch updated prompt
      onRegenerate(idx, editText.trim());
    }
    setEditingIdx(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 pb-28 space-y-6 max-w-3xl sm:max-w-4xl mx-auto w-full scroll-smooth px-3 sm:px-5">
      {/* Messages Stream — Clean Claude & ChatGPT Style */}
      {safeMessages.map((msg, idx) => (
        <div key={idx} className="w-full">
          {msg.role === 'user' ? (
            /* User Message Bubble with Claude-style Hover Actions (Timestamp, Retry, Edit, Copy) */
            <div className="group flex flex-col items-end justify-end ml-auto w-full animate-fade-in">
              {editingIdx === idx ? (
                /* Inline Edit Box Mode */
                <div className="w-full max-w-[90%] sm:max-w-[85%] bg-white p-3 rounded-2xl border border-zinc-300 shadow-lg space-y-2">
                  <textarea
                    rows={2}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-zinc-50 text-zinc-900 text-sm p-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-zinc-400 font-sans resize-none"
                  />
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setEditingIdx(null)}
                      className="px-3 py-1 rounded-lg text-xs font-medium text-zinc-500 hover:bg-zinc-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(idx)}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-sm transition-all"
                    >
                      Save & Submit
                    </button>
                  </div>
                </div>
              ) : (
                /* Standard Display Bubble */
                <div className="flex flex-col items-end max-w-[85%] sm:max-w-[80%]">
                  <div className="bg-zinc-100 text-zinc-900 px-5 py-3.5 rounded-[22px] rounded-tr-[4px] text-base leading-relaxed font-sans font-normal border border-zinc-200/50 w-full shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                    <FormattedMessage
                      content={msg.content}
                      isUser={true}
                      activeSandboxId={activeSandboxId}
                      onOpenCodeBlock={onOpenCodeBlock}
                      onQuickAction={onQuickAction}
                    />
                  </div>
                  {/* Claude Hover Toolbar */}
                  <UserMessageActions
                    msg={msg}
                    onStartEdit={() => {
                      setEditingIdx(idx);
                      setEditText(msg.content);
                    }}
                    onRetry={() => {
                      if (onRegenerate) onRegenerate(idx, msg.content);
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            /* Assistant Message Response — Seamless & Borderless like Claude / ChatGPT */
            <div className="flex flex-col items-start mr-auto w-full animate-fade-in py-1 max-w-full overflow-hidden">
              <div className="text-[15px] sm:text-base text-zinc-800 leading-relaxed font-sans w-full break-words whitespace-pre-wrap">
                <FormattedMessage content={msg.content} activeSandboxId={activeSandboxId} onOpenCodeBlock={onOpenCodeBlock} onQuickAction={onQuickAction} />
              </div>
              <MessageActions
                content={msg.content}
                onRegenerate={onRegenerate ? () => onRegenerate(idx) : null}
              />
            </div>
          )}
        </div>
      ))}

      {/* Build Progress Timeline (Only visible while building before sandbox is ready) */}
      {nodeHistory && nodeHistory.length > 0 && !activeSandboxId && (
        <div className="flex flex-col items-start mr-auto w-full max-w-[85%] sm:max-w-[80%] my-2 animate-fade-in">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 ml-1">AI Dev Team Progress</div>
          <div className="bg-white border border-zinc-200 rounded-xl p-3 sm:p-4 shadow-sm w-full space-y-3">
            {nodeHistory.map((hist, i) => (
              <div key={i} className="flex items-center space-x-3 text-sm text-zinc-700">
                <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-emerald-600" />
                </div>
                <span className="capitalize font-medium">{hist.node.replace('_', ' ')} phase completed</span>
              </div>
            ))}
            <div className="flex items-center space-x-3 text-sm text-zinc-500 mt-2 bg-zinc-50 p-2 rounded-lg border border-zinc-100">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-indigo-500 rounded-full animate-spin" />
              </div>
              <span className="animate-pulse">Working on next phase...</span>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Streaming AI Response */}
      {streamingText && (
        <div className="flex items-start mr-auto w-full animate-fade-in py-1">
          <div className="text-[15px] sm:text-base text-zinc-800 leading-relaxed font-sans relative w-full">
            <FormattedMessage content={streamingText} activeSandboxId={activeSandboxId} onOpenCodeBlock={onOpenCodeBlock} onQuickAction={onQuickAction} />
            <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse ml-1 align-middle rounded-sm"></span>
          </div>
        </div>
      )}

      {/* Thinking Animation */}
      {isLoading && !streamingText && nodeHistory.length === 0 && (
        <div className="flex items-start mr-auto w-full animate-fade-in py-2">
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 flex items-center space-x-1.5 w-fit shadow-sm">
             <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
             <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
             <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></div>
          </div>
        </div>
      )}

      {/* Interactive PM Q&A Form Widget */}
      {safeQuestions.length > 0 && (
        <div className="flex items-start space-x-3 animate-fade-in max-w-2xl mt-4">
          <div className="w-8 h-8 rounded-[10px] bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-[20px] border border-amber-200 shadow-lg shadow-amber-900/5 w-full">
            <div className="flex items-center space-x-2 text-[13px] font-semibold text-amber-800 mb-3 tracking-wide uppercase">
              <span>Clarification Needed</span>
            </div>
            <form onSubmit={handleAnswerSubmit} className="space-y-4">
              {safeQuestions.map((q, qIdx) => (
                <div key={qIdx} className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700 block">{qIdx + 1}. {q}</label>
                  <input
                    type="text"
                    onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })}
                    placeholder="Type your answer..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-50 transition-all shadow-sm"
                  />
                </div>
              ))}
              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 mt-2 rounded-xl text-sm font-semibold transition-all shadow-md shadow-amber-500/20 active:scale-[0.99]"
              >
                Submit Answers
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Clear Bottom Spacer & Scroll Target Anchor */}
      <div ref={chatEndRef} className="h-6 w-full shrink-0" />
    </div>
  );
}
