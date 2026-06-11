import React from 'react';
import { AlertCircle, ThumbsUp, ThumbsDown, ShieldAlert, Check } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface Submission {
  id: string;
  user_id: string;
  username: string;
  category: string;
  answer_text: string;
  is_valid: boolean;
}

interface Challenge {
  id: string;
  target_user_id: string;
  target_username: string;
  category: string;
  answer_text: string;
  yes_votes: number;
  no_votes: number;
  status: string;
}

interface Player {
  user_id: string;
  username: string;
  score: number;
  is_ready: boolean;
  avatar?: string;
}

interface ChallengePanelProps {
  submissions: Submission[];
  challenges: Challenge[];
  players: Player[];
  timeRemaining: number;
  currentUserId: string | null;
  onChallenge: (targetUserId: string, category: string, answerText: string) => void;
  onVote: (challengeId: string, vote: boolean) => void;
  votedChallengeIds: string[];
}

export const ChallengePanel: React.FC<ChallengePanelProps> = ({
  submissions,
  challenges,
  players,
  timeRemaining,
  currentUserId,
  onChallenge,
  onVote,
  votedChallengeIds,
}) => {
  const categories = ['name', 'place', 'animal', 'thing'] as const;

  // Pivot submissions by user_id
  const userSubmissions: Record<string, Record<string, Submission>> = {};
  submissions.forEach(sub => {
    if (!userSubmissions[sub.user_id]) {
      userSubmissions[sub.user_id] = {};
    }
    userSubmissions[sub.user_id][sub.category] = sub;
  });

  const getChallenge = (userId: string, category: string) => {
    return challenges.find(c => c.target_user_id === userId && c.category === category);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-200 uppercase tracking-wide">Audit Phase</h2>
          <p className="text-slate-400 text-xs font-semibold">Review answers and veto errors. Click an answer to challenge.</p>
        </div>
        
        {/* Timer Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-xs uppercase tracking-wider self-start md:self-auto">
          <AlertCircle className="w-4 h-4 animate-pulse" />
          <span>Veto Time: {timeRemaining}s</span>
        </div>
      </div>

      <GlassCard className="w-full overflow-hidden p-0 border-slate-800/60 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
        <div className="overflow-x-auto w-full max-w-[100vw]">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-slate-900/60 border-b border-white/5">
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-1/5">Player</th>
                {categories.map(cat => (
                  <th key={cat} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[20%]">{cat}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {players.map(player => {
                const subs = userSubmissions[player.user_id] || {};
                const isMe = player.user_id === currentUserId;

                return (
                  <tr key={player.user_id} className={`transition-colors hover:bg-white/[0.02] ${isMe ? 'bg-indigo-950/10' : ''}`}>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-lg shadow-inner">
                          {player.avatar || '👤'}
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-200 block truncate max-w-[100px]">
                            {player.username}
                          </span>
                          {isMe && <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block">You</span>}
                        </div>
                      </div>
                    </td>

                    {categories.map(cat => {
                      const sub = subs[cat];
                      const chal = getChallenge(player.user_id, cat);
                      const hasVoted = chal ? votedChallengeIds.includes(chal.id) : false;
                      const answerText = sub?.answer_text;

                      return (
                        <td key={cat} className="px-3 py-3 align-top border-l border-white/5 relative group">
                          {answerText ? (
                            <div className="flex flex-col gap-2 h-full justify-between">
                              <span className={`text-sm font-semibold truncate block ${chal ? 'text-red-300' : 'text-slate-100'}`}>
                                "{answerText}"
                              </span>

                              {chal ? (
                                <div className="space-y-2 mt-2 pt-2 border-t border-red-500/10">
                                  <div className="flex items-center gap-1 text-[9px] font-bold text-red-400 uppercase">
                                    <ShieldAlert className="w-3 h-3" /> Vetoed
                                  </div>
                                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase text-slate-400">
                                    <span className="flex items-center gap-0.5 text-red-400"><ThumbsDown className="w-3 h-3"/> {chal.yes_votes}</span>
                                    <span className="flex items-center gap-0.5 text-emerald-400"><ThumbsUp className="w-3 h-3"/> {chal.no_votes}</span>
                                  </div>
                                  
                                  {!isMe && !hasVoted ? (
                                    <div className="flex flex-col sm:flex-row gap-1.5 mt-1">
                                      <button onClick={() => onVote(chal.id, true)} className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] sm:text-[9px] font-bold rounded border border-red-500/20 uppercase tracking-wide">Reject</button>
                                      <button onClick={() => onVote(chal.id, false)} className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] sm:text-[9px] font-bold rounded border border-emerald-500/20 uppercase tracking-wide">Keep</button>
                                    </div>
                                  ) : (
                                    <div className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
                                      {hasVoted ? <><Check className="w-3 h-3 text-emerald-500"/> Voted</> : ''}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                !isMe && (
                                  <button 
                                    onClick={() => onChallenge(player.user_id, cat, answerText)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"
                                    title="Veto this answer"
                                  >
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                  </button>
                                )
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs italic">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};
