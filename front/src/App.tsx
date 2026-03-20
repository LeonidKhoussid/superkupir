import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QuizPage } from './features/quiz/QuizPage'
import { LandingPage } from './pages/LandingPage'
import { QuizDonePage } from './pages/QuizDonePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/quiz/:stepId" element={<QuizPage />} />
        <Route path="/quiz/done" element={<QuizDonePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
