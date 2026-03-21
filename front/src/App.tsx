import { useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './features/auth/authStore'
import { QuizPage } from './features/quiz/QuizPage'
import { LandingPage } from './pages/LandingPage'
import { PlaceDetailPage } from './pages/PlaceDetailPage'
import { QuizDonePage } from './pages/QuizDonePage'

function AuthSessionBootstrap() {
  const hydrateSession = useAuthStore((state) => state.hydrateSession)
  const hasBootstrapped = useRef(false)

  useEffect(() => {
    if (hasBootstrapped.current) return

    hasBootstrapped.current = true
    void hydrateSession()
  }, [hydrateSession])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthSessionBootstrap />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/places/:id" element={<PlaceDetailPage />} />
        <Route path="/quiz/:stepId" element={<QuizPage />} />
        <Route path="/quiz/done" element={<QuizDonePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
