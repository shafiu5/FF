// Amounts are treated as tax-inclusive; this extracts the tax portion
// already included in them (e.g. MVR 105 total at 5% tax => MVR 5 tax).
export function extractTax(amount: number, taxPercent: number): number {
  if (!taxPercent) return 0
  return (amount * taxPercent) / (100 + taxPercent)
}

export type IncomeTaxBreakdown = {
  taxFreeAmount: number
  taxableAmount: number
  tax: number
}

// An income entry with line items (e.g. a "whole file" import) can be a mix
// of tax-free and taxable passengers within one entry — tax must be
// computed only on the taxable lines' share, not the entry's full amount.
// Entries without lines fall back to their own is_tax_free flag.
export function computeIncomeTaxBreakdown(
  entryAmount: number,
  entryIsTaxFree: boolean,
  lines: { amount: number; is_tax_free: boolean }[] | undefined,
  taxPercent: number
): IncomeTaxBreakdown {
  if (lines && lines.length > 0) {
    const taxFreeAmount = lines.filter((l) => l.is_tax_free).reduce((sum, l) => sum + l.amount, 0)
    const taxableAmount = lines.filter((l) => !l.is_tax_free).reduce((sum, l) => sum + l.amount, 0)
    return { taxFreeAmount, taxableAmount, tax: extractTax(taxableAmount, taxPercent) }
  }
  if (entryIsTaxFree) {
    return { taxFreeAmount: entryAmount, taxableAmount: 0, tax: 0 }
  }
  return { taxFreeAmount: 0, taxableAmount: entryAmount, tax: extractTax(entryAmount, taxPercent) }
}
