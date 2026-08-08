'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Ship, Receipt, Wallet, Settings } from 'lucide-react'

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/vessels', label: 'Vessels', Icon: Ship },
  { href: '/expenses', label: 'Expenses', Icon: Receipt },
  { href: '/income', label: 'Income', Icon: Wallet },
  { href: '/settings', label: 'Settings', Icon: Settings },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 flex justify-around py-2">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 text-xs px-3 py-1 rounded-lg transition-colors ${
              active
                ? 'text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 active:bg-sky-100 dark:active:bg-sky-950/60'
                : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800 active:bg-gray-200 dark:active:bg-neutral-700'
            }`}
          >
            <Icon size={22} strokeWidth={1.75} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
