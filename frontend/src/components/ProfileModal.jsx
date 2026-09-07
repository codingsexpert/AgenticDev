import React, { useState } from 'react';
import {
  User,
  Mail,
  Crown,
  Shield,
  Zap,
  Activity,
  CheckCircle2,
  Key,
  Sparkles,
  X,
  Edit2,
  Save,
  CreditCard,
  Lock,
  Smartphone,
  LogOut
} from 'lucide-react';

export default function ProfileModal({ isOpen, onClose, user, onUpdateUser, onLogout, tokenUsage }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('account'); // 'account' | 'subscription' | 'usage' | 'security'
  const [isEditing, setIsEditing] = useState(false);

  // Form fields
  const [name, setName] = useState(user?.name || 'Mukesh Singh');
  const [email, setEmail] = useState(user?.email || 'mukesh@gmail.com');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [plan, setPlan] = useState(user?.plan || 'Pro Member');
  const [apiKey, setApiKey] = useState(user?.apiKey || 'sk-pixl-********************');
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    const updated = {
      ...user,
      name,
      email,
      avatar,
      plan,
      apiKey
    };
    if (onUpdateUser) {
      onUpdateUser(updated);
    }
    localStorage.setItem('pixlexpert_user', JSON.stringify(updated));
    setIsEditing(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div 
        className="bg-white border border-slate-200/80 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-800 border border-slate-200/80 font-bold text-base flex items-center justify-center shadow-2xs">
              {avatar ? (
                <img src={avatar} alt="Profile" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                name?.charAt(0) || 'M'
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <span>{name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center space-x-1 shadow-2xs">
                  <Crown className="w-3 h-3 text-slate-600 inline" />
                  <span>{plan}</span>
                </span>
              </h2>
              <p className="text-xs text-slate-500">{email}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs (ChatGPT Settings Style) */}
        <div className="flex border-b border-slate-200/80 px-6 bg-slate-50/30 overflow-x-auto">
          <button
            onClick={() => setActiveTab('account')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'account'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Account Details</span>
          </button>

          <button
            onClick={() => setActiveTab('subscription')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'subscription'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-slate-500" />
            <span>Plan & Subscription</span>
          </button>

          <button
            onClick={() => setActiveTab('usage')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'usage'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Usage & Tokens</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Security & Keys</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isSaved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center space-x-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Profile settings saved successfully!</span>
            </div>
          )}

          {/* TAB 1: Account Details */}
          {activeTab === 'account' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Personal Profile</h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Cancel Editing' : 'Edit Profile'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    disabled={!isEditing}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Avatar Image URL</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://example.com/my-avatar.png"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              {isEditing && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              )}
            </form>
          )}

          {/* TAB 2: Plan & Subscription */}
          {activeTab === 'subscription' && (
            <div className="space-y-5">
              {/* Current Active Plan Banner */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Crown className="w-5 h-5 text-indigo-400" />
                    <span className="font-bold text-sm tracking-wide">PixiExpert Pro Plan</span>
                    <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 rounded-full font-semibold border border-emerald-500/30">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">Unlimited AI chats, full code artifact generation, custom agent tools & high priority speed.</p>
                </div>

                <button
                  type="button"
                  onClick={() => alert('You are on the highest tier plan! (Pro Tier Active)')}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs rounded-xl border border-slate-200/80 shadow-2xs transition-all shrink-0 cursor-pointer"
                >
                  Manage Plan
                </button>
              </div>

              {/* Plan Comparison List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs text-slate-700">Free Tier</h4>
                    <span className="text-xs text-slate-400">\$0 / mo</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Standard response speed</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Gemini 1.5 Flash access</span>
                    </li>
                    <li className="flex items-center space-x-2 text-slate-400 line-through">
                      <X className="w-3.5 h-3.5 text-slate-300" />
                      <span>Priority execution & Artifacts</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl border border-slate-300 bg-slate-50/50 space-y-3 relative">
                  <span className="absolute -top-2.5 right-4 px-2 py-0.5 bg-slate-900 text-white font-bold text-[9px] rounded-full uppercase tracking-wider shadow-2xs">
                    Current Plan
                  </span>
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs text-slate-900">Pro Plus Tier</h4>
                    <span className="text-xs font-bold text-slate-700">\$20 / mo</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700">
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
                      <span>Ultra Fast AI Response</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
                      <span>Advanced Reasoning & Code Generation</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
                      <span>Custom Tools, Skills & Files Upload</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Usage & Stats */}
          {activeTab === 'usage' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Current Session Usage Metrics</h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Input Tokens</div>
                  <div className="text-xl font-extrabold text-indigo-600">
                    {(tokenUsage?.totalInput || 1240).toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Output Tokens</div>
                  <div className="text-xl font-extrabold text-emerald-600">
                    {(tokenUsage?.totalOutput || 3820).toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Est. Cost</div>
                  <div className="text-xl font-extrabold text-slate-800">
                    \${(tokenUsage?.estimatedCost || 0.0024).toFixed(4)}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center space-x-3 text-xs text-indigo-900">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
                <p>Your subscription includes unlimited quota under fair usage guidelines. Token counters auto-reset every billing cycle.</p>
              </div>
            </div>
          )}

          {/* TAB 4: Security & Keys */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">API Keys & Authentication</h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                  <span>Custom OpenAI / Gemini API Key</span>
                  <span className="text-[10px] text-slate-400">(Optional override)</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full pl-9 pr-24 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsSaved(true);
                      setTimeout(() => setIsSaved(false), 2000);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] bg-slate-200 hover:bg-slate-300 font-semibold text-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Save Key
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Account Security</div>
                  <div className="text-[11px] text-slate-500">2-Factor authentication active for this session</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onLogout) onLogout();
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs">
          <span className="text-slate-400 font-medium">PixiExpert AI Studio v2.5</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
