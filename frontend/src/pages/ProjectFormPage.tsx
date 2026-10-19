import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { apiFetch } from '../api/client'
import { SAVE_FAILED, readFailure, type ApiFailure } from '../api/employees'
import type { ProficiencyLevel, ProjectDetail, ProjectStatus, ProjectUpsert } from '../api/projects'
import AppShell from '../components/AppShell'
import Button from '../components/Button'
import DesktopNotice from '../components/DesktopNotice'
import SelectField, { type SelectOption } from '../components/SelectField'
import Spinner from '../components/Spinner'
import StateMessage from '../components/StateMessage'
import TextField from '../components/TextField'
import { WarningIcon } from '../components/icons'
import './pages.css'
import './ProjectFormPage.css'

// T#34, BRIEF §6.6 form (D3, D13, D22, D29, D30, D33): registration at /projects/new and edit at /projects/:id/edit.
// The server judges every rule and the screen puts its message under the input it is about (D30 under the two dates
// of 기간). The screen checks only that 인원 is a whole number (the API would cut 1.5 to 1); the address's id is checked
// by the route. Below 1024px the form is hidden and the desktop notice shows instead (ProjectFormPage.css).
const NOT_FOUND = '프로젝트를 찾을 수 없습니다.'
const HEADCOUNT_NOT_WHOLE = '필요 역량의 인원은 정수로 입력하세요.'
const NONE_CHOSEN: SelectOption = { value: '', label: '선택하세요' }
const STATUS_OPTIONS: SelectOption[] = [
  NONE_CHOSEN,
  { value: 'PLANNED', label: '계획' },
  { value: 'IN_PROGRESS', label: '진행 중' },
  { value: 'DONE', label: '완료' },
  { value: 'ON_HOLD', label: '보류' },
]
const LEVEL_OPTIONS: SelectOption[] = [
  NONE_CHOSEN,
  { value: 'BEGINNER', label: '초급' },
  { value: 'INTERMEDIATE', label: '중급' },
  { value: 'ADVANCED', label: '고급' },
]

type Field = 'name' | 'period' | 'status' | 'skills'

// The input each 400 code of T#9 is about (contract "서버 오류의 자리"). Anything else is the form's message.
const FIELD_OF_CODE: Record<string, Field> = {
  PROJECT_NAME_REQUIRED: 'name',
  PROJECT_PERIOD_REQUIRED: 'period',
  PROJECT_PERIOD_INVALID: 'period',
  PROJECT_PERIOD_EXCLUDES_ASSIGNMENTS: 'period',
  PROJECT_STATUS_INVALID: 'status',
  PROJECT_SKILL_LINE_INVALID: 'skills',
}

type FormError = { field: Field | 'form'; message: string }
type SkillRow = {
  key: number
  jobTitle: string
  skillName: string
  proficiencyLevel: ProficiencyLevel | ''
  headcount: string
}
type Values = {
  name: string
  description: string
  startDate: string
  endDate: string
  status: ProjectStatus | ''
  skills: SkillRow[]
}
type LoadState = { phase: 'loading' } | { phase: 'error'; message?: string } | { phase: 'ready' }
type Loaded = { ok: true; project: ProjectDetail } | { ok: false; message?: string }

const EMPTY: Values = { name: '', description: '', startDate: '', endDate: '', status: '', skills: [] }

