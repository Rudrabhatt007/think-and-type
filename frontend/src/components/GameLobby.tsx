import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, Copy, Check, Crown } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface Player {
  user_id: string;
  username: string;
  score: number;
  is_ready: boolean;
}

interface GameLobbyProps {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  onStartGame: () => void;
  currentUserId: string | null;
  hostId: string | null;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  roomCode,
  players,
  isHost,
  onStartGame,
  currentUserId,
  hostId,
}) => {
  const [copied, setCopied] = React.useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <GlassCard className="text-center py-6 border-slate-800/60 shadow-[0_8px_25px_rgba(0,0,0,0.2)]">
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">LOBBY ACCESS CODE</h2>
        <div className="flex items-center justify-center gap-3.5 mb-2.5">
          <span className="text-4xl font-black tracking-widest text-slate-100 bg-slate-950 px-4 py-1.5 rounded-xl border border-white/5 shadow-inner">
            {roomCode}
          </span>
          <button
            onClick={copyRoomCode}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/5 active:scale-95 transition-all text-slate-400 hover:text-slate-200"
            title="Copy Room Code"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-slate-400 text-xs font-semibold">Provide this code to other players on your network.</p>
      </GlassCard>

      <GlassCard className="border-slate-800/60 shadow-[0_8px_25px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-indigo-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Active Players</h3>
          </div>
          <span className="px-2.5 py-0.5 text-[10px] rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold uppercase tracking-wider">
            {players.length} Connected
          </span>
        </div>

        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {players.map((player, idx) => {
              const isMe = player.user_id === currentUserId;
              const isHostPlayer = player.user_id === hostId;
              return (
                <motion.div
                  key={player.user_id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2, delay: idx * 0.04 }}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isMe
                      ? 'bg-slate-950/70 border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.1)]'
                      : 'bg-slate-950/30 border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8.5 h-8.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center font-bold text-xs text-indigo-400">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      {isHostPlayer && (
                        <div className="absolute -top-1.5 -right-1.5 bg-amber-500/20 border border-amber-500/50 rounded-full p-0.5" title="Host">
                          <Crown className="w-2.5 h-2.5 text-amber-500 fill-amber-500/50" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        {player.username} 
                        {isMe && <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-bold uppercase tracking-wider">You</span>}
                        {isHostPlayer && <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold uppercase tracking-wider">Host</span>}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Points: <span className="text-slate-200">{player.score || 0}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Online</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </GlassCard>

      {isHost ? (
        <div className="space-y-2">
          <motion.button
            whileHover={players.length > 1 ? { scale: 1.01 } : {}}
            whileTap={players.length > 1 ? { scale: 0.99 } : {}}
            onClick={onStartGame}
            disabled={players.length < 2}
            className={`w-full py-4 md:py-3 rounded-xl font-bold flex items-center justify-center gap-2 border text-white transition-all uppercase tracking-wider text-sm md:text-xs h-14 md:h-11 ${
              players.length < 2
                ? 'bg-slate-900 border-slate-800/60 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500/30 shadow-[0_4px_12px_rgba(99,102,241,0.25)]'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            {players.length < 2 ? 'Waiting for players...' : 'Start Game Session'}
          </motion.button>
          {players.length < 2 && (
            <p className="text-[10px] text-slate-500 font-semibold text-center uppercase tracking-wider">
              At least 2 players are required to start
            </p>
          )}
        </div>
      ) : (
        <GlassCard className="text-center py-3.5 border-dashed border-indigo-500/20 bg-indigo-950/5">
          <p className="text-slate-400 text-xs font-semibold flex items-center justify-center gap-2 tracking-wide">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Waiting for the host to launch game...
          </p>
        </GlassCard>
      )}
    </div>
  );
};

