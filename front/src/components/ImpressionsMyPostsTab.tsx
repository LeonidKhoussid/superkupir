import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { requestAuthModalOpen } from '../features/auth/authModalEvents'
import { getPrimaryDisplayPhotoUrl } from '../features/places/placesApi'
import { createPost, fetchPostsList, PostsApiError, type PublicPostItem } from '../features/posts/postsApi'
import {
  fetchAllUserRoutes,
  fetchUserRouteById,
  RoutesApiError,
  type UserRouteDetail,
  type UserRouteSummary,
} from '../features/routes/routesApi'

const MAX_POST_CHARS = 4000
const PREVIEW_PLACES = 5

function buildImageUrlsFromRoute(detail: UserRouteDetail): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of detail.places) {
    const url = getPrimaryDisplayPhotoUrl(row.place)
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(url)
    if (out.length >= 20) break
  }
  return out
}

function formatShortDate(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type Props = {
  token: string | null
  onPostCreated: () => void
}

export function ImpressionsMyPostsTab({ token, onPostCreated }: Props) {
  const [routes, setRoutes] = useState<UserRouteSummary[]>([])
  const [routesPhase, setRoutesPhase] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [routesError, setRoutesError] = useState<string | null>(null)
  const [routesReload, setRoutesReload] = useState(0)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<UserRouteDetail | null>(null)
  const [detailPhase, setDetailPhase] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [detailError, setDetailError] = useState<string | null>(null)

  const [postText, setPostText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitOk, setSubmitOk] = useState(false)

  const [minePosts, setMinePosts] = useState<PublicPostItem[]>([])
  const [minePhase, setMinePhase] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [mineError, setMineError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setRoutes([])
      setRoutesPhase('idle')
      setMinePosts([])
      setMinePhase('idle')
      return
    }

    let cancelled = false
    setRoutesPhase('loading')
    setRoutesError(null)
    void fetchAllUserRoutes(token, { scope: 'owned' })
      .then((items) => {
        if (cancelled) return
        setRoutes(items)
        setRoutesPhase('ok')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setRoutesError(
          e instanceof RoutesApiError ? e.message : e instanceof Error ? e.message : 'Не удалось загрузить маршруты.',
        )
        setRoutesPhase('error')
      })

    return () => {
      cancelled = true
    }
  }, [token, routesReload])

  useEffect(() => {
    if (!token) return

    let cancelled = false
    setMinePhase('loading')
    setMineError(null)
    void fetchPostsList({ mine: true, token, limit: 30, offset: 0 })
      .then((res) => {
        if (cancelled) return
        setMinePosts(res.items)
        setMinePhase('ok')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setMineError(
          e instanceof PostsApiError ? e.message : e instanceof Error ? e.message : 'Не удалось загрузить ваши посты.',
        )
        setMinePhase('error')
      })

    return () => {
      cancelled = true
    }
  }, [token, routesReload])

  useEffect(() => {
    if (!token || selectedId === null) {
      setDetail(null)
      setDetailPhase('idle')
      setDetailError(null)
      return
    }

    let cancelled = false
    setDetailPhase('loading')
    setDetailError(null)
    void fetchUserRouteById(token, selectedId)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        setDetailPhase('ok')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setDetail(null)
        setDetailError(
          e instanceof RoutesApiError ? e.message : e instanceof Error ? e.message : 'Не удалось открыть маршрут.',
        )
        setDetailPhase('error')
      })

    return () => {
      cancelled = true
    }
  }, [token, selectedId])

  const refreshMineList = useCallback(() => {
    if (!token) return
    void fetchPostsList({ mine: true, token, limit: 30, offset: 0 })
      .then((res) => {
        setMinePosts(res.items)
        setMinePhase('ok')
      })
      .catch(() => {
        /* список вторичен после публикации */
      })
  }, [token])

  const handleSubmit = useCallback(async () => {
    setSubmitOk(false)
    setSubmitError(null)
    if (!token) {
      requestAuthModalOpen()
      return
    }
    if (selectedId === null || !detail || detailPhase !== 'ok') {
      setSubmitError('Выберите сохранённый маршрут.')
      return
    }
    const text = postText.trim()
    if (text.length < 1) {
      setSubmitError('Напишите текст поста.')
      return
    }
    if (text.length > MAX_POST_CHARS) {
      setSubmitError(`Текст длиннее ${MAX_POST_CHARS} символов.`)
      return
    }

    const routeTitle = detail.title.trim()
    const titleArg = routeTitle.length > 0 ? routeTitle.slice(0, 200) : undefined
    const image_urls = buildImageUrlsFromRoute(detail)

    setSubmitting(true)
    try {
      await createPost(token, {
        ...(titleArg !== undefined ? { title: titleArg } : {}),
        content: text,
        image_urls,
      })
      setPostText('')
      setSubmitOk(true)
      onPostCreated()
      refreshMineList()
    } catch (e: unknown) {
      setSubmitError(
        e instanceof PostsApiError ? e.message : e instanceof Error ? e.message : 'Не удалось опубликовать пост.',
      )
    } finally {
      setSubmitting(false)
    }
  }, [detail, detailPhase, onPostCreated, postText, refreshMineList, selectedId, token])

  if (!token) {
    return (
      <div className="rounded-[28px] border border-sky-200 bg-white px-6 py-12 text-center shadow-sm">
        <p className="font-display text-[1.1rem] font-bold text-neutral-900">Войдите, чтобы публиковать посты</p>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-neutral-600">
          Публикация привязана к вашему аккаунту. После входа вы сможете выбрать маршрут из «Мои туры» и поделиться
          впечатлением.
        </p>
        <button
          type="button"
          onClick={() => requestAuthModalOpen()}
          className="mt-6 inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-full bg-kr-blue px-8 text-[14px] font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-105"
        >
          Войти
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="rounded-[28px] border border-sky-200/90 bg-white p-5 shadow-sm shadow-sky-900/5 sm:p-7">
        <h2 className="font-display text-[clamp(1.1rem,2.2vw,1.35rem)] font-bold uppercase tracking-[0.08em] text-neutral-900">
          Новый пост из маршрута
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
          Выберите один из ваших сохранённых маршрутов — фото точек подтянутся автоматически (как в каталоге). Допишите
          текст и опубликуйте пост в общую ленту «Маршруты пользователей».
        </p>

        {routesPhase === 'loading' ? (
          <div className="mt-8 h-40 animate-pulse rounded-2xl bg-sky-50/80" />
        ) : null}

        {routesPhase === 'error' ? (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50/50 px-4 py-5 text-center">
            <p className="text-[14px] text-rose-900">{routesError}</p>
            <button
              type="button"
              onClick={() => setRoutesReload((k) => k + 1)}
              className="mt-4 inline-flex min-h-11 items-center rounded-full bg-kr-blue px-6 text-[13px] font-bold text-white"
            >
              Повторить
            </button>
          </div>
        ) : null}

        {routesPhase === 'ok' && routes.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-sky-200 bg-sky-50/50 px-5 py-10 text-center">
            <p className="text-[15px] font-semibold text-neutral-800">У вас пока нет своих маршрутов</p>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-neutral-600">
              Сначала соберите маршрут в каталоге мест или через квиз — затем вернитесь сюда и опубликуйте впечатление.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/places"
                className="inline-flex min-h-11 items-center rounded-full bg-kr-blue px-6 text-[13px] font-bold text-white"
              >
                К каталогу мест
              </Link>
              <Link
                to="/myroutes"
                className="inline-flex min-h-11 items-center rounded-full border border-sky-200 bg-white px-6 text-[13px] font-bold text-kr-blue"
              >
                Мои туры
              </Link>
            </div>
          </div>
        ) : null}

        {routesPhase === 'ok' && routes.length > 0 ? (
          <div className="mt-8 space-y-6">
            <div>
              <label htmlFor="impressions-route-select" className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                Маршрут
              </label>
              <select
                id="impressions-route-select"
                value={selectedId === null ? '' : String(selectedId)}
                onChange={(e) => {
                  const v = e.target.value
                  setSelectedId(v === '' ? null : Number(v))
                  setSubmitOk(false)
                  setSubmitError(null)
                }}
                className="mt-2 w-full min-h-12 rounded-2xl border border-sky-200 bg-white px-4 py-2 text-[15px] text-neutral-900 shadow-inner focus:border-kr-blue focus:outline-none focus:ring-2 focus:ring-kr-blue/25"
              >
                <option value="">Выберите маршрут…</option>
                {routes.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.title}
                    {r.place_count > 0 ? ` · ${r.place_count} точ.` : ''}
                    {r.created_at ? ` · ${formatShortDate(r.created_at)}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedId !== null && detailPhase === 'loading' ? (
              <p className="text-[14px] text-neutral-500">Загружаем точки маршрута…</p>
            ) : null}

            {selectedId !== null && detailPhase === 'error' ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[14px] text-amber-950">
                {detailError}
              </div>
            ) : null}

            {detail && detailPhase === 'ok' ? (
              <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-kr-blue">Предпросмотр</p>
                    <p className="mt-1 truncate text-[16px] font-semibold text-neutral-900">{detail.title}</p>
                    <p className="mt-1 text-[13px] text-neutral-600">
                      {detail.places.length} точек · фото в пост попадут в порядке остановок (до 20 уникальных URL).
                    </p>
                  </div>
                  <Link
                    to={`/routes/${detail.id}`}
                    className="inline-flex shrink-0 min-h-10 items-center justify-center rounded-full border border-sky-200 bg-white px-4 text-[12px] font-bold text-kr-blue"
                  >
                    Открыть маршрут
                  </Link>
                </div>
                <ul className="mt-3 space-y-1 text-[13px] text-neutral-700">
                  {detail.places.slice(0, PREVIEW_PLACES).map((row, i) => (
                    <li key={row.route_place_id}>
                      {i + 1}. {row.place.name}
                    </li>
                  ))}
                </ul>
                {detail.places.length > PREVIEW_PLACES ? (
                  <p className="mt-2 text-[12px] text-neutral-500">
                    и ещё {detail.places.length - PREVIEW_PLACES}…
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <label htmlFor="impressions-post-text" className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                Текст поста
              </label>
              <textarea
                id="impressions-post-text"
                value={postText}
                onChange={(e) => {
                  setPostText(e.target.value)
                  setSubmitOk(false)
                  setSubmitError(null)
                }}
                maxLength={MAX_POST_CHARS}
                rows={6}
                placeholder="Расскажите, что запомнилось в поездке…"
                className="mt-2 w-full resize-y rounded-2xl border border-sky-200 bg-white px-4 py-3 text-[15px] leading-relaxed text-neutral-900 shadow-inner placeholder:text-neutral-400 focus:border-kr-blue focus:outline-none focus:ring-2 focus:ring-kr-blue/25"
              />
              <p className="mt-1 text-right text-[12px] text-neutral-400">
                {postText.length} / {MAX_POST_CHARS}
              </p>
            </div>

            {submitOk ? (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-[14px] font-medium text-emerald-900">
                Пост опубликован. Он появится в ленте «Маршруты пользователей».
              </p>
            ) : null}

            {submitError ? <p className="text-[14px] text-red-700">{submitError}</p> : null}

            <button
              type="button"
              disabled={submitting || selectedId === null || detailPhase !== 'ok' || !detail}
              onClick={() => void handleSubmit()}
              className="inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-full bg-kr-blue px-8 text-[14px] font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting ? 'Публикуем…' : 'Опубликовать'}
            </button>
          </div>
        ) : null}
      </div>

      {token ? (
        <div className="rounded-[28px] border border-sky-200/90 bg-white p-5 shadow-sm shadow-sky-900/5 sm:p-7">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-neutral-400">Ваши посты</h3>
          {minePhase === 'loading' ? (
            <div className="mt-6 h-24 animate-pulse rounded-2xl bg-sky-50/80" />
          ) : null}
          {minePhase === 'error' ? (
            <p className="mt-4 text-[14px] text-neutral-600">{mineError}</p>
          ) : null}
          {minePhase === 'ok' && minePosts.length === 0 ? (
            <p className="mt-4 text-[14px] text-neutral-600">Пока нет опубликованных постов — создайте первый выше.</p>
          ) : null}
          {minePhase === 'ok' && minePosts.length > 0 ? (
            <ul className="mt-5 space-y-4">
              {minePosts.map((p) => (
                <li key={p.id} className="rounded-2xl border border-sky-100 bg-sky-50/30 px-4 py-3">
                  <p className="text-[12px] font-medium text-neutral-500">{formatShortDate(p.created_at)}</p>
                  {p.title ? <p className="mt-1 text-[14px] font-semibold text-kr-blue line-clamp-2">{p.title}</p> : null}
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[14px] text-neutral-800">{p.content}</p>
                  <p className="mt-2 text-[12px] text-neutral-500">{p.image_urls.length} фото в посте</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
