import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EmployeeDetail } from '../api/employees'
import { AuthContext } from '../auth/AuthContext'
import { HR_MANAGER, flush, never, reply } from '../test/api'
import { PARK_DETAIL, authAs, deferred } from '../test/employees'
import EmployeeFormPage from './EmployeeFormPage'

// T#39 criteria 5 and 6: the registration and edit form (contract "등록·수정"). fetch is replaced; the router is a
// MemoryRouter with both form addresses. Inputs are found by their accessible name: the required star is aria-hidden.
const DEPARTMENTS = [
  { id: 1, name: '개발팀' },
  { id: 2, name: '기획팀' },
  { id: 3, name: '디자인팀' },
]

const EDITED: EmployeeDetail = {
  ...PARK_DETAIL,
  skills: [
    { skillName: 'Kubernetes', proficiencyLevel: 'BEGINNER' },
    { skillName: 'Java', proficiencyLevel: 'ADVANCED' },
  ],
}

const DEFAULT_FAILURE = '저장하지 못했습니다. 잠시 후 다시 시도하세요.'

type Call = { url: string; method: string; body: unknown; contentType: string | null }

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>
}

// Answers the two loads by default; `save` answers POST/PUT. Every call is recorded with its method and body.
function stubFetch({
  departments = () => reply(200, DEPARTMENTS),
  detail = () => reply(200, EDITED),
  save = () => reply(400, { code: 'EMPLOYEE_NAME_REQUIRED', message: '이름을 입력하세요.' }),
}: {
  departments?: () => Promise<Response>
  detail?: () => Promise<Response>
  save?: (call: Call) => Promise<Response>
} = {}) {
  const calls: Call[] = []
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const headers = new Headers(init?.headers)
    const call: Call = {
      url,
      method,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      contentType: headers.get('Content-Type'),
    }
    calls.push(call)
    if (method !== 'GET') return save(call)
    if (url === '/api/departments') return departments()
    if (url === '/api/employees/1') return detail()
    return reply(404, {})
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

const writes = (calls: Call[]) => calls.filter((call) => call.method !== 'GET')
const reads = (calls: Call[]) => calls.filter((call) => call.method === 'GET').map((call) => call.url)

async function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={authAs(HR_MANAGER)}>
        <Routes>
          <Route path="/employees/new" element={<EmployeeFormPage mode="new" />} />
          <Route path="/employees/:id/edit" element={<EmployeeFormPage mode="edit" />} />
          <Route path="*" element={<p>다른 화면</p>} />
        </Routes>
        <Where />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
  await flush()
}

const where = () => screen.getByTestId('where').textContent
const nameInput = () => screen.getByRole('textbox', { name: '이름' })
const departmentSelect = () => screen.getByRole('combobox', { name: '부서' })
const jobInput = () => screen.getByRole('textbox', { name: '직무' })
const careerInput = () => screen.getByRole('spinbutton', { name: '경력(년)' })
const skillsGroup = () => screen.getByRole('group', { name: '기술' })
const skillRow = (n: number) => screen.getByRole('group', { name: `기술 ${n}` })
const skillRows = () => within(skillsGroup()).queryAllByRole('group')
const saveButton = () => screen.getByRole('button', { name: '저장' })

function type(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } })
}

function addSkill(name: string, level: string) {
  fireEvent.click(screen.getByRole('button', { name: '기술 추가' }))
  const row = skillRow(skillRows().length)
  type(within(row).getByRole('textbox', { name: '기술 이름' }), name)
  fireEvent.change(within(row).getByRole('combobox', { name: '숙련도' }), { target: { value: level } })
}

async function save() {
  fireEvent.click(saveButton())
  await flush()
}

