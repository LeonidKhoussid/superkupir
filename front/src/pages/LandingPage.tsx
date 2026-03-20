import { Link } from 'react-router-dom'
import { LoginButton } from '../components/LoginButton'
import landingHero from '../assets/landing-hero.png'

function HeroSplitImage() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex" aria-hidden>
      <div className="relative h-full w-1/2 overflow-hidden">
        <img
          src={landingHero}
          alt=""
          width={2048}
          height={1155}
          className="absolute left-0 top-0 h-full w-[200%] max-w-none object-cover object-left"
          decoding="async"
          fetchPriority="high"
        />
      </div>
      <div className="relative h-full w-1/2 overflow-hidden">
        <img
          src={landingHero}
          alt=""
          width={2048}
          height={1155}
          className="absolute right-0 top-0 h-full w-[200%] max-w-none object-cover object-right"
          decoding="async"
        />
      </div>
      <div className="absolute inset-0 bg-[#4385f5]/50" aria-hidden />
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#4385f5]/25 via-transparent to-[#4385f5]/40"
        aria-hidden
      />
    </div>
  )
}

export function LandingPage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-[#4385f5]"
      >
        К основному содержанию
      </a>
      <section className="relative overflow-hidden bg-[#4385f5] pb-16 pt-6 text-white md:pb-24 md:pt-8 lg:min-h-[78vh] lg:pb-28">
        <HeroSplitImage />
        <header className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-14">
          <div className="font-display text-[22px] font-bold uppercase sm:text-[26px] lg:text-[30px]">
            <span className="text-white">Край </span>
            <span className="text-kr-lime">Тур</span>
          </div>
          <nav
            className="hidden flex-1 justify-center gap-8 text-[14px] font-semibold tracking-wide text-white/95 md:flex lg:gap-14 lg:text-[15px]"
            aria-label="Основная навигация"
          >
            <a href="#places" className="hover:opacity-90">
              Места
            </a>
            <a href="#cities" className="hover:opacity-90">
              Города
            </a>
            <a href="#how" className="hover:opacity-90">
              Как это работает
            </a>
          </nav>
          <LoginButton variant="on-hero" />
        </header>

        <div
          id="main"
          className="relative z-10 mx-auto mt-10 flex max-w-[1440px] flex-col items-center px-5 text-center sm:mt-14 lg:mt-20"
        >
          <h1 className="font-display text-[clamp(2rem,5vw,3.75rem)] font-bold uppercase leading-[1.08] tracking-[0.06em] drop-shadow-sm">
            Куда поедем?
          </h1>
          <p className="mt-6 max-w-[640px] text-[15px] font-medium leading-relaxed text-white/95 sm:text-[17px] lg:text-[18px]">
            Подберём{' '}
            <span className="font-bold text-kr-lime">готовый маршрут</span> по
            Краснодарскому краю за пару секунд
          </p>
          <Link
            to="/quiz/1"
            className="font-display mt-10 inline-flex min-h-[52px] min-w-[240px] items-center justify-center rounded-full bg-white px-12 text-[15px] font-bold uppercase tracking-[0.18em] text-[#4385f5] shadow-sm hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:mt-12 sm:min-w-[280px] sm:px-14 sm:text-[16px]"
          >
            ПРОЙТИ КВИЗ
          </Link>
        </div>
      </section>

      <section
        id="how"
        className="bg-white px-5 py-14 sm:px-8 sm:py-16 lg:px-14 lg:py-20"
      >
        <div className="mx-auto max-w-[1440px]">
          <h2 className="font-display text-left text-[clamp(1.35rem,3vw,2rem)] font-bold uppercase tracking-[0.12em] text-[#4385f5]">
            Как работает сервис
          </h2>
          <p className="mt-6 max-w-2xl text-left text-[15px] leading-relaxed text-neutral-600 sm:text-[16px]">
            Ответьте на несколько вопросов — мы подберём направление и формат
            отдыха в Краснодарском крае. Фронтенд-демо: данные моковые, без
            сервера.
          </p>
        </div>
      </section>
      <section id="places" className="sr-only" aria-hidden />
      <section id="cities" className="sr-only" aria-hidden />
    </>
  )
}
