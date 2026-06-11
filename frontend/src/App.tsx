import { useState } from 'react';
import { Home } from './pages/Home';
import { GameRoom } from './pages/GameRoom';
import { AdminPanel } from './pages/AdminPanel';
import { AuroraBackground } from './components/AuroraBackground';

function App() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [view, setView] = useState<'game' | 'admin'>('game');

  const handleJoinRoom = (code: string, host: boolean) => {
    setRoomCode(code);
    setIsHost(host);
  };

  const handleLeaveRoom = () => {
    setRoomCode(null);
    setIsHost(false);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between py-6 relative overflow-x-hidden">
      <AuroraBackground />

      <main className="flex-1 w-full max-w-6xl mx-auto flex flex-col justify-center px-2 sm:px-4 relative z-10 min-w-0">
        {view === 'admin' ? (
          <AdminPanel onBack={() => setView('game')} />
        ) : roomCode ? (
          <GameRoom
            roomCode={roomCode}
            isHostInitial={isHost}
            onLeaveRoom={handleLeaveRoom}
          />
        ) : (
          <Home onJoinRoom={handleJoinRoom} onOpenAdmin={() => setView('admin')} />
        )}
      </main>

      <footer className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-6 relative z-10">
        Think & Type • Production Grade Realtime Gaming
      </footer>
    </div>
  );
}

export default App;

