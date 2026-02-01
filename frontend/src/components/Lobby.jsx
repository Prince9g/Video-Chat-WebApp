import React from 'react'
import { useState } from 'react';
import {useSocket} from '../context/SocketProvider';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
const Lobby = () => {
    const [email, setEmail] = useState('');
    const [roomId, setRoomId] = useState('');
    const socket = useSocket();
    const navigate = useNavigate();
    const handleSubmit = (e) => {
        e.preventDefault();
        socket.emit('join-room', {email, roomId});
    }
    const handleJoinRoom = (data) => {
        const {email, roomId} = data;
        navigate(`/room/${roomId}`);
        console.log(`Joined room ${roomId} as ${email}`);
    }
    useEffect(()=>{
        socket.on('join-room', handleJoinRoom);
        return () => {
            socket.off('join-room', handleJoinRoom);
        }
    },[socket])
  return (
    <div>
      <h1>Lobby</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email:</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" />
        <label htmlFor="roomId">Room ID:</label>
        <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Enter Room ID" />
        <button type="submit">Join Room</button>
      </form>
    </div>
  )
}

export default Lobby
