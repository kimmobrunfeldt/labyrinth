import React, { useEffect } from 'react'
import { Select } from 'src/components/Select'
import * as t from 'src/gameTypes'

export type Props = {
  open: boolean
  onStartGameClick: () => void
  onRestartGameClick: () => void
  onAddBot: (name: t.BotName) => void
  onRemovePlayer: (id: t.Player['id']) => void
  onSettingsChange: (settings: Partial<t.GameSettings>) => void
  gameState: t.ClientGameState
  onCloseClick: () => void
}

const AdminPanel = ({
  open,
  onStartGameClick,
  onRestartGameClick,
  gameState,
  onAddBot,
  onRemovePlayer,
  onSettingsChange,
  onCloseClick,
}: Props) => {
  useEffect(() => {
    function keyDown(e: KeyboardEvent) {
      if (e.keyCode === 27) {
        onCloseClick()
      }
    }

    document.addEventListener('keydown', keyDown)
    return () => {
      document.removeEventListener('keydown', keyDown)
    }
  }, [onCloseClick])

  return (
    <>
      <div
        style={{
          width: '90%',
          maxWidth: '230px',
          height: '100%',
          position: 'fixed',
          overflow: 'auto',
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
                <Subtitle>Settings</Subtitle>
                <div style={{ marginTop: '15px' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      color: '#666',
                    }}
                  >
                    Trophies to find
                  </label>
                  <Select
                    disabled={gameState.stage !== 'setup'}
                    value={String(gameState.settings.trophyCount)}
                    onChange={(value) =>
                      onSettingsChange({ trophyCount: Number(value) })
                    }
                    options={[
                      { value: '1', label: '1 trophy' },
                      { value: '3', label: '3 trophies' },
                      { value: '5', label: '5 trophies' },
                    ]}
                  />
                </div>
                <div style={{ marginTop: '15px' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      color: '#666',
                    }}
                  >
                    Difficulty level
                  </label>
                  <Select
                    disabled={gameState.stage !== 'setup'}
                    value={gameState.settings.shuffleLevel}
                    onChange={(value) =>
                      onSettingsChange({
                        shuffleLevel: value as t.ShuffleLevel,
                      })
                    }
                    options={[
                      { value: 'easy', label: 'Easy ' },
                      { value: 'hard', label: 'Intermediate' },
                      { value: 'perfect', label: 'Hard (slow)' },
                    ]}
                  />
                </div>
              </div>

              <div style={{ padding: '20px 0 0 0' }}>
                <Subtitle>Players</Subtitle>
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
                        <span>{p.name}</span>
                        <span style={{ marginLeft: '3px' }}>
                          {p.id === gameState.me.id ? ' (host)' : ''}
                        </span>
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
                className="button-50 button-50-small"
                onClick={
                  gameState.stage === 'setup'
                    ? onStartGameClick
                    : onRestartGameClick
                }
              >
                {gameState.stage === 'setup' ? 'Start game' : 'Restart game'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const Subtitle = ({ children }: { children: React.ReactNode }) => (
  <h3
    style={{
      fontSize: '15px',
      // letterSpacing: '-0.01rem',
      color: '#857E77',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </h3>
)
export default AdminPanel
