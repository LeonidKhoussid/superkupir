type Props = {
  src: string
  objectPosition: string
  scale: number
  alt?: string
}

export function QuizIllustration({
  src,
  objectPosition,
  scale,
  alt = '',
}: Props) {
  return (
    <div className="relative flex min-h-[280px] w-full shrink-0 items-center justify-center lg:min-h-[440px] lg:w-auto lg:max-w-[min(42vw,420px)] xl:max-w-[min(38vw,480px)]">
      <div className="relative mx-auto h-[min(360px,48vh)] w-full max-w-[min(100%,320px)] px-2 sm:max-w-[380px] lg:mx-0 lg:h-[min(440px,50vh)] lg:max-w-none">
        <img
          src={src}
          alt={alt}
          className="mx-auto h-full w-full max-h-full object-contain object-center select-none"
          style={{
            objectPosition: objectPosition,
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'center center',
          }}
          draggable={false}
          decoding="async"
        />
      </div>
    </div>
  )
}
