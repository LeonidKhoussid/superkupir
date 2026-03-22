import { useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './features/auth/authStore'
import { QuizPage } from './features/quiz/QuizPage'
import { ImpressionsPage } from './pages/ImpressionsPage'
import { LandingPage } from './pages/LandingPage'
import { MyRoutesPage } from './pages/MyRoutesPage'
import { PlaceDetailPage } from './pages/PlaceDetailPage'
import { PlacesCatalogPage } from './pages/PlacesCatalogPage'
import { QuizDonePage } from './pages/QuizDonePage'
import { RouteDetailPage } from './pages/RouteDetailPage'
import { RoutePanoramaPage } from './pages/RoutePanoramaPage'
import { RouteSharedPage } from './pages/RouteSharedPage'

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
        <Route path="/myroutes" element={<MyRoutesPage />} />
        <Route path="/impressions" element={<ImpressionsPage />} />
        <Route path="/places" element={<PlacesCatalogPage />} />
        <Route path="/places/:id" element={<PlaceDetailPage />} />
        <Route path="/routes/shared/:token" element={<RouteSharedPage />} />
        <Route path="/routes/:id/panorama" element={<RoutePanoramaPage />} />
        <Route path="/routes/:id" element={<RouteDetailPage />} />
        <Route path="/quiz/:stepId" element={<QuizPage />} />
        <Route path="/quiz/done" element={<QuizDonePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
