import * as XLSX from 'xlsx'

export type DetailedIncomeRow = {
  date: string
  vessel: string
  reference: string
  description: string
  amount: number
  taxFreeAmount: number
  taxableAmount: number
  tax: number
}

export type DetailedExpenseRow = {
  date: string
  vessel: string
  category: string
  vendor: string
  amount: number
  hasTax: boolean
  taxAmount: number
  source: string
}

// One row per transaction (matching what the app itself shows — a
// multi-passenger import stays a single row, not one row per passenger).
// When excludeTaxFree is on, income rows report only their taxable
// portion, and rows that are entirely tax-free (taxableAmount 0) are
// dropped rather than shown as zero.
export function exportDetailedReport(opts: {
  filename: string
  income: DetailedIncomeRow[]
  expenses: DetailedExpenseRow[]
  excludeTaxFree: boolean
}) {
  const { filename, income, expenses, excludeTaxFree } = opts

  const incomeRows = excludeTaxFree ? income.filter((i) => i.taxableAmount > 0) : income
  const incomeSheetData = [
    ['Date', 'Vessel', 'Reference', 'Description', 'Amount', 'Tax-free amount', 'Taxable amount', 'Tax'],
    ...incomeRows.map((i) => [
      i.date,
      i.vessel,
      i.reference,
      i.description,
      excludeTaxFree ? i.taxableAmount : i.amount,
      excludeTaxFree ? 0 : i.taxFreeAmount,
      i.taxableAmount,
      i.tax,
    ]),
    [],
    [
      'Total',
      '',
      '',
      '',
      incomeRows.reduce((s, i) => s + (excludeTaxFree ? i.taxableAmount : i.amount), 0),
      excludeTaxFree ? 0 : incomeRows.reduce((s, i) => s + i.taxFreeAmount, 0),
      incomeRows.reduce((s, i) => s + i.taxableAmount, 0),
      incomeRows.reduce((s, i) => s + i.tax, 0),
    ],
  ]

  const expenseSheetData = [
    ['Date', 'Vessel', 'Category', 'Vendor', 'Amount', 'Has tax', 'Tax amount', 'Source'],
    ...expenses.map((e) => [e.date, e.vessel, e.category, e.vendor, e.amount, e.hasTax ? 'Yes' : 'No', e.taxAmount, e.source]),
    [],
    ['Total', '', '', '', expenses.reduce((s, e) => s + e.amount, 0), '', expenses.reduce((s, e) => s + e.taxAmount, 0), ''],
  ]

  const incomeSheet = XLSX.utils.aoa_to_sheet(incomeSheetData)
  incomeSheet['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]

  const expenseSheet = XLSX.utils.aoa_to_sheet(expenseSheetData)
  expenseSheet['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 14 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, incomeSheet, 'Income')
  XLSX.utils.book_append_sheet(workbook, expenseSheet, 'Expenses')
  XLSX.writeFile(workbook, filename)
}
