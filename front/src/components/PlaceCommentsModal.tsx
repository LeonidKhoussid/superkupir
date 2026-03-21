import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { requestAuthModalOpen } from '../features/auth/authModalEvents'
import { useAuthStore } from '../features/auth/authStore'
import {
  createPlaceComment,
  fetchPlaceComments,
  PlaceInteractionsApiError,
  type PlaceCommentsResponse,
} from '../features/places/placeInteractionsApi'
import type { PublicPlace } from '../features/places/placesApi'

type Props = {
  open: boolean
  place: PublicPlace | null
  onClose: () => void
  onCommentsCountChange?: (placeId: number, nextCount: number) => void
}

const inputClassName =
  'min-h-28 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[15px] text-neutral-900 outline-none ring-[#4385f5]/30 transition placeholder:text-neutral-400 focus:border-[#4385f5] focus:ring-2'

const commentDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const formatCommentDate = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return commentDateFormatter.format(date)
}

const formatCommentsCountLabel = (count: number) => {
  const remainder10 = count % 10
  const remainder100 = count % 100

  if (remainder10 === 1 && remainder100 !== 11) {
    return `${count} комментарий`
  }

  if (
    remainder10 >= 2 &&
    remainder10 <= 4 &&
    (remainder100 < 12 || remainder100 > 14)
  ) {
    return `${count} комментария`
  }

  return `${count} комментариев`
}

export function PlaceCommentsModal({
  open,
  place,
  onClose,
  onCommentsCountChange,
}: Props) {
  const titleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const requestIdRef = useRef(0)
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const [commentsResponse, setCommentsResponse] = useState<PlaceCommentsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadComments = useCallback(async () => {
    if (!place) {
      return null
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsLoading(true)
    setLoadError(null)

    try {
      const response = await fetchPlaceComments(place.id, { limit: 20, offset: 0 })

      if (requestIdRef.current !== requestId) {
        return response
      }

      setCommentsResponse(response)
      onCommentsCountChange?.(place.id, response.total)
      return response
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return null
      }

      const message =
        error instanceof PlaceInteractionsApiError
          ? error.message
          : 'Не удалось загрузить комментарии.'

      setLoadError(message)
      return null
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false)
      }
    }
  }, [onCommentsCountChange, place])

  useEffect(() => {
    if (!open || !place) {
      return
    }

    setDraft('')
    setSubmitError(null)
    setCommentsResponse(null)
    void loadComments()

    return () => {
      requestIdRef.current += 1
    }
  }, [loadComments, open, place])

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    queueMicrotask(() => {
      closeButtonRef.current?.focus()
    })

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose, open])

  if (!open || !place) {
    return null
  }

  const region =
    place.source_location?.trim() ||
    place.address?.trim() ||
    'Краснодарский край'
  const trimmedDraft = draft.trim()
  const comments = commentsResponse?.items ?? []
  const commentsCount = commentsResponse?.total ?? 0

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    if (!trimmedDraft) {
      setSubmitError('Введите комментарий.')
      return
    }

    if (trimmedDraft.length > 1000) {
      setSubmitError('Комментарий должен быть не длиннее 1000 символов.')
      return
    }

    if (!token) {
      setSubmitError('Войдите, чтобы оставить комментарий.')
      requestAuthModalOpen()
      return
    }

    setIsSubmitting(true)

    try {
      await createPlaceComment(place.id, trimmedDraft, token)
      setDraft('')
      const refreshed = await loadComments()

      if (!refreshed) {
        setSubmitError('Комментарий сохранён, но список не удалось обновить.')
      }
    } catch (error) {
      const message =
        error instanceof PlaceInteractionsApiError
          ? error.message
          : 'Не удалось отправить комментарий.'

      setSubmitError(message)

      if (error instanceof PlaceInteractionsApiError && error.status === 401) {
        requestAuthModalOpen()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[180] flex items-end justify-center bg-black/55 p-4 pb-6 sm:items-center sm:pb-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(86vh,760px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#4385f5]">
                Комментарии
              </p>
              <h2
                id={titleId}
                className="font-display mt-2 line-clamp-2 text-[1.15rem] font-bold uppercase tracking-[0.06em] text-neutral-900 sm:text-[1.35rem]"
              >
                {place.name}
              </h2>
              <p className="mt-2 text-[14px] font-medium text-neutral-500">
                {region}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Закрыть комментарии"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-[1.5rem] leading-none text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5]"
            >
              ×
            </button>
          </div>
          <p className="mt-4 text-[14px] text-neutral-600">
            {isLoading && !commentsResponse
              ? 'Загружаем комментарии...'
              : formatCommentsCountLabel(commentsCount)}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 px-5 py-5 sm:px-7">
          {loadError ? (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-medium text-red-700">
              {loadError}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {isLoading && !commentsResponse ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-[14px] text-neutral-500">
                Загружаем комментарии...
              </div>
            ) : loadError && !commentsResponse ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                <p className="text-[14px] leading-relaxed text-neutral-600">
                  Не удалось загрузить комментарии для этого места.
                </p>
                <button
                  type="button"
                  onClick={() => void loadComments()}
                  className="font-display mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[#4385f5] px-6 text-[13px] font-bold uppercase tracking-[0.12em] text-white transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5]"
                >
                  Повторить
                </button>
              </div>
            ) : comments.length === 0 ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-[14px] leading-relaxed text-neutral-500">
                Пока никто не поделился впечатлениями. Будьте первым, кто оставит комментарий.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {comments.map((comment) => (
                  <article
                    key={comment.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[14px] font-semibold text-neutral-900">
                        {comment.user.email}
                      </p>
                      <time
                        dateTime={comment.created_at}
                        className="text-[12px] font-medium text-neutral-500"
                      >
                        {formatCommentDate(comment.created_at)}
                      </time>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-neutral-700">
                      {comment.content}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4">
            {user ? (
              <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
                <label
                  htmlFor={`${titleId}-comment`}
                  className="text-[14px] font-semibold text-neutral-900"
                >
                  Оставить комментарий
                </label>
                <textarea
                  id={`${titleId}-comment`}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    setSubmitError(null)
                  }}
                  maxLength={1000}
                  placeholder="Поделитесь впечатлениями о месте"
                  className={inputClassName}
                  disabled={isSubmitting}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12px] font-medium text-neutral-500">
                    {trimmedDraft.length}/1000
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="font-display inline-flex min-h-11 items-center justify-center rounded-full bg-neutral-900 px-6 text-[14px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-wait disabled:opacity-70"
                  >
                    {isSubmitting ? 'Отправляем...' : 'Отправить'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-[14px] leading-relaxed text-neutral-600">
                  Читать комментарии можно без входа, а чтобы оставить свой, нужно авторизоваться.
                </p>
                <button
                  type="button"
                  onClick={() => requestAuthModalOpen()}
                  className="font-display mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-[#4385f5] px-6 text-[13px] font-bold uppercase tracking-[0.12em] text-white transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4385f5]"
                >
                  Войти для комментария
                </button>
              </div>
            )}

            {submitError ? (
              <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-medium text-red-700">
                {submitError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
