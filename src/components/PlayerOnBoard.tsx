import _ from 'lodash'
import React from 'react'
import * as t from 'src/gameTypes'
import { getPlayerInTurn } from 'src/utils/uiUtils'

export type Props = JSX.IntrinsicElements['div'] & {
  player: t.CensoredPlayer
  showName?: boolean
  piece: t.CensoredPieceOnBoard
  gameState: t.ClientGameState
}

export const PlayerOnBoard = ({
  player,
  gameState,
  piece,
  showName = true,
  ...props
}: Props) => {
  const { playerHasPushed } = gameState
  const playerInTurn = getPlayerInTurn(gameState)
  const cardsFound = _.sumBy(player.censoredCards, (c) => (c.found ? 1 : 0))
  const isPlayerTurn = playerInTurn.id === player.id
  const cardsFoundLabel = `${cardsFound} / ${player.censoredCards.length}`

  return (
    <div
      {...props}
      title={`${player.name}, ${cardsFoundLabel} found`}
      key={player.id}
      style={{
        zIndex: 900,
        width: '100%',
        pointerEvents: 'none',
        height: '100%',
        opacity: piece.trophy ? 0.8 : 1,
        borderRadius: '9999px',
        background: player.color,
        ...(playerHasPushed && isPlayerTurn
          ? {
              border: `2px solid white`,
              boxShadow: `0px 0px 0px 2px ${playerInTurn.color}`,
            }
          : { border: `2px solid transparent` }),
      }}
    >
      {showName && (
        <span
          style={{
            position: 'absolute',
            zIndex: 900,
            left: '50%',
            top: '-25px',
            transform: 'translateX(-50%)',
            fontWeight: 'bold',
            fontSize: '15px',
            color: isPlayerTurn ? 'white' : player.color,
            textTransform: 'uppercase',
            borderRadius: '20px',
            overflow: 'hidden',
            padding: '1px 5px',
            background: isPlayerTurn
              ? playerInTurn.color
              : 'rgba(255, 255, 255, 0.8)',
            whiteSpace: 'nowrap',
          }}
        >
          {gameState.me.id === player.id
            ? `You, ${cardsFoundLabel}`
            : `${player.name}`}
        </span>
      )}
    </div>
  )
}
