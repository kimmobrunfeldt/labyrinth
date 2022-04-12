import React from 'react'
import corner from 'src/assets/corner.svg'
import straight from 'src/assets/straight.svg'
import tShape from 'src/assets/t-shape.svg'
import { Piece as PieceType, Type } from 'src/core/types'

const pieceToSvg: Record<Type, string> = {
  straight: straight,
  corner,
  't-shape': tShape,
}

export const STYLES = {
  display: 'inline-block',
  width: '40px',
  height: '40px',
  margin: 0,
  padding: 0,
}

export const Piece = ({ rotation, icon, type }: PieceType) => {
  const common = {
    style: {
      ...STYLES,
      transform: `rotate(${rotation}deg)`,
    },
  }

  return <img alt="" src={pieceToSvg[type]} {...common} />
}

export const EmptyPiece = () => <div style={{ ...STYLES }} />

export default Piece
