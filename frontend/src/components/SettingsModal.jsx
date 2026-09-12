import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  X, 
  Cpu, 
  Key, 
  ShieldCheck, 
  DollarSign, 
  User, 
  Sun, 
  Moon, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Save, 
  Sparkles,
  LogOut,
  Sliders,
  Lock,
  Rocket
} from 'lucide-react';
import { useToast } from './Toast';

export default function SettingsModal({
  isOpen,
  onClose,
  user,
  onOpenAuth,
  onLogout,
  tokenUsage
}) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('model'); // 'model' | 'guardrails' | 'budget' | 'account'

  // Model Settings State
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [langsmithApiKey, setLangsmithApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showLangsmithKey, setShowLangsmithKey] = useState(false);

  // Guardrail Settings State
  const [inputGuardrail, setInputGuardrail] = useState(true);
  const [executionGuardrail, setExecutionGuardrail] = useState(true);
  const [outputGuardrail, setOutputGuardrail] = useState(true);

  // Budget Settings State
  const [tokenBudget, setTokenBudget] = useState(2.0);
  
  // Deploy Settings State
  const [vercelToken, setVercelToken] = useState('');

  const [savedStatus, setSavedStatus] = useState(false);

  useEffect(() => {
    const savedApiKey = localStorage.getItem('pixlexpert_gemini_key') || '';
    const savedLangsmithKey = localStorage.getItem('pixlexpert_langsmith_key') || '';
    const savedModel = localStorage.getItem('pixlexpert_model') || 'gemini-1.5-flash';
    const savedBudget = localStorage.getItem('pixlexpert_budget') || '2.0';
    const savedVercelToken = localStorage.getItem('pixlexpert_vercel_token') || '';

    setGeminiApiKey(savedApiKey);
    setLangsmithApiKey(savedLangsmithKey);
    setSelectedModel(savedModel);
    setTokenBudget(parseFloat(savedBudget));
    setVercelToken(savedVercelToken);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    localStorage.setItem('pixlexpert_gemini_key', geminiApiKey);
    localStorage.setItem('pixlexpert_langsmith_key', langsmithApiKey);
    localStorage.setItem('pixlexpert_model', selectedModel);
    localStorage.setItem('pixlexpert_budget', tokenBudget.toString());
    localStorage.setItem('pixlexpert_vercel_token', vercelToken);

    try {
      await fetch('/api/memory/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_model: selectedModel,
          token_budget: tokenBudget,
          gemini_key: geminiApiKey,
          input_guardrail: inputGuardrail,
          output_guardrail: outputGuardrail
        })
      });
    } catch (err) {
      console.warn('Backend preferences sync note:', err);
    }

    setSavedStatus(true);
    toast.success('System preferences saved successfully!');
    setTimeout(() => {
      setSavedStatus(false);
      onClose();
    }, 800);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center justify-center shadow-2xs">
              <Settings className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                <span>System & AI Preferences</span>
                <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full">
                  Config
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Configure LLM models, API credentials, security guardrails, and token cost budget.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation & Body Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Tab Sidebar */}
          <div className="w-full md:w-60 border-r border-slate-100 bg-slate-50/70 p-3 space-y-1 shrink-0 overflow-x-auto md:overflow-y-auto">
            <button
              onClick={() => setActiveTab('model')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'model'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Cpu className="w-4 h-4 shrink-0" />
              <span>AI Model & API Key</span>
            </button>

            <button
              onClick={() => setActiveTab('guardrails')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'guardrails'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Security Guardrails</span>
            </button>

            <button
              onClick={() => setActiveTab('budget')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'budget'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-4 h-4 shrink-0" />
              <span>Token Budget & Usage</span>
            </button>

            <button
              onClick={() => setActiveTab('deploy')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'deploy'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Rocket className="w-4 h-4 shrink-0" />
              <span>Deploy Integration</span>
            </button>

            <button
              onClick={() => setActiveTab('account')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'account'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Account & Profile</span>
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
            {activeTab === 'model' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center space-x-2">
                    <span>LLM Model Engine</span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200/80 font-medium px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Select the foundational LLM powering PixiExpert multi-agent generation.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Recommended)', desc: 'Fastest reasoning & multi-agent tool execution.', badge: 'Default' },
                      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: '1M+ context window for large codebase refactoring.', badge: 'Deep Thinking' },
                      { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', desc: 'High accuracy code & architectural blueprint generation.', badge: 'Advanced Code' },
                      { id: 'gpt-4o', name: 'GPT-4o', desc: 'Omni multi-modal language model support.', badge: 'Multi-Modal' }
                    ].map((m) => (
                      <div
                        key={m.id}
                        onClick={() => setSelectedModel(m.id)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          selectedModel === m.id
                            ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-400'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-slate-900">{m.name}</span>
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            {m.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{m.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center space-x-2">
                    <Key className="w-4 h-4 text-amber-500" />
                    <span>Gemini API Key</span>
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Provide your Gemini API key from Google AI Studio. (Environment .env will be used if left blank).
                  </p>

                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-emerald-500" />
                    <span>LangSmith API Key (Optional)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Provide your LangSmith API key for tracing and monitoring agent graphs.
                  </p>

                  <div className="relative">
                    <input
                      type={showLangsmithKey ? 'text' : 'password'}
                      value={langsmithApiKey}
                      onChange={(e) => setLangsmithApiKey(e.target.value)}
                      placeholder="lsv2_pt_..."
                      className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLangsmithKey(!showLangsmithKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showLangsmithKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'guardrails' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Guardrails & Security Policies</span>
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    PixiExpert enforces multi-layer safety policies to ensure isolated & safe local code execution.
                  </p>

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 mb-0.5">Input Guardrail</h4>
                        <p className="text-[11px] text-slate-500">Sanitizes prompt injection attempts and malicious command inputs.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={inputGuardrail}
                        onChange={(e) => setInputGuardrail(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 mb-0.5">Execution Guardrail</h4>
                        <p className="text-[11px] text-slate-500">Enforces strict directory boundary checks inside `./sandboxes/`.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={executionGuardrail}
                        onChange={(e) => setExecutionGuardrail(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 mb-0.5">Output Guardrail</h4>
                        <p className="text-[11px] text-slate-500">Validates strict JSON schemas and redacts sensitive API keys.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={outputGuardrail}
                        onChange={(e) => setOutputGuardrail(e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'budget' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>Real-Time Account Balance & Billing</span>
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Your secure token budget managed via Stripe backend integration.
                  </p>

                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-emerald-950">Available Token Balance</span>
                      <span className="text-sm font-black text-emerald-600">
                        ${user?.token_budget != null ? user.token_budget.toFixed(2) : tokenBudget.toFixed(2)} USD
                      </span>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/billing/create-checkout', {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${localStorage.getItem('session_token')}` }
                            });
                            const data = await res.json();
                            if (res.ok && data.url) {
                              window.location.href = data.url;
                            } else {
                              toast.error(data.detail || "Failed to initiate Stripe Checkout");
                            }
                          } catch (e) {
                            toast.error("Failed to connect to billing server.");
                          }
                        }}
                        className="w-full flex justify-center items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Top up $10 with Stripe</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Total Lifetime Cost</h4>
                      <p className="text-[11px] text-slate-500">Tracked securely via backend</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-slate-600">
                      ${user?.total_cost != null ? user.total_cost.toFixed(4) : "0.0000"} USD
                    </span>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center space-x-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>User Profile & Supabase Auth</span>
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Manage your account details, sync project sessions, and handle authentication.
                  </p>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-sm overflow-hidden">
                        {user?.avatar && !user.avatar.includes('dicebear.com') ? (
                          <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          (user?.name?.trim()?.charAt(0) || user?.email?.trim()?.charAt(0) || 'M').toUpperCase()
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{user?.name || 'Mukesh Singh'}</h4>
                        <p className="text-xs text-slate-500">{user?.email || 'mukesh@gmail.com'}</p>
                      </div>
                    </div>

                    {user ? (
                      <button
                        onClick={onLogout}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    ) : (
                      <button
                        onClick={onOpenAuth}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Sign In</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'deploy' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 mb-1">
                    Deployment Integrations
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Connect your Vercel account to enable one-click deployments and live preview URLs directly in the dashboard.
                  </p>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                        <Rocket className="w-3.5 h-3.5 text-slate-500" />
                        <span>Vercel API Token</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={vercelToken}
                          onChange={(e) => setVercelToken(e.target.value)}
                          placeholder="Paste your Vercel token (e.g., k3y...)"
                          className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-sm font-mono transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Get your token from the <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">Vercel Dashboard</a>. We store this locally in your browser.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
          {savedStatus ? (
            <span className="text-xs font-semibold text-emerald-600 flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Settings saved successfully!</span>
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              Changes apply instantly to current session.
            </span>
          )}

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
