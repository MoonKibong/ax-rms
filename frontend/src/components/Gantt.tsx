import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { buildGanttModel, pickTickLabels, type GanttAssignment } from './gantt/model'
import StateMessage from './StateMessage'
import './Gantt.css'

type GanttProps = {
  assignments: GanttAssignment[]
  // Today's date as "YYYY-MM-DD". Required, with no default: the server's date (D19), passed by the screen.
  today: string
}

// Track width used until the real one is measured (and where ResizeObserver does not exist, as in jsdom).
const FALLBACK_TRACK_WIDTH_PX = 328

function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(4)}%`
}

// A bar or band: placed and sized in percent of the track, never narrower than 2px.
function spanStyle(startIndex: number, endIndex: number, days: number): CSSProperties {
  return { marginLeft: percent(startIndex / days), width: percent((endIndex - startIndex + 1) / days) }
}

// A text box whose `anchor` point sits at the `anchor` point of the track: it centres on the bar and never leaves the
// track, because it is pushed to the left edge at 0 and to the right edge at 1 (BRIEF §3.6).
function anchoredStyle(anchor: number): CSSProperties {
  return { marginLeft: percent(anchor), transform: `translateX(-${percent(anchor)})` }
}

function absoluteAnchoredStyle(anchor: number): CSSProperties {
  return { left: percent(anchor), transform: `translateX(-${percent(anchor)})` }
}

// BRIEF §3.6, §5. Text is never inside a bar: it is on the line right below it. Each overlap has its own line.
function Gantt({ assignments, today }: GanttProps) {
  const model = buildGanttModel(assignments, today)
  const axisTrack = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState(FALLBACK_TRACK_WIDTH_PX)

  const hasChart = model.days > 0
  useEffect(() => {
    const element = axisTrack.current
    if (!element || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => {
      setTrackWidth(element.clientWidth > 0 ? element.clientWidth : FALLBACK_TRACK_WIDTH_PX)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasChart])

  if (!hasChart) {
    return (
      <div data-testid="gantt">
        <StateMessage kind="empty" title="배치된 프로젝트가 없습니다" />
      </div>
    )
  }

  const todayLine =
    model.today === null ? null : (
      <span
        className="gantt__today-line"
        data-testid="gantt-today-line"
        aria-hidden="true"
        style={{ left: percent(model.today.anchor) }}
      />
    )
  const labels = pickTickLabels(model.ticks, model.days, trackWidth)

  return (
    <div data-testid="gantt">
      <div className="gantt__chart" data-testid="gantt-chart">
        {model.today !== null && (
          <div className="gantt__row">
            <div className="gantt__head gantt__head--empty" />
            <div className="gantt__track gantt__track--axis">
              <span
                className="gantt__axis-text gantt__axis-text--today"
                data-gantt-text
                style={absoluteAnchoredStyle(model.today.anchor)}
              >
                오늘
              </span>
              {todayLine}
            </div>
          </div>
        )}

        <div className="gantt__row" aria-hidden="true">
          <div className="gantt__head gantt__head--empty" />
          <div className="gantt__track gantt__track--axis" ref={axisTrack}>
            {labels.map((tick) => (
              <span
                key={tick.index}
                className="gantt__axis-text"
                data-gantt-text
                data-gantt-tick={(tick.index / model.days).toFixed(6)}
                style={absoluteAnchoredStyle(tick.index / model.days)}
              >
                {tick.label}
              </span>
            ))}
            {todayLine}
          </div>
        </div>

        {model.rows.map((row) => {
          const { assignment } = row
          const period = `${assignment.start} ~ ${assignment.end}`
          return (
            <div className="gantt__row" key={assignment.id}>
              <div className="gantt__head" data-testid="gantt-head">
                {assignment.projectName}
              </div>
              <div className="gantt__track">
                <div
                  className="gantt__bar"
                  role="img"
                  aria-label={`${assignment.projectName}, ${period}, ${assignment.rate}%`}
                  data-testid="gantt-bar"
                  data-status={assignment.projectStatus === '진행 중' ? 'active' : 'other'}
                  style={spanStyle(row.startIndex, row.endIndex, model.days)}
                />
                <div className="gantt__text" data-gantt-text aria-hidden="true" style={anchoredStyle(row.anchor)}>
                  {period} · {assignment.rate}%
                </div>
                {todayLine}
              </div>
            </div>
          )
        })}

        {model.overlaps.map((overlap) => (
          <div className="gantt__row" key={`${overlap.start}-${overlap.end}`}>
            <div className="gantt__head gantt__head--muted">겹침</div>
            <div className="gantt__track">
              <div
                className="gantt__band"
                role="img"
                aria-label={`${overlap.start} ~ ${overlap.end}, 합계 ${overlap.total}%`}
                data-testid="gantt-overlap"
                style={spanStyle(overlap.startIndex, overlap.endIndex, model.days)}
              />
              <div
                className="gantt__text gantt__text--total"
                data-gantt-text
                data-gantt-overlap-text
                aria-hidden="true"
                style={anchoredStyle(overlap.anchor)}
              >
                {overlap.total}%
              </div>
              {todayLine}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Gantt
