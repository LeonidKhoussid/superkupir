/**
 * В публичном контракте поста нет полей route_id / place_ids — только image_urls[].
 * Сопоставляем каждое фото поста с местом каталога по совпадению URL с любым элементом place.photo_urls.
 */

import type { PublicPlace } from '../places/placesApi'
import { getPrimaryDisplayPhotoUrl } from '../places/placesApi'

export function normalizePhotoUrlKey(url: string): string {
  const t = url.trim()
  if (!t) return ''
  try {
    const u = new URL(t)
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`
  } catch {
    return t.toLowerCase()
  }
}

/** Первое вхождение URL → место (по всем photo_urls). */
export function buildPlaceByPhotoUrlIndex(places: PublicPlace[]): Map<string, PublicPlace> {
  const m = new Map<string, PublicPlace>()
  for (const p of places) {
    if (!Array.isArray(p.photo_urls)) continue
    for (const raw of p.photo_urls) {
      if (typeof raw !== 'string') continue
      const k = normalizePhotoUrlKey(raw)
      if (!k) continue
      if (!m.has(k)) m.set(k, p)
    }
  }
  return m
}

export type PostImageSlot = {
  imageUrl: string
  place: PublicPlace | null
}

export function slotsFromPostImageUrls(
  image_urls: string[],
  index: Map<string, PublicPlace>,
): PostImageSlot[] {
  return image_urls.map((u) => {
    const imageUrl = u.trim()
    const place = imageUrl ? index.get(normalizePhotoUrlKey(imageUrl)) ?? null : null
    return { imageUrl, place }
  })
}

/** Порядок — как в посте; дубликаты place id пропускаем (первое вхождение). */
export function orderedUniquePlaceIdsFromSlots(slots: PostImageSlot[]): number[] {
  const ids: number[] = []
  const seen = new Set<number>()
  for (const s of slots) {
    if (!s.place) continue
    if (seen.has(s.place.id)) continue
    seen.add(s.place.id)
    ids.push(s.place.id)
  }
  return ids
}

/** URL для превью слота: primary места, иначе URL из поста. */
export function slotDisplayImageUrl(slot: PostImageSlot): string | null {
  if (slot.imageUrl) return slot.imageUrl
  const primary = slot.place ? getPrimaryDisplayPhotoUrl(slot.place) : null
  return primary
}
