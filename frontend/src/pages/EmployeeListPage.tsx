import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { EmployeeListItem } from '../api/employees'
import AppShell from '../components/AppShell'
import Badge from '../components/Badge'
import Button from '../components/Button'
import DataTable, { type Column } from '../components/DataTable'
import SelectField, { type SelectOption } from '../components/SelectField'
import Spinner from '../components/Spinner'
import StateMessage from '../components/StateMessage'
import TextField from '../components/TextField'
import './pages.css'
import './EmployeeListPage.css'

// T#13, BRIEF §6.3 (D2, D35). Values are shown as the API returns them (D36); the screen computes nothing.
type LoadState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; employees: EmployeeListItem[] }

// The filters as the address keeps them, in the order of the address and of the request (contract "필터와 주소").
type Filters = { name: string; departmentId: string; skill: string; status: string; minAvailability: string }
const KEYS: Array<keyof Filters> = ['name', 'departmentId', 'skill', 'status', 'minAvailability']

type Choices = { departments: SelectOption[]; skills: SelectOption[] }

const ALL: SelectOption = { value: '', label: '전체' }
const NO_CHOICES: Choices = { departments: [ALL], skills: [ALL] }
const STATUS_OPTIONS: SelectOption[] = [
  ALL,
  { value: 'AVAILABLE', label: '투입 가능' },
  { value: 'UNAVAILABLE', label: '투입 불가' },
]
// The thresholds are the contract's proposal (제안); the API keeps employees whose current availability is at least this.
const AVAILABILITY_OPTIONS: SelectOption[] = [
  ALL,
  { value: '30', label: '30% 이상' },
  { value: '50', label: '50% 이상' },
  { value: '70', label: '70% 이상' },
  { value: '100', label: '100%' },
]

const NONE = <span className="employee-list__none">—</span>

const COLUMNS: Column<EmployeeListItem>[] = [
  { key: 'name', header: '이름' },
  { key: 'departmentName', header: '부서' },
  { key: 'jobTitle', header: '직무' },
  {
    key: 'skills',
    header: '기술',
    render: (employee) =>
      employee.skills.length > 0 ? employee.skills.map((skill) => skill.skillName).join(', ') : NONE,
  },
  { key: 'availabilityStatus', header: '투입 상태', render: (employee) => <Badge status={employee.availabilityStatus} /> },
  {
    key: 'currentAvailability',
    header: '현재 가용률',
    align: 'end',
    render: (employee) => `${employee.currentAvailability}%`,
  },
  {
    key: 'needsReview',
    header: '확인 필요',
    render: (employee) => (employee.needsReview ? <Badge status="NEEDS_REVIEW" /> : NONE),
  },
]

// 부서 and 기술 come from the unfiltered answer, once: departments by id, skill names once each in Korean order.
function choicesFrom(employees: EmployeeListItem[]): Choices {
  const departments = new Map<number, string>()
  const skills = new Set<string>()
  for (const employee of employees) {
    if (!departments.has(employee.departmentId)) {
      departments.set(employee.departmentId, employee.departmentName)
    }
    for (const skill of employee.skills) {
      skills.add(skill.skillName)
    }
  }
  return {
    departments: [
      ALL,
      ...[...departments]
        .sort(([a], [b]) => a - b)
        .map(([id, name]) => ({ value: String(id), label: name })),
    ],
    skills: [ALL, ...[...skills].sort((a, b) => a.localeCompare(b, 'ko')).map((name) => ({ value: name, label: name }))],
  }
}

// The address as the screen reads it: a filter counts only when its value is one of the choices; anything else is
// 전체 and is never sent. The name stays as typed; the request trims it.
function readFilters(params: URLSearchParams, choices: Choices): Filters {
  const pick = (key: keyof Filters, options: SelectOption[]) => {
    const value = params.get(key) ?? ''
    return options.some((option) => option.value === value) ? value : ''
  }
  return {
    name: params.get('name') ?? '',
    departmentId: pick('departmentId', choices.departments),
    skill: pick('skill', choices.skills),
    status: pick('status', STATUS_OPTIONS),
    minAvailability: pick('minAvailability', AVAILABILITY_OPTIONS),
  }
}

function requestQuery(filters: Filters): string {
  const query = new URLSearchParams()
  for (const key of KEYS) {
    const value = key === 'name' ? filters.name.trim() : filters[key]
    if (value) {
      query.set(key, value)
    }
  }
  return query.toString()
}

async function fetchEmployees(url: string, signal: AbortSignal): Promise<EmployeeListItem[]> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    // Read the error body too: an unread body keeps the request open in the browser.
    await response.text().catch(() => '')
    throw new Error(`status ${response.status}`)
  }
  return (await response.json()) as EmployeeListItem[]
}

