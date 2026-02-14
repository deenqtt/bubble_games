import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Play, Zap, Activity, Terminal, Fingerprint, Volume2, VolumeX, UserCheck, AlertCircle, Loader2 } from 'lucide-react';
import useSound from 'use-sound';
import GameManager from './game/GameManager';
import { useOnlinePeer } from './hooks/useOnlinePeer';

// URL SFX & BGM
const CLICK_SFX = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'; 
const HOVER_SFX = 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'; 
const START_SFX = 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3'; 
const BGM_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3'; 

const ParticleBackground = () => {
  const particles = useMemo(() => [...Array(40)].map((_, i) => ({
    id: i,
    size: Math.random() * 3 + 1,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 10
  })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-blue-400/30"
          initial={{ y: '110%', x: `${p.x}%` }}
          animate={{ 
            y: '-10%',
            opacity: [0, 1, 1, 0],
          }}
          transition={{ 
            duration: p.duration, 
            repeat: Infinity, 
            delay: p.delay,
            ease: "linear"
          }}
          style={{ width: p.size, height: p.size }}
        />
      ))}
    </div>
  );
};

const HUDElement = ({ position, label, value }: { position: string, label: string, value: string }) => (
  <div className={`absolute ${position} pointer-events-none opacity-40 hidden md:block`}>
    <div className="flex flex-col gap-1 font-mono text-[10px] text-blue-400">
      <span className="bg-blue-500/20 px-2 py-0.5 border-l-2 border-blue-500">{label}</span>
      <span className="text-white tracking-widest">{value}</span>
    </div>
  </div>
);

