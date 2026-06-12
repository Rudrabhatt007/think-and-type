import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { 
  ArrowLeft, RefreshCw, Users, BookOpen, Crown, 
  Sparkles, CheckCircle2, ChevronDown, ChevronUp, Settings, Globe,
  Pencil, Save, Timer
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { apiClient, gamesApi } from '../api';

interface PlayerInfo {
  user_id: string;
  score: number;
  is_ready: boolean;
  profiles: {
    username: string;
  };
}

interface SubmissionInfo {
  id: string;
  user_id: string;
  round_number: number;
  category: 'name' | 'place' | 'animal' | 'thing';
  answer_text: string | null;
  is_valid: boolean;
  points: number;
  profiles: {
    username: string;
  };
}

interface GameRoomData {
  id: string;
  room_code: string;
  host_id: string;
  status: 'lobby' | 'active' | 'completed';
  current_round: number;
  total_rounds: number;
  exclude_u: boolean;
  round_duration: number;
  created_at: string;
  game_players: PlayerInfo[];
  submissions: SubmissionInfo[];
}

interface MapboxLogEntry {
  timestamp: string;
  query: string;
  request_url: string;
  status_code: number;
  feature_count: number;
  place_name_returned: string;
  is_valid: boolean;
  latency_ms: number;
  error: string;
  cached: boolean;
}

interface GeminiLogEntry {
  timestamp: string;
  room_code: string;
  round_number: number;
  inputs: string[];
  response: Record<string, any>;
  latency_ms: number;
  status_code: number;
  error: string;
  cached: boolean;
}

interface AdminPanelProps {
  onBack: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [rooms, setRooms] = useState<GameRoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [selectedRounds, setSelectedRounds] = useState<Record<string, number>>({});

  // Form states for deploying a new room
  const [newHostName, setNewHostName] = useState('Admin');
  const [newTotalRounds, setNewTotalRounds] = useState(15);
  const [newExcludeU, setNewExcludeU] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [deployedCode, setDeployedCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Mapbox API logs state
  const [mapboxLogs, setMapboxLogs] = useState<MapboxLogEntry[]>([]);
  const [mapboxLogsOpen, setMapboxLogsOpen] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Gemini API logs state
  const [geminiLogs, setGeminiLogs] = useState<GeminiLogEntry[]>([]);
  const [geminiLogsOpen, setGeminiLogsOpen] = useState(false);
  const [loadingGeminiLogs, setLoadingGeminiLogs] = useState(false);

  // Round duration for new room creation
  const [newRoundDuration, setNewRoundDuration] = useState(15);

  // Editable points state
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editedPoints, setEditedPoints] = useState<Record<string, number>>({});
  const [savingPoints, setSavingPoints] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRooms, setTotalRooms] = useState(0);
  const [roomsPerPage] = useState(10);

  const fetchRooms = async (pageToFetch = currentPage) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get(`/games/admin/all?page=${pageToFetch}&size=${roomsPerPage}`);
      setRooms(response.data.items || []);
      setTotalRooms(response.data.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load rooms.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMapboxLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await apiClient.get('/games/admin/mapbox-logs');
      setMapboxLogs(res.data);
    } catch {
      // Silently ignore if the endpoint is not available
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchGeminiLogs = async () => {
    setLoadingGeminiLogs(true);
    try {
      const res = await apiClient.get('/games/admin/gemini-logs');
      setGeminiLogs(res.data);
    } catch {
      // Silently ignore if the endpoint is not available
    } finally {
      setLoadingGeminiLogs(false);
    }
  };

  // Fetch rooms on page change
  useEffect(() => {
    fetchRooms(currentPage);
  }, [currentPage]);

  // Connect to websocket for live updates
  useEffect(() => {
    const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8000';
    const socket = io(WS_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Admin connected to socket');
      socket.emit('join_admin', {});
    });

    socket.on('admin_update', () => {
      fetchRooms(currentPage);
    });

    return () => {
      socket.disconnect();
    };
  }, [currentPage]);

  const handleCreateRoomFromAdmin = async () => {
    if (!newHostName.trim()) {
      setError('Host name is required.');
      return;
    }
    setCreatingRoom(true);
    setError('');
    setDeployedCode('');
    try {
      // 1. Perform guest login to get a valid JWT token
      const loginRes = await apiClient.post('/auth/guest-login', { username: newHostName.trim() });
      localStorage.setItem('think_type_token', loginRes.data.access_token);
      localStorage.setItem('think_type_username', newHostName.trim());
      
      // 2. Post room creation request
      const gameRes = await apiClient.post('/games/create', {
        total_rounds: newTotalRounds,
        exclude_u: newExcludeU,
        round_duration: newRoundDuration
      });
      
      setDeployedCode(gameRes.data.room_code);
      // Reload rooms to show the newly created one!
      fetchRooms();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to deploy room.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const toggleExpandRoom = (roomId: string) => {
    if (expandedRoomId === roomId) {
      setExpandedRoomId(null);
    } else {
      setExpandedRoomId(roomId);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition-all uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-400">
            Total Lobbies: <span className="text-slate-200">{rooms.length}</span>
          </span>
          <button
            onClick={() => fetchRooms()}
            disabled={loading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 transition-all text-slate-300 disabled:opacity-50"
            title="Refresh Admin Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Brand Title */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400 shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-100 uppercase">
            Live Game Rooms Console
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Monitor room configurations, joined players, live scoreboards, and submissions in real-time.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* Deploy Lobby Card */}
      <GlassCard className="p-5 border-slate-800/60 shadow-[0_8px_25px_rgba(0,0,0,0.2)] space-y-4">
        <div className="border-b border-slate-800/60 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Deploy New Game Lobby
          </h2>
          <p className="text-[11px] text-slate-450 mt-1">
            Instantly spin up a new game room, adjust target round rules, and extract invite code.
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Host Display Name
            </label>
            <input
              type="text"
              value={newHostName}
              onChange={(e) => setNewHostName(e.target.value)}
              placeholder="e.g. Admin"
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/5 text-slate-100 text-sm bg-slate-950/60 focus:border-indigo-500 focus:shadow-[0_0_12px_rgba(99,102,241,0.15)] outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Total Rounds
            </label>
            <select
              value={newTotalRounds}
              onChange={(e) => setNewTotalRounds(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/5 text-slate-200 text-sm bg-slate-950/60 focus:border-indigo-500 focus:shadow-[0_0_12px_rgba(99,102,241,0.15)] outline-none transition-all cursor-pointer font-semibold"
            >
              {[3, 5, 10, 15, 20, 25].map(v => (
                <option key={v} value={v} className="bg-slate-950 text-slate-200">{v} Rounds</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block flex items-center gap-1">
              <Timer className="w-3 h-3 text-indigo-400" />
              Round Timer
            </label>
            <select
              value={newRoundDuration}
              onChange={(e) => setNewRoundDuration(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/5 text-slate-200 text-sm bg-slate-950/60 focus:border-indigo-500 focus:shadow-[0_0_12px_rgba(99,102,241,0.15)] outline-none transition-all cursor-pointer font-semibold"
            >
              {[10, 15, 20, 30, 45, 60].map(v => (
                <option key={v} value={v} className="bg-slate-950 text-slate-200">{v}s</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2.5 h-11 select-none pb-1">
            <input
              type="checkbox"
              id="exclude-u-admin"
              checked={newExcludeU}
              onChange={(e) => setNewExcludeU(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600 bg-transparent border-white/10 cursor-pointer"
            />
            <label htmlFor="exclude-u-admin" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer">
              Exclude Letter U
            </label>
          </div>
          <button
            onClick={handleCreateRoomFromAdmin}
            disabled={creatingRoom}
            className="w-full py-4 md:py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-550 border border-indigo-500/20 text-white flex items-center justify-center gap-2 transition-all active:scale-[0.99] text-sm md:text-xs uppercase tracking-wider h-14 md:h-10 shadow-[0_4px_12px_rgba(99,102,241,0.25)] disabled:opacity-50 mt-2 md:mt-0"
          >
            {creatingRoom ? 'Deploying...' : 'Deploy Lobby'}
          </button>
        </div>

        {deployedCode && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in mt-2">
            <div className="text-xs font-semibold text-slate-205 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-450" />
              <span>Lobby deployed! Share Room Code:</span>
              <span className="text-emerald-400 font-black text-lg tracking-widest ml-1 bg-slate-950 px-3 py-1 rounded-lg border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.1)]">
                {deployedCode}
              </span>
            </div>
            <button
              onClick={async () => {
                try {
                  if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(deployedCode);
                  } else {
                    const textArea = document.createElement("textarea");
                    textArea.value = deployedCode;
                    textArea.style.position = "absolute";
                    textArea.style.left = "-999999px";
                    document.body.prepend(textArea);
                    textArea.select();
                    try {
                      document.execCommand('copy');
                    } catch (error) {
                      console.error('Fallback copy failed', error);
                    } finally {
                      textArea.remove();
                    }
                  }
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                } catch (err) {
                  console.error('Failed to copy', err);
                }
              }}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] uppercase font-bold text-slate-350 tracking-wider transition-all flex items-center gap-1.5"
            >
              {copiedCode ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
        )}
      </GlassCard>

      {loading && rooms.length === 0 ? (
        <div className="text-center py-20 text-slate-405 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-7 h-7 animate-spin text-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-wider">Retrieving Active Room Schemas...</span>
        </div>
      ) : rooms.length === 0 ? (
        <GlassCard className="text-center py-20 text-slate-450 border-slate-800/60 shadow-[0_8px_25px_rgba(0,0,0,0.2)]">
          <Users className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="font-bold text-sm uppercase tracking-wider">No Game Lobbies Active</p>
          <p className="text-xs text-slate-500 mt-1">Deploy a new room using the control panel above.</p>
        </GlassCard>
      ) : (
        <div className="grid gap-4">
          {rooms.map((room) => {
            const isExpanded = expandedRoomId === room.id;
            const statusColors = {
              lobby: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
              active: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
              completed: 'bg-slate-900 border-slate-800 text-slate-500'
            };

            return (
              <GlassCard key={room.id} className="p-0 overflow-hidden border-slate-800/60 hover:border-slate-700/60 shadow-md transition-all">
                {/* Room Header Card */}
                <div 
                  onClick={() => toggleExpandRoom(room.id)}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.01] select-none"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-black text-lg text-indigo-400 tracking-wider">
                      {room.room_code}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[9px] rounded border font-bold uppercase tracking-wider ${statusColors[room.status]}`}>
                          {room.status}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {new Date(room.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2.5 font-bold uppercase tracking-wider">
                        <span>Rounds: <span className="text-slate-200">{room.current_round} / {room.total_rounds}</span></span>
                        <span>•</span>
                        <span>Timer: <span className="text-slate-200">{room.round_duration || 15}s</span></span>
                        <span>•</span>
                        <span>Exclude U: <span className="text-slate-200">{room.exclude_u ? 'Yes' : 'No'}</span></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">{room.game_players.length} Players</span>
                    </div>

                    <div className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="border-t border-slate-900 p-4 bg-slate-950/20 space-y-5">
                    {room.status === 'lobby' && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-950/20 border border-indigo-550/20">
                        <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">
                          This room is in lobby mode.
                        </span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await apiClient.post(`/games/admin/start/${room.room_code}`);
                              fetchRooms();
                            } catch (err: any) {
                              alert(err.response?.data?.detail || "Failed to start game.");
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-indigo-650 hover:bg-indigo-600 border border-indigo-500/20 text-white font-bold text-[10px] uppercase tracking-wider transition-all active:scale-[0.98] shadow-md"
                        >
                          Force Start Game
                        </button>
                      </div>
                    )}
                    {room.status === 'active' && room.current_round >= room.total_rounds && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 animate-pulse">
                        <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
                          All rounds complete. Ready to show champion!
                        </span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await apiClient.post(`/games/admin/declare-winner/${room.room_code}`);
                              fetchRooms();
                            } catch (err: any) {
                              alert(err.response?.data?.detail || "Failed to declare winner.");
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 border border-amber-400/20 text-white font-bold text-[10px] uppercase tracking-wider transition-all active:scale-[0.98] shadow-md animate-none"
                        >
                          Declare Winner & Show Champion
                        </button>
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-5">
                      
                      {/* Players & Scores Section */}
                      <div className="space-y-2.5">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1.5 border-b border-slate-900 pb-1.5">
                          <Crown className="w-3.5 h-3.5" />
                          Roster & Leaderboard
                        </h3>
                        <div className="space-y-1.5">
                          {room.game_players.filter(p => p.user_id !== room.host_id).map((player) => {
                            const isHost = player.user_id === room.host_id;
                            return (
                              <div 
                                key={player.user_id}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-white/5"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                                    {player.profiles.username.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-xs font-bold text-slate-200">
                                    {player.profiles.username} 
                                    {isHost && <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1 rounded border border-amber-500/20 font-bold ml-1.5 uppercase tracking-wider">Host</span>}
                                  </span>
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
                                  {player.is_ready ? (
                                    <span className="bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wide">Ready</span>
                                  ) : (
                                    <span className="bg-slate-900 text-slate-500 px-1 py-0.5 rounded border border-slate-800 uppercase tracking-wide">Lobby</span>
                                  )}
                                  <span className="text-indigo-400 font-black">{player.score} pts</span>
                                </div>
                              </div>
                            );
                          })}
                          {room.game_players.length === 0 && (
                            <p className="text-xs text-slate-500 italic">No players in this room yet.</p>
                          )}
                        </div>
                      </div>

                      {/* Room details & config */}
                      <div className="space-y-2.5">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 border-b border-slate-900 pb-1.5">
                          <Settings className="w-3.5 h-3.5 text-indigo-400" />
                          Lobby Configuration
                        </h3>
                        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-white/5 space-y-2.5 text-xs text-slate-300">
                          <div className="flex justify-between">
                            <span className="text-slate-550 font-bold uppercase text-[9px] tracking-wider">Room Code:</span>
                            <span className="font-mono font-bold text-indigo-400">{room.room_code}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-550 font-bold uppercase text-[9px] tracking-wider">Room Status:</span>
                            <span className={`uppercase font-black text-[9px] px-1.5 py-0.5 rounded ${
                              room.status === 'active' 
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                                : room.status === 'completed'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-900 text-slate-500 border border-slate-800'
                            }`}>{room.status}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-550 font-bold uppercase text-[9px] tracking-wider">Current Round:</span>
                            <span className="font-bold text-slate-200">{room.current_round} / {room.total_rounds}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-550 font-bold uppercase text-[9px] tracking-wider">Round Timer:</span>
                            <span className="font-bold text-indigo-400">{room.round_duration || 15}s</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-550 font-bold uppercase text-[9px] tracking-wider">Exclude Letter U:</span>
                            <span className="font-bold text-slate-200">{room.exclude_u ? 'Yes' : 'No'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-550 font-bold uppercase text-[9px] tracking-wider">Created At:</span>
                            <span className="text-slate-400">{new Date(room.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Round-Wise Submissions Matrix (Full Width) */}
                    <div className="pt-4 border-t border-slate-900 space-y-3">
                      <div className="flex items-center justify-between pb-1">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                          Round-by-Round Submissions
                        </h3>
                        {room.submissions.length > 0 && (
                          <div className="flex items-center gap-2">
                            {saveSuccess === room.id && (
                              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Saved
                              </span>
                            )}
                            {editingRoomId === room.id ? (
                              <>
                                <button
                                  onClick={async () => {
                                    setSavingPoints(true);
                                    try {
                                      const updates = Object.entries(editedPoints).map(([id, pts]) => ({
                                        submission_id: id,
                                        points: pts,
                                      }));
                                      if (updates.length > 0) {
                                        await gamesApi.adminUpdatePoints(updates);
                                      }
                                      setEditingRoomId(null);
                                      setEditedPoints({});
                                      setSaveSuccess(room.id);
                                      setTimeout(() => setSaveSuccess(null), 3000);
                                      fetchRooms();
                                    } catch (err: any) {
                                      alert(err.response?.data?.detail || 'Failed to save points.');
                                    } finally {
                                      setSavingPoints(false);
                                    }
                                  }}
                                  disabled={savingPoints}
                                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 text-white font-bold text-[9px] uppercase tracking-wider transition-all active:scale-[0.98] flex items-center gap-1 disabled:opacity-50"
                                >
                                  <Save className="w-3 h-3" />
                                  {savingPoints ? 'Saving...' : 'Save Points'}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingRoomId(null);
                                    setEditedPoints({});
                                  }}
                                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/5 text-slate-300 font-bold text-[9px] uppercase tracking-wider transition-all active:scale-[0.98]"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingRoomId(room.id);
                                  setEditedPoints({});
                                }}
                                className="px-3 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/20 text-amber-400 font-bold text-[9px] uppercase tracking-wider transition-all active:scale-[0.98] flex items-center gap-1"
                              >
                                <Pencil className="w-3 h-3" />
                                Edit Points
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {(() => {
                        const uniqueRounds = Array.from(new Set(room.submissions.map(s => s.round_number))).sort((a, b) => a - b);
                        const activeRound = selectedRounds[room.id] || (uniqueRounds.length > 0 ? uniqueRounds[0] : 1);
                        const roundSubs = room.submissions.filter(s => s.round_number === activeRound);
                        const isEditing = editingRoomId === room.id;

                        const renderPointsCell = (sub: SubmissionInfo | undefined) => {
                          if (!sub) return <span className="text-slate-600 text-[10px] italic">No submission</span>;
                          
                          const currentPoints = editedPoints[sub.id] !== undefined ? editedPoints[sub.id] : sub.points;
                          
                          return (
                            <div className="space-y-0.5">
                              <div className="text-slate-100 font-semibold text-xs">
                                "{sub.answer_text || '(Empty)'}"
                              </div>
                              <div className="flex items-center gap-1 text-[9px] font-black text-indigo-400 uppercase">
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    {[0, 5, 10].map(val => (
                                      <button
                                        key={val}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditedPoints(prev => ({ ...prev, [sub.id]: val }));
                                        }}
                                        className={`px-1.5 py-0.5 rounded border text-[9px] font-bold transition-all ${
                                          currentPoints === val 
                                            ? 'bg-amber-500 text-slate-900 border-amber-400' 
                                            : 'bg-amber-950/20 text-amber-500/50 border-amber-500/20 hover:text-amber-300 hover:border-amber-500/50'
                                        }`}
                                      >
                                        {val}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <span>{sub.points} pts</span>
                                )}
                                {!sub.is_valid && (
                                  <span className="text-red-500 font-bold border border-red-500/30 px-1 rounded bg-red-500/10 text-[7px]">Vetoed</span>
                                )}
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div className="space-y-3">
                            {uniqueRounds.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 pb-1">
                                {uniqueRounds.map((round) => (
                                  <button
                                    key={round}
                                    onClick={() => setSelectedRounds(prev => ({ ...prev, [room.id]: round }))}
                                    className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all border ${
                                      activeRound === round
                                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                                        : 'bg-slate-950/40 text-slate-400 border-white/5 hover:bg-slate-900/60'
                                    }`}
                                  >
                                    Round {round}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic pb-1">No rounds have been played in this room yet.</p>
                            )}

                            {uniqueRounds.length > 0 && (
                              <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/20">
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                  <thead>
                                    <tr className="bg-slate-950/60 border-b border-slate-900">
                                      <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-1/5">Player</th>
                                      <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-1/5">Name</th>
                                      <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-1/5">Place</th>
                                      <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-1/5">Animal</th>
                                      <th className="py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-1/5">Thing</th>
                                    </tr>
                                  </thead>
                                    <tbody>
                                      {room.game_players.filter(p => p.user_id !== room.host_id).map((player) => {
                                        const nameSub = roundSubs.find(s => s.user_id === player.user_id && s.category === 'name');
                                      const placeSub = roundSubs.find(s => s.user_id === player.user_id && s.category === 'place');
                                      const animalSub = roundSubs.find(s => s.user_id === player.user_id && s.category === 'animal');
                                      const thingSub = roundSubs.find(s => s.user_id === player.user_id && s.category === 'thing');

                                      return (
                                        <tr key={player.user_id} className="border-b border-slate-900/40 hover:bg-white/[0.01] transition-all">
                                          <td className="py-3 px-3 text-xs font-bold text-slate-200">
                                            {player.profiles.username}
                                          </td>
                                          <td className="py-3 px-3">{renderPointsCell(nameSub)}</td>
                                          <td className="py-3 px-3">{renderPointsCell(placeSub)}</td>
                                          <td className="py-3 px-3">{renderPointsCell(animalSub)}</td>
                                          <td className="py-3 px-3">{renderPointsCell(thingSub)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalRooms > roomsPerPage && (
        <div className="flex items-center justify-between px-1 py-1">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 transition-all select-none active:scale-[0.98] cursor-pointer"
          >
            Previous
          </button>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Page <span className="text-slate-350">{currentPage}</span> of <span className="text-slate-350">{Math.ceil(totalRooms / roomsPerPage)}</span> ({totalRooms} rooms total)
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalRooms / roomsPerPage)))}
            disabled={currentPage >= Math.ceil(totalRooms / roomsPerPage)}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 transition-all select-none active:scale-[0.98] cursor-pointer"
          >
            Next
          </button>
        </div>
      )}

      {/* ──── Mapbox Place API Logs ──── */}
      <GlassCard className="p-5 border-slate-800/60 shadow-[0_8px_25px_rgba(0,0,0,0.2)] space-y-4">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => {
            if (!mapboxLogsOpen) fetchMapboxLogs();
            setMapboxLogsOpen(!mapboxLogsOpen);
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-800/30 text-emerald-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300">
                Mapbox Place Validation Logs
              </h2>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                API request / response audit trail for place name geocoding.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); fetchMapboxLogs(); }}
              disabled={loadingLogs}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
            </button>
            {mapboxLogsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>

        {mapboxLogsOpen && (
          <div className="pt-3 border-t border-slate-900 space-y-3">
            {mapboxLogs.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-6">
                No Mapbox API calls recorded yet. Place validation logs will appear here during gameplay.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/20">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-slate-900">
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Time</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Query</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Features</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Matched Place</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Valid?</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Latency</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Source</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapboxLogs.map((log, idx) => (
                      <tr key={idx} className="border-b border-slate-900/40 hover:bg-white/[0.01] transition-all">
                        <td className="py-2 px-3 text-[10px] text-slate-400 font-mono whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 text-xs font-bold text-slate-200">
                          "{log.query}"
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                            log.status_code === 200
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {log.status_code || '—'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs text-slate-300 font-mono">
                          {log.feature_count >= 0 ? log.feature_count : '—'}
                        </td>
                        <td className="py-2 px-3 text-[10px] text-slate-300 max-w-[200px] truncate" title={log.place_name_returned}>
                          {log.place_name_returned || '—'}
                        </td>
                        <td className="py-2 px-3">
                          {log.is_valid ? (
                            <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase">Yes</span>
                          ) : (
                            <span className="text-[9px] font-black bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 uppercase">No</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[10px] text-slate-400 font-mono">
                          {log.latency_ms > 0 ? `${log.latency_ms}ms` : '—'}
                        </td>
                        <td className="py-2 px-3">
                          {log.cached ? (
                            <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase">Cache</span>
                          ) : (
                            <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 uppercase">API</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[10px] text-red-400 max-w-[150px] truncate" title={log.error}>
                          {log.error || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1">
              <span>{mapboxLogs.length} log entries</span>
              <span>Max retained: 500 entries (FIFO)</span>
            </div>
          </div>
        )}
      </GlassCard>

      {/* ──── Gemini LLM API Logs ──── */}
      <GlassCard className="p-5 border-slate-800/60 shadow-[0_8px_25px_rgba(0,0,0,0.2)] space-y-4 mt-6">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => {
            if (!geminiLogsOpen) fetchGeminiLogs();
            setGeminiLogsOpen(!geminiLogsOpen);
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-950/30 border border-violet-800/30 text-violet-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300">
                Gemini LLM Validation Logs
              </h2>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Bulk AI request / response audit trail for "Thing" validation.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); fetchGeminiLogs(); }}
              disabled={loadingGeminiLogs}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingGeminiLogs ? 'animate-spin' : ''}`} />
            </button>
            {geminiLogsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>

        {geminiLogsOpen && (
          <div className="pt-3 border-t border-slate-900 space-y-3">
            {geminiLogs.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-6">
                No Gemini API calls recorded yet. LLM validation logs will appear here during gameplay.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/20">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-slate-900">
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Time</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Room</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Round</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Words Sent</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">AI Response</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Latency</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Source</th>
                      <th className="py-2.5 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {geminiLogs.map((log, idx) => (
                      <tr key={idx} className="border-b border-slate-900/40 hover:bg-white/[0.01] transition-all">
                        <td className="py-2 px-3 text-[10px] text-slate-400 font-mono whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 text-xs font-bold text-slate-200 font-mono">
                          {log.room_code || '—'}
                        </td>
                        <td className="py-2 px-3 text-xs text-slate-300 font-mono">
                          {log.round_number || '—'}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-300 font-mono max-w-[250px] truncate" title={log.inputs.join(', ')}>
                          {log.inputs.join(', ')}
                        </td>
                        <td className="py-2 px-3 text-[10px] text-violet-300 font-mono max-w-[250px] truncate" title={JSON.stringify(log.response)}>
                          {JSON.stringify(log.response)}
                        </td>
                        <td className="py-2 px-3 text-[10px] text-slate-400 font-mono">
                          {log.latency_ms > 0 ? `${log.latency_ms}ms` : '—'}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                            log.status_code === 200
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {log.status_code || '—'}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {log.cached ? (
                            <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase">Cache</span>
                          ) : (
                            <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 uppercase">API</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[10px] text-red-400 max-w-[150px] truncate" title={log.error}>
                          {log.error || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1">
              <span>{geminiLogs.length} log entries</span>
              <span>Max retained: 500 entries (FIFO)</span>
            </div>
          </div>
        )}
      </GlassCard>

    </div>
  );
};
