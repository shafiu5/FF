const formatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMVR(amount: number): string {
  return `MVR ${formatter.format(amount)}`
}
