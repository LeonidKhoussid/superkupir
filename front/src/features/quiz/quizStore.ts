import { create } from 'zustand'

/** Сезоны в UI ↔ slug (совместимо с backend canonical seasons). */
export type SeasonSlug = 'spring' | 'summer' | 'autumn' | 'winter'

export type QuizBudget = { from: number; to: number }

export type QuizRestType = 'Активный' | 'Умеренный' | 'Спокойный'

export type QuizState = {
  peopleCount: number | null
  seasons: SeasonSlug[]
  budget: QuizBudget
  restType: QuizRestType | null
  daysCount: number | null

  setPeopleCount: (value: number | null) => void
  toggleSeason: (slug: SeasonSlug) => void
  setBudgetFrom: (value: number) => void
  setBudgetTo: (value: number) => void
  setRestType: (value: QuizRestType) => void
  setDaysCount: (value: number | null) => void
  reset: () => void
}

const BUDGET_INITIAL: QuizBudget = { from: 15_000, to: 80_000 }

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export const useQuizStore = create<QuizState>((set) => ({
  peopleCount: null,
  seasons: [],
  budget: { ...BUDGET_INITIAL },
  restType: null,
  daysCount: null,

  setPeopleCount: (value) => set({ peopleCount: value }),

  toggleSeason: (slug) =>
    set((s) => {
      const has = s.seasons.includes(slug)
      return {
        seasons: has ? s.seasons.filter((x) => x !== slug) : [...s.seasons, slug],
      }
    }),

  setBudgetFrom: (value) =>
    set((s) => {
      const min = 0
      const max = 200_000
      const from = clamp(value, min, max)
      const to = from > s.budget.to ? from : s.budget.to
      return { budget: { from, to } }
    }),

  setBudgetTo: (value) =>
    set((s) => {
      const min = 0
      const max = 200_000
      const to = clamp(value, min, max)
      const from = to < s.budget.from ? to : s.budget.from
      return { budget: { from, to } }
    }),

  setRestType: (value) => set({ restType: value }),

  setDaysCount: (value) => set({ daysCount: value }),

  reset: () =>
    set({
      peopleCount: null,
      seasons: [],
      budget: { ...BUDGET_INITIAL },
      restType: null,
      daysCount: null,
    }),
}))

export function formatSeasonLabel(slug: SeasonSlug): string {
  const map: Record<SeasonSlug, string> = {
    spring: 'весна',
    summer: 'лето',
    autumn: 'осень',
    winter: 'зима',
  }
  return map[slug]
}
