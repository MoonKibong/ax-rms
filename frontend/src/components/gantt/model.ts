// Date and overlap arithmetic for the Gantt chart (T#12). Pure: no DOM and no clock; `today` always comes from the caller
// (D19: "now" is the server's date). Days are whole days counted from "YYYY-MM-DD" strings in UTC, so the result does not
// depend on the viewer's time zone.
export type ProjectStatus = '계획' | '진행 중' | '완료' | '보류'

export type GanttAssignment = {
  id: string
  projectName: string
  projectStatus: ProjectStatus
  start: string
  end: string
  rate: number
}

export type GanttRow = {
  assignment: GanttAssignment
  startIndex: number
  endIndex: number
  anchor: number
}

export type GanttOverlap = {
  start: string
  end: string
  startIndex: number
  endIndex: number
  total: number
  anchor: number
}

export type GanttTick = { index: number; label: string }

export type GanttModel = {
  days: number
  rows: GanttRow[]
  overlaps: GanttOverlap[]
  today: { index: number; anchor: number } | null
  ticks: GanttTick[]
}

// A month label is dropped when it would be closer than this to the previous label that is shown (BRIEF §3.6).
export const MIN_TICK_GAP_PX = 40

const MS_PER_DAY = 86_400_000

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / MS_PER_DAY
}

function dayString(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
}

// Middle of the span [startIndex, endIndex] as a fraction of the whole chart (0..1).
function anchorOf(startIndex: number, endIndex: number, days: number): number {
  return (startIndex + endIndex + 1) / 2 / days
}

function compareRows(a: GanttAssignment, b: GanttAssignment): number {
  if (a.start !== b.start) return a.start < b.start ? -1 : 1
  if (a.end !== b.end) return a.end < b.end ? -1 : 1
  if (a.projectName !== b.projectName) return a.projectName < b.projectName ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function buildGanttModel(assignments: GanttAssignment[], today: string): GanttModel {
  if (assignments.length === 0) {
    return { days: 0, rows: [], overlaps: [], today: null, ticks: [] }
  }

  const spans = assignments.map((assignment) => ({
    assignment,
    start: dayNumber(assignment.start),
    end: dayNumber(assignment.end),
  }))
  const first = Math.min(...spans.map((span) => span.start))
  const last = Math.max(...spans.map((span) => span.end))
  const days = last - first + 1

  const rows: GanttRow[] = [...spans]
    .sort((a, b) => compareRows(a.assignment, b.assignment))
    .map((span) => {
      const startIndex = span.start - first
      const endIndex = span.end - first
      return { assignment: span.assignment, startIndex, endIndex, anchor: anchorOf(startIndex, endIndex, days) }
    })

  // Day by day: how many assignments cover it and what they add up to.
  const count = new Array<number>(days).fill(0)
  const total = new Array<number>(days).fill(0)
  for (const span of spans) {
    for (let day = span.start; day <= span.end; day += 1) {
      count[day - first] += 1
      total[day - first] += span.assignment.rate
    }
  }
  const overlaps: GanttOverlap[] = []
  let index = 0
  while (index < days) {
    if (count[index] < 2) {
      index += 1
      continue
    }
    const startIndex = index
    while (index + 1 < days && count[index + 1] >= 2 && total[index + 1] === total[startIndex]) {
      index += 1
    }
    overlaps.push({
      start: dayString(first + startIndex),
      end: dayString(first + index),
      startIndex,
      endIndex: index,
      total: total[startIndex],
      anchor: anchorOf(startIndex, index, days),
    })
    index += 1
  }

  const todayIndex = dayNumber(today) - first
  const todayMark = todayIndex >= 0 && todayIndex < days ? { index: todayIndex, anchor: (todayIndex + 0.5) / days } : null

  // One mark per month that touches the span, at the month's first day or the span's first day if that is later.
  const ticks: GanttTick[] = []
  const firstDate = new Date(first * MS_PER_DAY)
  let year = firstDate.getUTCFullYear()
  let month = firstDate.getUTCMonth()
  for (;;) {
    const monthStart = Date.UTC(year, month, 1) / MS_PER_DAY
    if (monthStart > last) break
    ticks.push({ index: Math.max(monthStart, first) - first, label: `${month + 1}월` })
    month += 1
    if (month === 12) {
      month = 0
      year += 1
    }
  }

  return { days, rows, overlaps, today: todayMark, ticks }
}

// Month labels that stay: the first one, then every label at least MIN_TICK_GAP_PX after the last one kept.
export function pickTickLabels(ticks: GanttTick[], days: number, trackWidthPx: number): GanttTick[] {
  const kept: GanttTick[] = []
  for (const tick of ticks) {
    const previous = kept[kept.length - 1]
    if (previous === undefined || ((tick.index - previous.index) / days) * trackWidthPx >= MIN_TICK_GAP_PX) {
      kept.push(tick)
    }
  }
  return kept
}
