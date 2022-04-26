import React, { useEffect } from 'react'
import * as t from 'src/gameTypes'

export type Props = {
  open: boolean
  onStartGameClick: () => void
  onAddBotClick: () => void
  gameState: t.ClientGameState
  onCloseClick: () => void
}

const AdminPanel = ({
  open,
  onStartGameClick,
  gameState,
  onAddBotClick,
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
              <div style={{ padding: '20px 0 0 0' }}>
                <button
                  disabled={startDisabled}
                  className="button-50 button-50-secondary button-50-small"
                  onClick={onAddBotClick}
                >
                  Add bot
                </button>
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
