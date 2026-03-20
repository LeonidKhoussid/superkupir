import { Link } from 'react-router-dom'
import { useQuizStore } from '../features/quiz/quizStore'

export function QuizDonePage() {
  const answers = useQuizStore((s) => s.answers)
  const reset = useQuizStore((s) => s.reset)

  return (
    <div className="min-h-dvh bg-[#3b82f6] px-6 py-16 text-white">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Готово
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-white/90">
          Ответы сохранены локально (мок). Дальше здесь будет подбор маршрута.
        </p>
        <ul className="mt-8 space-y-2 text-left text-sm text-white/85">
          {Object.entries(answers).map(([step, value]) => (
            <li key={step}>
              <span className="font-semibold text-kr-lime">Шаг {step}:</span>{' '}
              {value}
            </li>
          ))}
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
