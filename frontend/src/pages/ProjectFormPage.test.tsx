import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDetail } from '../api/projects'
import { AuthContext } from '../auth/AuthContext'
import { flush, never, reply } from '../test/api'
import { PROJECT_MANAGER, authAs, deferred } from '../test/employees'
import ProjectFormPage from './ProjectFormPage'

// T#34 criteria 2 and 3: the project registration and edit form (contract "등록·수정"). fetch is replaced; the router is
// a MemoryRouter with both form addresses. Inputs are found by their accessible name: the required star is aria-hidden.
const ALPHA: ProjectDetail = {
  id: 1,
  name: '알파 프로젝트',
  description: '사내 포털 리뉴얼',
  startDate: '2026-05-16',
  endDate: '2026-09-13',
  status: 'IN_PROGRESS',
  requiredSkills: [
    { jobTitle: '백엔드 개발자', skillName: 'Java', proficiencyLevel: 'INTERMEDIATE', headcount: 2 },
    { jobTitle: '디자이너', skillName: 'Figma', proficiencyLevel: 'BEGINNER', headcount: 1 },
  ],
  requiredHeadcount: 3,
  assignedHeadcount: 1,
  assignments: [],
}

const DEFAULT_FAILURE = '저장하지 못했습니다. 잠시 후 다시 시도하세요.'
const HEADCOUNT_NOT_WHOLE = '필요 역량의 인원은 정수로 입력하세요.'
const D30_MESSAGE =
  '프로젝트 기간을 바꾸면 기간 밖으로 나가는 배정 3건이 있어 저장할 수 없습니다: 권지안 2026-09-16 ~ 2027-01-07, ' +
  '강민재 2026-09-19 ~ 2027-01-02, 박소영 2026-09-24 ~ 2026-11-23'

type Call = { url: string; method: string; body: unknown; contentType: string | null }

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>
}

// Answers the detail load by default; `save` answers POST/PUT. Every call is recorded with its method and body.
function stubFetch({
  detail = () => reply(200, ALPHA),
  save = () => reply(400, { code: 'PROJECT_NAME_REQUIRED', message: '프로젝트명을 입력하세요.' }),
}: {
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
    if (url === '/api/projects/1') return detail()
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
      <AuthContext.Provider value={authAs(PROJECT_MANAGER)}>
        <Routes>
          <Route path="/projects/new" element={<ProjectFormPage mode="new" />} />
          <Route path="/projects/:id/edit" element={<ProjectFormPage mode="edit" />} />
          <Route path="*" element={<p>다른 화면</p>} />
        </Routes>
        <Where />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
  await flush()
}

const where = () => screen.getByTestId('where').textContent
const nameInput = () => screen.getByRole('textbox', { name: '프로젝트명' })
const descriptionInput = () => screen.getByRole('textbox', { name: '설명' })
const periodGroup = () => screen.getByRole('group', { name: '기간' })
const startInput = () => within(periodGroup()).getByLabelText(/^시작일/) as HTMLInputElement
const endInput = () => within(periodGroup()).getByLabelText(/^종료일/) as HTMLInputElement
const statusSelect = () => screen.getByRole('combobox', { name: '상태' })
const skillsGroup = () => screen.getByRole('group', { name: '필요 역량' })
const skillRow = (n: number) => screen.getByRole('group', { name: `필요 역량 ${n}` })
const skillRows = () => within(skillsGroup()).queryAllByRole('group')
const saveButton = () => screen.getByRole('button', { name: '저장' })
const cancelButton = () => screen.getByRole('button', { name: '취소' })

function type(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } })
}

function fillRow(n: number, jobTitle: string, skillName: string, level: string, headcount: string) {
  const row = skillRow(n)
  type(within(row).getByRole('textbox', { name: '직무' }), jobTitle)
  type(within(row).getByRole('textbox', { name: '기술' }), skillName)
  fireEvent.change(within(row).getByRole('combobox', { name: '숙련도' }), { target: { value: level } })
  type(within(row).getByRole('spinbutton', { name: '인원' }), headcount)
}

function addRow() {
  fireEvent.click(screen.getByRole('button', { name: '필요 역량 추가' }))
  return skillRows().length
}

async function save() {
  fireEvent.click(saveButton())
  await flush()
}

function rowValues(n: number) {
  const row = skillRow(n)
  return [
    within(row).getByRole('textbox', { name: '직무' }),
    within(row).getByRole('textbox', { name: '기술' }),
    within(row).getByRole('combobox', { name: '숙련도' }),
    within(row).getByRole('spinbutton', { name: '인원' }),
  ].map((input) => (input as HTMLInputElement).value)
}

