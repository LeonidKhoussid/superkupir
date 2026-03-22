import type { SeasonSlug } from '../features/quiz/quizStore'

/** Единая иллюстрация квиза (CDN) */
export const QUIZ_ILLUSTRATION_URL =
  'https://storage.yandexcloud.net/hackathon-ss/quizImg1.png'

/** Одна картинка на все шаги — общие кадрирование и масштаб */
const quizIllustrationBlock = {
  illustration: QUIZ_ILLUSTRATION_URL,
  illustrationPosition: '50% 50%',
  illustrationScale: 1,
} as const

export type LogoMode = 'row-wide' | 'stack' | 'wordmark'

type TitleLine = { text: string; tone: 'white' | 'lime' }

type StepCommon = {
  id: number
  illustration: string
  illustrationPosition: string
  illustrationScale: number
  helper?: string
  helperPlacement?: 'left' | 'center'
  logoMode: LogoMode
  titleLines: TitleLine[]
}

export type QuizStepConfig =
  | (StepCommon & {
      kind: 'count'
      min: number
      max: number
      answerKey: 'peopleCount' | 'daysCount'
    })
  | (StepCommon & {
      kind: 'seasons'
      options: readonly { slug: SeasonSlug; label: string }[]
    })
  | (StepCommon & {
      kind: 'budget'
      min: number
      max: number
      step: number
    })
  | (StepCommon & {
      kind: 'radio'
      options: readonly string[]
    })

export const SEASON_OPTIONS: readonly { slug: SeasonSlug; label: string }[] = [
  { slug: 'spring', label: 'весна' },
  { slug: 'summer', label: 'лето' },
  { slug: 'autumn', label: 'осень' },
  { slug: 'winter', label: 'зима' },
] as const

export const REST_TYPE_OPTIONS = ['Активный', 'Умеренный', 'Спокойный'] as const

export const quizSteps: QuizStepConfig[] = [
  {
    id: 1,
    kind: 'count',
    ...quizIllustrationBlock,
    helper: 'давай подберем тебе маршрут!',
    helperPlacement: 'left',
    logoMode: 'row-wide',
    titleLines: [{ text: 'Сколько человек?', tone: 'white' }],
    min: 1,
    max: 50,
    answerKey: 'peopleCount',
  },
  {
    id: 2,
    kind: 'seasons',
    ...quizIllustrationBlock,
    helper: 'давай подберем тебе маршрут!',
    helperPlacement: 'center',
    logoMode: 'stack',
    titleLines: [{ text: 'Какой сезон?', tone: 'white' }],
    options: SEASON_OPTIONS,
  },
  {
    id: 3,
    kind: 'budget',
    ...quizIllustrationBlock,
    logoMode: 'stack',
    titleLines: [{ text: 'Бюджет?', tone: 'white' }],
    min: 0,
    max: 200_000,
    step: 1000,
  },
  {
    id: 4,
    kind: 'radio',
    ...quizIllustrationBlock,
    helper: 'давай подберем тебе маршрут!',
    helperPlacement: 'left',
    logoMode: 'stack',
    titleLines: [{ text: 'Вид отдыха?', tone: 'white' }],
    options: [...REST_TYPE_OPTIONS],
  },
  {
    id: 5,
    kind: 'count',
    ...quizIllustrationBlock,
    logoMode: 'stack',
    titleLines: [{ text: 'Сколько дней?', tone: 'white' }],
    min: 1,
    max: 30,
    answerKey: 'daysCount',
  },
]

export function getStepById(id: number): QuizStepConfig | undefined {
  return quizSteps.find((s) => s.id === id)
}
