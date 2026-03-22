import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DecorativeLoops } from '../../components/DecorativeLoops'
import { LoginButton } from '../../components/LoginButton'
import { Logo } from '../../components/Logo'
import { QuizIllustration } from '../../components/QuizIllustration'
import { QuizNextButton } from '../../components/QuizNextButton'
import { getStepById, quizSteps, type QuizStepConfig } from '../../data/quizSteps'
import type { QuizBudget, QuizRestType, SeasonSlug } from './quizStore'
import { useQuizStore } from './quizStore'

type AnswerSlice = {
  peopleCount: number | null
  city: string | null
  season: SeasonSlug | null
  budget: QuizBudget
  restType: QuizRestType | null
  daysCount: number | null
}

function stepIsValid(step: QuizStepConfig, s: AnswerSlice): boolean {
  switch (step.kind) {
    case 'count': {
      const v = step.answerKey === 'peopleCount' ? s.peopleCount : s.daysCount
      return v != null && Number.isFinite(v) && v >= step.min && v <= step.max
    }
    case 'city': {
      const t = (s.city ?? '').trim()
      return t.length >= step.minLength && t.length <= step.maxLength
    }
    case 'season':
      return s.season != null
    case 'budget':
      return (
        s.budget.from <= s.budget.to &&
        s.budget.from >= step.min &&
        s.budget.to <= step.max
      )
    case 'radio':
      return s.restType != null && step.options.includes(s.restType)
  }
}