describe('EmployeeFormPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Criterion 5.
  it('registers with the fields in the D2 order, required marks, and the departments from the API', async () => {
    const calls = stubFetch()

    await renderAt('/employees/new')

    expect(nameInput()).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '직원 등록' })).toBeInTheDocument()
    const order = [nameInput(), departmentSelect(), jobInput(), skillsGroup(), careerInput()]
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    for (const required of [nameInput(), departmentSelect(), jobInput(), careerInput()]) {
      expect(required).toBeRequired()
      const label = document.querySelector(`label[for="${required.id}"]`)
      expect(label?.querySelector('[aria-hidden="true"]')?.textContent).toBe('*')
    }
    expect(within(departmentSelect()).getAllByRole('option').map((option) => option.textContent)).toEqual([
      '선택하세요',
      '개발팀',
      '기획팀',
      '디자인팀',
    ])
    expect(departmentSelect()).toHaveValue('')
    expect(skillRows()).toEqual([])
    expect(reads(calls)).toEqual(['/api/departments'])
  })

  it('fills the edit form with the employee as the API returned it', async () => {
    const calls = stubFetch()

    await renderAt('/employees/1/edit')

    expect(screen.getByRole('heading', { level: 1, name: '직원 수정' })).toBeInTheDocument()
    expect(nameInput()).toHaveValue('박소영')
    expect(departmentSelect()).toHaveValue('1')
    expect(jobInput()).toHaveValue('백엔드 개발자')
    expect(careerInput()).toHaveValue(5)
    expect(skillRows().map((row) => row.getAttribute('aria-label'))).toEqual(['기술 1', '기술 2'])
    expect(within(skillRow(1)).getByRole('textbox', { name: '기술 이름' })).toHaveValue('Kubernetes')
    expect(within(skillRow(1)).getByRole('combobox', { name: '숙련도' })).toHaveValue('BEGINNER')
    expect(within(skillRow(2)).getByRole('textbox', { name: '기술 이름' })).toHaveValue('Java')
    expect(within(skillRow(2)).getByRole('combobox', { name: '숙련도' })).toHaveValue('ADVANCED')
    expect(
      within(within(skillRow(1)).getByRole('combobox', { name: '숙련도' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['선택하세요', '초급', '중급', '고급'])
    expect([...reads(calls)].sort()).toEqual(['/api/departments', '/api/employees/1'])
  })

  it('adds an empty skill row at the end with the focus on its name, and 기술 1 삭제 removes only the first row', async () => {
    stubFetch()
    await renderAt('/employees/1/edit')

    fireEvent.click(screen.getByRole('button', { name: '기술 추가' }))
    await flush()
    expect(skillRows()).toHaveLength(3)
    const added = within(skillRow(3)).getByRole('textbox', { name: '기술 이름' })
    expect(added).toHaveValue('')
    expect(document.activeElement).toBe(added)

    fireEvent.click(screen.getByRole('button', { name: '기술 1 삭제' }))
    expect(skillRows()).toHaveLength(2)
    expect(within(skillRow(1)).getByRole('textbox', { name: '기술 이름' })).toHaveValue('Java')
    expect(within(skillRow(2)).getByRole('textbox', { name: '기술 이름' })).toHaveValue('')
  })

  it('sends exactly the trimmed body, every skill row in order, and goes to the new employee on 201', async () => {
    const calls = stubFetch({ save: () => reply(201, { ...PARK_DETAIL, id: 21, name: '새직원' }) })
    await renderAt('/employees/new')

    type(nameInput(), '  새직원 ')
    fireEvent.change(departmentSelect(), { target: { value: '1' } })
    type(jobInput(), ' 백엔드 ')
    addSkill('Java', 'INTERMEDIATE')
    fireEvent.click(screen.getByRole('button', { name: '기술 추가' }))
    type(careerInput(), '3')
    await save()

    expect(writes(calls)).toEqual([
      {
        url: '/api/employees',
        method: 'POST',
        contentType: 'application/json',
        body: {
          name: '새직원',
          departmentId: 1,
          jobTitle: '백엔드',
          careerYears: 3,
          skills: [
            { skillName: 'Java', proficiencyLevel: 'INTERMEDIATE' },
            { skillName: '', proficiencyLevel: '' },
          ],
        },
      },
    ])
    expect(where()).toBe('/employees/21')
  })

  it('sends null for an unchosen department and an empty career', async () => {
    const calls = stubFetch()
    await renderAt('/employees/new')

    type(nameInput(), '새직원')
    type(jobInput(), '백엔드')
    await save()

    expect(writes(calls).map((call) => call.body)).toEqual([
      { name: '새직원', departmentId: null, jobTitle: '백엔드', careerYears: null, skills: [] },
    ])
  })

  it('edits with PUT /api/employees/1 in the same shape and goes to the detail on 200', async () => {
    const calls = stubFetch({ save: () => reply(200, EDITED) })
    await renderAt('/employees/1/edit')

    type(jobInput(), '시니어 백엔드 개발자')
    await save()

    expect(writes(calls)).toEqual([
      {
        url: '/api/employees/1',
        method: 'PUT',
        contentType: 'application/json',
        body: {
          name: '박소영',
          departmentId: 1,
          jobTitle: '시니어 백엔드 개발자',
          careerYears: 5,
          skills: [
            { skillName: 'Kubernetes', proficiencyLevel: 'BEGINNER' },
            { skillName: 'Java', proficiencyLevel: 'ADVANCED' },
          ],
        },
      },
    ])
    expect(where()).toBe('/employees/1')
  })

  for (const [path, target] of [
    ['/employees/new', '/employees'],
    ['/employees/1/edit', '/employees/1'],
  ] as const) {
    it(`cancels ${path} to ${target} without saving`, async () => {
      const calls = stubFetch()
      await renderAt(path)

      type(nameInput(), '바뀐 이름')
      fireEvent.click(screen.getByRole('button', { name: '취소' }))
      await flush()

      expect(where()).toBe(target)
      expect(writes(calls)).toEqual([])
    })
  }

  it('sends one request while the save is held, however often 저장 or Enter is pressed', async () => {
    const held = deferred()
    let saves = 0
    const calls = stubFetch({
      save: () => {
        saves += 1
        return held.promise
      },
    })
    await renderAt('/employees/new')
    type(nameInput(), '새직원')

    fireEvent.click(saveButton())
    await flush()
    expect(saves).toBe(1)
    expect(held.isReleased()).toBe(false)
    expect(saveButton()).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(saveButton())
    fireEvent.submit(nameInput().closest('form')!)
    await flush()

    expect(writes(calls)).toHaveLength(1)
    held.release(await reply(400, { code: 'EMPLOYEE_JOB_TITLE_REQUIRED', message: '직무를 입력하세요.' }))
    await flush()
    expect(held.isReleased()).toBe(true)
    expect(saveButton()).not.toHaveAttribute('aria-busy')
  })

  it('shows the spinner and 불러오는 중… while the form data is on its way', async () => {
    stubFetch({ departments: () => never() })

    await renderAt('/employees/new')

    expect(screen.getByText('불러오는 중…')).toBeInTheDocument()
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByRole('textbox', { name: '이름' })).not.toBeInTheDocument()
  })

  for (const failing of ['departments', 'detail'] as const) {
    it(`shows the error state when the ${failing} request fails, and 다시 시도 asks both again`, async () => {
      let call = 0
      const answer = () => {
        call += 1
        return call === 1 ? reply(500, { code: 'X', message: '서버 오류' }) : reply(200, failing === 'detail' ? EDITED : DEPARTMENTS)
      }
      const calls = failing === 'detail' ? stubFetch({ detail: answer }) : stubFetch({ departments: answer })
      await renderAt('/employees/1/edit')

      const alert = screen.getByRole('alert')
      expect(within(alert).getByText('서버 오류')).toBeInTheDocument()
      fireEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
      await flush()

      expect([...reads(calls)].sort()).toEqual([
        '/api/departments',
        '/api/departments',
        '/api/employees/1',
        '/api/employees/1',
      ])
      expect(nameInput()).toHaveValue('박소영')
    })
  }

  it('says the employee was not found when the detail answers 404', async () => {
    stubFetch({ detail: () => reply(404, { code: 'EMPLOYEE_NOT_FOUND', message: '직원을 찾을 수 없습니다.' }) })

    await renderAt('/employees/1/edit')

    expect(within(screen.getByRole('alert')).getByText('직원을 찾을 수 없습니다.')).toBeInTheDocument()
  })

  for (const [path, label, href] of [
    ['/employees/new', '직원 목록으로', '/employees'],
    ['/employees/1/edit', '직원 상세로', '/employees/1'],
  ] as const) {
    it(`has the desktop notice for ${path} with a link to ${href}`, async () => {
      stubFetch()

      await renderAt(path)

      const notice = screen.getByText('데스크톱에서 이용해 주세요').closest('[role="status"]') as HTMLElement
      expect(notice).not.toBeNull()
      expect(within(notice).getByText('직원 등록·수정은 너비 1024px 이상 화면에서 할 수 있습니다.')).toBeInTheDocument()
      expect(within(notice).getByRole('link', { name: label })).toHaveAttribute('href', href)
    })
  }
})

