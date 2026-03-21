import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LoginButton } from '../components/LoginButton'
import { useAuthStore } from '../features/auth/authStore'
import { getPrimaryDisplayPhotoUrl } from '../features/places/placesApi'
import {
  fetchUserRouteById,
  RoutesApiError,
  type UserRouteDetail,
} from '../features/routes/routesApi'

function BadIdView() {
  return (
    <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16 text-center">
      <p className="font-display text-lg font-bold text-neutral-800">Некорректная ссылка</p>
      <Link
        to="/places"
        className="mt-6 inline-block rounded-full bg-kr-blue px-8 py-3 font-bold text-white"
      >
        К каталогу мест
      </Link>
    </div>
  )
}

function AuthWall() {
  return (
    <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16 text-center">
      <p className="font-display text-lg font-bold text-neutral-800">
        Войдите, чтобы просмотреть маршрут.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <LoginButton variant="on-catalog" />
        <Link
          to="/places"
          className="inline-flex min-h-11 items-center rounded-full border border-kr-blue bg-white px-8 font-bold text-kr-blue"
        >
          К каталогу
        </Link>
      </div>
    </div>
  )
}

function RouteDetailLoaded({ id }: { id: number }) {
  const token = useAuthStore((s) => s.token)

  const [phase, setPhase] = useState<'loading' | 'ok' | 'error'>('loading')
  const [route, setRoute] = useState<UserRouteDetail | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) return

    let cancelled = false
    void fetchUserRouteById(token, id)
      .then((r) => {
        if (cancelled) return
        setRoute(r)
        setPhase('ok')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setMessage(e instanceof RoutesApiError ? e.message : 'Не удалось загрузить маршрут.')
        setPhase('error')
      })

    return () => {
      cancelled = true
    }
  }, [id, token])

  if (phase === 'loading') {
    return (
      <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16">
        <div className="mx-auto max-w-2xl animate-pulse space-y-4">
          <div className="h-10 w-2/3 rounded-lg bg-slate-200" />
          <div className="h-32 w-full rounded-2xl bg-slate-200" />
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-dvh bg-[#e8f4fc] px-5 py-16 text-center">
        <p className="font-display text-lg font-bold text-red-800">Ошибка</p>
        <p className="mt-2 text-neutral-600">{message}</p>
        <Link
          to="/places"
          className="mt-8 inline-block rounded-full bg-kr-blue px-8 py-3 font-bold text-white"
        >
          К каталогу мест
        </Link>
      </div>
    )
  }

  if (!route) return null

  return (
    <div className="min-h-dvh bg-[#e8f4fc] pb-28 text-neutral-900">
      <header className="border-b border-sky-200/60 bg-white/90 px-5 py-4 backdrop-blur-md sm:px-8 lg:px-14">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <Link
            to="/places"
            className="text-[14px] font-semibold text-kr-blue underline-offset-2 hover:underline"
          >
            ← К каталогу мест
          </Link>
          <Link to="/" className="font-display text-[16px] font-bold uppercase text-kr-blue">
            Край <span className="text-kr-lime">Тур</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-kr-blue">
          Маршрут создан
        </p>
        <h1 className="font-display mt-2 text-[clamp(1.35rem,4vw,2rem)] font-bold uppercase leading-tight tracking-wide text-neutral-900">
          {route.title}
        </h1>
        {route.description ? (
          <p className="mt-4 text-[15px] leading-relaxed text-neutral-600">{route.description}</p>
        ) : null}
        <p className="mt-4 text-[14px] text-neutral-500">
          Точек в маршруте: <span className="font-semibold text-neutral-800">{route.place_count}</span>
        </p>

        <ol className="mt-10 space-y-4">
          {route.places.map((rp, idx) => {
            const photo = getPrimaryDisplayPhotoUrl(rp.place)
            return (
              <li key={rp.route_place_id}>
                <Link
                  to={`/places/${rp.place_id}`}
                  className="flex gap-4 rounded-2xl border border-sky-200/80 bg-white p-4 shadow-sm shadow-sky-900/5 transition hover:border-kr-blue/40"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-kr-blue/10 text-[15px] font-bold text-kr-blue">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[15px] font-bold uppercase leading-snug text-neutral-900">
                      {rp.place.name}
                    </p>
                    {rp.place.source_location ? (
                      <p className="mt-1 line-clamp-2 text-[13px] text-neutral-500">
                        {rp.place.source_location}
                      </p>
                    ) : null}
                  </div>
                  {photo ? (
                    <img
                      src={photo}
                      alt=""
                      className="size-16 shrink-0 rounded-xl object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ol>
      </main>
    </div>
  )
}

export function RouteDetailPage() {
  const { id: idParam } = useParams()
  const token = useAuthStore((s) => s.token)
  const id = Number(idParam)

  if (!Number.isFinite(id) || id < 1 || !Number.isInteger(id)) {
    return <BadIdView />
  }

  if (!token) {
    return <AuthWall />
  }

  return <RouteDetailLoaded key={id} id={id} />
}
