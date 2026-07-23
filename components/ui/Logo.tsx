import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'reversed'
}

const SIZES = {
  sm: { icon: 24, text: 'text-lg' },
  md: { icon: 34, text: 'text-2xl' },
  lg: { icon: 44, text: 'text-3xl' },
} as const

export default function Logo({ size = 'md', variant = 'default' }: LogoProps) {
  const { icon, text } = SIZES[size]
  const iconSrc =
    variant === 'reversed'
      ? '/images/logo/zunio-symbol-reversed.svg'
      : '/images/logo/zunio-symbol.svg'
  const wordmarkColor = variant === 'reversed' ? 'text-brand-cream' : 'text-brand-emerald'

  return (
    <span className="inline-flex items-center gap-2">
      <Image src={iconSrc} alt="" width={icon} height={icon} priority />
      <span className={`font-display font-extrabold tracking-tight ${text} ${wordmarkColor}`}>
        zunio
      </span>
    </span>
  )
}
