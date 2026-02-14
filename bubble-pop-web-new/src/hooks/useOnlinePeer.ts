import { useEffect, useState } from 'react';
import { Peer } from 'peerjs';

export type PeerStatus = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

const generateShortId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export const useOnlinePeer = () => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [myId, setMyId] = useState<string>('');
  const [connection, setConnection] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<PeerStatus>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [incomingCall, setIncomingCall] = useState<any>(null); // Pindah ke State
  
  useEffect(() => {
    const shortId = generateShortId();
    const newPeer = new Peer(shortId);
    
    newPeer.on('open', (id) => {
      setMyId(id);
      setPeer(newPeer);
    });

    newPeer.on('connection', (conn) => {
      setConnection(conn);
      setStatus('CONNECTED');
      conn.on('close', () => setStatus('DISCONNECTED'));
    });

    // Pas ada panggilan video masuk
    newPeer.on('call', (call) => {
      console.log('Incoming video call from:', call.peer);
      setIncomingCall(call);
    });

    newPeer.on('error', (err) => {
      if (err.type === 'peer-unavailable') {
        setErrorMsg('Invalid Room Code or Host Offline');
        setStatus('ERROR');
      } else if (err.type === 'unavailable-id') {
        window.location.reload(); // Refresh aja kalau ID bentrok
      }
    });

    return () => newPeer.destroy();
  }, []);

  const connectToRoom = (targetId: string) => {
    if (!peer) return;
    setStatus('CONNECTING');
    const conn = peer.connect(targetId.toUpperCase(), { reliable: true });
    conn.on('open', () => {
      setConnection(conn);
      setStatus('CONNECTED');
    });
  };

  const startVideoCall = (targetId: string, localStream: MediaStream) => {
    if (!peer) return;
    console.log('Initiating call to:', targetId);
    const call = peer.call(targetId.toUpperCase(), localStream);
    call.on('stream', (stream) => {
      console.log('Received remote stream from Host');
      setRemoteStream(stream);
    });
  };

  const answerIncomingCall = (localStream: MediaStream) => {
    if (incomingCall) {
      console.log('Answering call...');
      incomingCall.answer(localStream);
      incomingCall.on('stream', (stream: MediaStream) => {
        console.log('Received remote stream from Client');
        setRemoteStream(stream);
      });
    }
  };

  return { 
    peer, myId, connection, remoteStream, status, errorMsg,
    connectToRoom, startVideoCall, answerIncomingCall,
    incomingCall
  };
};
