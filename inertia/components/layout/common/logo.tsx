import { Link } from '@inertiajs/react'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export function Logo({ className = '', size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  }

  return (
    <Link href="/dashboard" className={`flex items-center gap-2 ${className}`}>
      <div
        className={`${sizeClasses[size]} flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold`}
      >
        <span className="text-lg">J</span>
      </div>
      {showText && (
        <span className="text-xl font-semibold text-foreground">
          Juridic<span className="text-primary">AI</span>
        </span>
      )}
    </Link>
  )
}
