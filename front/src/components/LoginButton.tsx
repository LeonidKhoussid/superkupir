import { useState } from 'react'
import { useAuthStore } from '../features/auth/authStore'
import { LoginModal } from './LoginModal'

type Props = {
  /** Landing hero uses deeper blue text on pill */
  variant?: 'on-hero' | 'on-quiz'
  className?: string
}

export function LoginButton({ variant = 'on-quiz', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [modalKey, setModalKey] = useState(0)
  const user = useAuthStore((state) => state.user)
  const text =
    variant === 'on-hero'
      ? 'text-[#4385f5]'
      : 'text-[#3b82f6]'
  const label = user ? user.email : 'Войти'

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setModalKey((k) => k + 1)
          setOpen(true)
        }}
        title={user ? `Вы вошли как ${user.email}` : undefined}
        className={`inline-flex min-h-11 min-w-[120px] cursor-pointer items-center justify-center rounded-full bg-white px-8 py-2.5 text-[15px] font-bold tracking-wide ${text} shadow-none transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${className}`}
      >
        <span className="max-w-[160px] truncate">{label}</span>
      </button>
      <LoginModal
        key={modalKey}
        open={open}
        onClose={() => setOpen(false)}
        initialPanel={user ? 'account' : 'login'}
      />
    </>
  )
}
