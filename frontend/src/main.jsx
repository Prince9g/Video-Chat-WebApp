import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {RouterProvider, createBrowserRouter} from 'react-router-dom'
import SocketProvider from './context/SocketProvider.jsx'
import Room from './components/Room.jsx'
import Lobby from './components/Lobby.jsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Lobby />
  },{
    path:'/room/:roomId',
    element: <Room />
  }
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SocketProvider>
      <RouterProvider router={router} />
    </SocketProvider>
  </StrictMode>
);

