import ButtonLink from './ButtonLink'
import './DesktopNotice.css'

// T#39, T#34 (D29, BRIEF §6): below 1024px a management form's address shows this notice instead of the form, which the
// page hides there. The StateMessage block's look without an icon (BRIEF §3.4); hidden from 1024px up.
function DesktopNotice({ text, to, linkLabel }: { text: string; to: string; linkLabel: string }) {
  return (
    <div className="desktop-notice" role="status">
      <p className="desktop-notice__title">데스크톱에서 이용해 주세요</p>
      <p className="desktop-notice__text">{text}</p>
      <ButtonLink to={to} variant="secondary">
        {linkLabel}
      </ButtonLink>
    </div>
  )
}

export default DesktopNotice
