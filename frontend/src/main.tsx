import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'pretendard/dist/web/static/pretendard-dynamic-subset.css'
import './styles/tokens.css'
import './styles/base.css'
import App from './App'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('#root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
