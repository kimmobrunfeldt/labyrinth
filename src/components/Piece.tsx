import React from 'react'
import corner from 'src/assets/corner.svg'
import straight from 'src/assets/straight.svg'
import tShape from 'src/assets/t-shape.svg'
import { Piece as PieceType, Position, Type } from 'src/core/types'

export const PIECE_MARGIN_PX = 4
export const PIECE_WIDTH = 80

const pieceToSvg: Record<Type, string> = {
  straight: straight,
  corner,
  't-shape': tShape,
}

export const STYLES = {
  display: 'inline-block',
  width: `${PIECE_WIDTH}px`,
  height: `${PIECE_WIDTH}px`,
  margin: 0,
  padding: 0,
  borderRadius: '6px',
  overflow: 'hidden',
}

export const Piece = ({
  rotation,
  icon,
  type,
  isLastInRow,
  onClick,
  style,
  position,
}: PieceType & {
  isLastInRow: boolean
  onClick?: (pos: Position, event: React.MouseEvent) => void
  style: React.CSSProperties
  position: Position
}) => {
  const props = onClick
    ? { onClick: (e: React.MouseEvent) => onClick(position, e) }
    : {}
  return (
    <div
      {...props}
      style={{
        ...STYLES,
        marginRight: isLastInRow ? 0 : `${PIECE_MARGIN_PX}px`,
        position: 'relative',
        transform: `rotate(${Math.random() * 1.5}deg)`,
        ...style,
      }}
    >
      <img
        alt=""
        src={pieceToSvg[type]}
        style={{
          ...STYLES,
          top: 0,
          left: 0,
          position: 'absolute',
          transform: `rotate(${rotation ? rotation : 0}deg)`,
        }}
      />
      <div
        style={{
          ...STYLES,
          top: 0,
          left: 0,
          position: 'absolute',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontWeight: 'bold',
          fontSize: '10px',
        }}
      >
        <span>{icon}</span>
      </div>
    </div>
  )
}

export const EmptyPiece = ({
  isLastInRow,
  style,
}: {
  isLastInRow: boolean
  style: React.CSSProperties
  position: Position
}) => (
  <div
    style={{
      ...STYLES,
      background: '#eee',
      transform: `rotate(${Math.random() * 1.5}deg)`,
      marginRight: isLastInRow ? 0 : `${PIECE_MARGIN_PX}px`,
      ...style,
    }}
  />
)

export default Piece
