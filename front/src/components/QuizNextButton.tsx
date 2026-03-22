import { Link } from 'react-router-dom'

type Props = {
  to: string
  disabled?: boolean
}

const cls =
  'inline-flex min-h-[52px] min-w-[200px] items-center justify-center rounded-full bg-white px-14 text-[16px] font-bold uppercase tracking-[0.14em] text-[#3b82f6] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white hover:brightness-95 sm:min-w-[240px] sm:px-16 sm:text-[17px]'

export function QuizNextButton({ to, disabled }: Props) {
  if (disabled) {
    return (
      <span
        className={`${cls} cursor-not-allowed opacity-40`}
        aria-disabled="true"
        role="link"
      >
        ДАЛЕЕ
      </span>
    )
  }

  return (
    <Link to={to} className={cls}>
      ДАЛЕЕ
    </Link>
  )
}
