import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Settings, ShieldAlert } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { authApi, gamesApi } from '../api';

interface HomeProps {
  onJoinRoom: (roomCode: string, isHost: boolean) => void;
  onOpenAdmin: () => void;
}

const AVATARS = ['👨‍🔧', '🍄', '🪖', '🍳', '💣', '🗡️', '🥷', '👾', '🤖', '🦸‍♂️', '🦹‍♂️', '🧙‍♂️', '🧟', '🕹️', '🎮'];

export const Home: React.FC<HomeProps> = ({ onJoinRoom, onOpenAdmin }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Game Creation settings
  const [showSettings, setShowSettings] = useState(false);
  const [totalRounds, setTotalRounds] = useState(15);
  const [excludeU, setExcludeU] = useState(false);
  const [roundDuration, setRoundDuration] = useState(15);

  // Admin access control states
  const [activeTab, setActiveTab] = useState<'player' | 'admin'>('player');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // UI state
  const [showForm, setShowForm] = useState(false);

  const handleAdminLogin = () => {
    setError('');
    if (adminUsername.trim() === 'admin' && (adminPassword === 'admin' || adminPassword === 'admin123')) {
      onOpenAdmin();
    } else {
      setError('Invalid admin credentials.');
    }
  };

  const handleGuestLogin = async (): Promise<string> => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      throw new Error('Both First Name and Last Name are required.');
    }
    const combinedName = `${fn} ${ln}`;
    const res = await authApi.loginGuest(combinedName, avatar);
    localStorage.setItem('think_type_token', res.access_token);
    localStorage.setItem('think_type_username', combinedName);
    localStorage.setItem('think_type_avatar', avatar);
    return res.access_token;
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!roomCodeInput.trim() || roomCodeInput.trim().length !== 6) {
        throw new Error('Room code must be exactly 6 characters.');
      }
      await handleGuestLogin();
      const code = roomCodeInput.trim().toUpperCase();
      const gameState = await gamesApi.joinGame(code);
      const currentToken = localStorage.getItem('think_type_token');
      let isHost = false;
      if (currentToken) {
        try {
          const payload = JSON.parse(atob(currentToken.split('.')[1]));
          isHost = payload.sub === gameState.game.host_id;
        } catch (_) {}
      }
      onJoinRoom(code, isHost);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to join room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      
      {/* Topbar */}
      <div className="absolute top-0 left-0 w-full p-4 md:p-6 flex flex-row justify-between items-center z-20 gap-2">
        <div className="flex gap-2 md:gap-3 items-center font-black text-sm md:text-lg text-white font-['Poppins'] tracking-tight">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center text-lg md:text-xl bg-gradient-to-br from-emerald-400 to-blue-400 shadow-[0_8px_20px_rgba(16,217,160,0.4)]">
            ⚡
          </div>
          <span className="hidden sm:inline">Think&Type</span>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="font-bold cursor-pointer text-indigo-950 px-4 md:px-5 py-2 md:py-2.5 text-xs md:text-sm rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-[0_8px_22px_rgba(255,209,102,0.45)] hover:-translate-y-0.5 hover:scale-105 transition-all"
        >
          {activeTab === 'admin' ? '🛡️ Admin Panel' : '🏆 Join Lobby'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!showForm ? (
          <motion.section 
            key="hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="text-center pt-20 md:pt-24 pb-8 md:pb-12 z-10 px-4"
          >
            <div className="inline-flex gap-2 items-center font-semibold text-xs md:text-sm text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-4 md:mb-6">
              ✨ Multiplayer Word Battle
            </div>
            
            <h1 className="font-['Poppins'] font-black text-[clamp(40px,12vw,120px)] leading-[1] md:leading-[0.95] tracking-tighter mb-4 md:mb-6 select-none">
              <span className="bg-gradient-to-br from-purple-300 to-purple-500 bg-clip-text text-transparent inline-block">Think</span> 
              <span className="text-amber-400 inline-block text-[0.7em] align-[0.06em] mx-2 md:mx-4 drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]">&amp;</span> 
              <br className="sm:hidden" />
              <span className="bg-gradient-to-br from-emerald-200 to-emerald-400 bg-clip-text text-transparent inline-block">Type</span>
            </h1>
            
            <p className="max-w-xl mx-auto text-slate-300/80 text-[clamp(14px,2.2vw,18px)] font-light leading-relaxed mb-8 md:mb-10 px-2">
              One letter. Four categories. Ten seconds to vote. How fast can your brain spark a Name, Animal, Place, and Thing?
            </p>
            
            <div className="mt-6 md:mt-8">
              <button 
                onClick={() => setShowForm(true)}
                className="relative font-black text-lg md:text-xl text-indigo-950 px-8 md:px-12 py-4 md:py-5 rounded-[16px] md:rounded-[20px] bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-[0_16px_40px_rgba(16,217,160,0.5),inset_0_-4px_0_rgba(0,0,0,0.12)] hover:-translate-y-1 hover:scale-105 transition-transform active:translate-y-1"
              >
                <span className="absolute -inset-1 rounded-[24px] -z-10 bg-[conic-gradient(from_0deg,var(--emerald),var(--purple),var(--pink),var(--emerald))] blur-[14px] opacity-60 animate-[spin_5s_linear_infinite]" />
                ▶ Play Now
              </button>
            </div>
          </motion.section>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md mt-16 z-10"
          >
            <div className="flex gap-2 p-1 bg-slate-900/60 rounded-xl border border-white/5 mb-6 backdrop-blur-md">
              <button
                onClick={() => setActiveTab('player')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg uppercase tracking-widest transition-all ${
                  activeTab === 'player'
                    ? 'bg-indigo-600 text-white shadow-[0_2px_10px_rgba(99,102,241,0.3)]'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                Guest Login
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg uppercase tracking-widest transition-all ${
                  activeTab === 'admin'
                    ? 'bg-emerald-600 text-white shadow-[0_2px_10px_rgba(16,217,160,0.3)]'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                Admin Login
              </button>
            </div>

            {error && (
              <div className="p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                {error}
              </div>
            )}

            {activeTab === 'admin' ? (
              <GlassCard className="border-emerald-500/20 shadow-[0_8px_30px_rgba(16,217,160,0.1)]">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Admin ID</label>
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="Enter Admin ID"
                      className="w-full px-4 py-3 rounded-xl border border-white/5 text-slate-100 bg-slate-950/60 focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,217,160,0.15)] outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Access Key</label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-xl border border-white/5 text-slate-100 bg-slate-950/60 focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,217,160,0.15)] outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={handleAdminLogin}
                    className="w-full py-4 md:py-3.5 mt-2 rounded-xl font-black bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 border border-emerald-400/50 text-indigo-950 flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(16,217,160,0.3)] uppercase tracking-widest text-sm"
                  >
                    Authenticate
                  </button>
                </div>
              </GlassCard>
            ) : (
              <GlassCard className="border-indigo-500/20 shadow-[0_8px_30px_rgba(99,102,241,0.15)]">
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">First Name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        className="w-full px-4 py-3 rounded-xl border border-white/5 text-slate-100 font-bold bg-slate-950/60 focus:border-indigo-500 focus:shadow-[0_0_15px_rgba(99,102,241,0.15)] outline-none transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Last Name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        className="w-full px-4 py-3 rounded-xl border border-white/5 text-slate-100 font-bold bg-slate-950/60 focus:border-indigo-500 focus:shadow-[0_0_15px_rgba(99,102,241,0.15)] outline-none transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                      Choose Character
                    </label>
                    <div className="flex flex-wrap gap-2 justify-center bg-slate-950/40 p-3 rounded-xl border border-white/5">
                      {AVATARS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setAvatar(emoji)}
                          className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                            avatar === emoji
                              ? 'bg-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-110 border border-indigo-400/50'
                              : 'bg-white/5 hover:bg-white/10 opacity-70 hover:opacity-100 border border-transparent'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleJoinRoom} className="space-y-2 pt-2 border-t border-slate-800/60">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mt-2">
                      Join Lobby
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={roomCodeInput}
                        onChange={(e) => setRoomCodeInput(e.target.value)}
                        placeholder="CODE"
                        maxLength={6}
                        className="flex-1 w-full px-4 py-3 rounded-xl border border-white/5 text-slate-100 font-black text-center tracking-widest bg-slate-950/60 uppercase focus:border-indigo-500 focus:shadow-[0_0_15px_rgba(99,102,241,0.15)] outline-none transition-all text-sm"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full sm:w-auto px-6 md:px-8 py-3 rounded-xl font-bold bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 border border-indigo-400/30 text-white flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_20px_rgba(99,102,241,0.3)] text-sm md:text-xs uppercase tracking-wider h-12 md:h-auto"
                      >
                        Enter
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </div>
              </GlassCard>
            )}
            
            <button 
              onClick={() => setShowForm(false)}
              className="mt-6 mx-auto block text-xs md:text-sm font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest p-2"
            >
              ← Back to Home
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
