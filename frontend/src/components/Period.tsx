import './Period.css'

// "2026-05-16 ~ 2026-09-13": each date stays whole (a hyphen would otherwise allow a break inside it) and the space
// before "~" does not break, so the line breaks only after the "~" (BRIEF §5). In a card (<1024px) the end date goes
// on the next line (T#15 criterion 8). One wrapper keeps the pieces in one line of text; the card cell is a flex row,
// where separate pieces would not flow.
function Period({ startDate, endDate }: { startDate: string; endDate: string }) {
  return (
    <span className="project-list__period">
      <span className="project-list__date">{startDate}</span>
      {' ~ '}
      <span className="project-list__date project-list__date--end">{endDate}</span>
    </span>
  )
}

export default Period
