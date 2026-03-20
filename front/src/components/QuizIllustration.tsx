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
    <div className="relative flex min-h-[280px] flex-1 items-center justify-end lg:min-h-[440px]">
      <div className="relative h-[min(58vw,540px)] w-full max-w-[680px] overflow-hidden lg:h-[540px] lg:max-w-none">
        <img
          src={src}
          alt={alt}
          className="absolute right-0 top-1/2 h-full w-[min(240%,1100px)] max-w-none object-cover select-none"
          style={{
            objectPosition: objectPosition,
            transform: `translateY(-50%) scale(${scale})`,
            transformOrigin: 'center right',
          }}
          draggable={false}
        />
      </div>
    </div>
  )
}
