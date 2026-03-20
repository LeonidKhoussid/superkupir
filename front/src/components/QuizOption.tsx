type Props = {
  label: string
  selected: boolean
  onSelect: () => void
}

export function QuizOption({ label, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="group flex w-full max-w-[520px] items-center gap-4 rounded-none border-0 bg-transparent p-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
    >
      <span
        className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[10px] bg-white shadow-sm sm:h-[52px] sm:w-[52px] sm:rounded-[12px]"
        aria-hidden
      >
        {selected ? (
          <svg
            width="28"
            height="22"
            viewBox="0 0 28 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-[#3b82f6]"
          >
            <path
              d="M2 11.5L9.5 19L26 2"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span className="font-display text-[15px] font-bold uppercase leading-tight tracking-[0.08em] text-white sm:text-[17px] sm:tracking-[0.1em]">
        {label}
      </span>
    </button>
  )
}
