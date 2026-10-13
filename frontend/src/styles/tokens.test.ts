/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Read from disk: Vitest turns CSS imports (also `?raw`) into empty strings.
const tokensCss = readFileSync(join(__dirname, 'tokens.css'), 'utf8')

// Values copied from docs/design/BRIEF.md §2 (Tokens).
const expected: Record<string, string> = {
  '--color-bg': '#F6F7F9',
  '--color-surface': '#FFFFFF',
  '--color-surface-subtle': '#EEF1F5',
  '--color-text': '#1A1F27',
  '--color-text-muted': '#55606E',
  '--color-primary': '#2952CC',
  '--color-primary-hover': '#1F42A8',
  '--color-on-primary': '#FFFFFF',
  '--color-success': '#1B7340',
  '--color-success-bg': '#E7F4EC',
  '--color-warning': '#8F5300',
  '--color-warning-bg': '#FDF1DC',
  '--color-danger': '#BF2B1B',
  '--color-danger-hover': '#9E2215',
  '--color-danger-bg': '#FCEBE8',
  '--color-border': '#DDE2E8',
  '--color-border-strong': '#7D8796',
  '--color-focus': '#2952CC',
  '--color-disabled-bg': '#E6E9EE',
  '--color-disabled-text': '#8B94A1',
  '--font-family-base':
    '"Pretendard", system-ui, -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
  '--font-size-xs': '12px',
  '--line-height-xs': '16px',
  '--font-size-sm': '14px',
  '--line-height-sm': '20px',
  '--font-size-md': '16px',
  '--line-height-md': '24px',
  '--font-size-lg': '18px',
  '--line-height-lg': '26px',
  '--font-size-xl': '22px',
  '--line-height-xl': '30px',
  '--font-size-2xl': '28px',
  '--line-height-2xl': '36px',
  '--font-weight-regular': '400',
  '--font-weight-semibold': '600',
  '--font-weight-bold': '700',
  '--space-1': '4px',
  '--space-2': '8px',
  '--space-3': '12px',
  '--space-4': '16px',
  '--space-5': '24px',
  '--space-6': '32px',
  '--space-7': '48px',
  '--radius-sm': '4px',
  '--radius-md': '8px',
  '--radius-full': '999px',
  '--shadow-sm': '0 1px 2px rgba(26, 31, 39, 0.06)',
  '--shadow-md': '0 4px 12px rgba(26, 31, 39, 0.12)',
  '--control-height': '40px',
  '--row-min-height': '44px',
  '--focus-ring-width': '2px',
  '--focus-ring-offset': '2px',
  '--layout-header-height': '56px',
  '--layout-sidebar-width': '220px',
  '--layout-content-max': '1200px',
  '--layout-gutter-wide': '32px',
  '--layout-gutter-narrow': '16px',
}

// Text/background pairs from BRIEF §2.1 that must reach 4.5:1.
const textPairs: Array<[string, string]> = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-subtle'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface'],
  ['text-muted', 'surface-subtle'],
  ['on-primary', 'primary'],
  ['on-primary', 'primary-hover'],
  ['primary', 'surface'],
  ['primary', 'bg'],
  ['primary', 'surface-subtle'],
  ['success', 'surface'],
  ['success', 'success-bg'],
  ['warning', 'surface'],
  ['warning', 'warning-bg'],
  ['danger', 'surface'],
  ['danger', 'danger-bg'],
  ['on-primary', 'danger'],
  ['on-primary', 'danger-hover'],
  ['text', 'success-bg'],
  ['text', 'warning-bg'],
  ['text', 'danger-bg'],
]

function parseRootTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  const root = css.match(/:root\s*\{([^}]*)\}/)
  if (!root) {
    return tokens
  }
  for (const match of root[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim().replace(/\s+/g, ' ')
  }
  return tokens
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('design tokens', () => {
  const tokens = parseRootTokens(tokensCss)

  it('defines every BRIEF token with the BRIEF value', () => {
    for (const [name, value] of Object.entries(expected)) {
      expect(tokens[name]?.toLowerCase(), name).toBe(value.toLowerCase())
    }
  })

  it('keeps every BRIEF text/background pair at 4.5:1 or more', () => {
    for (const [text, background] of textPairs) {
      const fg = tokens[`--color-${text}`] ?? ''
      const bg = tokens[`--color-${background}`] ?? ''
      expect(fg, `--color-${text}`).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(bg, `--color-${background}`).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(contrast(fg, bg), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
