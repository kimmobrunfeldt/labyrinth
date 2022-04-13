import React from 'react'
import './App.css'
import Board from './Board'

export const App = () => (
  <div
    className="App"
    style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
  >
    <Board />
  </div>
)
export default App
