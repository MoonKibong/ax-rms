import type { ReactNode } from 'react'

// Inline SVG icons (BRIEF §3: no external icon fonts or CDNs). They draw with currentColor.
type IconProps = { size: number }

function Svg({ size, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function BoxIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
      <path d="m3 7.5 9 4.5 9-4.5M12 12v9" />
    </Svg>
  )
}

export function SearchIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </Svg>
  )
}

export function WarningIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 3 22 20H2L12 3Z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </Svg>
  )
}
