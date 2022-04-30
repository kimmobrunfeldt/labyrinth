import React from 'react'
import { CaretUp } from 'src/components/Icons'
import { PIECE_MARGIN_PX } from 'src/components/Piece'
import { centered } from 'src/css'
import { directionToCaretRotation, UIPushPosition } from 'src/utils/uiUtils'

type PushPositionProps = JSX.IntrinsicElements['div'] & {
  uiPushPosition: UIPushPosition
  pieceWidth: number
}

export const PushPosition = ({
  pieceWidth,
  uiPushPosition,
  onMouseOver,
  onMouseOut,
}: PushPositionProps) => (
  <div
    style={{
      position: 'absolute',
      transform: `translate(${
        PIECE_MARGIN_PX + uiPushPosition.x * (pieceWidth + PIECE_MARGIN_PX)
      }px, ${
        PIECE_MARGIN_PX + uiPushPosition.y * (pieceWidth + PIECE_MARGIN_PX)
      }px)`,
      width: `${pieceWidth}px`,
      height: `${pieceWidth}px`,
      transition: 'transform 600ms ease',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}
    onMouseOver={onMouseOver}
    onMouseOut={onMouseOut}
  >
    <div
      style={{
        ...centered(),
        width: '50%',
        height: '50%',
        background: '#f9f9f9',
        borderRadius: `${pieceWidth * 0.1}px`,
      }}
    ></div>
    <CaretUp
      style={{
        ...centered(
          `rotate(${directionToCaretRotation(uiPushPosition.direction)}deg)`
        ),
        width: '20%',
      }}
      fill="#CCC5AE"
    />
  </div>
)
