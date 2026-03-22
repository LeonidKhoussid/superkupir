import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink } from 'react-router-dom'
import { LandingHeroMedia } from '../components/LandingHeroMedia'
import { LandingPlacesCarousel } from '../components/LandingPlacesCarousel'
import { LoginButton } from '../components/LoginButton'

const HERO_LOGO_SRC = 'https://storage.yandexcloud.net/hackathon-ss/Group%201.svg'

const navLinkClass =
  'rounded-md px-1 py-1 text-[14px] font-semibold tracking-wide text-white transition hover:opacity-90 lg:text-[20px]'
const navLinkActive = 'underline decoration-2 underline-offset-4'

export function LandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!mobileNavOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileNavOpen])

  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileNavOpen])

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-[#4385f5]"
      >
        К основному содержанию
      </a>
      <section className="relative min-h-[88dvh] overflow-hidden bg-[#0f172a] pb-16 pt-6 text-white sm:min-h-[90dvh] md:pb-24 md:pt-8 lg:min-h-[92dvh] lg:pb-28">
        <LandingHeroMedia />
        <header className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-5 sm:gap-4 sm:px-8 lg:px-14">
          <Link
            to="/"
            className="flex min-w-0 shrink-0 items-center drop-shadow-md"
            aria-label="Край Тур — на главную"
          >
            <img
              src={HERO_LOGO_SRC}
              alt="Край Тур"
              width={174}
              height={81}
              className="h-10 w-auto max-w-[min(58vw,260px)] object-contain object-left sm:h-12 lg:h-14"
              decoding="async"
            />
          </Link>
          <nav
            className="ml-8 hidden flex-1 flex-wrap items-center justify-center gap-x-8 gap-y-1 text-[14px] font-semibold tracking-wide text-white/95 drop-shadow-sm sm:flex lg:gap-14 lg:text-[20px]"
            aria-label="Основная навигация"
          >
            <NavLink
              to="/places"
              end
              className={({ isActive }) => `${navLinkClass} ${isActive ? navLinkActive : ''}`}
            >
              Места
            </NavLink>
            <NavLink
              to="/impressions"
              end
              className={({ isActive }) => `${navLinkClass} ${isActive ? navLinkActive : ''}`}
            >
              Впечатления
            </NavLink>
            <NavLink
              to="/myroutes"
              end
              className={({ isActive }) => `${navLinkClass} ${isActive ? navLinkActive : ''}`}
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
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/35 bg-white/10 text-white shadow-sm backdrop-blur-sm sm:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </button>
            <LoginButton variant="on-hero" />
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

        <div
          id="main"
          className="relative z-10 mx-auto mt-12 flex max-w-[1440px] flex-col items-center px-5 text-center sm:mt-16 lg:mt-[min(8vh,5rem)]"
        >
          <h1 className="font-gerhaus max-w-[920px] text-[clamp(2rem,6vw,4rem)] font-medium uppercase leading-[1.05] tracking-[0.05em] drop-shadow-[0_4px_28px_rgba(0,0,0,0.55)]">
            Куда поедем?
          </h1>
          <p className="mt-6 max-w-[640px] text-[15px] font-medium leading-relaxed text-white/95 drop-shadow-sm sm:text-[27px] lg:text-[28px]">
            Подберём{' '}
            <span className="font-bold text-kr-blue">готовый маршрут</span> по
            Краснодарскому краю за пару секунд
          </p>
          <Link
            to="/quiz/1"
            className="font-display relative z-20 mt-10 inline-flex min-h-[52px] min-w-[240px] items-center justify-center rounded-full bg-kr-blue px-12 text-[15px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-black/25 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:mt-12 sm:min-w-[280px] sm:px-14 sm:text-[16px]"
          >
            ПРОЙТИ КВИЗ
          </Link>
        </div>
      </section>

      <LandingPlacesCarousel />

      <section
        id="how"
        className="flex gap-12 bg-white px-5 py-14 max-sm:flex-col max-sm:gap-8 sm:px-8 sm:py-16 lg:px-14 lg:py-20"
      >
        <div className="mx-auto max-w-[1440px] max-sm:w-full max-sm:min-w-0 max-sm:max-w-none">
          <h2 className="font-display text-left text-[clamp(1.35rem,3vw,2rem)] font-bold uppercase tracking-[0.12em] text-[#4385f5]">
            Как работает сервис
          </h2>
          <p className="mt-6 max-w-2xl text-left text-[15px] font-bold leading-relaxed text-neutral-600 max-sm:max-w-none max-sm:leading-[1.65] sm:text-[16px]">
            Это сервис для планирования путешествий, который строится вокруг интересных мест и впечатлений, а не отелей. Пользователь выбирает локации или типы опыта, которые ему близки, а система сама собирает на их основе готовый маршрут — с логистикой, подходящим жильём и ресторанами поблизости.
            Сервис помогает туристу тем, что избавляет от сложного поиска и планирования: он предлагает уже проверенные и персонализированные маршруты, учитывая предпочтения пользователя и опыт других людей. В результате человек получает не просто набор точек, а цельное путешествие, которое удобно организовано и заранее понятно по формату и атмосфере.
          </p>
        </div>
        <img
          src="https://storage.yandexcloud.net/hackathon-ss/howItWorksImg.png"
          alt=""
          className="h-auto max-w-full shrink-0 max-sm:max-h-[min(48vh,380px)] max-sm:w-full max-sm:object-contain max-sm:object-center"
          decoding="async"
        />
      </section>
      <section id="cities" className="sr-only" aria-hidden />
    </>
  )
}
