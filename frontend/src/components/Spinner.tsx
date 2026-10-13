import './Spinner.css'

// BRIEF §3.3: the ring that turns next to "불러오는 중…". It is decoration only; the text says what is happening.
function Spinner() {
  return <span className="spinner" aria-hidden="true" data-testid="spinner" />
}

export default Spinner
