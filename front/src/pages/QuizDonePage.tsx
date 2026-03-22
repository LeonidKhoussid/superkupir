import { Link } from 'react-router-dom'
import { formatSeasonLabel, useQuizStore } from '../features/quiz/quizStore'

export function QuizDonePage() {
  const peopleCount = useQuizStore((s) => s.peopleCount)
  const seasons = useQuizStore((s) => s.seasons)
  const budget = useQuizStore((s) => s.budget)
  const restType = useQuizStore((s) => s.restType)
  const daysCount = useQuizStore((s) => s.daysCount)
  const reset = useQuizStore((s) => s.reset)

  const seasonText =
    seasons.length > 0 ? seasons.map(formatSeasonLabel).join(', ') : '—'

  return (
    <div className="min-h-dvh bg-[#3b82f6] px-6 py-16 text-white">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Готово
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-white/90">
          Ответы сохранены локально. Дальше здесь будет подбор маршрута.
        </p>
        <ul className="mt-8 space-y-3 text-left text-sm text-white/90">
          <li>
            <span className="font-semibold text-kr-lime">Сколько человек:</span>{' '}
            {peopleCount ?? '—'}
          </li>
          <li>
            <span className="font-semibold text-kr-lime">Какой сезон:</span> {seasonText}
          </li>
          <li>
            <span className="font-semibold text-kr-lime">Бюджет:</span>{' '}
            {budget.from.toLocaleString('ru-RU')} – {budget.to.toLocaleString('ru-RU')} ₽
          </li>
          <li>
            <span className="font-semibold text-kr-lime">Вид отдыха:</span>{' '}
            {restType ?? '—'}
          </li>
          <li>
            <span className="font-semibold text-kr-lime">Сколько дней:</span>{' '}
            {daysCount ?? '—'}
          </li>
        </ul>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            to="/"
            onClick={() => reset()}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-8 font-bold uppercase tracking-wide text-[#3b82f6] hover:brightness-95"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  )
}
