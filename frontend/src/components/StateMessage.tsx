import Button from './Button'
import { BoxIcon, SearchIcon, WarningIcon } from './icons'
import './StateMessage.css'

type Kind = 'empty' | 'no-results' | 'error'

type StateMessageProps = {
  kind: Kind
  title?: string
  description?: string
  onRetry?: () => void
  onReset?: () => void
}

// BRIEF §3.4 defaults. A screen may replace the title and description, not the icon or colour.
const DEFAULTS: Record<Kind, { icon: 'box' | 'search' | 'warning'; title: string; description: string }> = {
  empty: { icon: 'box', title: '표시할 항목이 없습니다', description: '아직 등록된 데이터가 없습니다.' },
  'no-results': { icon: 'search', title: '검색 결과가 없습니다', description: '검색어나 필터를 바꿔 다시 찾아보세요.' },
  error: { icon: 'warning', title: '데이터를 불러오지 못했습니다', description: '잠시 후 다시 시도하세요.' },
}

const ICONS = { box: BoxIcon, search: SearchIcon, warning: WarningIcon }

function StateMessage({ kind, title, description, onRetry, onReset }: StateMessageProps) {
  const defaults = DEFAULTS[kind]
  const Icon = ICONS[defaults.icon]

  return (
    <div className="state" data-kind={kind} role={kind === 'error' ? 'alert' : 'status'}>
      <span className="state__icon" data-testid="state-icon" data-icon={defaults.icon}>
        <Icon size={32} />
      </span>
      <p className="state__title">{title ?? defaults.title}</p>
      <p className="state__description">{description ?? defaults.description}</p>
      {kind === 'error' && onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
      {kind === 'no-results' && onReset ? (
        <Button variant="secondary" onClick={onReset}>
          필터 초기화
        </Button>
      ) : null}
    </div>
  )
}

export default StateMessage
