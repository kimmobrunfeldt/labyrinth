import _ from 'lodash'
import React, { useEffect, useState } from 'react'
import { CSSTransition, TransitionGroup } from 'react-transition-group'
import AdminPanel, { Props as AdminPanelProps } from 'src/components/AdminPanel'
import { assertDefined } from 'src/core/board'
import * as t from 'src/gameTypes'
import { getKey, saveKey } from 'src/localStorage'

export type Props = {
  showAdmin: boolean
  serverPeerId: string
  gameState: t.ClientGameState
  onAddBotClick: AdminPanelProps['onAddBotClick']
  onStartGameClick: AdminPanelProps['onStartGameClick']
}

function getSavedAdminPanelOpen(): boolean {
  return getKey('adminPanelOpen') === 'true'
}

function getCenterElement(
  gameState: t.ClientGameState,
  serverPeerId: string
): JSX.Element {
  switch (gameState.stage) {
    case 'setup':
      return (
        <a target="_blank" href={`#${serverPeerId}`} rel="noreferrer">
          {serverPeerId}
        </a>
      )
    case 'playing': {
      const action = gameState.playerHasPushed ? 'move' : 'push'
      const player = gameState.players[gameState.playerTurn]
      const label =
        player.id === gameState.me.id
          ? `Your turn to ${action}`
          : `${player.name}'s turn to ${action}`
      return <span>{label}</span>
    }
    case 'finished': {
      return <span>{`${assertDefined(gameState.winners[0]).name} wins!`}</span>
    }
  }
}

export default function MenuBar({
  serverPeerId,
  showAdmin,
  onAddBotClick,
  onStartGameClick,
  gameState,
}: Props) {
  const [open, setOpen] = useState(getSavedAdminPanelOpen())

  function setAndSaveOpen(open: boolean) {
    saveKey('adminPanelOpen', open ? 'true' : 'false')
    setOpen(open)
  }

  useEffect(() => {
    // First time usage
    if (getKey('adminPanelOpen') === null) {
      setTimeout(() => setAndSaveOpen(true), 100)
    }
  }, [])

  function _onStartGameClick() {
    setOpen(false)
    onStartGameClick()
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        height: '60px',
        // background: '#fafafa',
      }}
    >
      {showAdmin && (
        <AdminPanel
          open={open}
          onCloseClick={() => setOpen(false)}
          gameState={gameState}
          onAddBotClick={onAddBotClick}
          onStartGameClick={_onStartGameClick}
        />
      )}
      {showAdmin ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#F9F4EC',
            height: '100%',
            padding: '0 20px 0 10px',
            borderRadius: '0 100px 100px 0',
          }}
        >
          <img
            className="cursor-pointer icon-hover"
            onClick={() => setOpen(true)}
            style={{
              boxSizing: 'content-box',
              padding: '10px',
              width: '20px',
              height: '20px',
              zIndex: 10,
            }}
            src={`${process.env.PUBLIC_URL}/Settings.svg`}
            alt="Settings"
          />
          <img
            className="cursor-pointer icon-hover"
            onClick={() => onStartGameClick()}
            style={{
              boxSizing: 'content-box',
              padding: '10px',
              width: '20px',
              height: '20px',
              zIndex: 10,
            }}
            src={`${process.env.PUBLIC_URL}/Play.svg`}
            alt="Start game"
          />
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#F9F4EC',
            height: '100%',
            padding: '0 30px 0 15px',
            borderRadius: '0 100px 100px 0',
            color: '#454545',
          }}
        >
          {gameState.me.name}
        </div>
      )}
      <div style={{ textAlign: 'center', fontSize: '14px' }}>
        {getCenterElement(gameState, serverPeerId)}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#F9F4EC',
          height: '100%',
          padding: '0 10px 0 26px',
          borderRadius: '100px 0 0 100px',
        }}
      >
        <img
          style={{
            width: '20px',
            height: '20px',
            marginRight: '15px',
          }}
          src={`${process.env.PUBLIC_URL}/Players.svg`}
          alt="Players"
        />
        <TransitionGroup style={{ display: 'flex' }}>
          {gameState.players.map((p, index) => {
            const cardsFound = _.sumBy(p.censoredCards, (c) =>
              c.found ? 1 : 0
            )
            const getExtra = () => {
              if (gameState.stage !== 'playing') {
                return { opacity: 1 }
              }
              return {
                opacity: gameState.playerTurn === index ? 1 : 0.7,
                transform: `scale(${gameState.playerTurn === index ? 1.1 : 1})`,
              }
            }

            return (
              <CSSTransition key={p.id} timeout={500} classNames="appear">
                <div
                  title={`${p.name}, ${cardsFound} / ${p.censoredCards.length} found`}
                  style={{
                    ...getExtra(),
                    cursor: 'default',
                    width: '24px',
                    height: '24px',
                    marginLeft: '8px',
                    borderRadius: '9999px',
                    background: p.color,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    position: 'relative',
                    top: '1px',
                  }}
                >
                  {cardsFound}
                </div>
              </CSSTransition>
            )
          })}
        </TransitionGroup>
      </div>
    </div>
  )
}
