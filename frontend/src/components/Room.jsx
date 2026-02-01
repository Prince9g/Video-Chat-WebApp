import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketProvider";
import Peer from "../service/Peer";

const Room = () => {
  const socket = useSocket();

  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // ------------------ SOCKET EVENTS ------------------

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
  }, [socket]);

  // ------------------ PEER EVENTS ------------------

  useEffect(() => {
    Peer.peer.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      remoteVideoRef.current.srcObject = stream;
    };

    Peer.peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: remoteSocketId,
          candidate: event.candidate,
        });
      }
    };
  }, [remoteSocketId, socket]);

  // ------------------ CALL LOGIC ------------------

  const getMediaStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    setMyStream(stream);
    myVideoRef.current.srcObject = stream;

    stream.getTracks().forEach((track) => {
      Peer.peer.addTrack(track, stream);
    });
  };

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

  // ------------------ UI ------------------

  return (
    <div>
      <h2>1-to-1 Video Call</h2>

      {remoteSocketId && (
        <button onClick={handleCallUser}>Start Call</button>
      )}

      <div style={{ display: "flex", gap: "20px" }}>
        <video
          ref={myVideoRef}
          autoPlay
          muted
          playsInline
          width="300"
          height="200"
        />

        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          width="300"
          height="200"
        />
      </div>
    </div>
  );
};

export default Room;
