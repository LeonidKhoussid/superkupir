import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ImpressionsMyPostsTab } from '../components/ImpressionsMyPostsTab'
import { LoginButton } from '../components/LoginButton'
import { requestAuthModalOpen } from '../features/auth/authModalEvents'
import { useAuthStore } from '../features/auth/authStore'
import { fetchAllPlaces, type PublicPlace } from '../features/places/placesApi'
import {
  buildPlaceByPhotoUrlIndex,
  orderedUniquePlaceIdsFromSlots,
  slotDisplayImageUrl,
  slotsFromPostImageUrls,
  type PostImageSlot,
} from '../features/posts/postPlaceHydration'
import { fetchPostsList, PostsApiError, type PublicPostItem } from '../features/posts/postsApi'
import { createRouteFromSelection, RoutesApiError } from '../features/routes/routesApi'
import impressionsBonusPromo from '../assets/impressions-bonus-promo.png'

const CATALOG_LOGO_SRC = 'https://storage.yandexcloud.net/hackathon-ss/logoPlace.svg'

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

const navLinkClass =
  'rounded-md px-1 py-1 text-[14px] font-semibold tracking-wide text-kr-blue transition hover:opacity-80 lg:text-[15px]'
const navLinkActive = 'underline decoration-2 underline-offset-4'

type ImpressionsLeftTab = 'community' | 'mine'

const miniNavBtnBase =
  'block w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition'
const miniNavBtnActive = `${miniNavBtnBase} bg-sky-50 font-bold text-kr-blue ring-1 ring-kr-blue/25`
const miniNavBtnIdle = `${miniNavBtnBase} text-neutral-800 hover:bg-sky-50/60`

function emailInitial(email: string): string {
  const c = email.trim().charAt(0)
  return c ? c.toUpperCase() : '?'
}

