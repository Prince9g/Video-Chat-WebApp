import React from 'react'
import { useContext } from 'react';
import { createContext } from 'react'
import {io} from 'socket.io-client';


const SocketContext = createContext(null);
export const useSocket = () =>{
    const socket = useContext(SocketContext);
    return socket;
}
const SocketProvider = ({children}) => {
    const socket = io('https://video-chat-webapp.onrender.com', {
      transports: ['websocket'],
    });
  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

export default SocketProvider