function follows(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('ProjectFormPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Criterion 2.
  it('registers with the fields in the D3 order and the required marks, without a request', async () => {
    const calls = stubFetch()

    await renderAt('/projects/new')

    expect(nameInput()).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '프로젝트 등록' })).toBeInTheDocument()
    const order = [nameInput(), descriptionInput(), periodGroup(), startInput(), endInput(), statusSelect(), skillsGroup()]
    for (let i = 1; i < order.length; i += 1) {
      expect(follows(order[i - 1], order[i]), `field ${i}`).toBe(true)
    }
    for (const required of [nameInput(), startInput(), endInput(), statusSelect()]) {
      expect(required).toBeRequired()
      const label = document.querySelector(`label[for="${required.id}"]`)
      expect(label?.querySelector('[aria-hidden="true"]')?.textContent).toBe('*')
    }
    expect(descriptionInput()).not.toBeRequired()
    expect(startInput()).toHaveAttribute('type', 'date')
    expect(endInput()).toHaveAttribute('type', 'date')
    const options = within(statusSelect()).getAllByRole('option') as HTMLOptionElement[]
    expect(options.map((option) => option.textContent)).toEqual(['선택하세요', '계획', '진행 중', '완료', '보류'])
    expect(options.map((option) => option.value)).toEqual(['', 'PLANNED', 'IN_PROGRESS', 'DONE', 'ON_HOLD'])
    expect(statusSelect()).toHaveValue('')
    expect(skillRows()).toEqual([])
    expect(calls).toEqual([])
  })

  it('fills the edit form from the project, its status and its required-skill rows in the API order', async () => {
    const calls = stubFetch()

    await renderAt('/projects/1/edit')

    expect(screen.getByRole('heading', { level: 1, name: '프로젝트 수정' })).toBeInTheDocument()
    expect(nameInput()).toHaveValue('알파 프로젝트')
    expect(descriptionInput()).toHaveValue('사내 포털 리뉴얼')
    expect(startInput()).toHaveValue('2026-05-16')
    expect(endInput()).toHaveValue('2026-09-13')
    expect(statusSelect()).toHaveValue('IN_PROGRESS')
    expect((within(statusSelect()).getByRole('option', { selected: true }) as HTMLOptionElement).textContent).toBe('진행 중')
    expect(skillRows()).toHaveLength(2)
    expect(rowValues(1)).toEqual(['백엔드 개발자', 'Java', 'INTERMEDIATE', '2'])
    expect(rowValues(2)).toEqual(['디자이너', 'Figma', 'BEGINNER', '1'])
    const level = within(skillRow(1)).getByRole('combobox', { name: '숙련도' })
    expect((within(level).getByRole('option', { selected: true }) as HTMLOptionElement).textContent).toBe('중급')
    expect(reads(calls)).toEqual(['/api/projects/1'])
  })

  it('leaves the description empty when the project has none', async () => {
    stubFetch({ detail: () => reply(200, { ...ALPHA, description: null }) })

    await renderAt('/projects/1/edit')

    expect(descriptionInput()).toHaveValue('')
  })

  it('adds an empty row at the end with the focus on its 직무, and deletes only the row asked for', async () => {
    stubFetch()
    await renderAt('/projects/1/edit')

    expect(addRow()).toBe(3)
    expect(rowValues(3)).toEqual(['', '', '', ''])
    expect(within(skillRow(3)).getByRole('textbox', { name: '직무' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: '필요 역량 1 삭제' }))

    expect(skillRows()).toHaveLength(2)
    expect(rowValues(1)).toEqual(['디자이너', 'Figma', 'BEGINNER', '1'])
    expect(rowValues(2)).toEqual(['', '', '', ''])
  })

  it('posts the trimmed values, null for what is empty, and every row in screen order', async () => {
    const calls = stubFetch()
    await renderAt('/projects/new')

    type(nameInput(), '  새 프로젝트 ')
    type(descriptionInput(), ' 설명 ')
    type(startInput(), '2026-11-01')
    type(endInput(), '2026-12-31')
    fireEvent.change(statusSelect(), { target: { value: 'PLANNED' } })
    fillRow(addRow(), ' 백엔드 개발자 ', ' Java ', 'ADVANCED', '2')
    addRow()
    await save()

    expect(writes(calls)).toEqual([
      {
        url: '/api/projects',
        method: 'POST',
        contentType: 'application/json',
        body: {
          name: '새 프로젝트',
          description: '설명',
          startDate: '2026-11-01',
          endDate: '2026-12-31',
          status: 'PLANNED',
          requiredSkills: [
            { jobTitle: '백엔드 개발자', skillName: 'Java', proficiencyLevel: 'ADVANCED', headcount: 2 },
            { jobTitle: '', skillName: '', proficiencyLevel: null, headcount: null },
          ],
        },
      },
    ])
    expect(JSON.stringify(writes(calls)[0].body)).toBe(
      '{"name":"새 프로젝트","description":"설명","startDate":"2026-11-01","endDate":"2026-12-31","status":"PLANNED",' +
        '"requiredSkills":[{"jobTitle":"백엔드 개발자","skillName":"Java","proficiencyLevel":"ADVANCED","headcount":2},' +
        '{"jobTitle":"","skillName":"","proficiencyLevel":null,"headcount":null}]}',
    )
  })

  it('posts an empty form as empty name, nulls and no rows', async () => {
    const calls = stubFetch()
    await renderAt('/projects/new')

    await save()

    expect(writes(calls).map((call) => JSON.stringify(call.body))).toEqual([
      '{"name":"","description":null,"startDate":null,"endDate":null,"status":null,"requiredSkills":[]}',
    ])
  })

  it('puts the edited project to /api/projects/1 in the same shape, a blank description as null', async () => {
    const calls = stubFetch()
    await renderAt('/projects/1/edit')

    type(descriptionInput(), '   ')
    await save()

    expect(writes(calls)).toEqual([
      {
        url: '/api/projects/1',
        method: 'PUT',
        contentType: 'application/json',
        body: {
          name: '알파 프로젝트',
          description: null,
          startDate: '2026-05-16',
          endDate: '2026-09-13',
          status: 'IN_PROGRESS',
          requiredSkills: [
            { jobTitle: '백엔드 개발자', skillName: 'Java', proficiencyLevel: 'INTERMEDIATE', headcount: 2 },
            { jobTitle: '디자이너', skillName: 'Figma', proficiencyLevel: 'BEGINNER', headcount: 1 },
          ],
        },
      },
    ])
  })

  it('goes to the new project after 201 and to the project after 200', async () => {
    stubFetch({ save: () => reply(201, { ...ALPHA, id: 6 }) })
    await renderAt('/projects/new')
    await save()
    expect(where()).toBe('/projects/6')
  })

  it('goes back to the project after an edit is saved', async () => {
    stubFetch({ save: () => reply(200, ALPHA) })
    await renderAt('/projects/1/edit')
    await save()
    expect(where()).toBe('/projects/1')
  })

  for (const [path, target] of [
    ['/projects/new', '/projects'],
    ['/projects/1/edit', '/projects/1'],
  ] as const) {
    it(`cancels ${path} to ${target} without saving`, async () => {
      const calls = stubFetch()
      await renderAt(path)

      fireEvent.click(cancelButton())
      await flush()

      expect(where()).toBe(target)
      expect(writes(calls)).toEqual([])
    })
  }

  it('sends one save however often 저장 or Enter is pressed while it is held, and then goes on', async () => {
    const held = deferred()
    const calls = stubFetch({ save: () => held.promise })
    await renderAt('/projects/new')

    fireEvent.click(saveButton())
    fireEvent.click(saveButton())
    fireEvent.submit(nameInput().closest('form')!)
    await flush()

    expect(writes(calls)).toHaveLength(1)
    expect(held.isReleased()).toBe(false)
    expect(saveButton()).toHaveAttribute('aria-busy', 'true')
    expect(cancelButton()).toBeDisabled()

    held.release(await reply(201, { ...ALPHA, id: 7 }))
    await flush()

    expect(held.isReleased()).toBe(true)
    expect(where()).toBe('/projects/7')
    expect(writes(calls)).toHaveLength(1)
  })

  it('shows 불러오는 중… and aria-busy until the project answers', async () => {
    stubFetch({ detail: never })

    await renderAt('/projects/1/edit')

    expect(screen.getByText('불러오는 중…')).toBeInTheDocument()
    expect(screen.getByText('불러오는 중…').closest('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByRole('textbox', { name: '프로젝트명' })).not.toBeInTheDocument()
  })

  it('shows the error with 다시 시도 when the project fails to load, and loads it again', async () => {
    let call = 0
    const calls = stubFetch({
      detail: () => {
        call += 1
        return call === 1 ? reply(500, {}) : reply(200, ALPHA)
      },
    })
    await renderAt('/projects/1/edit')

    expect(screen.getByRole('alert')).toHaveTextContent('데이터를 불러오지 못했습니다')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await flush()

    expect(reads(calls)).toEqual(['/api/projects/1', '/api/projects/1'])
    expect(nameInput()).toHaveValue('알파 프로젝트')
  })

  it('says the project was not found on 404', async () => {
    stubFetch({ detail: () => reply(404, { code: 'PROJECT_NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' }) })

    await renderAt('/projects/1/edit')

    expect(screen.getByRole('alert')).toHaveTextContent('프로젝트를 찾을 수 없습니다.')
    expect(screen.queryByRole('textbox', { name: '프로젝트명' })).not.toBeInTheDocument()
  })

  for (const [path, label, href] of [
    ['/projects/new', '프로젝트 목록으로', '/projects'],
    ['/projects/1/edit', '프로젝트 상세로', '/projects/1'],
  ] as const) {
    it(`has the desktop notice for ${path} with a link to ${href}`, async () => {
      stubFetch()
      await renderAt(path)

      const notice = screen.getByText('데스크톱에서 이용해 주세요').closest('[role="status"]') as HTMLElement
      expect(notice).not.toBeNull()
      expect(within(notice).getByText('프로젝트 등록·수정은 너비 1024px 이상 화면에서 할 수 있습니다.')).toBeInTheDocument()
      expect(within(notice).getByRole('link', { name: label })).toHaveAttribute('href', href)
    })
  }
})

