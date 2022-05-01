import React from 'react'
import { MENU_BAR_HEIGHT } from 'src/components/MenuBar'
import * as t from 'src/gameTypes'

// The icons were flipped upside down in Figma because they are locked always
// on the top of the board.
// When showing the icon here, we want them to be in normal rotation.
const UPWARDS_TROPHIES = ['Candles', 'KnightHelmet']

export const NextTrophy = ({ trophy }: { trophy: t.Trophy }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      position: 'absolute',
      top: `${MENU_BAR_HEIGHT + 8}px`,
      right: '0',
      textAlign: 'center',
    }}
  >
    <div style={{ fontWeight: 'bold', color: '#555' }}>NEXT</div>
    <img
      style={{
        position: 'relative',
        top: '-15px',
        width: '70px',
        transform: `rotate(${UPWARDS_TROPHIES.includes(trophy) ? 180 : 0}deg)`,
      }}
      src={`${process.env.PUBLIC_URL}/pieces/${trophy}.svg`}
      alt={trophy}
    />
  </div>
)
