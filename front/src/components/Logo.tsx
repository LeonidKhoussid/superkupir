import type { LogoMode } from '../data/quizSteps'
import brandLogo from '../assets/brand-logo.svg'

type Props = {
  mode: LogoMode
  className?: string
}

const modeImgClass: Record<LogoMode, string> = {
  'row-wide':
    'h-10 w-auto max-w-[min(100vw-10rem,280px)] object-contain object-left sm:h-12',
  stack: 'h-12 w-auto max-w-[min(100vw-10rem,220px)] object-contain object-left sm:h-14',
  wordmark:
    'h-10 w-auto max-w-[min(100vw-10rem,260px)] object-contain object-left sm:h-12',
}

export function Logo({ mode, className = '' }: Props) {
  return (
    <img
      src={brandLogo}
      alt="Край Тур"
      width={174}
      height={81}
      className={`${modeImgClass[mode]} ${className}`}
      decoding="async"
    />
  )
}