// 인원: empty is null (the server says what is missing); a whole number of the API's range is that number; anything
// else (1.5, 1e2, 99999999999) is not sent.
function headcountOf(text: string): number | null | undefined {
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

function ProjectFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const back = mode === 'new' ? '/projects' : `/projects/${id}`
  const [state, setState] = useState<LoadState>(mode === 'new' ? { phase: 'ready' } : { phase: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [values, setValues] = useState<Values>(EMPTY)
  const [error, setError] = useState<FormError | null>(null)
  const [saving, setSaving] = useState(false)
  // One save at a time, however often 저장 or Enter is pressed while it is under way.
  const inFlight = useRef(false)
  const nextKey = useRef(0)
  const focusKey = useRef<number | null>(null)
  const skillsRef = useRef<HTMLFieldSetElement>(null)
  const periodErrorId = useId()
  const skillsErrorId = useId()

  // An edit loads the project; a retry asks again. A registration has nothing to load.
  useEffect(() => {
    if (mode !== 'edit') {
      return undefined
    }
    const controller = new AbortController()
    setState({ phase: 'loading' })
    apiFetch(`/api/projects/${id}`, { signal: controller.signal })
      .then(async (response): Promise<Loaded> => {
        if (!response.ok) {
          const failure = await readFailure(response)
          return { ok: false, message: response.status === 404 ? NOT_FOUND : failure.message }
        }
        return { ok: true, project: (await response.json()) as ProjectDetail }
      })
      .then(
        (result) => {
          if (controller.signal.aborted) {
            return
          }
          if (!result.ok) {
            setState({ phase: 'error', message: result.message || undefined })
            return
          }
          const { project } = result
          setValues({
            name: project.name,
            description: project.description ?? '',
            startDate: project.startDate,
            endDate: project.endDate,
            status: project.status,
            skills: project.requiredSkills.map((line) => ({
              key: nextKey.current++,
              jobTitle: line.jobTitle,
              skillName: line.skillName,
              proficiencyLevel: line.proficiencyLevel,
              headcount: String(line.headcount),
            })),
          })
          setState({ phase: 'ready' })
        },
        () => {
          if (!controller.signal.aborted) {
            setState({ phase: 'error' })
          }
        },
      )
    return () => controller.abort()
  }, [mode, id, attempt])

  // "필요 역량 추가" puts the focus on the new row's 직무 once it is drawn.
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
    setValues((current) => ({
      ...current,
      skills: [...current.skills, { key, jobTitle: '', skillName: '', proficiencyLevel: '', headcount: '' }],
    }))
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
    const headcounts = values.skills.map((skill) => headcountOf(skill.headcount))
    if (headcounts.some((headcount) => headcount === undefined)) {
      setError({ field: 'skills', message: HEADCOUNT_NOT_WHOLE })
      return
    }
    const description = values.description.trim()
    const body: ProjectUpsert = {
      name: values.name.trim(),
      description: description === '' ? null : description,
      startDate: values.startDate === '' ? null : values.startDate,
      endDate: values.endDate === '' ? null : values.endDate,
      status: values.status === '' ? null : values.status,
      requiredSkills: values.skills.map((skill, index) => ({
        jobTitle: skill.jobTitle.trim(),
        skillName: skill.skillName.trim(),
        proficiencyLevel: skill.proficiencyLevel === '' ? null : skill.proficiencyLevel,
        headcount: headcounts[index] ?? null,
      })),
    }
    inFlight.current = true
    setSaving(true)
    try {
      const response = await apiFetch(mode === 'new' ? '/api/projects' : `/api/projects/${id}`, {
        method: mode === 'new' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (response.ok) {
        // The detail asks the server again at its address (D36).
        const saved = (await response.json()) as ProjectDetail
        navigate(`/projects/${saved.id}`, { replace: true })
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
  const periodError = errorFor('period')
  const skillsError = errorFor('skills')

  let content
  if (state.phase === 'loading') {
    content = (
      <div className="project-form-page__loading" aria-busy="true">
        <Spinner />
        <p className="project-form-page__loading-text">불러오는 중…</p>
      </div>
    )
  } else if (state.phase === 'error') {
    content = <StateMessage kind="error" description={state.message} onRetry={() => setAttempt((count) => count + 1)} />
  } else {
    content = (
      <form className="project-form" noValidate onSubmit={save}>
        <TextField
          label="프로젝트명"
          required
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          error={errorFor('name')}
        />
        <TextField label="설명" value={values.description} onChange={(event) => set('description', event.target.value)} />
        <fieldset
          className="project-form__group"
          aria-invalid={periodError ? true : undefined}
          aria-describedby={periodError ? periodErrorId : undefined}
        >
          <legend className="project-form__legend">기간</legend>
          <div className="project-form__period">
            <TextField
              label="시작일"
              required
              type="date"
              value={values.startDate}
              onChange={(event) => set('startDate', event.target.value)}
            />
            <TextField
              label="종료일"
              required
              type="date"
              value={values.endDate}
              onChange={(event) => set('endDate', event.target.value)}
            />
          </div>
          {periodError ? (
            <p id={periodErrorId} className="field__error project-form__group-error">
              <WarningIcon size={16} />
              {periodError}
            </p>
          ) : null}
        </fieldset>
        <SelectField
          label="상태"
          required
          options={STATUS_OPTIONS}
          value={values.status}
          onChange={(value) => set('status', value as ProjectStatus | '')}
          error={errorFor('status')}
        />
        <fieldset
          ref={skillsRef}
          className="project-form__group"
          aria-invalid={skillsError ? true : undefined}
          aria-describedby={skillsError ? skillsErrorId : undefined}
        >
          <legend className="project-form__legend">필요 역량</legend>
          <div className="project-form__skill-list">
            {values.skills.map((skill, index) => (
              <div
                key={skill.key}
                className="project-form__skill"
                role="group"
                aria-label={`필요 역량 ${index + 1}`}
                data-skill-key={skill.key}
              >
                <TextField
                  label="직무"
                  value={skill.jobTitle}
                  onChange={(event) => updateSkill(skill.key, { jobTitle: event.target.value })}
                />
                <TextField
                  label="기술"
                  value={skill.skillName}
                  onChange={(event) => updateSkill(skill.key, { skillName: event.target.value })}
                />
                <SelectField
                  label="숙련도"
                  options={LEVEL_OPTIONS}
                  value={skill.proficiencyLevel}
                  onChange={(value) => updateSkill(skill.key, { proficiencyLevel: value as ProficiencyLevel | '' })}
                />
                <TextField
                  label="인원"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={skill.headcount}
                  onChange={(event) => updateSkill(skill.key, { headcount: event.target.value })}
                />
                <Button
                  variant="secondary"
                  aria-label={`필요 역량 ${index + 1} 삭제`}
                  onClick={() => removeSkill(skill.key)}
                >
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
            <Button variant="secondary" className="project-form__add-skill" onClick={addSkill}>
              필요 역량 추가
            </Button>
          </div>
        </fieldset>
        {error?.field === 'form' ? (
          <p className="field__error" role="alert">
            <WarningIcon size={16} />
            {error.message}
          </p>
        ) : null}
        <div className="project-form__actions">
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
    <AppShell current="projects">
      <div className="project-form-page">
        <h1 className="page__title">{mode === 'new' ? '프로젝트 등록' : '프로젝트 수정'}</h1>
        <div className="project-form-page__body">{content}</div>
        <DesktopNotice
          text="프로젝트 등록·수정은 너비 1024px 이상 화면에서 할 수 있습니다."
          to={back}
          linkLabel={mode === 'new' ? '프로젝트 목록으로' : '프로젝트 상세로'}
        />
      </div>
    </AppShell>
  )
}

export default ProjectFormPage
