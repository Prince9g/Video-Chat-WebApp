import React, { useState } from "react";
import { useSocket } from "../context/SocketProvider";
import { useNavigate } from "react-router-dom";

const Lobby = () => {
  const socket = useSocket();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [roomId, setRoomId] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!email || !roomId) return;

    // Emit join-room (backend already handles this)
    socket.emit("join-room", { email, roomId });

    // Navigate immediately (backend does not send confirmation)
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-6">
          Join Video Room
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm mb-1 text-gray-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-300">
              Room ID
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter Room ID"
              className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={!email || !roomId}
            className={`w-full py-2 rounded-lg font-semibold transition
              ${
                email && roomId
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-gray-600 cursor-not-allowed"
              }`}
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
};

export default Lobby;
