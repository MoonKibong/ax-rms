import { describe, expect, it } from 'vitest'
import { buildGanttModel, pickTickLabels, type GanttAssignment } from './model'

function assignment(id: string, start: string, end: string, rate: number, name = `프로젝트 ${id}`): GanttAssignment {
  return { id, projectName: name, projectStatus: '진행 중', start, end, rate }
}

const NO_TODAY = '2000-01-01'

describe('buildGanttModel', () => {
  it('spans from the earliest start to the latest end, both days included', () => {
    const model = buildGanttModel([assignment('a', '2026-10-01', '2026-10-31', 60)], NO_TODAY)
    expect(model.days).toBe(31)
    expect(model.rows).toHaveLength(1)
    expect(model.rows[0]).toMatchObject({ startIndex: 0, endIndex: 30 })
    expect(model.rows[0].anchor).toBeCloseTo(0.5, 5)
    expect(model.overlaps).toEqual([])
  })

  it('has no overlap for two assignments that do not share a day', () => {
    const model = buildGanttModel(
      [assignment('a', '2026-10-01', '2026-10-10', 60), assignment('b', '2026-10-20', '2026-10-31', 30)],
      NO_TODAY,
    )
    expect(model.days).toBe(31)
    expect(model.overlaps).toEqual([])
  })

  it('totals only the shared days when 60% and 30% partly overlap', () => {
    const model = buildGanttModel(
      [assignment('a', '2026-10-01', '2026-10-20', 60), assignment('b', '2026-10-15', '2026-10-31', 30)],
      NO_TODAY,
    )
    expect(model.overlaps).toHaveLength(1)
    expect(model.overlaps[0]).toMatchObject({
      start: '2026-10-15',
      end: '2026-10-20',
      startIndex: 14,
      endIndex: 19,
      total: 90,
    })
  })

  it('splits the overlap where the total changes (three assignments)', () => {
    const model = buildGanttModel(
      [
        assignment('a', '2026-10-01', '2026-10-30', 50),
        assignment('b', '2026-10-10', '2026-10-20', 30),
        assignment('c', '2026-10-15', '2026-10-25', 20),
      ],
      NO_TODAY,
    )
    expect(model.overlaps.map((o) => [o.start, o.end, o.total])).toEqual([
      ['2026-10-10', '2026-10-14', 80],
      ['2026-10-15', '2026-10-20', 100],
      ['2026-10-21', '2026-10-25', 70],
    ])
  })

  it('counts one shared day as an overlap, and the next day as none', () => {
    const shared = buildGanttModel(
      [assignment('a', '2026-10-01', '2026-10-15', 50), assignment('b', '2026-10-15', '2026-10-31', 40)],
      NO_TODAY,
    )
    expect(shared.overlaps.map((o) => [o.start, o.end, o.total])).toEqual([['2026-10-15', '2026-10-15', 90]])

    const adjacent = buildGanttModel(
      [assignment('a', '2026-10-01', '2026-10-15', 50), assignment('b', '2026-10-16', '2026-10-31', 40)],
      NO_TODAY,
    )
    expect(adjacent.overlaps).toEqual([])
  })

  it('places today only when it is inside the span', () => {
    const list = [assignment('a', '2026-10-01', '2026-10-31', 60)]
    expect(buildGanttModel(list, '2026-09-30').today).toBeNull()
    expect(buildGanttModel(list, '2026-11-01').today).toBeNull()
    const inside = buildGanttModel(list, '2026-10-11')
    expect(inside.today?.index).toBe(10)
    expect(inside.today?.anchor).toBeCloseTo(10.5 / 31, 5)
  })

  it('orders rows by start, end, then name whatever the input order', () => {
    const a = assignment('a', '2026-10-05', '2026-10-20', 10, '가')
    const b = assignment('b', '2026-10-01', '2026-10-31', 10, '나')
    const c = assignment('c', '2026-10-01', '2026-10-10', 10, '다')
    const d = assignment('d', '2026-10-01', '2026-10-10', 10, '라')
    const expected = ['c', 'd', 'b', 'a']
    for (const order of [[a, b, c, d], [d, c, b, a], [b, d, a, c]]) {
      expect(buildGanttModel(order, NO_TODAY).rows.map((row) => row.assignment.id)).toEqual(expected)
    }
  })

  it('anchors a short bar at the start near 0 and one at the end near 1', () => {
    const model = buildGanttModel(
      [
        assignment('long', '2026-01-01', '2026-12-31', 50),
        assignment('first', '2026-01-01', '2026-01-03', 10),
        assignment('last', '2026-12-29', '2026-12-31', 10),
      ],
      NO_TODAY,
    )
    const byId = Object.fromEntries(model.rows.map((row) => [row.assignment.id, row]))
    expect(byId.first.anchor).toBeLessThan(0.01)
    expect(byId.last.anchor).toBeGreaterThan(0.99)
    expect(byId.long.anchor).toBeCloseTo(0.5, 2)
  })

  it('marks each month once, across two years, at the first day inside the span', () => {
    const model = buildGanttModel([assignment('a', '2026-11-15', '2027-02-10', 60)], NO_TODAY)
    expect(model.ticks).toEqual([
      { index: 0, label: '11월' },
      { index: 16, label: '12월' },
      { index: 47, label: '1월' },
      { index: 78, label: '2월' },
    ])
  })
})

describe('pickTickLabels', () => {
  it('drops labels closer than 40px to the last one shown, but keeps the first', () => {
    const model = buildGanttModel([assignment('a', '2026-01-05', '2026-12-18', 50)], NO_TODAY)
    expect(model.ticks).toHaveLength(12)
    const picked = pickTickLabels(model.ticks, model.days, 328)
    expect(picked.length).toBeGreaterThan(0)
    expect(picked.length).toBeLessThan(12)
    expect(picked[0]).toEqual(model.ticks[0])
    for (let i = 1; i < picked.length; i += 1) {
      const gap = ((picked[i].index - picked[i - 1].index) / model.days) * 328
      expect(gap, `${picked[i - 1].label} to ${picked[i].label}`).toBeGreaterThanOrEqual(40)
    }
  })

  it('drops the second label when a month boundary is 4 days after the start', () => {
    const model = buildGanttModel([assignment('a', '2026-10-28', '2027-01-20', 50)], NO_TODAY)
    const picked = pickTickLabels(model.ticks, model.days, 328)
    expect(model.ticks.slice(0, 2).map((tick) => tick.label)).toEqual(['10월', '11월'])
    expect(picked.map((tick) => tick.label)).not.toContain('11월')
    expect(picked[0].label).toBe('10월')
  })
})
