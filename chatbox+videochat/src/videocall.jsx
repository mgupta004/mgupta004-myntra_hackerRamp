import React ,{useState,useEffect,useRef,useMemo} from "react";
import { app } from './firee12';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import "./videocall.css";

function VideoCall() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callId, setCallId] = useState('');
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  const servers = {
    iceServers: [
      {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  const pc = useMemo(() => new RTCPeerConnection(servers), []);
  const firestore = getFirestore(app);

  useEffect(() => {
    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };
  }, [pc]);

  const startCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const callDocRef = await addDoc(collection(firestore, 'calls'), {});
    const offerCandidates = collection(callDocRef, 'offerCandidates');
    const answerCandidates = collection(callDocRef, 'answerCandidates');

    setCallId(callDocRef.id);
    alert(`Call ID: ${callDocRef.id}`);

    pc.onicecandidate = (event) => {
      event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
    };

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };
    await setDoc(callDocRef, { offer });

    onSnapshot(callDocRef, (snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
      }
    });

    onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
  };

  const startCam = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  };

  const acceptCall = async () => {
    if (!callId) {
      alert("Call ID is required");
      return;
    }

    try {
      const callDocRef = doc(firestore, 'calls', callId);
      const answerCandidates = collection(callDocRef, 'answerCandidates');
      const offerCandidates = collection(callDocRef, 'offerCandidates');

      pc.onicecandidate = (event) => {
        event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
      };

      const callDoc = await getDoc(callDocRef);
      const callData = callDoc.data();

      if (callData && callData.offer) {
        const offerDescription = callData.offer;
        await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);

        const answer = {
          type: answerDescription.type,
          sdp: answerDescription.sdp,
        };
        await updateDoc(callDocRef, { answer });

        onSnapshot(offerCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              let data = change.doc.data();
              pc.addIceCandidate(new RTCIceCandidate(data));
            }
          });
        });
      } else {
        alert("Invalid Call ID or Offer not found");
      }
    } catch (error) {
      console.error("Error accepting call: ", error);
    }
  };

  useEffect(() => {
    if (localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream]);

  useEffect(() => {
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        alert('Call Disconnected...');
      }
    };
  }, [pc]);

  const stopCamera = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
    }
  };
  const stopMicrophone = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }
  }

  const hangupCall = () => {
    setLocalStream(null);
    setRemoteStream(null);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    pc.close();
    setCallId('');
    console.log('Call Ended');
  };

  return (
    <div>
      <h1>Video Call</h1>
      <div className="vc-grp">
      <video
        className="tm2"
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
      ></video>
      <video
        className='tm2'
        ref={remoteVideoRef}
        autoPlay
        playsInline
      ></video>
      </div>
      <div className="btn-grp">
      <button onClick={startCall}>Create Key</button>
      <button onClick={startCam}>Start Camera</button>
      <button onClick={acceptCall}>Accept Call</button>
      <button onClick={stopCamera}>Stop Camera</button>
      <button onClick={stopMicrophone}>Stop Microphone</button>
      <button onClick={hangupCall}>Hangup Call</button>
      <input
        value={callId}
        onChange={(e) => setCallId(e.target.value)}
        placeholder="Enter Call ID"
      />
      </div>
    </div>
  );
}

export default VideoCall;
