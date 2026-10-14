import { useState } from 'react'
import type { Candidate } from '../api/assignments'
import type { EmployeeListItem, ProficiencyLevel } from '../api/employees'
import Badge from '../components/Badge'
import DataTable, { type Column } from '../components/DataTable'
import StateMessage from '../components/StateMessage'
import TextField from '../components/TextField'

// T#17, BRIEF 6.7 item 3: the candidate table. The candidate API (T#10) gives name, status and the availability of the asked
// period (D18); the employee list API (T#13) gives department and skills, joined by employee id. Nothing is computed here.
const LEVELS: Record<ProficiencyLevel, string> = { BEGINNER: '초급', INTERMEDIATE: '중급', ADVANCED: '고급' }

type Row = Candidate & { departmentName: string; skillsText: string }

export type CandidatesState =
  | { phase: 'loading'; rows: Candidate[] | null }
  | { phase: 'error'; rows: Candidate[] | null }
  | { phase: 'ready'; rows: Candidate[] }

type AssignCandidatesProps = {
  state: CandidatesState
  employees: EmployeeListItem[] | null
  selectedId: number | null
  // While a row's 수정 is under way the target is the row's, so the names cannot be picked.
  locked: boolean
  onPick: (employeeId: number) => void
  onRetry: () => void
}

function AssignCandidates({ state, employees, selectedId, locked, onPick, onRetry }: AssignCandidatesProps) {
  const [search, setSearch] = useState('')

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: '이름',
      render: (row) => (
        <button
          type="button"
          className="assign__pick"
          aria-pressed={row.employeeId === selectedId}
          disabled={locked}
          onClick={() => onPick(row.employeeId)}
        >
          {row.name}
        </button>
      ),
    },
    { key: 'departmentName', header: '부서' },
    { key: 'skillsText', header: '기술' },
    { key: 'availabilityStatus', header: '상태', render: (row) => <Badge status={row.availabilityStatus} /> },
    { key: 'periodAvailability', header: '기간 가용률', align: 'end', render: (row) => `${row.periodAvailability}%` },
  ]

  let content
  if (state.phase === 'error') {
    content = <StateMessage kind="error" onRetry={onRetry} />
  } else if (state.rows === null) {
    content = <p className="assign__loading">불러오는 중…</p>
  } else if (state.rows.length === 0) {
    content = <StateMessage kind="empty" title="이 기간에 투입 가능한 직원이 없습니다" />
  } else {
    const byId = new Map((employees ?? []).map((employee) => [employee.id, employee]))
    const joined: Row[] = state.rows.map((candidate) => {
      const employee = byId.get(candidate.employeeId)
      return {
        ...candidate,
        departmentName: employee?.departmentName ?? '',
        skillsText: (employee?.skills ?? []).map((skill) => `${skill.skillName} ${LEVELS[skill.proficiencyLevel]}`).join(', '),
      }
    })
    const needle = search.trim()
    const shown = needle ? joined.filter((row) => row.name.includes(needle)) : joined
    content =
      shown.length === 0 ? (
        <StateMessage kind="no-results" onReset={() => setSearch('')} />
      ) : (
        <DataTable columns={columns} rows={shown} rowKey={(row) => String(row.employeeId)} empty={null} />
      )
  }

  return (
    <>
      <TextField label="이름 검색" className="assign__search" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="assign__candidates" aria-busy={state.phase === 'loading' ? true : undefined}>
        {content}
      </div>
    </>
  )
}

export default AssignCandidates
