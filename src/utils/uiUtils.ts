import _ from 'lodash'
import { useEffect, useRef } from 'react'
import { BOARD_PUSH_POSITIONS } from 'src/core/board'
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

export function boardPushPositionToUIPosition(pos: t.Position): UIPushPosition {
  const index = _.findIndex(
    BOARD_PUSH_POSITIONS,
    (pPos) => pPos.x === pos.x && pPos.y === pos.y
  )
  return UI_PUSH_POSITIONS[index]
}

export function uiPushPositionToBoard(pos: UIPushPosition): t.PushPosition {
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
