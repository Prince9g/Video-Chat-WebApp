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
    const socket = io('http://localhost:8080');
  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

export default SocketProvider
