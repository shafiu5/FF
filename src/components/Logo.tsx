import Link from 'next/link'
import Image from 'next/image'
import LiveIndicator from '@/components/LiveIndicator'

export default function Logo() {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <LiveIndicator />
      <Link href="/dashboard" className="shrink-0 transition-opacity hover:opacity-80">
        <Image
          src="/logo.png"
          alt="Furaaqu"
          width={4916}
          height={810}
          priority
          className="h-6 w-auto invert dark:invert-0"
        />
      </Link>
    </div>
  )
}
