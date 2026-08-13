'use client'

import { useEffect, useRef, useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'
import { CalendarRange } from 'lucide-react'

type Props = {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}

function parseISODate(s: string): Date | undefined {
  if (!s) return undefined
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DateRangeFilter({ from, to, onFromChange, onToChange }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const range: DateRange = {
    from: parseISODate(from),
    to: parseISODate(to),
  }

  function handleSelect(next: DateRange | undefined) {
    if (!next?.from) {
      onFromChange('')
      onToChange('')
      return
    }
    if (range.from && !range.to) {
      // Second tap: completes the range (react-day-picker normalizes from <= to).
      onFromChange(toISODate(next.from))
      onToChange(toISODate(next.to ?? next.from))
      setOpen(false)
      return
    }
    // First tap: only take the start date and wait for the second tap.
    onFromChange(toISODate(next.from))
    onToChange('')
  }

  const label = range.from
    ? range.to
      ? `${formatDisplay(range.from)} – ${formatDisplay(range.to)}`
      : `${formatDisplay(range.from)} – select end date`
    : 'All dates'

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700"
      >
        <CalendarRange size={16} strokeWidth={1.75} />
        {label}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 shadow-lg text-gray-900 dark:text-gray-100">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={handleSelect}
            defaultMonth={range.from ?? new Date()}
          />
          {(from || to) && (
            <button
              type="button"
              onClick={() => {
                onFromChange('')
                onToChange('')
                setOpen(false)
              }}
              className="w-full text-center text-sm text-sky-600 dark:text-sky-400 py-1.5 border-t border-gray-100 dark:border-neutral-800 mt-1 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800 active:bg-gray-100 dark:active:bg-neutral-700"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
