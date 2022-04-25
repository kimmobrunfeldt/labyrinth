import React from 'react'
import corner from 'src/assets/corner.svg'
import straight from 'src/assets/straight.svg'
import tShape from 'src/assets/t-shape.svg'
import * as t from 'src/core/types'
import { Piece, PieceOnBoard, Type } from 'src/core/types'

export const PIECE_MARGIN_PX = 2

const pieceToSvg: Record<Type, string> = {
  straight: straight,
  corner,
  't-shape': tShape,
}

function getSharedStyles(width: number): React.CSSProperties {
  return {
    width: `${width}px`,
    height: `${width}px`,
    display: 'inline-block',
    margin: 0,
    padding: 0,
    borderRadius: '5px',
    overflow: 'hidden',
  }
}

function PieceComponent<T extends Piece | PieceOnBoard>({
  piece,
  style = {},
  onClick,
  width,
}: {
  piece: T
  style?: React.CSSProperties
  onClick?: (piece: T) => void
  width: number
}) {
  const sharedStyles = getSharedStyles(width)

  return (
    <div
      onClick={() => onClick && onClick(piece)}
      style={{
        ...sharedStyles,
        // transform: `rotate(${Math.random() * 1.5}deg)`,
        transformOrigin: '50% 50%',
        transition: 'transform 50ms ease',
        transform: `rotate(${piece.rotation ? piece.rotation : 0}deg)`,
        ...style,
      }}
    >
      <img
        alt=""
        src={pieceToSvg[piece.type]}
        style={{
          ...sharedStyles,
          top: 0,
          left: 0,
          position: 'absolute',
        }}
      />
      <div
        style={{
          ...sharedStyles,
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
        {piece.trophy && (
          <img
            style={{
              width: '100%',
              height: '100%',
              transform: `rotate(${getTrophyRotation(piece.type)}deg)`,
            }}
            alt=""
            src={`${process.env.PUBLIC_URL}/pieces/${piece.trophy}.svg`}
          />
        )}
      </div>
    </div>
  )
}

function getTrophyRotation(type: t.Piece['type']): t.Rotation {
  switch (type) {
    case 'corner':
      return 0
    case 't-shape':
      return 90
    case 'straight':
      return 0
  }
}

export const EmptyPiece = ({
  width,
  style,
}: {
  width: number
  style: React.CSSProperties
}) => (
  <div
    style={{
      ...getSharedStyles(width),
      background: '#eee',
      // transform: `rotate(${Math.random() * 1.5}deg)`,
      ...style,
    }}
  />
)

export default PieceComponent
