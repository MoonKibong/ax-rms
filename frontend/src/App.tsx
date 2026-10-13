import { useEffect, useState } from 'react'
import AppShell from './components/AppShell'
import Button from './components/Button'
import DataTable, { type Column } from './components/DataTable'
import StateMessage from './components/StateMessage'
import TextField from './components/TextField'
import './App.css'

// Reference screen (BRIEF §6.0): the design system on one page until the business screens take `/`.
// Sample values are constants; they do not come from the API or the seed.
type SampleRow = {
  id: string
  name: string
  department: string
  start: string
  end: string
  rate: string
  available: string
}

const LONG_VALUE = 'workforceplannerreferenceunbrokenvaluesample0048'

const COLUMNS: Column<SampleRow>[] = [
  { key: 'name', header: '이름' },
  { key: 'department', header: '부서' },
  { key: 'start', header: '투입 시작일' },
  { key: 'end', header: '투입 종료일' },
  { key: 'rate', header: '투입률', align: 'end' },
  { key: 'available', header: '가용률', align: 'end' },
]

const ROWS: SampleRow[] = [
  { id: '1', name: '김하나', department: '개발1팀', start: '2026-10-01', end: '2026-12-31', rate: '60%', available: '40%' },
  { id: '2', name: '이두리', department: '개발2팀', start: '2026-09-15', end: '2027-01-31', rate: '30%', available: '10%' },
  { id: '3', name: LONG_VALUE, department: '플랫폼팀', start: '2026-11-01', end: '2027-03-31', rate: '100%', available: '0%' },
  { id: '4', name: '박세나', department: '디자인팀', start: '2026-10-13', end: '2026-11-30', rate: '5%', available: '95%' },
]

const noop = () => undefined

function App() {
  const [status, setStatus] = useState('확인 중...')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then((data: { status: string }) => setStatus(data.status))
      .catch(() => setStatus('연결 실패'))
  }, [])

  return (
    <AppShell current="dashboard">
      <div className="reference">
        <div className="reference__head">
          <h1 className="reference__title">디자인 참조</h1>
          <p className="reference__status">백엔드 상태: {status}</p>
        </div>

        <section className="reference__section" aria-labelledby="reference-buttons">
          <h2 id="reference-buttons" className="reference__heading">
            버튼
          </h2>
          <div className="reference__row">
            <Button data-testid="primary-button">기본 동작</Button>
            <Button variant="secondary">취소</Button>
            <Button variant="danger">배치 해제</Button>
            <Button disabled>비활성</Button>
            <Button data-testid="save-idle">저장</Button>
            <Button data-testid="save-loading" loading>
              저장
            </Button>
          </div>
        </section>

        <section className="reference__section" aria-labelledby="reference-inputs">
          <h2 id="reference-inputs" className="reference__heading">
            입력
          </h2>
          <div className="reference__fields">
            <TextField label="이름" placeholder="이름을 입력하세요" />
            <TextField label="투입률" defaultValue="120" error="투입률은 5%에서 100% 사이로 입력하세요." />
          </div>
        </section>

        <section className="reference__section" aria-labelledby="reference-table">
          <h2 id="reference-table" className="reference__heading">
            표
          </h2>
          <DataTable columns={COLUMNS} rows={ROWS} rowKey={(row) => row.id} empty={<StateMessage kind="empty" />} />
        </section>

        <section className="reference__section" aria-labelledby="reference-states">
          <h2 id="reference-states" className="reference__heading">
            상태
          </h2>
          <div className="reference__states">
            <StateMessage kind="empty" />
            <StateMessage kind="no-results" onReset={noop} />
            <StateMessage kind="error" onRetry={noop} />
          </div>
        </section>
      </div>
    </AppShell>
  )
}

export default App
