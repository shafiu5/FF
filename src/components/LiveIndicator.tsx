'use client'

import { useLiveState } from '@/lib/liveStatus'

const LABELS = {
  live: { text: 'Live', hint: 'Live — this page updates automatically', dot: 'bg-emerald-500' },
  connecting: { text: 'Connecting', hint: 'Connecting to live updates…', dot: 'bg-amber-500' },
  offline: { text: 'Offline', hint: 'Live updates are off — reload to catch up', dot: 'bg-gray-400' },
} as const

export default function LiveIndicator() {
  const state = useLiveState()
  if (state === 'none') return null
  const { text, hint, dot } = LABELS[state]

  return (
    <span
      title={hint}
      className="print:hidden flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400"
    >
      <span className="relative flex h-2 w-2">
        {state === 'live' && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      {text}
    </span>
  )
}
