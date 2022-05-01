export const centered: (
  transform?: React.CSSProperties['transform']
) => React.CSSProperties = (transform) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: `translate(-50%, -50%) ${transform ? transform : ''}`,
})