function App() {
  const [gameState, setGameState] = useState<'lobby' | 'playing'>(() => {
    return (localStorage.getItem('bubble_arena_state') as 'lobby' | 'playing') || 'lobby';
  });
  const [gameMode, setGameMode] = useState<1 | 2>(() => {
    return Number(localStorage.getItem('bubble_arena_mode')) as 1 | 2 || 1;
  });
  
  const [isOnline, setIsOnline] = useState(false);
  const [onlineRole, setOnlineRole] = useState<'host' | 'client' | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showOnlineMenu, setShowOnlineMenu] = useState(false);
  
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Connection management
  const { status, errorMsg, connectToRoom, connection, myId, remoteStream, startVideoCall, answerIncomingCall, incomingCall } = useOnlinePeer();

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('bubble_arena_state', gameState);
    localStorage.setItem('bubble_arena_mode', gameMode.toString());
  }, [gameState, gameMode]);

  // Transition to game when connected (for client)
  useEffect(() => {
    if (isOnline && onlineRole === 'client' && status === 'CONNECTED') {
      setGameState('playing');
    }
  }, [status, isOnline, onlineRole]);

  // Sound Hooks
  const [playClick] = useSound(CLICK_SFX, { volume: 0.4, soundEnabled: !isMuted });
  const [playHover] = useSound(HOVER_SFX, { volume: 0.15, soundEnabled: !isMuted });
  const [playStart] = useSound(START_SFX, { volume: 0.5, soundEnabled: !isMuted });
  const [playBgm, { stop: stopBgm }] = useSound(BGM_URL, { volume: 0.2, loop: true, soundEnabled: !isMuted });

  useEffect(() => {
    if (!isMuted && hasInteracted) playBgm();
    else stopBgm();
  }, [isMuted, hasInteracted, playBgm, stopBgm]);

  const handleMouseMove = (e: React.MouseEvent) => {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  };

  const handleInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      setIsMuted(false); 
    }
  };

  const onStartGame = () => {
    handleInteraction();
    playStart();
    setGameState('playing');
  };

  return (
    <div 
      onClick={handleInteraction}
      onMouseMove={handleMouseMove}
      className="min-h-screen w-full flex flex-col items-center justify-center bg-[#010409] text-slate-100 p-4 relative overflow-hidden font-sans cursor-default"
    >
      <button 
        onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
        className={`absolute top-10 right-10 z-50 p-3 rounded-full border transition-all ${!isMuted ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-900/50 border-slate-800 text-slate-500'}`}
      >
        {!isMuted ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </button>

      <motion.div style={{ x: useTransform(mouseX, [0, window.innerWidth], [-20, 20]), y: useTransform(mouseY, [0, window.innerHeight], [-20, 20]) }} className="absolute inset-0 z-0">
        <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, #3b82f6 1px, transparent 0)`, backgroundSize: '40px 40px' }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(29,78,216,0.15),transparent_70%)]" />
      </motion.div>

      <ParticleBackground />

      <HUDElement position="top-10 left-10" label="AUDIO_ENGINE" value={!isMuted ? "ONLINE" : "SILENT_PROTOCOL"} />
      <div className="absolute bottom-10 left-10 flex gap-4 opacity-40 font-mono text-[10px] text-blue-400">
        <div className="flex items-center gap-2"><Fingerprint size={12}/> IDENTITY_VERIFIED</div>
        <div className="flex items-center gap-2"><Terminal size={12}/> CMD_EXEC_ACTIVE</div>
      </div>

      <AnimatePresence mode="wait">
        {showOnlineMenu && (
          <motion.div 
            key="online-menu"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg bg-slate-900 border border-blue-500/30 rounded-[2rem] p-10 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600" />
              <h2 className="text-4xl font-black italic text-white mb-2 italic uppercase">Link_Interface</h2>
              <p className="text-slate-500 font-mono text-xs tracking-widest mb-10 uppercase">Verify_Neural_Signature</p>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => { setGameMode(2); setIsOnline(false); setShowOnlineMenu(false); onStartGame(); }}
                  className="group flex items-center justify-between p-6 bg-slate-800/50 hover:bg-blue-600 border border-slate-700 hover:border-blue-400 rounded-2xl transition-all"
                >
                  <div className="text-left">
                    <p className="font-black text-xl italic text-white uppercase tracking-tighter">Local Battle</p>
                    <p className="text-[10px] text-slate-400 group-hover:text-blue-200">Same screen session</p>
                  </div>
                  <UserCheck className="text-slate-500 group-hover:text-white" />
                </button>

                <div className="h-[1px] w-full bg-slate-800 my-2" />

                <button 
                  disabled={status === 'CONNECTING'}
                  onClick={() => { setOnlineRole('host'); setIsOnline(true); setGameMode(2); setShowOnlineMenu(false); onStartGame(); }}
                  className="group flex items-center justify-between p-6 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-400 rounded-2xl transition-all disabled:opacity-50"
                >
                  <div className="text-left">
                    <p className="font-black text-xl italic text-white uppercase tracking-tighter">Create Session</p>
                    <p className="text-[10px] text-blue-400 group-hover:text-blue-200">Generate neural room</p>
                  </div>
                  <Activity className="text-blue-500 group-hover:text-white" />
                </button>

                <div className="relative mt-2">
                  <input 
                    type="text" 
                    placeholder="PASTE_ROOM_CODE_HERE"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.trim())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 font-mono text-blue-400 focus:outline-none focus:border-blue-500 transition-all tracking-tighter text-xs"
                  />
                  <button 
                    disabled={status === 'CONNECTING' || !roomCode}
                    onClick={() => { 
                      setOnlineRole('client'); 
                      setIsOnline(true); 
                      connectToRoom(roomCode);
                    }}
                    className="absolute right-2 top-2 bottom-2 px-6 bg-slate-800 hover:bg-indigo-600 text-white font-black text-xs rounded-xl transition-all flex items-center gap-2"
                  >
                    {status === 'CONNECTING' ? <Loader2 size={14} className="animate-spin" /> : 'JOIN'}
                  </button>
                </div>

                {status === 'ERROR' && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-widest mt-2">
                    <AlertCircle size={14} /> {errorMsg}
                  </motion.div>
                )}
              </div>

              <button 
                onClick={() => setShowOnlineMenu(false)}
                className="mt-10 w-full text-slate-500 hover:text-white font-mono text-[10px] tracking-[0.4em] uppercase transition-colors"
              >
                [ Abort_Protocol ]
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'lobby' && !showOnlineMenu && (
          <motion.div 
            key="lobby"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -50, filter: 'blur(20px)' }}
            className="z-10 flex flex-col items-center w-full"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-blue-500/10 rounded-full pointer-events-none">
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 4, repeat: Infinity }} className="w-full h-full border border-blue-400/20 rounded-full" />
            </div>

            {!hasInteracted && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute top-20 text-blue-500/60 font-mono text-[10px] tracking-[0.3em] animate-pulse">
                CLICK ANYWHERE TO SYNC AUDIO
              </motion.div>
            )}

            <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="relative text-center mb-16">
              <h1 className="relative text-7xl md:text-[10rem] font-black tracking-tighter leading-none italic">
                <span className="absolute top-0 left-0 -ml-1 text-red-500 opacity-30 mix-blend-screen animate-pulse">BUBBLE</span>
                <span className="absolute top-0 left-0 ml-1 text-blue-500 opacity-30 mix-blend-screen animate-pulse">BUBBLE</span>
                <span className="relative z-10 text-white drop-shadow-[0_0_30px_rgba(59,130,246,0.6)] uppercase tracking-tighter">Bubble</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-600 drop-shadow-2xl font-black italic uppercase tracking-tighter">Arena</span>
              </h1>
              <div className="mt-4 flex items-center justify-center gap-4 text-blue-400 tracking-[0.5em] font-bold text-[10px] uppercase opacity-80">
                <div className="h-[1px] w-12 bg-blue-500/50" /> Next-Gen Gesture Control <div className="h-[1px] w-12 bg-blue-500/50" />
              </div>
            </motion.div>

            <div className="relative flex flex-col md:flex-row gap-6 items-center">
              <motion.button 
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onMouseEnter={() => playHover()}
                onClick={() => setShowOnlineMenu(true)}
                className="group relative px-12 py-6 bg-blue-600 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(37,99,235,0.4)] transition-all"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                <div className="relative flex items-center gap-4">
                  <Play size={28} className="fill-white" />
                  <div className="flex flex-col items-start text-left leading-none">
                    <span className="text-[10px] font-bold opacity-60 uppercase mb-1">Multiplayer</span>
                    <span className="text-2xl font-black italic tracking-wider uppercase">2 Players</span>
                  </div>
                </div>
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onMouseEnter={() => playHover()}
                onClick={() => { setGameMode(1); setIsOnline(false); onStartGame(); }}
                className="group relative px-12 py-6 bg-slate-900/60 border border-slate-700 rounded-2xl overflow-hidden backdrop-blur-xl transition-all"
              >
                <div className="relative flex items-center gap-4">
                  <Zap size={28} className="text-blue-400" />
                  <div className="flex flex-col items-start text-left leading-none">
                    <span className="text-[10px] font-bold opacity-60 uppercase mb-1">Solo Op</span>
                    <span className="text-2xl font-black italic tracking-wider uppercase text-white">Single</span>
                  </div>
                </div>
              </motion.button>
            </div>

            <div className="mt-24 w-full max-w-2xl px-8 flex justify-between items-end opacity-40 border-b border-blue-500/20 pb-4 font-mono text-[10px]">
              <div className="flex gap-8 uppercase tracking-widest">
                <div className="flex flex-col"><span className="text-blue-500">Engine</span><span>Neuro_Link_V4</span></div>
                <div className="flex flex-col"><span className="text-blue-500">Security</span><span>Encrypted</span></div>
              </div>
              <div className="flex items-center gap-2 uppercase tracking-widest"><Activity size={12} className="text-green-500" /> Core_Stable</div>
            </div>
          </motion.div>
        )}

        {gameState === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black">
            <GameManager 
              mode={gameMode} 
              isOnline={isOnline}
              onlineRole={onlineRole}
              roomCode={roomCode}
              // Pass established peer connection
              externalConnection={connection}
              externalMyId={myId}
              externalRemoteStream={remoteStream}
              externalStartVideoCall={startVideoCall}
              externalAnswerIncomingCall={answerIncomingCall}
              externalIncomingCall={incomingCall}
              externalIsConnected={status === 'CONNECTED'}
              onBack={() => { 
                playClick(); 
                setGameState('lobby'); 
                setIsOnline(false); 
                setOnlineRole(null); 
                setRoomCode('');
                localStorage.removeItem('bubble_arena_state');
              }} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}</style>
    </div>
  );
}

export default App;
