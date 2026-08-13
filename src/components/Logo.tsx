import Link from 'next/link'
import Image from 'next/image'

export default function Logo() {
  return (
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
  )
}
