import _ from 'lodash'
import { useEffect, useRef } from 'react'
import { assertDefined, BOARD_PUSH_POSITIONS } from 'src/core/server/board'
import * as t from 'src/gameTypes'
import { oppositeIndex } from 'src/utils/utils'

export type UIPushPosition = {
  x: number
  y: number
  direction: t.Direction
}

export const PIECES_IN_A_ROW = 7
// Accounts for the empty piece placeholders in the edges
export const PIECE_SLOTS = PIECES_IN_A_ROW + 2

export const UI_PUSH_POSITIONS: UIPushPosition[] = [
  // top
  { x: 2, y: 0, direction: 'down' },
  { x: 4, y: 0, direction: 'down' },
  { x: 6, y: 0, direction: 'down' },
  // right
  { x: 8, y: 2, direction: 'left' },
  { x: 8, y: 4, direction: 'left' },
  { x: 8, y: 6, direction: 'left' },
  // bottom
  { x: 6, y: 8, direction: 'up' },
  { x: 4, y: 8, direction: 'up' },
  { x: 2, y: 8, direction: 'up' },
  // left
  { x: 0, y: 6, direction: 'right' },
  { x: 0, y: 4, direction: 'right' },
  { x: 0, y: 2, direction: 'right' },
]

export function boardPushPositionToUIPosition(
  pos: t.Position
): UIPushPosition | undefined {
  const index = _.findIndex(
    BOARD_PUSH_POSITIONS,
    (pPos) => pPos.x === pos.x && pPos.y === pos.y
  )
  return UI_PUSH_POSITIONS[index]
}

export function uiPushPositionToBoard(
  pos: UIPushPosition
): t.PushPosition | undefined {
  const index = _.findIndex(
    UI_PUSH_POSITIONS,
    (pPos) => pPos.x === pos.x && pPos.y === pos.y
  )
  return BOARD_PUSH_POSITIONS[index]
}

export function oppositeUIPosition(uiPos: UIPushPosition): UIPushPosition {
  switch (uiPos.direction) {
    case 'up':
    case 'down':
      return { ...uiPos, y: oppositeIndex(PIECE_SLOTS, uiPos.y) }
    case 'right':
    case 'left':
      return { ...uiPos, x: oppositeIndex(PIECE_SLOTS, uiPos.x) }
  }
}

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>()
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}

export const hex2rgba = (hex: string, alpha = 1) => {
  const matches = hex.match(/\w\w/g)
  if (!matches) {
    throw new Error(`Unable to parse hex: ${hex}`)
  }
  const [r, g, b] = matches.map((x) => parseInt(x, 16))
  return `rgba(${r},${g},${b},${alpha})`
}

export function directionToCaretRotation(direction: t.Direction): t.Rotation {
  switch (direction) {
    case 'up':
      return 0
    case 'right':
      return 90
    case 'down':
      return 180
    case 'left':
      return 270
  }
}

export function getPlayerInTurn(
  gameState: t.ClientGameState
): t.CensoredPlayer {
  return gameState.players[gameState.playerTurn]
}

export function getIsMyTurn(gameState: t.ClientGameState): boolean {
  const player = getPlayerInTurn(gameState)
  if (!player) {
    return false
  }

  return gameState.me.id === player.id
}

/**
 * Returns if given push position blocked based on previous move.
 *
 * Note: uses UI coordinates (extra padding around the board).
 */
export function isBlockedUiPushPosition(
  gameState: t.ClientGameState,
  position: t.Position
): boolean {
  const { previousPushPosition } = gameState
  if (!previousPushPosition) {
    // No moves done yet
    return false
  }

  const blockedUiPushPos =
    getUiPushPositionBasedOnPreviousPush(previousPushPosition)
  return position.x === blockedUiPushPos.x && position.y === blockedUiPushPos.y
}

/**
 * Returns if given push position blocked based on previous move.
 *
 * Note: takes position in UI coordinates!
 */
export function isBlockedBoardPushPosition(
  gameState: t.ClientGameState,
  position: t.Position
): boolean {
  const { previousPushPosition } = gameState
  if (!previousPushPosition) {
    // No moves done yet
    return false
  }

  const uiPushPos = boardPushPositionToUIPosition(position)
  if (!uiPushPos) {
    // Position is not a valid board push position
    return false
  }
  return isBlockedUiPushPosition(gameState, uiPushPos)
}

export function boardToUiCoordinates(position: t.Position): t.Position {
  return { x: position.x + 1, y: position.y + 1 }
}

export function uiToBoardCoordinates(position: t.Position): t.Position {
  return { x: position.x - 1, y: position.y - 1 }
}

const createSetupExtraPiecePosition = () => ({ x: 0, y: 0 })

/**
 * Resolves the Position in UI coordinages for extra piece,
 * given the local and server state.
 */
export function resolveExtraPiecePosition(
  gameState: t.ClientGameState,
  lastServerHover?: t.Position,
  lastLocalHover?: t.Position
): t.Position {
  const { previousPushPosition, stage, playerHasPushed } = gameState
  if (stage === 'setup') {
    return createSetupExtraPiecePosition()
  }

  const basedOnPrevPush = previousPushPosition
    ? getUiPushPositionBasedOnPreviousPush(previousPushPosition)
    : undefined

  // If the player has pushed (you or any other), ignore all hoverings
  if (playerHasPushed) {
    return basedOnPrevPush ?? createSetupExtraPiecePosition()
  }

  // If it's your turn, prefer your local hovering. Ignore server hovers.
  if (getIsMyTurn(gameState)) {
    return lastLocalHover ?? basedOnPrevPush ?? createSetupExtraPiecePosition()
  }

  // If not your turn, prever server hovering. Ignore local hovers.
  return lastServerHover ?? basedOnPrevPush ?? createSetupExtraPiecePosition()
}

function getUiPushPositionBasedOnPreviousPush(
  previousPushPosition: t.PushPosition
): UIPushPosition {
  const prevUiPushPos = assertDefined(
    boardPushPositionToUIPosition(previousPushPosition)
  )
  return oppositeUIPosition(prevUiPushPos)
}