function EmployeeListPage() {
  const [params, setParams] = useSearchParams()
  const [choicesState, setChoicesState] = useState<LoadState>({ phase: 'loading' })
  const [choicesAttempt, setChoicesAttempt] = useState(0)
  const [list, setList] = useState<LoadState>({ phase: 'loading' })
  const [listAttempt, setListAttempt] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Until the person changes a filter, an address without filters shows the unfiltered answer that also made the
  // choices, so opening the screen asks once.
  const changed = useRef(false)
  const panelId = useId()

  useEffect(() => {
    const controller = new AbortController()
    setChoicesState({ phase: 'loading' })
    fetchEmployees('/api/employees', controller.signal)
      .then((employees) => {
        if (!controller.signal.aborted) {
          setChoicesState({ phase: 'ready', employees })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setChoicesState({ phase: 'error' })
        }
      })
    return () => controller.abort()
  }, [choicesAttempt])

  const unfiltered = choicesState.phase === 'ready' ? choicesState.employees : null
  const choices = useMemo(() => (unfiltered ? choicesFrom(unfiltered) : null), [unfiltered])
  const filters = readFilters(params, choices ?? NO_CHOICES)
  const query = choices ? requestQuery(filters) : null

  // One list request at a time counts: a new filter (or a retry) cancels the one before, and an answer that comes
  // after that is ignored, so the screen always shows the last choice.
  useEffect(() => {
    if (query === null || !unfiltered) {
      return
    }
    if (query === '' && !changed.current) {
      setList({ phase: 'ready', employees: unfiltered })
      return
    }
    const controller = new AbortController()
    setList({ phase: 'loading' })
    fetchEmployees(query ? `/api/employees?${query}` : '/api/employees', controller.signal)
      .then((employees) => {
        if (!controller.signal.aborted) {
          setList({ phase: 'ready', employees })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setList({ phase: 'error' })
        }
      })
    return () => controller.abort()
  }, [query, listAttempt, unfiltered])

  // Writes the filters to the address in the fixed order. Before the choices have arrived the address values are
  // kept as they are, so a change made while loading does not drop the others.
  function update(key: keyof Filters, value: string) {
    changed.current = true
    const current: Filters = choices
      ? readFilters(params, choices)
      : { name: '', departmentId: '', skill: '', status: '', minAvailability: '', ...Object.fromEntries(params) }
    const next = { ...current, [key]: value }
    const address = new URLSearchParams()
    for (const name of KEYS) {
      if (next[name]) {
        address.set(name, next[name])
      }
    }
    setParams(address, { replace: true })
  }

  function reset() {
    changed.current = true
    setParams(new URLSearchParams(), { replace: true })
  }

  function retry() {
    if (choicesState.phase === 'error') {
      setChoicesAttempt((count) => count + 1)
    } else {
      setListAttempt((count) => count + 1)
    }
  }

  const shown: LoadState = choicesState.phase === 'ready' ? list : choicesState
  const applied = [filters.departmentId, filters.skill, filters.status, filters.minAvailability].filter(Boolean).length
  const filtered = requestQuery(filters) !== ''

  let content
  if (shown.phase === 'loading') {
    content = (
      <div className="employee-list__loading">
        <Spinner />
        <p className="employee-list__loading-text">불러오는 중…</p>
      </div>
    )
  } else if (shown.phase === 'error') {
    content = <StateMessage kind="error" onRetry={retry} />
  } else if (shown.employees.length === 0) {
    content = filtered ? (
      <StateMessage kind="no-results" title="조건에 맞는 직원이 없습니다" onReset={reset} />
    ) : (
      <StateMessage kind="empty" title="등록된 직원이 없습니다" />
    )
  } else {
    content = (
      <DataTable columns={COLUMNS} rows={shown.employees} rowKey={(employee) => String(employee.id)} empty={null} />
    )
  }

  return (
    <AppShell current="employees">
      <div className="employee-list">
        <h1 className="page__title">직원</h1>
        <TextField
          className="employee-list__search"
          label="이름 검색"
          type="search"
          value={filters.name}
          onChange={(event) => update('name', event.target.value)}
        />
        <Button
          variant="secondary"
          className="employee-list__toggle"
          aria-expanded={filtersOpen}
          aria-controls={panelId}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          {applied > 0 ? `필터 (${applied})` : '필터'}
        </Button>
        <div id={panelId} className="employee-list__filters" data-open={filtersOpen || undefined}>
          <SelectField
            label="부서"
            options={(choices ?? NO_CHOICES).departments}
            value={filters.departmentId}
            onChange={(value) => update('departmentId', value)}
          />
          <SelectField
            label="기술"
            options={(choices ?? NO_CHOICES).skills}
            value={filters.skill}
            onChange={(value) => update('skill', value)}
          />
          <SelectField
            label="투입 상태"
            options={STATUS_OPTIONS}
            value={filters.status}
            onChange={(value) => update('status', value)}
          />
          <SelectField
            label="가용률"
            options={AVAILABILITY_OPTIONS}
            value={filters.minAvailability}
            onChange={(value) => update('minAvailability', value)}
          />
        </div>
        {shown.phase === 'ready' && shown.employees.length > 0 ? (
          <p className="employee-list__count">{shown.employees.length}명</p>
        ) : null}
        <div className="employee-list__result" aria-busy={shown.phase === 'loading' ? true : undefined}>
          {content}
        </div>
      </div>
    </AppShell>
  )
}

export default EmployeeListPage
