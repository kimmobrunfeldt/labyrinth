import React from 'react'
import corner from 'src/assets/corner.svg'
import straight from 'src/assets/straight.svg'
import tShape from 'src/assets/t-shape.svg'
import { Piece, PieceOnBoard, Type } from 'src/core/types'

export const PIECE_MARGIN_PX = 2
export const PIECE_WIDTH = 50

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
  borderRadius: '5px',
  overflow: 'hidden',
}

function PieceComponent<T extends Piece | PieceOnBoard>({
  piece,
  style,
  onClick,
}: {
  piece: T
  style: React.CSSProperties
  onClick?: (piece: T) => void
}) {
  return (
    <div
      onClick={() => onClick && onClick(piece)}
      style={{
        ...STYLES,
        // transform: `rotate(${Math.random() * 1.5}deg)`,
        transformOrigin: '50% 50%',
        ...style,
      }}
    >
      <img
        alt=""
        src={pieceToSvg[piece.type]}
        style={{
          ...STYLES,
          top: 0,
          left: 0,
          position: 'absolute',
          transition: 'transform 50ms ease',
          transform: `rotate(${piece.rotation ? piece.rotation : 0}deg)`,
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
        <span>{piece.trophy}</span>
      </div>
    </div>
  )
}

export const EmptyPiece = ({ style }: { style: React.CSSProperties }) => (
  <div
    style={{
      ...STYLES,
      background: '#eee',
      transform: `rotate(${Math.random() * 1.5}deg)`,
      ...style,
    }}
  />
)

export default PieceComponent
