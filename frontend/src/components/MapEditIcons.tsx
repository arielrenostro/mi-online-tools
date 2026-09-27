const ICON_CLASS = 'w-4 h-4'
const ICON_PROPS = { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', strokeWidth: 2 } as const

export function IconAdjust() {
  return (
    <svg className={ICON_CLASS} {...ICON_PROPS}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h6m4 0h6M4 6a2 2 0 104 0 2 2 0 00-4 0zm14 6h2m-8 0a2 2 0 10-4 0 2 2 0 004 0zm-8 0H4m0 6h10m4 0h2m-6 0a2 2 0 104 0 2 2 0 00-4 0z" />
    </svg>
  )
}

export function IconInterpolateH() {
  return (
    <svg className={ICON_CLASS} {...ICON_PROPS}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />
    </svg>
  )
}

export function IconInterpolateV() {
  return (
    <svg className={ICON_CLASS} {...ICON_PROPS}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />
    </svg>
  )
}

export function IconUndo() {
  return (
    <svg className={ICON_CLASS} {...ICON_PROPS}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  )
}

export function IconRedo() {
  return (
    <svg className={ICON_CLASS} {...ICON_PROPS}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
    </svg>
  )
}
