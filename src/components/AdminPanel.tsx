import React from 'react'

export type Props = {
  onStartGameClick: () => void
}

const AdminPanel = ({ onStartGameClick }: Props) => {
  return (
    <div>
      <button onClick={onStartGameClick}>Start game</button>
    </div>
  )
}
export default AdminPanel
