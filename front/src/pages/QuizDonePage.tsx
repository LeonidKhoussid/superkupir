import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DecorativeLoops } from '../components/DecorativeLoops'
import { LoginButton } from '../components/LoginButton'
import { Logo } from '../components/Logo'
import { requestAuthModalOpen } from '../features/auth/authModalEvents'
import { useAuthStore } from '../features/auth/authStore'
import {
  formatSeasonLabel,
  seasonSlugToQuizApi,
  useQuizStore,
} from '../features/quiz/quizStore'
import {
  createRouteFromQuiz,
  RoutesApiError,
} from '../features/routes/routesApi'

const MIN_LOADING_MS = 6600

const STATUS_MESSAGES = [
  'Подбираем маршрут под ваши предпочтения…',
  'Анализируем сезон, бюджет и формат поездки…',
  'Собираем оптимальные точки маршрута…',
] as const

export function QuizDonePage() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)

  const peopleCount = useQuizStore((s) => s.peopleCount)
  const season = useQuizStore((s) => s.season)
  const budget = useQuizStore((s) => s.budget)
  const restType = useQuizStore((s) => s.restType)
  const daysCount = useQuizStore((s) => s.daysCount)
  const reset = useQuizStore((s) => s.reset)

  const [phase, setPhase] = useState<'summary' | 'loading' | 'error'>('summary')
  const [statusIndex, setStatusIndex] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submittingRef = useRef(false)

  useEffect(() => {
    if (phase !== 'loading') return
    const id = window.setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_MESSAGES.length)
    }, 2200)
    return () => window.clearInterval(id)
  }, [phase])

  const seasonText = season != null ? formatSeasonLabel(season) : '—'

  const answersComplete =
    peopleCount != null &&
    season != null &&
    restType != null &&
    daysCount != null &&
    budget.from <= budget.to

  const handleBuildRoute = useCallback(async () => {
    if (submittingRef.current || phase === 'loading') return
    if (!answersComplete || !season || !restType) return

    if (!token) {
      requestAuthModalOpen()
      return
    }

    submittingRef.current = true
    setPhase('loading')
    setStatusIndex(0)
    setErrorMessage(null)

    try {
      const [route] = await Promise.all([
        createRouteFromQuiz(token, {
          people_count: peopleCount!,
          season: seasonSlugToQuizApi(season),
          budget_from: budget.from,
          budget_to: budget.to,
          excursion_type: restType!.toLowerCase(),
          days_count: daysCount!,
        }),
        new Promise<undefined>((resolve) => {
          window.setTimeout(resolve, MIN_LOADING_MS)
        }),
      ])
      navigate(`/routes/${route.id}`, { replace: true })
    } catch (e) {
      const msg =
        e instanceof RoutesApiError
          ? e.message
          : 'Не удалось собрать маршрут. Попробуйте ещё раз.'
      setErrorMessage(msg)
      setPhase('error')
      submittingRef.current = false
    }
  }, [
    answersComplete,
    budget.from,
    budget.to,
    daysCount,
    navigate,
    peopleCount,
    phase,
    restType,
    season,
    token,
  ])

  if (!answersComplete) {
    return (
      <div className="relative min-h-dvh overflow-hidden bg-[#3b82f6] px-6 py-16 text-white">
        <DecorativeLoops />
        <div className="relative z-10 mx-auto max-w-lg text-center">
          <Link to="/quiz/1" className="inline-block">
            <Logo mode="stack" />
          </Link>
          <p className="mt-8 font-display text-lg font-bold">Заполните квиз целиком</p>
          <Link
            to="/quiz/1"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-8 font-bold uppercase tracking-wide text-[#3b82f6] hover:brightness-95">
            К первому вопросу
          </Link>
        </div>
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#3b82f6] text-white">
        <DecorativeLoops />
        <header className="relative z-20 mx-auto flex w-full max-w-[1440px] items-start justify-between gap-4 px-5 pt-6 sm:px-8 lg:px-14 lg:pt-8">
          <Link to="/" aria-label="Край Тур — на главную">
            <Logo mode="stack" />
          </Link>
          <LoginButton />
        </header>
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-8">
          <div
            className="h-14 w-14 animate-spin rounded-full border-4 border-white/30 border-t-white"
            aria-hidden
          />
          <p
            className="mt-10 max-w-md text-center font-display text-[clamp(1rem,2.5vw,1.25rem)] font-semibold leading-snug text-white"
            aria-live="polite">
            {STATUS_MESSAGES[statusIndex]}
          </p>
          <p className="mt-4 max-w-sm text-center text-[13px] text-white/80">
            Демо-режим: маршрут собирается по правилам из ваших ответов и каталога мест.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#3b82f6] text-white">
      <DecorativeLoops />
      <a
        href="#quiz-done-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-[#3b82f6]">
        К итогам квиза
      </a>

      <header className="relative z-20 mx-auto flex w-full max-w-[1440px] items-start justify-between gap-4 px-5 pb-2 pt-6 sm:px-8 lg:px-14 lg:pt-8">
        <Link to="/" aria-label="Край Тур — на главную">
          <Logo mode="stack" />
        </Link>
        <LoginButton />
      </header>

      <main
        id="quiz-done-main"
        className="relative z-10 mx-auto max-w-lg px-6 pb-20 pt-4 text-center">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Готово
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-white/90">
          Проверьте ответы и нажмите «Собрать маршрут» — мы подготовим план поездки из
          каталога мест.
        </p>
        <ul className="mt-8 space-y-3 text-left text-sm text-white/90">
          <li>
            <span className="font-semibold text-kr-lime">Сколько человек:</span>{' '}
            {peopleCount ?? '—'}
          </li>
          <li>
            <span className="font-semibold text-kr-lime">Сезон:</span> {seasonText}
          </li>
          <li>
            <span className="font-semibold text-kr-lime">Бюджет:</span>{' '}
            {budget.from.toLocaleString('ru-RU')} – {budget.to.toLocaleString('ru-RU')} ₽
          </li>
          <li>
            <span className="font-semibold text-kr-lime">Формат:</span> {restType ?? '—'}
          </li>
          <li>
            <span className="font-semibold text-kr-lime">Дней:</span> {daysCount ?? '—'}
          </li>
        </ul>

        {phase === 'error' && errorMessage ? (
          <p
            className="mt-6 rounded-2xl border border-white/40 bg-white/10 px-4 py-3 text-left text-[14px] text-white"
            role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:justify-center">
          <button
            type="button"
            onClick={handleBuildRoute}
            className="font-display inline-flex min-h-[52px] w-full min-w-[240px] items-center justify-center rounded-full bg-white px-8 text-[15px] font-bold uppercase tracking-[0.12em] text-[#3b82f6] transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:w-auto">
            Собрать маршрут
          </button>
          {!token ? (
            <p className="max-w-xs text-[13px] text-white/85">
              Если вы ещё не вошли, по кнопке «Собрать маршрут» сначала откроется окно входа.
            </p>
          ) : null}
          <Link
            to="/"
            onClick={() => reset()}
            className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-white/70 bg-transparent px-8 text-[14px] font-bold uppercase tracking-wide text-white hover:bg-white/10">
            На главную
          </Link>
        </div>
      </main>
    </div>
  )
}
