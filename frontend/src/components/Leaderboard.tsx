import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, ArrowRight } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface LeaderboardPlayer {
  user_id: string;
  username: string;
  score: number;
  avatar?: string;
  round_points?: number;
}

interface LeaderboardProps {
  players: LeaderboardPlayer[];
  winner?: LeaderboardPlayer | null;
  runnerUp?: LeaderboardPlayer | null;
  isGameOver: boolean;
  roundNumber?: number;
  onLobbyReturn: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  players,
  winner,
  isGameOver,
  roundNumber,
  onLobbyReturn,
}) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // Massive Celebration View for Game Over
  if (isGameOver) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm overflow-hidden">
        {/* Simple CSS Fireworks/Confetti using multiple animated divs */}
        <div className="absolute inset-0 pointer-events-none opacity-50">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ top: '100%', left: `${Math.random() * 100}%`, scale: 0 }}
              animate={{
                top: `${Math.random() * 50}%`,
                scale: [0, 1, 0],
                opacity: [1, 1, 0]
              }}
              transition={{
                duration: Math.random() * 2 + 1,
                repeat: Infinity,
                delay: Math.random() * 2
              }}
              className={`absolute w-3 h-3 rounded-full ${['bg-amber-400', 'bg-pink-500', 'bg-indigo-500', 'bg-cyan-400'][i % 4]} shadow-[0_0_15px_currentColor]`}
            />
          ))}
        </div>

        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 flex flex-col items-center gap-8">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 50, damping: 10, duration: 1.5 }}
            className="flex flex-col items-center text-center"
          >
            <div className="w-48 h-48 rounded-full bg-amber-500/20 border-4 border-amber-400 shadow-[0_0_100px_rgba(251,191,36,0.5)] flex items-center justify-center text-[100px] mb-6 relative">
              <span className="absolute -top-6 text-5xl animate-bounce">👑</span>
              {winner?.avatar || '👤'}
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-widest text-shadow-lg mb-2 text-center break-words px-2">
              {winner?.username}
            </h1>
            <p className="text-lg md:text-2xl font-bold text-amber-400 text-center">GRAND CHAMPION • {winner?.score} PTS</p>
          </motion.div>

          <GlassCard className="w-full max-w-2xl bg-slate-900/80 border-slate-700/50 p-6 mt-8">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest text-center mb-4">Final Standings</h3>
            <div className="space-y-2">
              {sortedPlayers.map((player, idx) => (
                <div key={player.user_id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${idx === 0 ? 'bg-amber-500 text-slate-900' : idx === 1 ? 'bg-slate-300 text-slate-900' : 'bg-slate-800 text-slate-400'}`}>
                      #{idx + 1}
                    </span>
                    <span className="text-xl">{player.avatar || '👤'}</span>
                    <span className="text-sm font-bold text-slate-200">{player.username}</span>
                  </div>
                  <span className="text-lg font-black text-slate-300">{player.score} pts</span>
                </div>
              ))}
            </div>

            <button
              onClick={onLobbyReturn}
              className="w-full mt-6 py-4 rounded-xl font-black bg-indigo-600 hover:bg-indigo-500 text-white uppercase tracking-widest shadow-lg transition-all"
            >
              Return to Main Menu
            </button>
          </GlassCard>
        </div>
      </div>
    );
  }

  // Intermission / Round Standings View
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-black text-slate-100 uppercase tracking-wide">
          Round {roundNumber} Complete
        </h2>
        <p className="text-slate-400 text-xs font-semibold">
          Points awarded! Preparing next round...
        </p>
      </div>

      <GlassCard className="border-slate-800/60 shadow-[0_8px_30px_rgba(0,0,0,0.3)] p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[400px]">
            <thead>
              <tr className="bg-slate-900/60 border-b border-white/5">
                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Player</th>
                <th className="px-5 py-4 text-[10px] font-bold text-emerald-400 uppercase tracking-widest text-right">Round {roundNumber} Points</th>
                <th className="px-5 py-4 text-[10px] font-bold text-indigo-400 uppercase tracking-widest text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedPlayers.map((player, idx) => (
                <tr key={player.user_id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{player.avatar || '👤'}</span>
                      <span className="text-sm font-bold text-slate-200">{player.username}</span>
                      {idx === 0 && <Trophy className="w-4 h-4 text-amber-400 ml-2" />}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-sm font-black text-emerald-400">+{player.round_points || 0}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-sm font-black text-slate-100">{player.score}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <div className="flex items-center justify-center gap-1.5 text-slate-500 text-xs font-bold py-1 uppercase tracking-wider">
        <span>Loading next letter</span>
        <ArrowRight className="w-3.5 h-3.5 animate-bounce-right" />
      </div>
    </div>
  );
};
