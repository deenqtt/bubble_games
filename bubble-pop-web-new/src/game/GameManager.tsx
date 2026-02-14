import { useRef, useEffect, useState } from 'react';
import { FilesetResolver, HandLandmarker, FaceDetector } from '@mediapipe/tasks-vision';
import { Bubble, PopParticle, PLAYER_COLORS } from './Engine';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, XCircle, Copy, Wifi, Trophy } from 'lucide-react';

interface Props {
  mode: 1 | 2;
  isOnline: boolean;
  onlineRole: 'host' | 'client' | null;
  roomCode: string;
  onBack: () => void;
  externalConnection: any;
  externalMyId: string;
  externalRemoteStream: MediaStream | null;
  externalIsConnected: boolean;
  externalStartVideoCall: (id: string, stream: MediaStream) => void;
  externalAnswerIncomingCall: (stream: MediaStream) => void;
  externalIncomingCall: any;
}

type SubState = 'lobby' | 'countdown' | 'playing' | 'result';

const GameManager: React.FC<Props> = ({ 
  mode, isOnline, onlineRole, roomCode, onBack,
  externalConnection, externalMyId, externalRemoteStream, 
  externalIsConnected, externalStartVideoCall, externalAnswerIncomingCall, externalIncomingCall 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [trackers, setTrackers] = useState<{ hand: HandLandmarker, face: FaceDetector } | null>(null);
  
  const [subState, setSubState] = useState<SubState>('lobby');
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState({ 1: 0, 2: 0 });
  const [timer, setTimer] = useState(60);
  const [countdown, setCountdown] = useState(3);
  const [readyStatus, setReadyStatus] = useState({ 1: false, 2: false });
  const [faceHold, setFaceHold] = useState({ 1: 0, 2: 0 });
  const [remoteHand, setRemoteHand] = useState<{x: number, y: number} | null>(null);

  const bubbles = useRef<Bubble[]>([]);
  const particles = useRef<PopParticle[]>([]);
  const lastVideoTime = useRef(-1);

  // Call logic
  useEffect(() => {
    if (!videoRef.current?.srcObject) return;
    const myStream = videoRef.current.srcObject as MediaStream;
    if (onlineRole === 'client' && externalIsConnected && roomCode) {
      externalStartVideoCall(roomCode, myStream);
    }
    if (onlineRole === 'host' && externalIncomingCall) {
      externalAnswerIncomingCall(myStream);
    }
  }, [externalIsConnected, externalIncomingCall, onlineRole, roomCode]);

  useEffect(() => {
    if (externalRemoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = externalRemoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [externalRemoteStream]);

  // Sync logic
  useEffect(() => {
    if (!externalConnection) return;
    const handleData = (data: any) => {
      if (data.type === 'SYNC_ALL' && onlineRole === 'client') {
        setTimer(data.timer); setScore(data.score); setSubState(data.subState); setIsPaused(data.isPaused);
        setRemoteHand(data.p1Hand);
        bubbles.current = data.bubbles.map((b: any) => { const newB = new Bubble(1280, 720); Object.assign(newB, b); return newB; });
      }
      if (data.type === 'CLIENT_UPDATE' && onlineRole === 'host') {
        setRemoteHand(data.p2Hand);
        if (data.poppedIdx !== undefined) {
          const b = bubbles.current[data.poppedIdx];
          if (b && b.alive) { b.alive = false; setScore(s => ({ ...s, 2: s[2] + 10 })); for(let i=0; i<8; i++) particles.current.push(new PopParticle(b.x, b.y, PLAYER_COLORS[2])); }
        }
      }
      if (data.type === 'READY_CHECK') setReadyStatus(prev => ({ ...prev, [onlineRole === 'host' ? 2 : 1]: data.ready }));
    };
    externalConnection.on('data', handleData);
    return () => externalConnection.off('data', handleData);
  }, [externalConnection, onlineRole]);

  useEffect(() => {
    const init = async () => {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
      const handModel = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "GPU" },
        runningMode: "VIDEO", numHands: (isOnline ? 1 : mode)
      });
      const faceModel = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`, delegate: "GPU" },
        runningMode: "VIDEO"
      });
      setTrackers({ hand: handModel, face: faceModel });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.onloadeddata = () => setLoading(false); }
    };
    init();
  }, [mode, isOnline]);

  useEffect(() => {
    if (isOnline && onlineRole === 'client') return;
    if (subState === 'countdown') {
      const id = setInterval(() => { setCountdown(prev => {
          if (prev <= 1) { setSubState('playing'); bubbles.current = Array.from({ length: 35 }, () => new Bubble(1280, 720, Math.random() * 720)); clearInterval(id); return 0; }
          return prev - 1;
      }); }, 1000); return () => clearInterval(id);
    }
    if (subState === 'playing' && !isPaused) {
      const id = setInterval(() => { setTimer(prev => {
          if (prev <= 1) { setSubState('result'); clearInterval(id); return 0; }
          return prev - 1;
      }); }, 1000); return () => clearInterval(id);
    }
  }, [subState, isPaused, isOnline, onlineRole]);

  useEffect(() => {
    if (loading || !trackers) return;
    let animationId: number;
    const ctx = canvasRef.current?.getContext('2d');

    const render = () => {
      if (!ctx || !videoRef.current) return;
      const width = canvasRef.current!.width;
      const height = canvasRef.current!.height;

      ctx.save(); ctx.scale(-1, 1); ctx.translate(-width, 0);
      ctx.drawImage(videoRef.current, 0, 0, width, height); ctx.restore();

      if (isOnline && remoteVideoRef.current && externalRemoteStream) {
        if (remoteVideoRef.current.readyState >= 2) {
          ctx.save(); ctx.globalAlpha = 0.5; ctx.drawImage(remoteVideoRef.current, width/2, 0, width/2, height); ctx.restore();
        }
      }

      ctx.fillStyle = isPaused ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)'; ctx.fillRect(0,0,width,height);

      if (!isPaused && videoRef.current.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = videoRef.current.currentTime;
        const timestamp = performance.now();

        if (subState === 'lobby') {
          const faceRes = trackers.face.detectForVideo(videoRef.current, timestamp);
          const myP = isOnline ? (onlineRole === 'client' ? 2 : 1) : null;
          setFaceHold(prev => {
            const next = { 1: prev[1], 2: prev[2] };
            if (isOnline) {
                const detected = faceRes.detections.length > 0;
                const val = detected ? Math.min(prev[myP as 1|2] + 1, 40) : Math.max(prev[myP as 1|2] - 2, 0);
                next[myP as 1|2] = val;
                const isReady = val >= 30;
                if (readyStatus[myP as 1|2] !== isReady && externalConnection) externalConnection.send({ type: 'READY_CHECK', ready: isReady });
                setReadyStatus(rs => ({ ...rs, [myP as 1|2]: isReady }));
            } else {
                const d1 = faceRes.detections.some(d => (d.boundingBox!.originX + d.boundingBox!.width/2)/videoRef.current!.videoWidth > 0.5);
                const d2 = faceRes.detections.some(d => (d.boundingBox!.originX + d.boundingBox!.width/2)/videoRef.current!.videoWidth <= 0.5);
                next[1] = d1 ? Math.min(prev[1]+1, 40) : Math.max(prev[1]-2, 0);
                next[2] = d2 ? Math.min(prev[2]+1, 40) : Math.max(prev[2]-2, 0);
                setReadyStatus({ 1: next[1] >= 30, 2: mode === 1 ? true : next[2] >= 30 });
            }
            return next;
          });
          if (readyStatus[1] && readyStatus[2]) setSubState('countdown');
        }

        if (subState === 'playing') {
          const handRes = trackers.hand.detectForVideo(videoRef.current, timestamp);
          if (handRes.landmarks?.[0]) {
            const tip = handRes.landmarks[0][8];
            const x = (1 - tip.x) * width;
            const y = tip.y * height;
            const myP = isOnline ? (onlineRole === 'client' ? 2 : 1) : (tip.x > 0.5 ? 1 : 2);
            if (isOnline && externalConnection) externalConnection.send({ type: 'CLIENT_UPDATE', p2Hand: { x, y } });
            bubbles.current.forEach((b, idx) => {
              if (b.alive && b.checkPop(x, y)) {
                b.alive = false; setScore(s => ({ ...s, [myP]: s[myP as 1|2] + 10 }));
                for(let i=0; i<8; i++) particles.current.push(new PopParticle(b.x, b.y, PLAYER_COLORS[myP as 1|2]));
                if (isOnline && onlineRole === 'client' && externalConnection) externalConnection.send({ type: 'CLIENT_UPDATE', poppedIdx: idx, p2Hand: { x, y } });
              }
            });
            ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI*2); ctx.fillStyle = PLAYER_COLORS[myP as 1|2]; ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
          }
        }
      }

      if (!isPaused) {
        if (!isOnline || onlineRole === 'host') {
          bubbles.current.forEach(b => b.update(width)); bubbles.current = bubbles.current.filter(b => b.alive);
          while (bubbles.current.length < 35 && subState === 'playing') bubbles.current.push(new Bubble(width, height));
          if (externalConnection && isOnline) externalConnection.send({ type: 'SYNC_ALL', bubbles: bubbles.current, score, timer, subState, isPaused });
        }
        particles.current.forEach(p => p.update()); particles.current = particles.current.filter(p => p.life > 0);
      }
      bubbles.current.forEach(b => b.draw(ctx)); particles.current.forEach(p => p.draw(ctx));

      if (remoteHand && isOnline) {
        const otherP = onlineRole === 'client' ? 1 : 2;
        ctx.beginPath(); ctx.arc(remoteHand.x, remoteHand.y, 12, 0, Math.PI*2); ctx.fillStyle = PLAYER_COLORS[otherP as 1|2]; ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
      }
      if (!isOnline && mode === 2) {
        ctx.beginPath(); ctx.setLineDash([10,10]); ctx.moveTo(width/2,0); ctx.lineTo(width/2,height);
        ctx.strokeStyle = 'rgba(59,130,246,0.3)'; ctx.stroke(); ctx.setLineDash([]);
      }
      animationId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationId);
  }, [loading, trackers, subState, readyStatus, mode, isPaused, isOnline, onlineRole, externalConnection, remoteHand, score, timer, externalRemoteStream]);

  const handleAbort = () => { localStorage.removeItem('bubble_arena_state'); onBack(); };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden flex items-center justify-center font-sans text-white text-left">
      <video ref={videoRef} className="hidden" autoPlay playsInline muted width={1280} height={720} />
      <video ref={remoteVideoRef} className="hidden" autoPlay playsInline width={1280} height={720} />
      <canvas ref={canvasRef} width={1280} height={720} className="h-full w-full object-contain" />

      {isOnline && (
        <div className="absolute top-10 left-10 flex flex-col gap-3 z-50 pointer-events-auto">
          <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border backdrop-blur-xl transition-all ${externalIsConnected ? 'bg-green-500/10 border-green-500/50 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.2)]' : 'bg-slate-950/80 border-slate-800 text-slate-500'}`}>
            <Wifi size={16} className={externalIsConnected ? '' : 'animate-pulse'} />
            <span className="text-[10px] font-black tracking-widest uppercase">{externalIsConnected ? 'Neural_Link_Stable' : 'Establishing_Link...'}</span>
          </div>
          {onlineRole === 'host' && !externalIsConnected && (
            <button onClick={() => { navigator.clipboard.writeText(externalMyId); alert('Room Code Copied!'); }} className="group flex items-center justify-between bg-slate-900 border-2 border-blue-500/50 p-2 pr-8 rounded-2xl text-white hover:border-blue-600 transition-all shadow-[0_0_30px_rgba(59,130,246,0.3)] text-left">
              <div className="p-4 bg-blue-600 rounded-xl group-hover:scale-110 transition-transform shadow-lg"><Copy size={20}/></div>
              <div className="flex flex-col items-start ml-6">
                <span className="text-[10px] text-blue-400 font-black uppercase tracking-[0.3em] mb-1 leading-none">Room Protocol ID</span>
                <span className="text-4xl font-black font-mono tracking-[0.2em] uppercase leading-none">{externalMyId}</span>
              </div>
            </button>
          )}
        </div>
      )}

      {subState === 'lobby' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none gap-20">
          {(isOnline ? [onlineRole === 'host' ? 1 : 2] : (mode === 2 ? [1, 2] : [1])).map(p => (
            <motion.div key={p} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`p-12 rounded-[2.5rem] backdrop-blur-2xl border-2 transition-all ${readyStatus[p as 1|2] ? 'bg-green-500/10 border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.2)]' : 'bg-slate-950/60 border-slate-800'}`}>
              <div className={`w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center transition-colors ${readyStatus[p as 1|2] ? 'bg-green-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}><UserCheck size={48} /></div>
              <h3 className="text-3xl font-black italic tracking-tighter text-white mb-2 text-center uppercase">{isOnline && p === (onlineRole === 'host' ? 1 : 2) ? 'YOU' : `PLAYER 0${p}`}</h3>
              <p className={`text-[10px] font-mono text-center tracking-[0.3em] ${readyStatus[p as 1|2] ? 'text-green-400' : 'text-slate-500'}`}>{readyStatus[p as 1|2] ? 'SYNC_COMPLETE' : 'SCANNING_FACE...'}</p>
              <div className="w-full h-1 bg-slate-800 rounded-full mt-6 overflow-hidden">
                <motion.div className={`h-full ${readyStatus[p as 1|2] ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)]' : 'bg-blue-500'}`} animate={{ width: `${(faceHold[p as 1|2]/40)*100}%` }} />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {subState === 'countdown' && (
        <motion.div initial={{ scale: 3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute text-[15rem] font-black italic text-blue-500 drop-shadow-[0_0_80px_rgba(59,130,246,0.5)] uppercase tracking-tighter leading-none">
          {countdown > 0 ? countdown : 'GO!'}
        </motion.div>
      )}

      {subState === 'playing' && (
        <div className="absolute top-10 inset-x-0 flex justify-center pointer-events-none text-white">
          <div className="bg-slate-900/90 backdrop-blur-2xl px-12 py-5 rounded-3xl border border-white/10 flex items-center gap-12 shadow-2xl">
              <div className="text-left leading-tight uppercase"><p className="text-[10px] text-blue-400 font-black tracking-widest mb-1">P1_Score</p><p className="text-4xl font-black italic">{score[1]}</p></div>
              <div className="flex flex-col items-center px-10 border-x border-white/5 text-center leading-none">
                <p className="text-3xl font-mono font-black italic text-white mb-1">{timer}s</p>
                <div className="h-1 w-20 bg-slate-800 rounded-full overflow-hidden"><motion.div className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)]" animate={{ width: `${(timer/60)*100}%` }} /></div>
              </div>
              <div className="text-right leading-tight uppercase"><p className="text-[10px] text-orange-400 font-black tracking-widest mb-1">P2_Score</p><p className="text-4xl font-black italic">{score[2]}</p></div>
          </div>
        </div>
      )}

      {subState === 'result' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-950/98 backdrop-blur-3xl flex flex-col items-center justify-center z-[70] text-white">
          <h2 className="text-7xl font-black italic tracking-tighter text-white mb-24 uppercase font-black">Results_Analyzed</h2>
          <div className="flex gap-16">
            {(mode === 2 ? [1, 2] : [1]).map(p => {
               const win = (mode === 2) ? (score[p as 1|2] >= Math.max(score[1], score[2]) && score[1] !== score[2]) : true;
               return (
                <div key={p} className={`relative p-12 rounded-[3rem] border-4 transition-all ${win ? 'bg-yellow-500/5 border-yellow-500 shadow-[0_0_60px_rgba(234,179,8,0.2)]' : 'bg-red-500/5 border-red-500/30'}`}>
                    <p className="text-8xl font-black text-white mb-4 text-center">{score[p as 1|2]}</p>
                    <p className={`text-xl font-bold tracking-[0.2em] text-center uppercase ${win ? 'text-yellow-500' : 'text-red-500'}`}>{win ? 'VICTORIOUS' : 'DEFEATED'}</p>
                    {win && <motion.div animate={{ y: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute -top-20 left-1/2 -translate-x-1/2"><Trophy size={80} className="text-yellow-500 fill-current" /></motion.div>}
                </div>
               );
            })}
          </div>
          <button onClick={handleAbort} className="mt-24 px-16 py-5 bg-slate-900 hover:bg-white hover:text-black text-white font-black italic rounded-3xl transition-all border border-slate-700 shadow-2xl uppercase tracking-widest leading-none">Back_To_Citadel</button>
        </motion.div>
      )}

      <div className="absolute top-10 right-10 flex gap-4 pointer-events-auto z-[110]">
          {subState === 'playing' && (
            <button onClick={() => setIsPaused(!isPaused)} className="p-4 bg-slate-900/80 border border-blue-500/30 rounded-2xl text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-xl">
              {isPaused ? <Play fill="currentColor" size={20}/> : <Pause fill="currentColor" size={20}/>}
            </button>
          )}
          <button onClick={handleAbort} className="p-4 bg-slate-900/80 border border-red-500/30 rounded-2xl text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-xl"><XCircle size={20}/></button>
      </div>

      <AnimatePresence>
        {isPaused && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center">
            <h2 className="text-7xl font-black italic text-white mb-12 tracking-tighter uppercase font-black tracking-widest leading-none">Paused</h2>
            <button onClick={() => setIsPaused(false)} className="px-16 py-6 bg-blue-600 hover:bg-blue-500 text-white font-black italic rounded-3xl text-2xl shadow-2xl transition-all flex items-center gap-4 text-white">
              <Play fill="currentColor" size={24} /> RESUME_PROTOCOL
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#010409]">
          <div className="w-24 h-24 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-8" />
          <p className="text-blue-500 font-mono text-sm tracking-[0.6em] animate-pulse uppercase leading-none">Syncing_Neural_Link...</p>
        </div>
      )}
    </div>
  );
};

const Pause = ({ fill, size }: { fill?: string, size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>;
const Play = ({ fill, size }: { fill?: string, size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>;

export default GameManager;
