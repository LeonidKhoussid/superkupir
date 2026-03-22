import { Link } from 'react-router-dom'
import { LandingHeroMedia } from '../components/LandingHeroMedia'
import { LandingPlacesCarousel } from '../components/LandingPlacesCarousel'
import { LoginButton } from '../components/LoginButton'

const HERO_LOGO_SRC = 'https://storage.yandexcloud.net/hackathon-ss/Group%201.svg'

export function LandingPage() {
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
        <header className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-14">
          <Link
            to="/"
            className="flex shrink-0 items-center drop-shadow-md"
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
            className="hidden flex-1 justify-center gap-8 text-[14px] ml-32 font-semibold tracking-wide text-white/95 drop-shadow-sm md:flex lg:gap-14 lg:text-[20px]"
            aria-label="Основная навигация"
          >
            <Link to="/places" className="hover:opacity-90">
              Места
            </Link>
            <Link to="/impressions" className="hover:opacity-90">
              Впечатления
            </Link>
            <Link to="/myroutes" className="hover:opacity-90">
              Мои Туры
            </Link>
          </nav>
          <LoginButton variant="on-hero" />
        </header>

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
        className="bg-white px-5 py-14 sm:px-8 sm:py-16 lg:px-14 lg:py-20 flex gap-12"
      >
        <div className="mx-auto max-w-[1440px]">
          <h2 className="font-display text-left text-[clamp(1.35rem,3vw,2rem)] font-bold uppercase tracking-[0.12em] text-[#4385f5]">
            Как работает сервис
          </h2>
          <p className="mt-6 max-w-2xl text-left text-[15px] leading-relaxed text-neutral-600 sm:text-[16px] font-bold">
          Это сервис для планирования путешествий, который строится вокруг интересных мест и впечатлений, а не отелей. Пользователь выбирает локации или типы опыта, которые ему близки, а система сама собирает на их основе готовый маршрут — с логистикой, подходящим жильём и ресторанами поблизости.
Сервис помогает туристу тем, что избавляет от сложного поиска
и планирования: он предлагает уже проверенные
и персонализированные маршруты, учитывая предпочтения пользователя и опыт других людей. В результате человек получает не просто набор точек, а цельное путешествие, которое удобно организовано и заранее понятно по формату
и атмосфере.
          </p>
        </div>
        <img src="https://storage.yandexcloud.net/hackathon-ss/howItWorksImg.png"/>
      </section>
      <section id="cities" className="sr-only" aria-hidden />
    </>
  )
}
