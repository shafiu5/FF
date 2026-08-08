// Profit margin as a percentage of income, not of expense. Undefined
// (null) when there's no income to divide by, rather than showing a
// misleading 0% or -Infinity%.
export function profitMargin(income: number, expense: number): number | null {
  if (income <= 0) return null
  return ((income - expense) / income) * 100
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}