function ImpressionPostCard({
  post,
  slots,
  placeIds,
  photoIndexReady,
  onBuildRoute,
  building,
  buildError,
}: {
  post: PublicPostItem
  slots: PostImageSlot[]
  placeIds: number[]
  photoIndexReady: boolean
  onBuildRoute: () => void
  building: boolean
  buildError: string | null
}) {
  const canBuild = placeIds.length >= 1
  const noImages = post.image_urls.length === 0

  return (
    <article className="rounded-[28px] border border-sky-200/80 bg-white p-5 shadow-sm shadow-sky-900/5 sm:p-7">
      <div className="flex items-center gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-kr-blue/15 text-[15px] font-bold text-kr-blue"
          aria-hidden
        >
          {emailInitial(post.author.email)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-neutral-900">{post.author.email}</p>
          {post.title ? (
            <p className="mt-0.5 text-[13px] font-medium text-kr-blue line-clamp-2">{post.title}</p>
          ) : null}
        </div>
      </div>

      {noImages ? (
        <div className="mt-5 rounded-2xl border border-dashed border-sky-200 bg-sky-50/60 px-4 py-10 text-center text-[13px] text-neutral-500">
          В посте нет изображений — добавьте фото мест в пост, чтобы они отобразились в ленте.
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
            Фото маршрута
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {slots.map((slot, idx) => {
              const src = slotDisplayImageUrl(slot)
              return (
                <div
                  key={`${post.id}-img-${idx}-${slot.imageUrl || idx}`}
                  className="relative h-36 w-44 shrink-0 overflow-hidden rounded-2xl bg-sky-100 sm:h-40 sm:w-52"
                >
                  {src ? (
                    <img
                      src={src}
                      alt={slot.place ? slot.place.name : ''}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const el = e.currentTarget
                        el.style.display = 'none'
                      }}
                    />
                  ) : null}
                  {!src ? (
                    <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-sky-800/80">
                      Нет фото
                    </div>
                  ) : null}
                  {slot.place ? (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
                      <p className="line-clamp-2 text-[11px] font-semibold text-white">{slot.place.name}</p>
                    </div>
                  ) : (
                    <div className="absolute inset-x-0 bottom-0 bg-black/45 px-2 py-1.5">
                      <p className="text-[10px] font-medium text-white/95">Нет в каталоге</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Текст</p>
        <div className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800">
          {post.content}
        </div>
      </div>

      <div className="mt-6 border-t border-sky-100 pt-5">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-kr-blue">Ключевые точки маршрута</p>
        {!photoIndexReady ? (
          <p className="mt-2 text-[13px] text-neutral-500">Загрузка каталога для сопоставления мест…</p>
        ) : slots.length === 0 ? (
          <p className="mt-2 text-[13px] text-neutral-500">Нет фото для привязки к местам.</p>
        ) : (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[14px] text-neutral-700">
            {slots.map((s, i) => (
              <li key={`${post.id}-stop-${i}`}>
                {s.place ? (
                  <Link
                    to={`/places/${s.place.id}`}
                    className="font-medium text-kr-blue underline-offset-2 hover:underline"
                  >
                    {s.place.name}
                  </Link>
                ) : (
                  <span className="text-neutral-500">Фото {i + 1} — место не найдено в каталоге</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          disabled={!canBuild || building}
          onClick={onBuildRoute}
          className="inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-full bg-kr-blue px-8 text-[14px] font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {building ? 'Создаём…' : 'Построить маршрут'}
        </button>
        {!canBuild && photoIndexReady ? (
          <p className="text-[12px] text-amber-900 sm:max-w-xs">
            Нет мест, сопоставленных с фото поста и каталогом — маршрут создать нельзя.
          </p>
        ) : null}
        {buildError ? <p className="w-full text-[13px] text-red-700">{buildError}</p> : null}
      </div>
    </article>
  )
}

export function ImpressionsPage() {
  const token = useAuthStore((s) => s.token)
  const navigate = useNavigate()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [leftTab, setLeftTab] = useState<ImpressionsLeftTab>('community')

  const [phase, setPhase] = useState<'loading' | 'ok' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [posts, setPosts] = useState<PublicPostItem[]>([])
  const [catalog, setCatalog] = useState<PublicPlace[]>([])

  const [buildingPostId, setBuildingPostId] = useState<number | null>(null)
  const [buildErrors, setBuildErrors] = useState<Record<number, string>>({})
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    setErrorMessage(null)
    void Promise.all([
      fetchPostsList({ limit: 50, offset: 0 }),
      fetchAllPlaces(),
    ])
      .then(([list, places]) => {
        if (cancelled) return
        const userPosts = list.items.filter((p) => !p.author.is_guide)
        setPosts(userPosts)
        setCatalog(places)
        setPhase('ok')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setErrorMessage(
          e instanceof PostsApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Не удалось загрузить данные.',
        )
        setPhase('error')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const photoIndex = useMemo(() => buildPlaceByPhotoUrlIndex(catalog), [catalog])
  const photoIndexReady = phase === 'ok'

  const handleBuildRoute = useCallback(
    async (post: PublicPostItem) => {
      if (!token) {
        requestAuthModalOpen()
        return
      }
      const slots = slotsFromPostImageUrls(post.image_urls, photoIndex)
      const placeIds = orderedUniquePlaceIdsFromSlots(slots)
      if (placeIds.length < 1) return

      setBuildErrors((prev) => {
        const next = { ...prev }
        delete next[post.id]
        return next
      })
      setBuildingPostId(post.id)
      try {
        const title =
          post.title?.trim() ||
          `Маршрут: ${post.author.email.split('@')[0] ?? 'пост'} · пост ${post.id}`
        const description =
          post.content.trim().length > 600 ? `${post.content.slice(0, 597)}…` : post.content.trim()

        const detail = await createRouteFromSelection(token, {
          title,
          place_ids: placeIds,
          description: description || undefined,
        })
        navigate(`/routes/${detail.id}`)
      } catch (e) {
        setBuildErrors((prev) => ({
          ...prev,
          [post.id]:
            e instanceof RoutesApiError ? e.message : 'Не удалось создать маршрут. Попробуйте ещё раз.',
        }))
      } finally {
        setBuildingPostId(null)
      }
    },
    [navigate, photoIndex, token],
  )

  return (
    <div className="min-h-dvh bg-[#e8f4fc] text-neutral-900">
      <a
        href="#impressions-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-kr-blue"
      >
        К ленте впечатлений
      </a>

      <header className="sticky top-0 z-30 border-b border-sky-200/60 bg-white/90 shadow-sm shadow-sky-900/5 backdrop-blur-md">
        <div className="mx-auto max-w-[1440px] px-3 py-2 sm:px-6 sm:py-3 lg:px-12 lg:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <Link to="/" className="flex shrink-0 items-center" aria-label="Край Тур — на главную">
              <img
                src={CATALOG_LOGO_SRC}
                alt="Край Тур"
                width={174}
                height={81}
                className="h-9 w-auto object-contain object-left sm:h-10 lg:h-11"
                decoding="async"
              />
            </Link>
            <nav
              className="hidden flex-wrap items-center justify-center gap-x-6 gap-y-1 text-kr-blue sm:flex lg:gap-x-10"
              aria-label="Основная навигация"
            >
              <NavLink
                to="/places"
                className={({ isActive }) => `${navLinkClass} ${isActive ? navLinkActive : ''}`}
                end
              >
                Места
              </NavLink>
              <NavLink
                to="/impressions"
                className={({ isActive }) => `${navLinkClass} ${isActive ? navLinkActive : ''}`}
                end
              >
                Впечатления
              </NavLink>
              <NavLink
                to="/myroutes"
                className={({ isActive }) => `${navLinkClass} ${isActive ? navLinkActive : ''}`}
                end
              >
                Мои Туры
              </NavLink>
            </nav>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Открыть меню"
                aria-expanded={mobileNavOpen}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-sky-200/90 bg-white text-kr-blue shadow-sm sm:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                </svg>
              </button>
              <LoginButton
                variant="on-catalog"
                className="!min-w-0 px-4 text-[13px] sm:!min-w-[120px] sm:px-8 sm:text-[15px]"
              />
            </div>
          </div>
        </div>
      </header>

      {mobileNavOpen
        ? createPortal(
            <div className="fixed inset-0 z-[95] sm:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-black/45"
                aria-label="Закрыть меню"
                onClick={() => setMobileNavOpen(false)}
              />
              <nav
                className="absolute right-0 top-0 flex h-full w-[min(88vw,280px)] flex-col gap-1 border-l border-sky-200 bg-white py-4 pl-4 pr-3 shadow-xl"
                aria-label="Меню навигации"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex justify-end pr-1">
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    aria-label="Закрыть"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-[1.5rem] leading-none text-neutral-500 hover:bg-neutral-100"
                  >
                    ×
                  </button>
                </div>
                <NavLink
                  to="/places"
                  end
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-3 text-[15px] font-semibold text-kr-blue ${isActive ? `bg-sky-50 ${navLinkActive}` : ''}`
                  }
                >
                  Места
                </NavLink>
                <NavLink
                  to="/impressions"
                  end
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-3 text-[15px] font-semibold text-kr-blue ${isActive ? `bg-sky-50 ${navLinkActive}` : ''}`
                  }
                >
                  Впечатления
                </NavLink>
                <NavLink
                  to="/myroutes"
                  end
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-3 text-[15px] font-semibold text-kr-blue ${isActive ? `bg-sky-50 ${navLinkActive}` : ''}`
                  }
                >
                  Мои Туры
                </NavLink>
              </nav>
            </div>,
            document.body,
          )
        : null}

      <main
        id="impressions-main"
        className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:grid lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)] lg:gap-10 lg:px-12 lg:py-10"
      >
        <aside className="mb-8 lg:mb-0">
          <div className="rounded-2xl border border-sky-200/90 bg-white p-4 shadow-sm shadow-sky-900/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Разделы</p>
            <ul className="mt-3 space-y-1">
              <li>
                <span
                  className="block cursor-not-allowed rounded-xl px-3 py-2.5 text-[13px] font-semibold text-neutral-400"
                  title="Скоро"
                >
                  Готовые маршруты
                </span>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setLeftTab('community')}
                  className={leftTab === 'community' ? miniNavBtnActive : miniNavBtnIdle}
                >
                  Маршруты пользователей
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setLeftTab('mine')} className={leftTab === 'mine' ? miniNavBtnActive : miniNavBtnIdle}>
                  Мои посты
                </button>
              </li>
            </ul>
          </div>
        </aside>

        <section className="min-w-0">
          <div
            className="mb-8 rounded-[28px] bg-sky-200 p-4 shadow-sm shadow-sky-900/6 sm:p-5 md:p-6 lg:mb-10"
            role="region"
            aria-labelledby="impressions-promo-heading"
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-stretch md:gap-6 lg:gap-8">
              <div className="shrink-0 overflow-hidden rounded-2xl bg-white/40 md:w-[min(100%,260px)] lg:w-[min(100%,300px)]">
                <img
                  src={impressionsBonusPromo}
                  alt="Иллюстрация: десерты"
                  className="aspect-[4/3] h-full w-full object-cover md:aspect-auto md:min-h-[160px] md:max-h-[200px] lg:max-h-[220px]"
                  width={600}
                  height={450}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 md:gap-4">
                <h2
                  id="impressions-promo-heading"
                  className="font-display text-[clamp(1.05rem,2.2vw,1.35rem)] font-bold leading-tight tracking-wide text-neutral-900"
                >
                  Бонусы и подарки за ваши впечатления!
                </h2>
                <p className="max-w-xl text-[13px] leading-relaxed text-neutral-800 sm:text-[14px]">
                  Поделитесь впечатлениями о построенном маршруте и получите бонусы/подарки от ресторанов и отелей.
                </p>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!token) {
                        requestAuthModalOpen()
                      }
                      setLeftTab('mine')
                      window.requestAnimationFrame(() => {
                        document.getElementById('impressions-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      })
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-kr-blue px-6 py-2.5 text-[13px] font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kr-blue sm:min-h-12 sm:px-8 sm:text-[14px]"
                  >
                    <PencilIcon className="size-5 shrink-0 text-white" />
                    Поделиться впечатлениями
                  </button>
                </div>
              </div>
            </div>
          </div>

          {leftTab === 'community' ? (
            <>
              <h1 className="font-display text-[clamp(1.35rem,3vw,2rem)] font-bold uppercase tracking-[0.1em] text-neutral-900">
                Новые посты
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
                Идеи маршрутов от путешественников. В ответе API постов нет явных ID мест — точки и кнопка
                «Построить маршрут» опираются на совпадение URL фотографий с каталогом мест (загружается для
                сопоставления).
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-[clamp(1.35rem,3vw,2rem)] font-bold uppercase tracking-[0.1em] text-neutral-900">
                Мои посты
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
                Опубликуйте впечатление: выберите сохранённый маршрут, допишите текст — фото точек подставятся из
                маршрута.
              </p>
            </>
          )}

          {leftTab === 'mine' ? (
            <div className="mt-10">
              <ImpressionsMyPostsTab token={token} onPostCreated={() => setReloadKey((k) => k + 1)} />
            </div>
          ) : null}

          {leftTab === 'community' && phase === 'loading' ? (
            <div className="mt-10 space-y-6">
              {[0, 1].map((i) => (
                <div key={i} className="h-64 animate-pulse rounded-[28px] bg-white/80 shadow-inner" />
              ))}
            </div>
          ) : null}

          {leftTab === 'community' && phase === 'error' ? (
            <div className="mt-10 rounded-[28px] border border-rose-200 bg-white px-6 py-10 text-center shadow-sm">
              <p className="font-display text-[1.1rem] font-bold text-neutral-900">Не удалось загрузить ленту</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-neutral-600">{errorMessage}</p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="mt-6 inline-flex min-h-11 items-center rounded-full bg-kr-blue px-8 text-[14px] font-bold text-white"
              >
                Повторить
              </button>
            </div>
          ) : null}

          {leftTab === 'community' && phase === 'ok' && posts.length === 0 ? (
            <div className="mt-10 rounded-[28px] border border-sky-200 bg-white px-6 py-12 text-center shadow-sm">
              <p className="text-[16px] font-semibold text-neutral-800">Пока нет постов от пользователей</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-neutral-500">
                Когда гиды и путешественники публикуют впечатления, они появятся здесь.
              </p>
            </div>
          ) : null}

          {leftTab === 'community' && phase === 'ok' && posts.length > 0 ? (
            <div className="mt-10 flex flex-col gap-10">
              {posts.map((post) => {
                const slots = slotsFromPostImageUrls(post.image_urls, photoIndex)
                const placeIds = orderedUniquePlaceIdsFromSlots(slots)
                return (
                  <ImpressionPostCard
                    key={post.id}
                    post={post}
                    slots={slots}
                    placeIds={placeIds}
                    photoIndexReady={photoIndexReady}
                    building={buildingPostId === post.id}
                    buildError={buildErrors[post.id] ?? null}
                    onBuildRoute={() => void handleBuildRoute(post)}
                  />
                )
              })}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}
