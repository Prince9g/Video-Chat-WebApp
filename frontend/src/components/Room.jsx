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

  // video refs
  const myMainRef = useRef(null);
  const myTileRef = useRef(null);
  const remoteMainRef = useRef(null);
  const remoteTileRef = useRef(null);

  // ---------------- SOCKET EVENTS ----------------

  useEffect(() => {
    socket.on("user-joined", ({ id }) => {
      if (remoteSocketId) {
        alert("Room already has 2 participants");
        return;
      }
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

  // ---------------- PEER EVENTS ----------------

  useEffect(() => {
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
  }, [remoteSocketId, socket]);

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
  };

  const handleIceCandidate = async ({ candidate }) => {
    await Peer.peer.addIceCandidate(new RTCIceCandidate(candidate));
  };

  // ---------------- END CALL ----------------

  const handleEndCall = () => {
    if (myStream) myStream.getTracks().forEach((t) => t.stop());
    if (remoteStream) remoteStream.getTracks().forEach((t) => t.stop());

    Peer.peer.close();

    Peer.peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" },
      ],
    });

    setMyStream(null);
    setRemoteStream(null);
    setRemoteSocketId(null);
    setIsRemoteMain(true);

    navigate("/");
  };

  // ---------------- UI HELPERS ----------------

  const swapVideos = () => {
    setIsRemoteMain((prev) => !prev);
  };

  // ---------------- UI ----------------

  return (
    <div className="h-screen w-screen bg-black relative overflow-hidden">

      {/* WAITING SCREEN */}
      {!remoteSocketId && !myStream && (
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-white text-2xl font-semibold">
            Waiting for someone to join…
          </h1>
        </div>
      )}

      {/* MAIN VIDEO */}
      {(myStream || remoteStream) && (
        <>
          {isRemoteMain ? (
            <video
              ref={remoteMainRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              ref={myMainRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          )}
        </>
      )}

      {/* TILE VIDEO */}
      {(myStream || remoteStream) && (
        <div
          onClick={swapVideos}
          className="absolute bottom-4 right-4 w-40 h-28 rounded-lg overflow-hidden border-2 border-white cursor-pointer shadow-lg bg-black"
        >
          {isRemoteMain ? (
            <video
              ref={myTileRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              ref={remoteTileRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          )}
        </div>
      )}

      {/* START CALL BUTTON */}
      {remoteSocketId && !remoteStream && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={handleCallUser}
            className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-full text-white font-semibold text-lg"
          >
            Start Call
          </button>
        </div>
      )}

      {/* END CALL BUTTON */}
      {(myStream || remoteStream) && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <button
            onClick={handleEndCall}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full text-white font-semibold"
          >
            End Call
          </button>
        </div>
      )}
    </div>
  );
};

export default Room;
