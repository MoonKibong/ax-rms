import { useEffect, useState } from 'react'

function App() {
  const [status, setStatus] = useState('확인 중...')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then((data: { status: string }) => setStatus(data.status))
      .catch(() => setStatus('연결 실패'))
  }, [])

  return (
    <main>
      <h1>Workforce Planner</h1>
      <p>백엔드 상태: {status}</p>
    </main>
  )
}

export default App
