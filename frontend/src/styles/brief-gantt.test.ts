/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// T#25: BRIEF §3.6 (Gantt) and §7 (Checks) carry the rule "text goes below the bar, never inside it".
// BRIEF_PATH lets the red run point at an older copy of BRIEF.
const briefPath = process.env.BRIEF_PATH ?? join(__dirname, '../../../docs/design/BRIEF.md')
const brief = readFileSync(briefPath, 'utf8')

function between(text: string, start: string, end: string | null): string {
  const from = text.indexOf(start)
  expect(from, `"${start}" not found in BRIEF`).toBeGreaterThanOrEqual(0)
  const to = end === null ? text.length : text.indexOf(end, from)
  expect(to, `"${end}" not found after "${start}"`).toBeGreaterThan(from)
  return text.slice(from, to)
}

const gantt = between(brief, '- **Gantt (T#12, D15)**:', '- **확인 대화상자')
const checks = between(brief, '## 7. Checks', null)

describe('BRIEF §3.6 Gantt', () => {
  it('has every phrase of the text-below-the-bar rule', () => {
    const required = [
      '막대 안에는 글자를 쓰지 않는다',
      '그 막대 바로 아래 줄에 쓴다',
      '겹침 구간마다 자기 줄을 둔다',
      '최소 2px',
      'warning-bg 배경에 1px warning 테두리',
      '"오늘" 글자는 월 눈금 줄 위의 자기 줄에 쓴다',
      '40px 미만이면 그 눈금 글자는 생략한다',
      '서로 겹치지 않는다',
      '말줄임표는 쓰지 않는다',
      '끝을 넘으면 끝에 붙인다',
      '차트 바탕은 surface',
    ]
    for (const phrase of required) {
      expect(gantt, phrase).toContain(phrase)
    }
  })

  it('no longer puts text inside the bar or the total above the overlap', () => {
    expect(gantt).not.toContain('막대에는 기간과 투입률을 쓴다')
    expect(gantt).not.toContain('겹친 날짜 구간 위에 그날 합계 %를 xs로 쓴다')
  })
})

describe('BRIEF §7 Checks', () => {
  it('has item 13 for the Gantt', () => {
    const item13 = between(checks, '13. **간트**', null)
    for (const phrase of ['막대 안에 글자가 없고', '겹침 구간마다 자기 줄', '말줄임표가 없다', '40px 이상']) {
      expect(item13, phrase).toContain(phrase)
    }
  })

  it('applies item 13 to screens that draw a Gantt', () => {
    const intro = between(checks, '리뷰어는', '1. **배경과 면**')
    expect(intro).toContain('간트를 그리는 화면은 13도 적용한다')
  })
})
