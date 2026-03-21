import { useEffect, useState } from 'react'
import { AUTH_MODAL_OPEN_EVENT } from '../features/auth/authModalEvents'
import { useAuthStore } from '../features/auth/authStore'
import { LoginModal } from './LoginModal'

type Props = {
  /** Landing hero uses deeper blue text on pill; catalog — синяя кнопка */
  variant?: 'on-hero' | 'on-quiz' | 'on-catalog'
  className?: string
}

export function LoginButton({ variant = 'on-quiz', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [modalKey, setModalKey] = useState(0)
  const user = useAuthStore((state) => state.user)
  const text =
    variant === 'on-hero'
      ? 'text-[#4385f5]'
      : variant === 'on-catalog'
        ? 'text-white'
        : 'text-[#3b82f6]'
  const label = user ? user.email : 'Войти'

  const surfaceClass =
    variant === 'on-catalog'
      ? 'rounded-full bg-kr-blue text-white shadow-sm hover:brightness-110 focus-visible:outline-kr-blue'
      : 'rounded-full bg-white shadow-none hover:brightness-95 focus-visible:outline-white'

  useEffect(() => {
    const handleOpenAuthModal = () => {
      setModalKey((k) => k + 1)
      setOpen(true)
    }

    window.addEventListener(AUTH_MODAL_OPEN_EVENT, handleOpenAuthModal)
    return () => window.removeEventListener(AUTH_MODAL_OPEN_EVENT, handleOpenAuthModal)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setModalKey((k) => k + 1)
          setOpen(true)
        }}
        title={user ? `Вы вошли как ${user.email}` : undefined}
        className={`inline-flex min-h-11 min-w-[120px] cursor-pointer items-center justify-center px-8 py-2.5 text-[15px] font-bold tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${surfaceClass} ${text} ${className}`}
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
