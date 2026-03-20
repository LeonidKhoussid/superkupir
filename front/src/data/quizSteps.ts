import budgetImg from '../assets/quiz/budget.png'
import cityImg from '../assets/quiz/city.png'
import companionImg from '../assets/quiz/companion.png'
import durationImg from '../assets/quiz/duration.png'
import seasonImg from '../assets/quiz/season.png'
import tourismImg from '../assets/quiz/tourism.png'

export type LogoMode = 'row-wide' | 'stack' | 'wordmark'

export type QuizStepConfig = {
  id: number
  illustration: string
  /** object-position for full mockup crop (right-side art) */
  illustrationPosition: string
  illustrationScale: number
  helper?: string
  helperPlacement?: 'left' | 'center'
  logoMode: LogoMode
  titleLines: { text: string; tone: 'white' | 'lime' }[]
  options: string[]
}

export const quizSteps: QuizStepConfig[] = [
  {
    id: 1,
    illustration: companionImg,
    illustrationPosition: '76% 48%',
    illustrationScale: 1.85,
    helper: 'давай подберем тебе маршрут!',
    helperPlacement: 'left',
    logoMode: 'row-wide',
    titleLines: [
      { text: 'С КЕМ', tone: 'lime' },
      { text: 'ПЛАНИРУЕШЬ ПОЕЗДКУ?', tone: 'white' },
    ],
    options: [
      'ОДИН',
      'С ПАРТНЁРОМ',
      'С ДРУЗЬЯМИ',
      'С СЕМЬЁЙ',
      'БОЛЬШОЙ КАМПАНИЕЙ (9+ ЧЕЛ.)',
    ],
  },
  {
    id: 2,
    illustration: tourismImg,
    illustrationPosition: '74% 50%',
    illustrationScale: 1.82,
    helper: 'давай подберем тебе маршрут!',
    helperPlacement: 'left',
    logoMode: 'stack',
    titleLines: [
      { text: 'КАКОЙ ВИД ТУРИЗМА', tone: 'white' },
      { text: 'ВАМ', tone: 'white' },
      { text: 'ИНТЕРЕСЕН?', tone: 'white' },
    ],
    options: ['АГРОТУРИЗМ', 'ВИННЫЙ', 'ГАСТРО', 'ЭКО', 'ЭКО'],
  },
  {
    id: 3,
    illustration: seasonImg,
    illustrationPosition: '78% 52%',
    illustrationScale: 1.9,
    helper: 'давай подберем тебе маршрут!',
    helperPlacement: 'center',
    logoMode: 'stack',
    titleLines: [
      { text: 'В КАКОЙ СЕЗОН ВЫ', tone: 'white' },
      { text: 'ХОТИТЕ ПОЕХАТЬ', tone: 'white' },
    ],
    options: ['2-3 ДНЯ', '4-5 ДНЕЙ', '1-2 НЕДЕЛИ', 'МЕСЯЦ И БОЛЕЕ'],
  },
  {
    id: 4,
    illustration: budgetImg,
    illustrationPosition: '78% 52%',
    illustrationScale: 1.9,
    logoMode: 'stack',
    titleLines: [{ text: 'КАКОЙ У ВАС БЮДЖЕТ?', tone: 'white' }],
    options: ['2-3 ДНЯ', '4-5 ДНЕЙ', '1-2 НЕДЕЛИ', 'МЕСЯЦ И БОЛЕЕ'],
  },
  {
    id: 5,
    illustration: cityImg,
    illustrationPosition: '78% 52%',
    illustrationScale: 1.9,
    logoMode: 'wordmark',
    titleLines: [
      { text: 'ВЫБЕРИТЕ', tone: 'white' },
      { text: 'ИНТЕРЕСУЮЩИЙ', tone: 'white' },
      { text: 'ВАС ГОРОД', tone: 'white' },
    ],
    options: ['2-3 ДНЯ', '4-5 ДНЕЙ', '1-2 НЕДЕЛИ', 'МЕСЯЦ И БОЛЕЕ'],
  },
  {
    id: 6,
    illustration: durationImg,
    illustrationPosition: '78% 52%',
    illustrationScale: 1.9,
    logoMode: 'stack',
    titleLines: [
      { text: 'КАКОЕ ДЛЯ ВАС ОПТИМАЛЬНОЕ', tone: 'white' },
      { text: 'ВРЕМЯ В ПУТИ?', tone: 'white' },
    ],
    options: ['2-3 ДНЯ', '4-5 ДНЕЙ', '1-2 НЕДЕЛИ', 'МЕСЯЦ И БОЛЕЕ'],
  },
]

export function getStepById(id: number): QuizStepConfig | undefined {
  return quizSteps.find((s) => s.id === id)
}
