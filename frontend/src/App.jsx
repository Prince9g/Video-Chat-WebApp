import React from 'react'
import Lobby from './components/Lobby'
import { Outlet } from 'react-router-dom'

const App = () => {
  return (
    <div>
      <Outlet/>
    </div>
  )
}

export default App
