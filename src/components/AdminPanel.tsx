import React, { useEffect } from 'react'
import { Select } from 'src/components/Select'
import * as t from 'src/gameTypes'

export type Props = {
  open: boolean
  onStartGameClick: () => void
  onAddBot: (name: t.BotName) => void
  onRemovePlayer: (id: t.Player['id']) => void
  gameState: t.ClientGameState
  onCloseClick: () => void
}

const AdminPanel = ({
  open,
  onStartGameClick,
  gameState,
  onAddBot,
  onRemovePlayer,
  onCloseClick,
}: Props) => {
  const startDisabled = Boolean(gameState && gameState.stage !== 'setup')

  function keyDown(e: KeyboardEvent) {
    if (e.keyCode === 27) {
      onCloseClick()
    }
  }

  useEffect(() => {
    document.addEventListener('keydown', keyDown)
    return () => {
      document.removeEventListener('keydown', keyDown)
    }
  }, [])

  return (
    <>
      <div
        style={{
          width: '90%',
          maxWidth: '230px',
          height: '100%',
          position: 'absolute',
          zIndex: '900',
          boxShadow: open ? '5px 5px 15px rgba(133, 126, 119, 0.4)' : undefined,
          borderTop: '6px solid #857E77',
          background: 'white',
          left: 0,
          top: 0,
          transform: open ? `translateX(0px)` : `translateX(-100%)`,
          transition: 'transform 600ms ease',
        }}
      >
        <div
          className="icon-hover"
          style={{
            position: 'absolute',
            top: '7px',
            right: '5px',
            zIndex: 90,
            transition: 'all 400ms ease',
            padding: '8px 14px',
            cursor: 'pointer',
            color: '#857E77',
            fontWeight: 'bold',
            fontSize: open ? '24px' : '30px',
          }}
          onClick={onCloseClick}
        >
          {'×'}
        </div>
        <div style={{ padding: '18px 20px', height: '100%' }}>
          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
            }}
          >
            <div>
              <h2
                style={{ fontSize: '1.3rem', color: '#857E77', marginTop: 0 }}
              >
                Admin panel
              </h2>

              <div style={{ paddingTop: '10px', paddingBottom: '20px' }}>
                <h3
                  style={{
                    fontSize: '14px',
                    color: '#857E77',
                    textTransform: 'uppercase',
                  }}
                >
                  Game
                </h3>
              </div>
              <div style={{ padding: '20px 0 0 0' }}>
                <h3
                  style={{
                    fontSize: '14px',
                    color: '#857E77',
                    textTransform: 'uppercase',
                  }}
                >
                  Players
                </h3>
                {gameState.players.map((p) => {
                  return (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      key={p.id}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '5px 0',
                        }}
                      >
                        <div
                          style={{
                            width: '15px',
                            height: '15px',
                            borderRadius: '999px',
                            background: p.color,
                            marginRight: '8px',
                          }}
                        />
                        {p.name}
                      </div>
                      {gameState.stage === 'setup' && p.id !== gameState.me.id && (
                        <div
                          onClick={() => onRemovePlayer(p.id)}
                          title="Remove"
                          role="button"
                          style={{
                            cursor: 'pointer',
                            padding: '6px',
                            fontSize: '25x',
                            fontWeight: 'bold',
                          }}
                        >
                          ×
                        </div>
                      )}
                    </div>
                  )
                })}
                {gameState.stage === 'setup' && gameState.players.length < 4 && (
                  <div style={{ marginTop: '10px' }}>
                    <Select
                      placeholder="Add bot"
                      value={''}
                      onChange={(value) => onAddBot(value as t.BotName)}
                      options={[{ value: 'random', label: 'Random bot' }]}
                    />
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                padding: '35px 0',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <button
                disabled={startDisabled}
                className="button-50 button-50-small"
                onClick={onStartGameClick}
              >
                Start game
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
export default AdminPanel
