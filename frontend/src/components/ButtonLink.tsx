import type { ReactNode } from 'react'
import { Link } from 'react-router'
import './Button.css'

type ButtonLinkProps = {
  to: string
  variant?: 'primary' | 'secondary'
  className?: string
  children: ReactNode
}

// A link drawn as a button (BRIEF §3.1): navigation is a link, so it opens, copies and is announced as one.
function ButtonLink({ to, variant = 'primary', className, children }: ButtonLinkProps) {
  return (
    <Link to={to} className={className ? `button ${className}` : 'button'} data-variant={variant}>
      {children}
    </Link>
  )
}

export default ButtonLink
