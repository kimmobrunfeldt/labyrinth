import React from 'react'
import { Button } from 'src/components/Button'

export type Props = {
  onHostGame: () => void
  onJoinGame: (id: string) => void
}

const StartPage = ({ onHostGame, onJoinGame }: Props) => {
  const onJoinClick = () => {
    const input = window.prompt('Input server ID. For example mouse-ghost-712')
    if (!input) {
      return
    }

    onJoinGame(input)
  }

  return (
    <div
      className="StartPage"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'column',
        paddingTop: '15vh',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '2rem' }}>Labyrinth</h1>
        <p style={{ maxWidth: '300px' }}>
          Online version of the Labyrinth board game. The game server will run
          on the host&apos;s browser and networking happens peer-to-peer.
        </p>
      </div>

      <div style={{ display: 'flex' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginRight: '15px',
            maxWidth: '150px',
          }}
        >
          <Button onClick={onHostGame}>Host game</Button>
          <span
            style={{
              marginTop: '12px',
              fontStyle: 'italic',
              fontSize: '12px',
              textAlign: 'center',
              padding: '0 10px 0 10px',
            }}
          >
            <b>Note!</b> Closing browser as the host cancels the game.
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginRight: '15px',
            maxWidth: '150px',
          }}
        >
          <Button onClick={onJoinClick}>Join game</Button>
          <span
            style={{
              marginTop: '12px',
              fontStyle: 'italic',
              fontSize: '12px',
              textAlign: 'center',
              padding: '0 5px 0 5px',
            }}
          >
            Join an existing game hosted by someone else.
          </span>
        </div>
      </div>
    </div>
  )
}
export default StartPage
