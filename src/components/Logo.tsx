'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function Logo() {
  const pathname = usePathname()
  if (pathname.startsWith('/settings')) return null

  return (
    <Link
      href="/dashboard"
      className="print:hidden fixed top-3 right-3 z-30 transition-opacity hover:opacity-80"
    >
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