describe('ProjectFormPage errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Criterion 3.
  for (const [code, message, field] of [
    ['PROJECT_NAME_REQUIRED', '프로젝트명을 입력하세요.', nameInput],
    ['PROJECT_STATUS_INVALID', '프로젝트 상태를 선택하세요.', statusSelect],
  ] as const) {
    it(`puts ${code} under its input`, async () => {
      stubFetch({ save: () => reply(400, { code, message }) })
      await renderAt('/projects/new')

      await save()

      expect(field()).toHaveAttribute('aria-invalid', 'true')
      expect(field()).toHaveAccessibleDescription(message)
      expect(field()).toHaveFocus() // T#58 criterion 5
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  }

  for (const [code, message] of [
    ['PROJECT_PERIOD_REQUIRED', '시작일과 종료일을 YYYY-MM-DD 형식으로 입력하세요.'],
    ['PROJECT_PERIOD_INVALID', '종료일은 시작일보다 앞설 수 없습니다.'],
    ['PROJECT_PERIOD_EXCLUDES_ASSIGNMENTS', D30_MESSAGE],
  ] as const) {
    it(`puts ${code} under the two dates of 기간`, async () => {
      stubFetch({ save: () => reply(400, { code, message }) })
      await renderAt('/projects/1/edit')

      await save()

      // T#58 criterion 2: the two date inputs carry aria-invalid and the message; the fieldset keeps only the description.
      for (const input of [startInput(), endInput()]) {
        expect(input).toHaveAttribute('aria-invalid', 'true')
        expect(input).toHaveAccessibleDescription(message)
      }
      expect(periodGroup()).not.toHaveAttribute('aria-invalid')
      expect(periodGroup()).toHaveAccessibleDescription(message)
      expect(startInput()).toHaveFocus()
      const shown = within(periodGroup()).getByText(message)
      expect(follows(endInput(), shown)).toBe(true)
      expect(follows(shown, statusSelect())).toBe(true)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  }

  it('puts PROJECT_SKILL_LINE_INVALID under the rows, above 필요 역량 추가', async () => {
    const message = '필요 역량의 직무, 기술, 숙련도, 인원(1 이상)을 모두 입력하세요.'
    stubFetch({ save: () => reply(400, { code: 'PROJECT_SKILL_LINE_INVALID', message }) })
    await renderAt('/projects/1/edit')

    await save()

    // T#58 criterion 3: the first row's 직무 carries aria-invalid and the message; the fieldset keeps only the description.
    const firstJob = within(skillRow(1)).getByRole('textbox', { name: '직무' })
    expect(firstJob).toHaveAttribute('aria-invalid', 'true')
    expect(firstJob).toHaveAccessibleDescription(message)
    expect(firstJob).toHaveFocus()
    expect(skillsGroup()).not.toHaveAttribute('aria-invalid')
    expect(skillsGroup()).toHaveAccessibleDescription(message)
    const shown = within(skillsGroup()).getByText(message)
    expect(follows(skillRow(2), shown)).toBe(true)
    expect(follows(shown, screen.getByRole('button', { name: '필요 역량 추가' }))).toBe(true)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  for (const [label, answer, shown] of [
    ['PROJECT_REQUEST_INVALID', () => reply(400, { code: 'PROJECT_REQUEST_INVALID', message: '요청 본문을 읽을 수 없습니다.' }), '요청 본문을 읽을 수 없습니다.'],
    ['404 PROJECT_NOT_FOUND', () => reply(404, { code: 'PROJECT_NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' }), '프로젝트를 찾을 수 없습니다.'],
    ['403', () => reply(403, { code: 'AUTH_FORBIDDEN', message: '이 작업을 할 권한이 없습니다.' }), '이 작업을 할 권한이 없습니다.'],
    ['500', () => reply(500, {}), DEFAULT_FAILURE],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch')), DEFAULT_FAILURE],
    ['an unknown code', () => reply(400, { code: 'SOMETHING_NEW', message: '새 규칙 위반입니다.' }), '새 규칙 위반입니다.'],
    ['a 400 without a code', () => reply(400, { status: 400, error: 'Bad Request' }), DEFAULT_FAILURE],
  ] as const) {
    it(`shows ${label} as the form message above the buttons`, async () => {
      stubFetch({ save: answer })
      await renderAt('/projects/1/edit')

      saveButton().focus() // T#58 criterion 5: a real click leaves the focus on the button; fireEvent.click does not
      expect(saveButton()).toHaveFocus()
      await save()

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(shown)
      expect(saveButton()).toHaveFocus() // a form-level message moves no focus
      expect(follows(alert, saveButton())).toBe(true)
      expect(follows(skillsGroup(), alert)).toBe(true)
      for (const field of [nameInput(), statusSelect(), periodGroup(), skillsGroup()]) {
        expect(field).not.toHaveAttribute('aria-invalid')
      }
    })
  }

  it('clears the earlier message when saving again', async () => {
    let call = 0
    const held = deferred()
    stubFetch({
      save: () => {
        call += 1
        return call === 1
          ? reply(400, { code: 'PROJECT_PERIOD_EXCLUDES_ASSIGNMENTS', message: D30_MESSAGE })
          : held.promise
      },
    })
    await renderAt('/projects/1/edit')
    await save()
    expect(startInput()).toHaveAttribute('aria-invalid', 'true')

    await save()

    expect(startInput()).not.toHaveAttribute('aria-invalid')
    expect(endInput()).not.toHaveAttribute('aria-invalid')
    expect(periodGroup()).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByText(D30_MESSAGE)).not.toBeInTheDocument()
  })

  for (const headcount of ['1.5', '1e2', '99999999999']) {
    it(`does not send 인원 ${headcount} and asks for a whole number under the rows`, async () => {
      const calls = stubFetch()
      await renderAt('/projects/1/edit')
      type(within(skillRow(2)).getByRole('spinbutton', { name: '인원' }), headcount)

      await save()

      expect(writes(calls)).toEqual([])
      // T#58 criterion 3: the row's 인원 carries aria-invalid and the message.
      const headcountInput = within(skillRow(2)).getByRole('spinbutton', { name: '인원' })
      expect(headcountInput).toHaveAttribute('aria-invalid', 'true')
      expect(headcountInput).toHaveAccessibleDescription(HEADCOUNT_NOT_WHOLE)
      expect(headcountInput).toHaveFocus()
      expect(within(skillRow(1)).getByRole('spinbutton', { name: '인원' })).not.toHaveAttribute('aria-invalid')
      expect(skillsGroup()).not.toHaveAttribute('aria-invalid')
      expect(skillsGroup()).toHaveAccessibleDescription(HEADCOUNT_NOT_WHOLE)
    })
  }

  it('sends 인원 0 as it is: the server judges it', async () => {
    const calls = stubFetch()
    await renderAt('/projects/1/edit')
    type(within(skillRow(1)).getByRole('spinbutton', { name: '인원' }), '0')

    await save()

    const body = writes(calls)[0].body as { requiredSkills: Array<{ headcount: unknown }> }
    expect(body.requiredSkills.map((line) => line.headcount)).toEqual([0, 1])
  })
})
