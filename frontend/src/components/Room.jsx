import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketProvider";
import Peer from "../service/Peer";
import { useNavigate, useParams } from "react-router-dom";

const Room = () => {
  const socket = useSocket();
  const navigate = useNavigate();
  const { roomId } = useParams();

  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isRemoteMain, setIsRemoteMain] = useState(true);

  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  const myMainRef = useRef(null);
  const myTileRef = useRef(null);
  const remoteMainRef = useRef(null);
  const remoteTileRef = useRef(null);

  const iceQueue = useRef([]);

  // ---------------- JOIN ROOM ----------------

  useEffect(() => {
    socket.emit("join-room", { roomId });
  }, [socket, roomId]);

  // ---------------- PEER LISTENERS ----------------

  const setupPeerListeners = () => {
    Peer.peer.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
    };

    Peer.peer.onicecandidate = (event) => {
      if (event.candidate && remoteSocketId) {
        socket.emit("ice-candidate", {
          to: remoteSocketId,
          candidate: event.candidate,
        });
      }
    };
  };

  useEffect(() => {
    setupPeerListeners();
  }, []);

  // ---------------- SOCKET EVENTS ----------------

  useEffect(() => {
    socket.on("user-joined", ({ id }) => {
      setRemoteSocketId(id);
    });

    socket.on("call-made", handleIncomingCall);
    socket.on("answer-made", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);

    socket.on("room-full", () => {
      alert("Room already has 2 participants");
      navigate("/");
    });

    return () => {
      socket.off("user-joined");
      socket.off("call-made");
      socket.off("answer-made");
      socket.off("ice-candidate");
      socket.off("room-full");
    };
  }, [socket, remoteSocketId]);

  // ---------------- STREAM ASSIGNMENT ----------------

  useEffect(() => {
    if (myStream) {
      myMainRef.current.srcObject = myStream;
      myTileRef.current.srcObject = myStream;
    }
  }, [myStream]);

  useEffect(() => {
    if (remoteStream) {
      remoteMainRef.current.srcObject = remoteStream;
      remoteTileRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // ---------------- MEDIA ----------------

  const getMediaStream = async () => {
    if (myStream) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    setMyStream(stream);

    stream.getTracks().forEach((track) => {
      Peer.peer.addTrack(track, stream);
    });
  };

  // ---------------- CALL FLOW ----------------

  const handleCallUser = async () => {
    await getMediaStream();
    const offer = await Peer.getOffer();

    socket.emit("call-user", {
      to: remoteSocketId,
      offer,
    });
  };

  const handleIncomingCall = async ({ from, offer }) => {
    setRemoteSocketId(from);
    await getMediaStream();

    const answer = await Peer.getAnswer(offer);

    socket.emit("make-answer", {
      to: from,
      answer,
    });
  };

  const handleAnswer = async ({ answer }) => {
    await Peer.setRemoteDescription(answer);

    iceQueue.current.forEach((c) =>
      Peer.peer.addIceCandidate(new RTCIceCandidate(c))
    );
    iceQueue.current = [];
  };

  const handleIceCandidate = async ({ candidate }) => {
    if (Peer.peer.remoteDescription) {
      await Peer.peer.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      iceQueue.current.push(candidate);
    }
  };

  // ---------------- CAMERA / MIC ----------------

  const toggleCamera = () => {
    if (!myStream) return;

    myStream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setIsCameraOn(track.enabled);
    });
  };

  const toggleMic = () => {
    if (!myStream) return;

    myStream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setIsMicOn(track.enabled);
    });
  };

  // ---------------- END CALL ----------------

  const handleEndCall = () => {
    myStream?.getTracks().forEach((t) => t.stop());
    remoteStream?.getTracks().forEach((t) => t.stop());

    Peer.reset();
    setupPeerListeners();

    setMyStream(null);
    setRemoteStream(null);
    setRemoteSocketId(null);
    setIsRemoteMain(true);

    navigate("/");
  };

  // ---------------- UI ----------------

  return (
    <div className="h-screen w-screen bg-black relative overflow-hidden">

      {!remoteSocketId && !myStream && (
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-white text-2xl">Waiting for someone to join…</h1>
        </div>
      )}

      {(myStream || remoteStream) && (
        <>
          {isRemoteMain ? (
            <video ref={remoteMainRef} autoPlay playsInline className="h-full w-full object-cover" />
          ) : (
            <video ref={myMainRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          )}
        </>
      )}

      {(myStream || remoteStream) && (
        <div
          onClick={() => setIsRemoteMain((p) => !p)}
          className="absolute bottom-4 right-4 w-40 h-28 border-2 border-white cursor-pointer"
        >
          {isRemoteMain ? (
            <video ref={myTileRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          ) : (
            <video ref={remoteTileRef} autoPlay playsInline className="h-full w-full object-cover" />
          )}
        </div>
      )}

      {remoteSocketId && !remoteStream && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button onClick={handleCallUser} className="px-8 py-4 bg-green-600 rounded-full text-white">
            Start Call
          </button>
        </div>
      )}

      {(myStream || remoteStream) && (
        <>
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-4">
            <button
              onClick={toggleMic}
              className={`px-4 py-3 rounded-full text-white ${isMicOn ? "bg-gray-700" : "bg-red-600"}`}
            >
              {isMicOn ? "Mute" : "Unmute"}
            </button>

            <button
              onClick={toggleCamera}
              className={`px-4 py-3 rounded-full text-white ${isCameraOn ? "bg-gray-700" : "bg-red-600"}`}
            >
              {isCameraOn ? "Camera Off" : "Camera On"}
            </button>
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <button onClick={handleEndCall} className="px-6 py-3 bg-red-600 rounded-full text-white">
              End Call
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Room;
