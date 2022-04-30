import React, { useEffect, useState } from 'react'
import corner from 'src/assets/corner.svg'
import straight from 'src/assets/straight.svg'
import tShape from 'src/assets/t-shape.svg'
import * as t from 'src/gameTypes'
import { Piece, PieceOnBoard, Type } from 'src/gameTypes'
import { usePrevious } from 'src/utils/uiUtils'

export const PIECE_MARGIN_PX = 2
export const PIECE_BORDER_RADIUS = '5px'

const pieceToSvg: Record<Type, string> = {
  straight: straight,
  corner,
  't-shape': tShape,
}

export function getSharedStyles(width: number): React.CSSProperties {
  return {
    width: `${width}px`,
    height: `${width}px`,
    display: 'inline-block',
    margin: 0,
    padding: 0,
    borderRadius: PIECE_BORDER_RADIUS,
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
  const [rotation, setRotation] = useState<number>(piece.rotation)
  const prevPiece = usePrevious(piece)

  // Make rotation smooth
  useEffect(() => {
    const addRotation = findShortestRotation(piece, prevPiece)
    setRotation((r) => r + addRotation)
  }, [prevPiece, piece, piece.rotation])

  const sharedStyles = getSharedStyles(width)

  return (
    <div
      className="Piece"
      onClick={() => onClick && onClick(piece)}
      style={{
        ...sharedStyles,
        transformOrigin: '50% 50%',
        transition: 'transform 250ms ease',
        transform: `rotate(${rotation}deg)`,
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

function findShortestRotation(
  piece: t.Piece | t.CensoredPieceOnBoard,
  prevPiece?: t.Piece | t.CensoredPieceOnBoard
): number {
  const prevPieceRotation = prevPiece?.rotation ?? piece.rotation
  const newPieceRotation = piece.rotation
  return newPieceRotation >= prevPieceRotation
    ? newPieceRotation - prevPieceRotation
    : 360 - prevPieceRotation + newPieceRotation
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
  style = {},
}: {
  width: number
  style?: React.CSSProperties
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
