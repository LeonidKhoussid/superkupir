import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchPlaceById,
  PlacesApiError,
  type PublicPlace,
} from '../features/places/placesApi'

function BadIdView() {
  return (
    <div className="min-h-dvh bg-neutral-50 px-5 py-16 text-center">
      <p className="font-display text-lg font-bold text-neutral-800">
        Некорректная ссылка
      </p>
      <Link
        to="/#places"
        className="mt-6 inline-block rounded-full bg-[#4385f5] px-8 py-3 font-bold text-white"
      >
        К каталогу мест
      </Link>
    </div>
  )
}

function PlaceDetailLoaded({ id }: { id: number }) {
  const [phase, setPhase] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [place, setPlace] = useState<PublicPlace | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    void fetchPlaceById(id)
      .then((p) => {
        if (cancelled) return
        setPlace(p)
        setPhase('ok')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        if (e instanceof PlacesApiError && e.status === 404) {
          setPhase('notfound')
          return
        }
        setErrorMessage(
          e instanceof PlacesApiError ? e.message : 'Не удалось загрузить место.',
        )
        setPhase('error')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (phase === 'loading') {
    return (
      <div className="min-h-dvh bg-neutral-50 px-5 py-16">
        <div className="mx-auto max-w-3xl animate-pulse space-y-4">
          <div className="h-10 w-2/3 rounded-lg bg-slate-200" />
          <div className="h-56 w-full rounded-2xl bg-slate-200" />
          <div className="h-24 w-full rounded-lg bg-slate-200" />
        </div>
      </div>
    )
  }

  if (phase === 'notfound') {
    return (
      <div className="min-h-dvh bg-neutral-50 px-5 py-16 text-center">
        <p className="font-display text-lg font-bold text-neutral-800">
          Место не найдено
        </p>
        <p className="mt-2 text-neutral-600">
          Возможно, запись удалена или указан неверный id.
        </p>
        <Link
          to="/#places"
          className="mt-8 inline-block rounded-full bg-[#4385f5] px-8 py-3 font-bold text-white"
        >
          Назад к каталогу
        </Link>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="min-h-dvh bg-neutral-50 px-5 py-16 text-center">
        <p className="font-display text-lg font-bold text-red-800">Ошибка</p>
        <p className="mt-2 text-neutral-600">{errorMessage}</p>
        <Link
          to="/#places"
          className="mt-8 inline-block rounded-full bg-[#4385f5] px-8 py-3 font-bold text-white"
        >
          На главную
        </Link>
      </div>
    )
  }

  if (!place) return null

  const heroPhoto = place.photo_urls[0]
  const region =
    place.source_location?.trim() ||
    place.address?.trim() ||
    'Краснодарский край'

  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <header className="border-b border-slate-100 bg-neutral-50/80 px-5 py-4 backdrop-blur-sm sm:px-8 lg:px-14">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
          <Link
            to="/#places"
            className="text-[14px] font-semibold text-[#4385f5] underline-offset-2 hover:underline"
          >
            ← К каталогу мест
          </Link>
          <Link
            to="/"
            className="font-display text-[18px] font-bold uppercase text-[#4385f5]"
          >
            Край <span className="text-kr-lime">Тур</span>
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-10 sm:px-8 lg:py-14">
        {heroPhoto ? (
          <img
            src={heroPhoto}
            alt=""
            className="mb-8 max-h-[420px] w-full rounded-2xl object-cover shadow-lg"
            width={1200}
            height={630}
            decoding="async"
          />
        ) : (
          <div
            className="mb-8 flex min-h-[220px] items-center justify-center rounded-2xl bg-gradient-to-br from-[#4385f5]/20 to-slate-100 text-neutral-500"
            aria-hidden
          >
            Фото скоро
          </div>
        )}

        <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#4385f5]">
          {region}
        </p>
        <h1 className="font-display mt-2 text-[clamp(1.5rem,4vw,2.25rem)] font-bold uppercase leading-tight tracking-wide">
          {place.name}
        </h1>
        {place.size ? (
          <p className="mt-3 text-[13px] font-medium uppercase tracking-wide text-neutral-400">
            {place.size}
          </p>
        ) : null}

        {place.description ? (
          <div className="mt-8 space-y-4 text-[16px] leading-relaxed text-neutral-700">
            {place.description.split('\n').map((para, i) => (
              <p key={`${place.id}-p-${i}`}>{para}</p>
            ))}
          </div>
        ) : null}

        <dl className="mt-10 grid gap-4 border-t border-slate-100 pt-8 text-[14px] sm:grid-cols-2">
          {place.address ? (
            <div>
              <dt className="font-semibold text-neutral-500">Адрес</dt>
              <dd className="mt-1 text-neutral-800">{place.address}</dd>
            </div>
          ) : null}
          {place.lat != null && place.lon != null ? (
            <div>
              <dt className="font-semibold text-neutral-500">Координаты</dt>
              <dd className="mt-1 text-[13px] text-neutral-800">
                {place.lat.toFixed(5)}, {place.lon.toFixed(5)}
              </dd>
            </div>
          ) : null}
          {place.card_url ? (
            <div className="sm:col-span-2">
              <dt className="font-semibold text-neutral-500">Карточка источника</dt>
              <dd className="mt-1">
                <a
                  href={place.card_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-[#4385f5] underline"
                >
                  {place.card_url}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>

        {place.photo_urls.length > 1 ? (
          <div className="mt-10">
            <h2 className="font-display text-[14px] font-bold uppercase tracking-wider text-neutral-500">
              Ещё фото
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {place.photo_urls.slice(1).map((url, idx) => (
                <li key={`${place.id}-ph-${idx}`}>
                  <img
                    src={url}
                    alt=""
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>
    </div>
  )
}

export function PlaceDetailPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)

  if (!Number.isFinite(id) || id < 1 || !Number.isInteger(id)) {
    return <BadIdView />
  }

  return <PlaceDetailLoaded id={id} />
}