// Criterion 6.
describe('EmployeeFormPage errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  for (const [code, message, field] of [
    ['EMPLOYEE_NAME_REQUIRED', '이름을 입력하세요.', nameInput],
    ['EMPLOYEE_DEPARTMENT_NOT_FOUND', '부서를 찾을 수 없습니다.', departmentSelect],
    ['EMPLOYEE_JOB_TITLE_REQUIRED', '직무를 입력하세요.', jobInput],
    ['EMPLOYEE_CAREER_YEARS_INVALID', '경력은 0년 이상이어야 합니다.', careerInput],
  ] as const) {
    it(`puts ${code} under its input`, async () => {
      stubFetch({ save: () => reply(400, { code, message }) })
      await renderAt('/employees/new')

      await save()

      expect(field()).toHaveAttribute('aria-invalid', 'true')
      expect(field()).toHaveAccessibleDescription(message)
      expect(field()).toHaveFocus() // T#58 criterion 5
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  }

  for (const [code, message] of [
    ['EMPLOYEE_SKILL_INVALID', '기술 이름과 숙련도를 올바르게 입력하세요.'],
    ['EMPLOYEE_SKILL_DUPLICATE', '같은 기술을 두 번 등록할 수 없습니다.'],
  ] as const) {
    it(`puts ${code} under the skill rows, above 기술 추가`, async () => {
      stubFetch({ save: () => reply(400, { code, message }) })
      await renderAt('/employees/1/edit')

      await save()

      // T#58 criterion 4: the first row's 기술 이름 carries aria-invalid, the message and the focus; the fieldset keeps only
      // the description.
      const firstName = within(skillRow(1)).getByRole('textbox', { name: '기술 이름' })
      expect(firstName).toHaveAttribute('aria-invalid', 'true')
      expect(firstName).toHaveAccessibleDescription(message)
      expect(firstName).toHaveFocus()
      expect(skillsGroup()).not.toHaveAttribute('aria-invalid')
      expect(skillsGroup()).toHaveAccessibleDescription(message)
      const shown = within(skillsGroup()).getByText(message)
      const add = screen.getByRole('button', { name: '기술 추가' })
      expect(shown.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(skillRow(2).compareDocumentPosition(shown) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it(`marks the skill fieldset invalid on ${code} and clears it when saving again`, async () => {
      let call = 0
      const held = deferred()
      stubFetch({
        save: () => {
          call += 1
          return call === 1 ? reply(400, { code, message }) : held.promise
        },
      })
      await renderAt('/employees/1/edit')
      await save()
      const firstName = () => within(skillRow(1)).getByRole('textbox', { name: '기술 이름' })
      expect(firstName()).toHaveAttribute('aria-invalid', 'true')

      await save()

      expect(firstName()).not.toHaveAttribute('aria-invalid')
      expect(skillsGroup()).not.toHaveAttribute('aria-invalid')
      expect(skillsGroup()).not.toHaveAttribute('aria-describedby')
      expect(screen.queryByText(message)).not.toBeInTheDocument()
    })
  }

  for (const [kind, answer, expected] of [
    ['403', () => reply(403, { code: 'AUTH_FORBIDDEN', message: '이 작업을 할 권한이 없습니다.' }), '이 작업을 할 권한이 없습니다.'],
    ['404', () => reply(404, { code: 'EMPLOYEE_NOT_FOUND', message: '직원을 찾을 수 없습니다.' }), '직원을 찾을 수 없습니다.'],
    ['500', () => reply(500, { code: 'X', message: '서버 오류' }), '서버 오류'],
    ['an unknown code', () => reply(400, { code: 'SOMETHING_ELSE', message: '모르는 오류' }), '모르는 오류'],
    ['a 400 without a code', () => reply(400, { timestamp: 't', status: 400, error: 'Bad Request', path: '/api/employees' }), DEFAULT_FAILURE],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch')), DEFAULT_FAILURE],
  ] as const) {
    it(`shows ${kind} as the form message above the buttons`, async () => {
      stubFetch({ save: answer })
      await renderAt('/employees/new')

      await save()

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(expected)
      expect(alert.closest('form')).not.toBeNull()
      expect(alert.compareDocumentPosition(saveButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  }

  it('clears the earlier message when saving again', async () => {
    let call = 0
    const held = deferred()
    stubFetch({
      save: () => {
        call += 1
        return call === 1 ? reply(400, { code: 'EMPLOYEE_NAME_REQUIRED', message: '이름을 입력하세요.' }) : held.promise
      },
    })
    await renderAt('/employees/new')
    await save()
    expect(nameInput()).toHaveAccessibleDescription('이름을 입력하세요.')

    await save()

    expect(nameInput()).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText('이름을 입력하세요.')).not.toBeInTheDocument()
  })

  for (const career of ['1.5', '1e2', '99999999999']) {
    it(`does not send a career of ${career} and asks for a whole number under it`, async () => {
      const calls = stubFetch()
      await renderAt('/employees/new')
      type(nameInput(), '새직원')
      type(careerInput(), career)

      await save()

      expect(writes(calls)).toEqual([])
      expect(careerInput()).toHaveAttribute('aria-invalid', 'true')
      expect(careerInput()).toHaveAccessibleDescription('경력은 정수로 입력하세요.')
      expect(careerInput()).toHaveFocus() // T#58 criterion 5
    })
  }
})
