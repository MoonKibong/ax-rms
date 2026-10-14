import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { Department } from '../api/departments'
import {
  SAVE_FAILED,
  readFailure,
  type ApiFailure,
  type EmployeeDetail,
  type EmployeeUpsert,
  type ProficiencyLevel,
} from '../api/employees'
import AppShell from '../components/AppShell'
import Button from '../components/Button'
import SelectField, { type SelectOption } from '../components/SelectField'
import Spinner from '../components/Spinner'
import StateMessage from '../components/StateMessage'
import TextField from '../components/TextField'
import { WarningIcon } from '../components/icons'
import './pages.css'
import './EmployeeFormPage.css'

// T#39, BRIEF §6.4 form (D2, D11, D12, D26, D29, D33): registration at /employees/new and edit at /employees/:id/edit.
// The server judges every rule and the screen puts its message under the input it is about. The screen checks only
// that 경력 is a whole number (the API would cut 1.5 to 1, or answer Spring's own 400) and the address's id.
// Below 1024px the form is hidden and the desktop notice shows instead (EmployeeFormPage.css).
const EMPLOYEE_ID = /^[1-9][0-9]*$/
const NOT_FOUND = '직원을 찾을 수 없습니다.'
const CAREER_NOT_WHOLE = '경력은 정수로 입력하세요.'
const NONE_CHOSEN: SelectOption = { value: '', label: '선택하세요' }
const LEVEL_OPTIONS: SelectOption[] = [
  NONE_CHOSEN,
  { value: 'BEGINNER', label: '초급' },
  { value: 'INTERMEDIATE', label: '중급' },
  { value: 'ADVANCED', label: '고급' },
]

type Field = 'name' | 'departmentId' | 'jobTitle' | 'careerYears' | 'skills'

// The input each 400 code of T#8 is about (contract "서버 오류의 자리"). Anything else is the form's message.
const FIELD_OF_CODE: Record<string, Field> = {
  EMPLOYEE_NAME_REQUIRED: 'name',
  EMPLOYEE_DEPARTMENT_NOT_FOUND: 'departmentId',
  EMPLOYEE_JOB_TITLE_REQUIRED: 'jobTitle',
  EMPLOYEE_CAREER_YEARS_INVALID: 'careerYears',
  EMPLOYEE_SKILL_INVALID: 'skills',
  EMPLOYEE_SKILL_DUPLICATE: 'skills',
}

type FormError = { field: Field | 'form'; message: string }
type SkillRow = { key: number; skillName: string; proficiencyLevel: ProficiencyLevel | '' }
type Values = { name: string; departmentId: string; jobTitle: string; careerYears: string; skills: SkillRow[] }
type LoadState = { phase: 'loading' } | { phase: 'error'; message?: string } | { phase: 'ready'; departments: Department[] }

const EMPTY: Values = { name: '', departmentId: '', jobTitle: '', careerYears: '', skills: [] }

class LoadError extends Error {}

async function load<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new LoadError((await readFailure(response)).message)
  }
  return (await response.json()) as T
}

// 경력: empty is null (the server says what is missing); a whole number of the API's range is that number; anything
// else (1.5, 1e2, 99999999999) is not sent.
function careerOf(text: string): number | null | undefined {
  const value = text.trim()
  if (value === '') {
    return null
  }
  if (!/^-?[0-9]+$/.test(value)) {
    return undefined
  }
  const number = Number(value)
  return number >= -2147483648 && number <= 2147483647 ? number : undefined
}

function placeError(failure: ApiFailure): FormError {
  const field = failure.status === 400 && failure.code ? FIELD_OF_CODE[failure.code] : undefined
  if (field && failure.message) {
    return { field, message: failure.message }
  }
  return { field: 'form', message: failure.message ?? SAVE_FAILED }
}

function EmployeeFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const validId = mode === 'new' || EMPLOYEE_ID.test(id)
  const back = mode === 'new' ? '/employees' : `/employees/${id}`
  const [state, setState] = useState<LoadState>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [values, setValues] = useState<Values>(EMPTY)
  const [error, setError] = useState<FormError | null>(null)
  const [saving, setSaving] = useState(false)
  // One save at a time, however often 저장 or Enter is pressed while it is under way.
  const inFlight = useRef(false)
  const nextKey = useRef(0)
  const focusKey = useRef<number | null>(null)
  const skillsRef = useRef<HTMLFieldSetElement>(null)
  const skillsErrorId = useId()

  // The departments, and for an edit the employee too. A retry asks both again.
  useEffect(() => {
    if (!validId) {
      return undefined
    }
    const controller = new AbortController()
    setState({ phase: 'loading' })
    Promise.all([
      load<Department[]>('/api/departments', controller.signal),
      mode === 'edit' ? load<EmployeeDetail>(`/api/employees/${id}`, controller.signal) : Promise.resolve(null),
    ]).then(
      ([departments, employee]) => {
        if (controller.signal.aborted) {
          return
        }
        if (employee) {
          setValues({
            name: employee.name,
            departmentId: String(employee.departmentId),
            jobTitle: employee.jobTitle,
            careerYears: String(employee.careerYears),
            skills: employee.skills.map((skill) => ({
              key: nextKey.current++,
              skillName: skill.skillName,
              proficiencyLevel: skill.proficiencyLevel,
            })),
          })
        }
        setState({ phase: 'ready', departments })
      },
      (failure: unknown) => {
        if (!controller.signal.aborted) {
          setState({ phase: 'error', message: failure instanceof LoadError ? failure.message || undefined : undefined })
        }
      },
    )
    return () => controller.abort()
  }, [mode, id, validId, attempt])

  // "기술 추가" puts the focus on the new row's name once it is drawn.
  useEffect(() => {
    if (focusKey.current === null) {
      return
    }
    skillsRef.current?.querySelector<HTMLInputElement>(`[data-skill-key="${focusKey.current}"] input`)?.focus()
    focusKey.current = null
  }, [values.skills])

  function set<K extends Exclude<keyof Values, 'skills'>>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function addSkill() {
    const key = nextKey.current++
    focusKey.current = key
    setValues((current) => ({ ...current, skills: [...current.skills, { key, skillName: '', proficiencyLevel: '' }] }))
  }

  function updateSkill(key: number, change: Partial<Omit<SkillRow, 'key'>>) {
    setValues((current) => ({
      ...current,
      skills: current.skills.map((skill) => (skill.key === key ? { ...skill, ...change } : skill)),
    }))
  }

  function removeSkill(key: number) {
    setValues((current) => ({ ...current, skills: current.skills.filter((skill) => skill.key !== key) }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) {
      return
    }
    setError(null)
    const careerYears = careerOf(values.careerYears)
    if (careerYears === undefined) {
      setError({ field: 'careerYears', message: CAREER_NOT_WHOLE })
      return
    }
    const body: EmployeeUpsert = {
      name: values.name.trim(),
      departmentId: values.departmentId ? Number(values.departmentId) : null,
      jobTitle: values.jobTitle.trim(),
      careerYears,
      skills: values.skills.map((skill) => ({ skillName: skill.skillName.trim(), proficiencyLevel: skill.proficiencyLevel })),
    }
    inFlight.current = true
    setSaving(true)
    try {
      const response = await fetch(mode === 'new' ? '/api/employees' : `/api/employees/${id}`, {
        method: mode === 'new' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (response.ok) {
        // The detail asks the server again at its address (D36).
        const saved = (await response.json()) as EmployeeDetail
        navigate(`/employees/${saved.id}`, { replace: true })
        return
      }
      setError(placeError(await readFailure(response)))
    } catch {
      setError({ field: 'form', message: SAVE_FAILED })
    }
    inFlight.current = false
    setSaving(false)
  }

  const errorFor = (field: Field) => (error?.field === field ? error.message : undefined)
  const skillsError = errorFor('skills')

  let content
  if (!validId) {
    content = <StateMessage kind="error" description={NOT_FOUND} />
  } else if (state.phase === 'loading') {
    content = (
      <div className="employee-form-page__loading" aria-busy="true">
        <Spinner />
        <p className="employee-form-page__loading-text">불러오는 중…</p>
      </div>
    )
  } else if (state.phase === 'error') {
    content = <StateMessage kind="error" description={state.message} onRetry={() => setAttempt((count) => count + 1)} />
  } else {
    const departmentOptions = [
      NONE_CHOSEN,
      ...state.departments.map((department) => ({ value: String(department.id), label: department.name })),
    ]
    content = (
      <form className="employee-form" noValidate onSubmit={save}>
        <TextField
          label="이름"
          required
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          error={errorFor('name')}
        />
        <SelectField
          label="부서"
          required
          options={departmentOptions}
          value={values.departmentId}
          onChange={(value) => set('departmentId', value)}
          error={errorFor('departmentId')}
        />
        <TextField
          label="직무"
          required
          value={values.jobTitle}
          onChange={(event) => set('jobTitle', event.target.value)}
          error={errorFor('jobTitle')}
        />
        <fieldset
          ref={skillsRef}
          className="employee-form__skills"
          aria-describedby={skillsError ? skillsErrorId : undefined}
        >
          <legend className="employee-form__legend">기술</legend>
          <div className="employee-form__skill-list">
            {values.skills.map((skill, index) => (
              <div
                key={skill.key}
                className="employee-form__skill"
                role="group"
                aria-label={`기술 ${index + 1}`}
                data-skill-key={skill.key}
              >
                <TextField
                  label="기술 이름"
                  value={skill.skillName}
                  onChange={(event) => updateSkill(skill.key, { skillName: event.target.value })}
                />
                <SelectField
                  label="숙련도"
                  options={LEVEL_OPTIONS}
                  value={skill.proficiencyLevel}
                  onChange={(value) => updateSkill(skill.key, { proficiencyLevel: value as ProficiencyLevel | '' })}
                />
                <Button variant="secondary" aria-label={`기술 ${index + 1} 삭제`} onClick={() => removeSkill(skill.key)}>
                  삭제
                </Button>
              </div>
            ))}
            {skillsError ? (
              <p id={skillsErrorId} className="field__error">
                <WarningIcon size={16} />
                {skillsError}
              </p>
            ) : null}
            <Button variant="secondary" className="employee-form__add-skill" onClick={addSkill}>
              기술 추가
            </Button>
          </div>
        </fieldset>
        <TextField
          label="경력(년)"
          required
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={values.careerYears}
          onChange={(event) => set('careerYears', event.target.value)}
          error={errorFor('careerYears')}
        />
        {error?.field === 'form' ? (
          <p className="field__error" role="alert">
            <WarningIcon size={16} />
            {error.message}
          </p>
        ) : null}
        <div className="employee-form__actions">
          <Button variant="secondary" disabled={saving} onClick={() => navigate(back)}>
            취소
          </Button>
          <Button type="submit" loading={saving}>
            저장
          </Button>
        </div>
      </form>
    )
  }

  return (
    <AppShell current="employees">
      <div className="employee-form-page">
        <h1 className="page__title">{mode === 'new' ? '직원 등록' : '직원 수정'}</h1>
        <div className="employee-form-page__body">{content}</div>
        <div className="employee-form-page__notice" role="status">
          <p className="employee-form-page__notice-title">데스크톱에서 이용해 주세요</p>
          <p className="employee-form-page__notice-text">직원 등록·수정은 너비 1024px 이상 화면에서 할 수 있습니다.</p>
          <Link className="button employee-form-page__notice-link" data-variant="secondary" to={back}>
            {mode === 'new' ? '직원 목록으로' : '직원 상세로'}
          </Link>
        </div>
      </div>
    </AppShell>
  )
}

export default EmployeeFormPage
