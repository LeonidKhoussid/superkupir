import { useEffect, useRef, useState } from 'react'
import landingHeroPoster from '../assets/landing-hero.png'

/** Публичный ролик (hero); постер и fallback — локальный `landing-hero.png`. */
export const LANDING_HERO_VIDEO_SRC =
  'https://storage.yandexcloud.net/hackathon-ss/%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D0%B4%D0%B0%D1%80%D1%81%D0%BA%D0%B8%D0%B8%CC%86_%D0%BA%D1%80%D0%B0%D0%B8%CC%86_%D1%81_%D0%B2%D1%8B%D1%81%D0%BE%D1%82%D1%8B_%D0%BF%D1%82%D0%B8%D1%87%D1%8C%D0%B5%D0%B3%D0%BE_%D0%BF%D0%BE%D0%BB%D0%B5%D1%82%D0%B0%20(1).mp4'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return reduced
}

/**
 * Полноэкранный фон hero: видео (autoplay/muted/loop/playsInline/object-cover) или статичный кадр
 * при ошибке загрузки или prefers-reduced-motion.
 */
export function LandingHeroMedia() {
  const reducedMotion = usePrefersReducedMotion()
  const [videoFailed, setVideoFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const showVideo = !reducedMotion && !videoFailed

  useEffect(() => {
    if (!showVideo) {
      videoRef.current?.pause()
      return
    }
    const v = videoRef.current
    if (!v) return
    v.muted = true
    const playAttempt = v.play()
    if (playAttempt !== undefined) {
      playAttempt.catch(() => setVideoFailed(true))
    }
  }, [showVideo])

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      {showVideo ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          poster={landingHeroPoster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          disableRemotePlayback
          tabIndex={-1}
          onError={() => setVideoFailed(true)}
        >
          <source src={LANDING_HERO_VIDEO_SRC} type="video/mp4" />
        </video>
      ) : (
        <img
          src={landingHeroPoster}
          alt=""
          width={2048}
          height={1155}
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
          fetchPriority="high"
        />
      )}

      <div className="absolute inset-0 bg-[#0f172a]/50" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628]/95 via-[#1e3a5f]/50 to-[#4385f5]/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/35" />
    </div>
  )
}
