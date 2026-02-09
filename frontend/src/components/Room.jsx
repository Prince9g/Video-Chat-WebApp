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
  const peerSetupRef = useRef(false);

  // ---------------- JOIN ROOM ----------------
  useEffect(() => {
    socket.emit("join-room", { roomId });
  }, [socket, roomId]);

  // ---------------- INITIALIZE PEER ----------------
  useEffect(() => {
    if (!peerSetupRef.current) {
      setupPeerListeners();
      peerSetupRef.current = true;
    }
  }, []);

  const setupPeerListeners = () => {
    console.log("Setting up peer listeners");
    
    // Handle incoming remote stream
    Peer.peer.ontrack = (event) => {
      console.log("Received remote track:", event.streams[0]);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Handle ICE candidates
    Peer.peer.onicecandidate = (event) => {
      if (event.candidate && remoteSocketId) {
        socket.emit("ice-candidate", {
          to: remoteSocketId,
          candidate: event.candidate,
        });
      }
    };
  };

  // ---------------- SOCKET EVENTS ----------------
  useEffect(() => {
    const handleUserJoined = ({ id }) => {
      console.log("User joined:", id);
      setRemoteSocketId(id);
    };

    const handleCallMade = async ({ from, offer }) => {
      console.log("Received call from:", from);
      await handleIncomingCall({ from, offer });
    };

    const handleAnswerMade = async ({ answer }) => {
      console.log("Received answer");
      await handleAnswer({ answer });
    };

    const handleIceCandidateReceived = async ({ candidate }) => {
      console.log("Received ICE candidate");
      await handleIceCandidate({ candidate });
    };

    socket.on("user-joined", handleUserJoined);
    socket.on("call-made", handleCallMade);
    socket.on("answer-made", handleAnswerMade);
    socket.on("ice-candidate", handleIceCandidateReceived);

    return () => {
      socket.off("user-joined", handleUserJoined);
      socket.off("call-made", handleCallMade);
      socket.off("answer-made", handleAnswerMade);
      socket.off("ice-candidate", handleIceCandidateReceived);
    };
  }, [socket, remoteSocketId]);

  // ---------------- FIXED: VIDEO ELEMENT UPDATES ----------------
  // Use separate effects for each video element to ensure they update properly
  useEffect(() => {
    if (myMainRef.current && myStream) {
      console.log("Setting my stream to main video");
      myMainRef.current.srcObject = myStream;
      
      // Force play
      myMainRef.current.play().catch(e => {
        console.error("Error playing my main video:", e);
      });
    }
  }, [myStream, myMainRef.current]);

  useEffect(() => {
    if (myTileRef.current && myStream) {
      console.log("Setting my stream to tile video");
      myTileRef.current.srcObject = myStream;
      
      // Force play
      myTileRef.current.play().catch(e => {
        console.error("Error playing my tile video:", e);
      });
    }
  }, [myStream, myTileRef.current]);

  useEffect(() => {
    if (remoteMainRef.current && remoteStream) {
      console.log("Setting remote stream to main video");
      remoteMainRef.current.srcObject = remoteStream;
      
      // Force play
      remoteMainRef.current.play().catch(e => {
        console.error("Error playing remote main video:", e);
      });
    }
  }, [remoteStream, remoteMainRef.current]);

  useEffect(() => {
    if (remoteTileRef.current && remoteStream) {
      console.log("Setting remote stream to tile video");
      remoteTileRef.current.srcObject = remoteStream;
      
      // Force play
      remoteTileRef.current.play().catch(e => {
        console.error("Error playing remote tile video:", e);
      });
    }
  }, [remoteStream, remoteTileRef.current]);

  // ---------------- GET MEDIA STREAM ----------------
  const getMediaStream = async () => {
    if (myStream) {
      return myStream;
    }

    try {
      console.log("Requesting media stream...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      console.log("Stream obtained, tracks:", stream.getTracks());
      
      // Update state first
      setMyStream(stream);
      
      // Add tracks to peer connection
      setTimeout(() => {
        stream.getTracks().forEach((track) => {
          try {
            // Check if track is already added
            const existingSenders = Peer.peer.getSenders();
            const alreadyAdded = existingSenders.some(
              sender => sender.track && sender.track.id === track.id
            );
            
            if (!alreadyAdded) {
              Peer.peer.addTrack(track, stream);
              console.log(`Added ${track.kind} track to peer`);
            }
          } catch (error) {
            console.error("Error adding track:", error);
          }
        });
      }, 100);

      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      alert("Could not access camera/microphone. Please check permissions.");
      throw error;
    }
  };

  // ---------------- CALL FLOW ----------------
  const handleCallUser = async () => {
    try {
      console.log("Calling user:", remoteSocketId);
      const stream = await getMediaStream();
      
      // Wait a moment for stream to be ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const offer = await Peer.getOffer();
      console.log("Offer created");
      
      socket.emit("call-user", {
        to: remoteSocketId,
        offer,
      });
    } catch (error) {
      console.error("Call error:", error);
    }
  };

  const handleIncomingCall = async ({ from, offer }) => {
    try {
      console.log("Incoming call from:", from);
      setRemoteSocketId(from);
      
      const stream = await getMediaStream();
      
      await Peer.setRemoteDescription(offer);
      const answer = await Peer.getAnswer(offer);
      
      socket.emit("make-answer", {
        to: from,
        answer,
      });

      // Process queued ICE candidates
      if (iceQueue.current.length > 0) {
        iceQueue.current.forEach(candidate => {
          Peer.peer.addIceCandidate(new RTCIceCandidate(candidate));
        });
        iceQueue.current = [];
      }
    } catch (error) {
      console.error("Incoming call error:", error);
    }
  };

  const handleAnswer = async ({ answer }) => {
    try {
      await Peer.setRemoteDescription(answer);
      
      // Process queued ICE candidates
      if (iceQueue.current.length > 0) {
        iceQueue.current.forEach(candidate => {
          Peer.peer.addIceCandidate(new RTCIceCandidate(candidate));
        });
        iceQueue.current = [];
      }
    } catch (error) {
      console.error("Answer error:", error);
    }
  };

  const handleIceCandidate = async ({ candidate }) => {
    try {
      if (Peer.peer.remoteDescription) {
        await Peer.peer.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        iceQueue.current.push(candidate);
      }
    } catch (error) {
      console.error("ICE candidate error:", error);
    }
  };

  // ---------------- CAMERA / MIC TOGGLE ----------------
  const toggleCamera = () => {
    if (!myStream) return;
    
    const videoTracks = myStream.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = !track.enabled;
      setIsCameraOn(track.enabled);
      console.log("Camera enabled:", track.enabled);
    });
    
    // Force video elements to update
    if (myMainRef.current) {
      myMainRef.current.srcObject = myStream;
    }
    if (myTileRef.current) {
      myTileRef.current.srcObject = myStream;
    }
  };

  const toggleMic = () => {
    if (!myStream) return;
    
    const audioTracks = myStream.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !track.enabled;
      setIsMicOn(track.enabled);
      console.log("Mic enabled:", track.enabled);
    });
  };

  // ---------------- END CALL ----------------
  const handleEndCall = () => {
    if (myStream) {
      myStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
    }
    
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    
    Peer.reset();
    setMyStream(null);
    setRemoteStream(null);
    setRemoteSocketId(null);
    iceQueue.current = [];
    peerSetupRef.current = false;
    
    navigate("/");
  };

  // ---------------- FIXED UI WITH BETTER VIDEO HANDLING ----------------
  return (
    <div className="h-screen w-screen bg-black relative overflow-hidden">
      {/* Waiting screen */}
      {!remoteSocketId && !myStream && (
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-white text-2xl">Waiting for someone to join…</h1>
        </div>
      )}

      {/* Main video display */}
      <div className="h-full w-full">
        {/* Remote video as main */}
        {isRemoteMain && remoteStream && (
          <video
            key="remote-main"
            ref={remoteMainRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover absolute inset-0"
            muted={false}
          />
        )}
        
        {/* My video as main */}
        {!isRemoteMain && myStream && (
          <video
            key="my-main"
            ref={myMainRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover absolute inset-0"
            muted={true}
          />
        )}
        
        {/* Fallback if no stream */}
        {!myStream && !remoteStream && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-xl">Loading...</p>
            </div>
          </div>
        )}
      </div>

      {/* Picture-in-picture tile */}
      {(myStream || remoteStream) && (
        <div
          onClick={() => setIsRemoteMain(!isRemoteMain)}
          className="absolute bottom-4 right-4 w-48 h-32 border-2 border-white cursor-pointer rounded-lg overflow-hidden bg-gray-800"
          style={{ zIndex: 50 }}
        >
          {isRemoteMain ? (
            <video
              key="my-tile"
              ref={myTileRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
              muted={true}
            />
          ) : (
            <video
              key="remote-tile"
              ref={remoteTileRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
              muted={false}
            />
          )}
          <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            {isRemoteMain ? "You" : "Remote"}
          </div>
        </div>
      )}

      {/* Call initiation button */}
      {remoteSocketId && !remoteStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <button
            onClick={handleCallUser}
            className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-full text-white font-semibold text-lg transition-all transform hover:scale-105"
          >
            Start Video Call
          </button>
          <p className="text-gray-300">Connected to user. Ready to call!</p>
        </div>
      )}

      {/* Call controls */}
      {(myStream || remoteStream) && (
        <>
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex gap-4">
            <button
              onClick={toggleMic}
              className={`px-6 py-3 rounded-full text-white font-medium transition-all ${
                isMicOn 
                  ? "bg-blue-600 hover:bg-blue-700" 
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isMicOn ? "🔈 Mute" : "🔇 Unmute"}
            </button>

            <button
              onClick={toggleCamera}
              className={`px-6 py-3 rounded-full text-white font-medium transition-all ${
                isCameraOn 
                  ? "bg-blue-600 hover:bg-blue-700" 
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isCameraOn ? "📹 Camera Off" : "📷 Camera On"}
            </button>
          </div>

          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
            <button
              onClick={handleEndCall}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 rounded-full text-white font-semibold transition-all transform hover:scale-105"
            >
              🚪 End Call
            </button>
          </div>
        </>
      )}

      {/* Debug info */}
      <div className="absolute top-4 left-4 text-white text-sm bg-black bg-opacity-50 p-2 rounded">
        <div>Room: {roomId}</div>
        <div>Local Stream: {myStream ? "✅" : "❌"}</div>
        <div>Remote Stream: {remoteStream ? "✅" : "❌"}</div>
        <div>Remote User: {remoteSocketId ? "✅" : "❌"}</div>
      </div>
    </div>
  );
};

export default Room;