export function QuizPage() {
  const { stepId } = useParams()
  const id = Number(stepId)
  const step = useMemo(() => (Number.isFinite(id) ? getStepById(id) : undefined), [id])

  const peopleCount = useQuizStore((st) => st.peopleCount)
  const city = useQuizStore((st) => st.city)
  const season = useQuizStore((st) => st.season)
  const budget = useQuizStore((st) => st.budget)
  const restType = useQuizStore((st) => st.restType)
  const daysCount = useQuizStore((st) => st.daysCount)

  const setPeopleCount = useQuizStore((st) => st.setPeopleCount)
  const setCity = useQuizStore((st) => st.setCity)
  const setSeason = useQuizStore((st) => st.setSeason)
  const setBudgetFrom = useQuizStore((st) => st.setBudgetFrom)
  const setBudgetTo = useQuizStore((st) => st.setBudgetTo)
  const setRestType = useQuizStore((st) => st.setRestType)
  const setDaysCount = useQuizStore((st) => st.setDaysCount)

  const canProceed =
    step != null &&
    stepIsValid(step, { peopleCount, city, season, budget, restType, daysCount })

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

  const nextPath = `/quiz/${step.id + 1}`
  const prevPath = step.id > 1 ? `/quiz/${step.id - 1}` : null
  const isLast = step.id >= quizSteps.length
  const stepIndex = step.id
  const totalSteps = quizSteps.length

  const helper = step.helper
  const helperCenter = step.helperPlacement === 'center'

  const doneLinkCls =
    'font-display inline-flex min-h-[52px] min-w-[200px] items-center justify-center rounded-full bg-white px-14 text-[16px] font-bold uppercase tracking-[0.14em] text-[#3b82f6] transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:min-w-[240px]'

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
        className="relative z-10 mx-auto flex max-w-[1440px] flex-col gap-10 px-5 pb-16 pt-4 lg:flex-row lg:items-center lg:justify-center lg:gap-5 lg:px-14 lg:pb-20 lg:pt-2 xl:gap-8"
      >
        <div className="flex min-w-0 flex-1 flex-col lg:max-w-[560px] lg:flex-none">
          {helper && !helperCenter ? (
            <p className="mb-4 text-[13px] font-medium lowercase tracking-wide text-white/95 sm:text-[14px]">
              {helper}
            </p>
          ) : null}

          <p
            className="mb-3 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-white/85 sm:text-[12px]"
            aria-live="polite">
            Шаг {stepIndex} из {totalSteps}
          </p>
          <div
            className="mb-6 h-1.5 w-full max-w-[320px] overflow-hidden rounded-full bg-white/20 sm:max-w-[400px]"
            role="progressbar"
            aria-valuenow={stepIndex}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-label={`Прогресс квиза: шаг ${stepIndex} из ${totalSteps}`}>
            <div
              className="h-full rounded-full bg-white transition-[width] duration-300 ease-out"
              style={{ width: `${(stepIndex / totalSteps) * 100}%` }}
            />
          </div>

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

          <div className="mt-8 sm:mt-10">{renderStepControls(step, {
            peopleCount,
            city,
            season,
            budget,
            restType,
            daysCount,
            setPeopleCount,
            setCity,
            setSeason,
            setBudgetFrom,
            setBudgetTo,
            setRestType,
            setDaysCount,
          })}</div>

          <div className="mt-10 flex flex-col items-center gap-4 sm:mt-12 lg:items-start">
            <div className="flex w-full max-w-[400px] flex-wrap items-center justify-center gap-3 sm:justify-start">
              {prevPath ? (
                <Link
                  to={prevPath}
                  className="font-display inline-flex min-h-[48px] min-w-[120px] items-center justify-center rounded-full border-2 border-white/80 bg-transparent px-8 text-[14px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                  Назад
                </Link>
              ) : null}
              {isLast ? (
                canProceed ? (
                  <Link to="/quiz/done" className={doneLinkCls}>
                    Далее
                  </Link>
                ) : (
                  <span
                    className={`${doneLinkCls} cursor-not-allowed opacity-40`}
                    aria-disabled="true"
                    role="link">
                    Далее
                  </span>
                )
              ) : (
                <QuizNextButton to={nextPath} disabled={!canProceed} />
              )}
            </div>
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

type ControlsProps = {
  peopleCount: number | null
  city: string | null
  season: SeasonSlug | null
  budget: { from: number; to: number }
  restType: QuizRestType | null
  daysCount: number | null
  setPeopleCount: (v: number | null) => void
  setCity: (v: string | null) => void
  setSeason: (s: SeasonSlug | null) => void
  setBudgetFrom: (v: number) => void
  setBudgetTo: (v: number) => void
  setRestType: (v: QuizRestType) => void
  setDaysCount: (v: number | null) => void
}

function renderStepControls(step: QuizStepConfig, p: ControlsProps) {
  const inputClass =
    'w-full max-w-[320px] rounded-xl border-2 border-white/40 bg-white/95 px-4 py-3 text-center font-display text-[20px] font-bold uppercase tracking-wide text-[#3b82f6] outline-none ring-white/30 focus:border-white focus:ring-2'

  switch (step.kind) {
    case 'count': {
      const value = step.answerKey === 'peopleCount' ? p.peopleCount : p.daysCount
      const set = step.answerKey === 'peopleCount' ? p.setPeopleCount : p.setDaysCount
      return (
        <div className="flex flex-col gap-3">
          <label htmlFor={`quiz-count-${step.id}`} className="sr-only">
            {step.answerKey === 'peopleCount' ? 'Количество человек' : 'Количество дней'}
          </label>
          <input
            id={`quiz-count-${step.id}`}
            type="number"
            inputMode="numeric"
            min={step.min}
            max={step.max}
            placeholder={`${step.min}–${step.max}`}
            value={value ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                set(null)
                return
              }
              const n = parseInt(raw, 10)
              if (Number.isNaN(n)) return
              set(Math.min(step.max, Math.max(step.min, n)))
            }}
            className={inputClass}
          />
          <p className="text-[13px] text-white/80">Число от {step.min} до {step.max}</p>
        </div>
      )
    }
    case 'city':
      return (
        <div className="flex max-w-[520px] flex-col gap-3">
          <label htmlFor={`quiz-city-${step.id}`} className="sr-only">
            Город или регион поездки
          </label>
          <input
            id={`quiz-city-${step.id}`}
            type="text"
            autoComplete="address-level2"
            maxLength={step.maxLength}
            placeholder={step.placeholder}
            value={p.city ?? ''}
            onChange={(e) => {
              const v = e.target.value
              p.setCity(v === '' ? null : v)
            }}
            className={inputClass}
          />
          <p className="text-[13px] text-white/80">
            От {step.minLength} до {step.maxLength} символов — так уходит в подбор маршрута
          </p>
        </div>
      )
    case 'season':
      return (
        <ul
          className="flex max-w-[520px] flex-col gap-4 sm:gap-5"
          role="radiogroup"
          aria-label="Сезон поездки">
          {step.options.map((opt) => {
            const selected = p.season === opt.slug
            return (
              <li key={opt.slug}>
                <label className="flex cursor-pointer items-center gap-4">
                  <input
                    type="radio"
                    name={`quiz-season-${step.id}`}
                    checked={selected}
                    onChange={() => p.setSeason(opt.slug)}
                    className="peer sr-only"
                  />
                  <span
                    className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border-2 border-white/50 bg-white/10 peer-focus-visible:ring-2 peer-focus-visible:ring-white sm:h-[52px] sm:w-[52px] peer-checked:border-white peer-checked:bg-white"
                    aria-hidden>
                    {selected ? (
                      <span className="size-5 rounded-full bg-[#3b82f6]" aria-hidden />
                    ) : null}
                  </span>
                  <span className="font-display text-[15px] font-bold uppercase leading-tight tracking-[0.08em] text-white sm:text-[17px]">
                    {opt.label}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )
    case 'budget':
      return (
        <div className="flex max-w-[520px] flex-col gap-8">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2 text-[13px] font-semibold uppercase tracking-wide text-white/95">
              <span>От</span>
              <span className="tabular-nums text-kr-lime">
                {p.budget.from.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <input
              type="range"
              min={step.min}
              max={step.max}
              step={step.step}
              value={p.budget.from}
              onChange={(e) => p.setBudgetFrom(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-white"
              aria-label="Бюджет от"
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2 text-[13px] font-semibold uppercase tracking-wide text-white/95">
              <span>До</span>
              <span className="tabular-nums text-kr-lime">
                {p.budget.to.toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <input
              type="range"
              min={step.min}
              max={step.max}
              step={step.step}
              value={p.budget.to}
              onChange={(e) => p.setBudgetTo(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-white"
              aria-label="Бюджет до"
            />
          </div>
        </div>
      )
    case 'radio':
      return (
        <ul className="flex max-w-[520px] flex-col gap-4 sm:gap-5" role="radiogroup" aria-label="Вид отдыха">
          {step.options.map((opt) => {
            const selected = p.restType === opt
            return (
              <li key={opt}>
                <label className="flex cursor-pointer items-center gap-4">
                  <input
                    type="radio"
                    name={`quiz-rest-${step.id}`}
                    value={opt}
                    checked={selected}
                    onChange={() => p.setRestType(opt as QuizRestType)}
                    className="peer sr-only"
                  />
                  <span
                    className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border-2 border-white/50 bg-white/10 peer-focus-visible:ring-2 peer-focus-visible:ring-white sm:h-[52px] sm:w-[52px] peer-checked:border-white peer-checked:bg-white"
                    aria-hidden
                  >
                    {selected ? (
                      <span className="size-5 rounded-full bg-[#3b82f6]" aria-hidden />
                    ) : null}
                  </span>
                  <span className="font-display text-[15px] font-bold uppercase leading-tight tracking-[0.08em] text-white sm:text-[17px]">
                    {opt}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )
    default:
      return null
  }
}
