import { create } from 'zustand'

type Answers = Record<number, string>

type QuizState = {
  answers: Answers
  setAnswer: (stepId: number, value: string) => void
  reset: () => void
}

export const useQuizStore = create<QuizState>((set) => ({
  answers: {},
  setAnswer: (stepId, value) =>
    set((s) => ({ answers: { ...s.answers, [stepId]: value } })),
  reset: () => set({ answers: {} }),
}))
