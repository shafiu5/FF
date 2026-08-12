export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// First and last day of the current month, as the default period for
// date-filtered pages (expenses, income, tax reporting) instead of "all
// dates" — most reporting is done month by month.
export function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: toISODate(first), to: toISODate(last) }
}
