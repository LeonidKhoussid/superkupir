import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DecorativeLoops } from '../../components/DecorativeLoops'
import { LoginButton } from '../../components/LoginButton'
import { Logo } from '../../components/Logo'
import { QuizIllustration } from '../../components/QuizIllustration'
import { QuizNextButton } from '../../components/QuizNextButton'
import { QuizOption } from '../../components/QuizOption'
import { getStepById, quizSteps } from '../../data/quizSteps'
import { useQuizStore } from './quizStore'

export function QuizPage() {
  const { stepId } = useParams()
  const id = Number(stepId)
  const step = useMemo(() => (Number.isFinite(id) ? getStepById(id) : undefined), [id])
  const answers = useQuizStore((s) => s.answers)
  const setAnswer = useQuizStore((s) => s.setAnswer)

  if (!step || id < 1 || id > quizSteps.length) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#3b82f6] px-6 text-center text-white">
        <div>
          <p className="font-display text-lg font-bold">Шаг не найден</p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-full bg-white px-6 py-2 font-bold text-[#3b82f6]"
          >
            На главную
          </Link>
        </div>
      </div>
    )
  }

  const selected = answers[step.id]
  const nextPath = `/quiz/${step.id + 1}`
  const isLast = step.id >= quizSteps.length

  const helper = step.helper
  const helperCenter = step.helperPlacement === 'center'

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#3b82f6] text-white">
      <DecorativeLoops />
      <a
        href="#quiz-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-[#3b82f6]"
      >
        К вопросам квиза
      </a>

      <header className="relative z-20 mx-auto w-full max-w-[1440px] px-5 pb-2 pt-6 sm:px-8 lg:px-14 lg:pt-8">
        <div className="flex items-start justify-between gap-4">
          <Link to="/" aria-label="Край Тур — на главную">
            <Logo mode={step.logoMode} />
          </Link>
          <LoginButton />
        </div>
        {helper && helperCenter ? (
          <p className="mt-3 text-center text-[13px] font-medium lowercase leading-tight tracking-wide text-white/95 sm:text-[14px] lg:absolute lg:left-1/2 lg:top-8 lg:mt-0 lg:-translate-x-1/2 lg:text-[14px]">
            {helper}
          </p>
        ) : null}
      </header>

      <main
        id="quiz-main"
        className="relative z-10 mx-auto flex max-w-[1440px] flex-col gap-10 px-5 pb-16 pt-4 lg:flex-row lg:items-center lg:gap-6 lg:px-14 lg:pb-20 lg:pt-2"
      >
        <div className="flex min-w-0 flex-1 flex-col lg:max-w-[640px]">
          {helper && !helperCenter ? (
            <p className="mb-4 text-[13px] font-medium lowercase tracking-wide text-white/95 sm:text-[14px]">
              {helper}
            </p>
          ) : null}

          <h1 className="font-display max-w-[540px] text-[clamp(1.35rem,2.4vw,2rem)] font-bold uppercase leading-[1.12] tracking-[0.08em] sm:text-[clamp(1.5rem,2.2vw,2.25rem)] sm:tracking-[0.1em]">
            {step.titleLines.map((line, idx) => (
              <span
                key={`${step.id}-t-${idx}`}
                className={`block ${line.tone === 'lime' ? 'text-kr-lime' : 'text-white'}`}
              >
                {line.text}
              </span>
            ))}
          </h1>

          <ul className="mt-8 flex flex-col gap-4 sm:mt-10 sm:gap-5" role="list">
            {step.options.map((opt, idx) => (
              <li key={`${step.id}-${idx}-${opt}`}>
                <QuizOption
                  label={opt}
                  selected={selected === opt}
                  onSelect={() => setAnswer(step.id, opt)}
                />
              </li>
            ))}
          </ul>

          <div className="mt-10 flex justify-center sm:mt-12 lg:justify-start">
            {isLast ? (
              <Link
                to="/quiz/done"
                className="font-display inline-flex min-h-[52px] min-w-[200px] items-center justify-center rounded-full bg-white px-14 text-[16px] font-bold uppercase tracking-[0.14em] text-[#3b82f6] transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:min-w-[240px]"
              >
                ДАЛЕЕ
              </Link>
            ) : (
              <QuizNextButton to={nextPath} />
            )}
          </div>
        </div>

        <QuizIllustration
          src={step.illustration}
          objectPosition={step.illustrationPosition}
          scale={step.illustrationScale}
          alt=""
        />
      </main>
    </div>
  )
}
