import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketProvider";
import Peer from "../service/Peer";
import { useNavigate } from "react-router-dom";

const Room = () => {
  const socket = useSocket();
  const navigate = useNavigate();

  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isRemoteMain, setIsRemoteMain] = useState(true);

  const myMainRef = useRef(null);
  const myTileRef = useRef(null);
  const remoteMainRef = useRef(null);
  const remoteTileRef = useRef(null);

  const iceQueue = useRef([]);

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

    Peer.peer.onconnectionstatechange = () => {
      console.log("PC state:", Peer.peer.connectionState);
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

    return () => {
      socket.off("user-joined");
      socket.off("call-made");
      socket.off("answer-made");
      socket.off("ice-candidate");
    };
  }, [socket, remoteSocketId]);

  // ---------------- STREAM ASSIGNMENT ----------------

  useEffect(() => {
    if (myStream) {
      if (myMainRef.current) myMainRef.current.srcObject = myStream;
      if (myTileRef.current) myTileRef.current.srcObject = myStream;
    }
  }, [myStream]);

  useEffect(() => {
    if (remoteStream) {
      if (remoteMainRef.current) remoteMainRef.current.srcObject = remoteStream;
      if (remoteTileRef.current) remoteTileRef.current.srcObject = remoteStream;
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
          <h1 className="text-white text-2xl font-semibold">
            Waiting for someone to join…
          </h1>
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
          className="absolute bottom-4 right-4 w-40 h-28 rounded-lg overflow-hidden border-2 border-white cursor-pointer"
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
          <button
            onClick={handleCallUser}
            className="px-8 py-4 bg-green-600 rounded-full text-white font-semibold"
          >
            Start Call
          </button>
        </div>
      )}

      {(myStream || remoteStream) && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <button
            onClick={handleEndCall}
            className="px-6 py-3 bg-red-600 rounded-full text-white font-semibold"
          >
            End Call
          </button>
        </div>
      )}
    </div>
  );
};

export default Room;
