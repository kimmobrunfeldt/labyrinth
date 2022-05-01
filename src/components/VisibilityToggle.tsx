import React from 'react'
import { MENU_BAR_HEIGHT } from 'src/components/MenuBar'
import { zIndices } from 'src/zIndices'

export const VisibilityToggle = ({
  visible,
  onToggle,
  style = {},
}: {
  visible: boolean
  onToggle: () => void
  style?: React.CSSProperties
}) => (
  <div
    onClick={onToggle}
    role="button"
    title={visible ? 'Hide player labels' : 'Show player labels'}
    className="label-link"
    style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      position: 'absolute',
      top: `${MENU_BAR_HEIGHT + 10}px`,
      left: '10px',
      cursor: 'pointer',
      zIndex: zIndices.hideLabelsLink,
      ...style,
    }}
  >
    <img
      style={{
        width: '20px',
        height: '20px',
        marginRight: '7px',
      }}
      src={`${process.env.PUBLIC_URL}/${visible ? 'Invisible' : 'Visible'}.svg`}
      alt={visible ? 'Hide player labels' : 'Show player labels'}
    />
    <div style={{ color: '#555', fontSize: '14px' }}>
      {visible ? 'Hide' : 'Show'}
    </div>
  </div>
)
