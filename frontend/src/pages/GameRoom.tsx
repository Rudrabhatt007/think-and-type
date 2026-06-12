import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GameLobby } from '../components/GameLobby';
import { AnswerForm } from '../components/AnswerForm';
import { ChallengePanel } from '../components/ChallengePanel';
import { Leaderboard } from '../components/Leaderboard';
import { useSocket } from '../hooks/useSocket';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';

interface GameRoomProps {
  roomCode: string;
  isHostInitial: boolean;
  onLeaveRoom: () => void;
}

export const GameRoom: React.FC<GameRoomProps> = ({
  roomCode,
  isHostInitial,
  onLeaveRoom,
}) => {
  const [players, setPlayers] = useState<any[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [roundLetter, setRoundLetter] = useState('');
  const [roundDuration, setRoundDuration] = useState(15);
  
  // Phase state: 'lobby' | 'typing' | 'challenge' | 'intermission' | 'completed'
  const [phase, setPhase] = useState<'lobby' | 'typing' | 'challenge' | 'intermission' | 'completed'>('lobby');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [votedChallengeIds, setVotedChallengeIds] = useState<string[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  
  // Game End Winners
  const [winner, setWinner] = useState<any | null>(null);
  const [runnerUp, setRunnerUp] = useState<any | null>(null);

  // Initialize socket hook
  const { emit, on, isConnected } = useSocket(roomCode);

  // Decode local user id from JWT
  const currentUserId = useMemo(() => {
    const token = localStorage.getItem('think_type_token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || null;
    } catch (_) {
      return null;
    }
  }, []);

  const isHost = useMemo(() => {
    if (!hostId || !currentUserId) return isHostInitial;
    return hostId === currentUserId;
  }, [hostId, currentUserId, isHostInitial]);

  // Set up socket listeners
  useEffect(() => {
    // 1. Room state listener
    const cleanupRoomState = on('room_state', (data: any) => {
      if (data.game) {
        setHostId(data.game.host_id);
        setCurrentRound(data.game.current_round);
        setTotalRounds(data.game.total_rounds || 0);
        setRoundDuration(data.game.round_duration || 15);
        
        if (data.game.status === 'active' && phase === 'lobby') {
          // Keep sync if player joins a game already active
          setPhase('typing');
        }
      }
      if (data.players && data.game) {
        // Filter out the host from the active player list
        setPlayers(data.players.filter((p: any) => p.user_id !== data.game.host_id));
      } else if (data.players) {
        setPlayers(data.players);
      }
    });

    // 2. Round Start listener
    const cleanupRoundStart = on('round_start', (data: any) => {
      setPhase('typing');
      setRoundLetter(data.letter);
      setCurrentRound(data.round_number);
      setHasSubmitted(false);
      setSubmissions([]);
      setChallenges([]);
      setVotedChallengeIds([]);
      setRoundDuration(data.duration_seconds || 15);
      setTimeRemaining((data.duration_seconds || 15) + (data.animation_seconds || 0));
    });

    // 3. Timer Tick listener
    const cleanupTimerTick = on('timer_tick', (data: any) => {
      setTimeRemaining(data.time_remaining);
      if (data.phase && data.phase !== phase) {
        setPhase(data.phase);
      }
    });

    // 4. Round Ended listener (Typing phase finished)
    const cleanupRoundEnded = on('round_ended', (data: any) => {
      setPhase('challenge');
      setSubmissions(data.submissions);
      setTimeRemaining(data.challenge_duration);
    });

    // 5. Challenge Update listener
    const cleanupChallengeUpdate = on('challenge_update', (data: any) => {
      setChallenges(data.challenges);
    });

    // 6. Round Scores listener
    const cleanupRoundScores = on('round_scores', (data: any) => {
      setPhase('intermission');
      // Update local players list with the new round scores
      setPlayers((prevPlayers) => {
        return prevPlayers.map((player) => {
          const match = data.scores.find((s: any) => s.user_id === player.user_id);
          return match ? { ...player, score: match.score, round_points: match.round_points } : player;
        });
      });
    });

    // 7. Game Completed listener
    const cleanupGameCompleted = on('game_completed', (data: any) => {
      setPhase('completed');
      setWinner(data.winner);
      setRunnerUp(data.runner_up);
      if (data.leaderboard) {
        setPlayers(data.leaderboard);
      }
    });

    return () => {
      cleanupRoomState();
      cleanupRoundStart();
      cleanupTimerTick();
      cleanupRoundEnded();
      cleanupChallengeUpdate();
      cleanupRoundScores();
      cleanupGameCompleted();
    };
  }, [on, phase]);

  // Emit actions to Socket
  const handleStartGame = () => {
    emit('start_game', { room_code: roomCode });
  };

  const handleAnswerSubmit = (answers: { name: string; place: string; animal: string; thing: string }) => {
    setHasSubmitted(true);
    emit('submit_answers', {
      round_number: currentRound,
      answers,
    });
  };

  const handleChallenge = (targetUserId: string, category: string, answerText: string) => {
    emit('submit_challenge', {
      round_number: currentRound,
      target_user_id: targetUserId,
      category,
      answer_text: answerText,
    });
  };

  const handleVote = (challengeId: string, vote: boolean) => {
    setVotedChallengeIds((prev) => [...prev, challengeId]);
    emit('submit_vote', {
      challenge_id: challengeId,
      vote,
    });
  };

  // Render components based on phase
  const renderGameContent = () => {
    switch (phase) {
      case 'lobby':
        return (
          <GameLobby
            roomCode={roomCode}
            players={players}
            isHost={isHost}
            onStartGame={handleStartGame}
            currentUserId={currentUserId}
            hostId={hostId}
          />
        );
      case 'typing':
        if (isHost) {
          return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-16 h-16 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              <h2 className="text-2xl font-black text-slate-200 uppercase tracking-widest">Round {currentRound} Active</h2>
              <p className="text-slate-400 font-bold">Players are typing... ({timeRemaining}s remaining)</p>
            </div>
          );
        }
        return (
          <AnswerForm
            letter={roundLetter}
            roundNumber={currentRound}
            timeRemaining={timeRemaining}
            roundDuration={roundDuration}
            onSubmit={handleAnswerSubmit}
            hasSubmitted={hasSubmitted}
          />
        );
      case 'challenge':
        return (
          <ChallengePanel
            submissions={submissions}
            challenges={challenges}
            players={players}
            timeRemaining={timeRemaining}
            currentUserId={currentUserId}
            onChallenge={handleChallenge}
            onVote={handleVote}
            votedChallengeIds={votedChallengeIds}
          />
        );
      case 'intermission':
        return (
          <Leaderboard
            players={players}
            isGameOver={false}
            roundNumber={currentRound}
            totalRounds={totalRounds}
            onLobbyReturn={onLeaveRoom}
          />
        );
      case 'completed':
        return (
          <Leaderboard
            players={players}
            winner={winner}
            runnerUp={runnerUp}
            isGameOver={true}
            onLobbyReturn={onLeaveRoom}
          />
        );
      default:
        return <div className="text-center text-slate-400">Loading game session...</div>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 pb-12">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition-all uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          Leave
        </button>

        {/* Network indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-brand-emerald" />
              <span className="text-[10px] font-bold text-brand-emerald uppercase tracking-wider">Sync Active</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Sync Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Main content frame */}
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {renderGameContent()}
      </motion.div>
    </div>
  );
};
