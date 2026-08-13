'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function Logo() {
  const pathname = usePathname()
  if (pathname.startsWith('/settings')) return null

  return (
    <div className="print:hidden fixed top-0 inset-x-0 z-30 pointer-events-none">
      <div className="max-w-2xl mx-auto px-4 py-3 flex justify-end">
        <Link href="/dashboard" className="pointer-events-auto transition-opacity hover:opacity-80">
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
    </div>
  )
}
