import type { LogoMode } from '../data/quizSteps'

type Props = {
  mode: LogoMode
  className?: string
}

export function Logo({ mode, className = '' }: Props) {
  if (mode === 'row-wide') {
    return (
      <div
        className={`font-display text-[26px] font-bold uppercase leading-none tracking-[0.02em] sm:text-[28px] ${className}`}
      >
        <span className="text-white">КРАЙ </span>
        <span className="text-kr-lime">ТУР</span>
      </div>
    )
  }

  if (mode === 'wordmark') {
    return (
      <div
        className={`font-display text-[26px] font-bold leading-none tracking-[0.04em] sm:text-[28px] ${className}`}
      >
        <span className="text-white">край</span>
        <span className="text-kr-lime">тур</span>
      </div>
    )
  }

  return (
    <div
      className={`font-display flex flex-col text-[22px] font-bold uppercase leading-[1.05] tracking-[0.06em] sm:text-[24px] ${className}`}
    >
      <span className="text-white">КРАЙ</span>
      <span className="text-kr-lime">ТУР</span>
    </div>
  )
}
