import * as XLSX from 'xlsx'

export type ParsedSheet = {
  headers: string[]
  rows: string[][]
}

export async function parseWorkbookFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][]
  const [headerRow, ...dataRows] = raw
  const headers = (headerRow ?? []).map((h) => String(h).trim())
  const rows = dataRows
    .filter((r) => r.some((cell) => String(cell).trim() !== ''))
    .map((r) => headers.map((_, i) => String(r[i] ?? '').trim()))
  return { headers, rows }
}

export type ColumnMapping = {
  date: number | null
  amount: number | null
  reference: number | null
  description: number | null
  name: number | null
}

export const EMPTY_MAPPING: ColumnMapping = {
  date: null,
  amount: null,
  reference: null,
  description: null,
  name: null,
}

export type ParsedIncomeRow = {
  date: string
  amount: number
  reference: string
  description: string
  name: string
  isTaxFree: boolean
  include: boolean
}

export type OmitRuleLike = { reference: string; contact: string }

// A row's single mapped grouping-key value (reference OR contact column,
// whichever the file has) is checked against both saved fields, since a
// saved omit-list entry might have been entered as either one.
export function matchesOmitRule(value: string, omitRules: OmitRuleLike[]): boolean {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  return omitRules.some(
    (r) => r.reference.trim().toLowerCase() === normalized || r.contact.trim().toLowerCase() === normalized
  )
}

function normalizeDate(raw: string): string {
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, '')
  const n = Number(cleaned)
  return isNaN(n) ? 0 : n
}

export type FieldKey = 'date' | 'amount' | 'reference' | 'description' | 'name'

const FIELD_KEYWORDS: Record<FieldKey, string[]> = {
  date: ['date'],
  amount: ['amount', 'amt', 'value', 'total', 'credit', 'price', 'fare'],
  reference: ['reference', 'ref', 'invoice', 'txn', 'transaction id', 'contact', 'phone'],
  description: ['description', 'desc', 'narration', 'details', 'particulars', 'remarks'],
  name: ['name', 'passenger', 'customer'],
}

export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { ...EMPTY_MAPPING }
  ;(Object.keys(FIELD_KEYWORDS) as FieldKey[]).forEach((field) => {
    const idx = headers.findIndex((h) =>
      FIELD_KEYWORDS[field].some((kw) => h.toLowerCase().includes(kw))
    )
    if (idx !== -1) mapping[field] = idx
  })
  return mapping
}

const MAPPING_STORAGE_KEY = 'vessel-finance:income-import-mapping'
const ALL_FIELDS: FieldKey[] = ['date', 'amount', 'reference', 'description', 'name']

export function saveMappingPreference(headers: string[], mapping: ColumnMapping): void {
  const byName: Partial<Record<FieldKey, string>> = {}
  ALL_FIELDS.forEach((field) => {
    const idx = mapping[field]
    if (idx != null) byName[field] = headers[idx]
  })
  window.localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(byName))
}

export function loadMappingPreference(headers: string[]): ColumnMapping | null {
  const raw = window.localStorage.getItem(MAPPING_STORAGE_KEY)
  if (!raw) return null
  try {
    const byName = JSON.parse(raw) as Partial<Record<FieldKey, string>>
    const mapping: ColumnMapping = { ...EMPTY_MAPPING }
    let found = false
    ALL_FIELDS.forEach((field) => {
      const name = byName[field]
      if (!name) return
      const idx = headers.indexOf(name)
      if (idx !== -1) {
        mapping[field] = idx
        found = true
      }
    })
    return found ? mapping : null
  } catch {
    return null
  }
}

// `fallbackDate` fills in rows/groups when the file has no date column at
// all (e.g. a single-trip passenger manifest) — the whole file shares one
// date entered by the user instead.
export function buildIncomeRows(
  sheet: ParsedSheet,
  mapping: ColumnMapping,
  omitRules: OmitRuleLike[],
  fallbackDate = ''
): ParsedIncomeRow[] {
  return sheet.rows.map((row) => {
    const reference = mapping.reference != null ? row[mapping.reference] ?? '' : ''
    return {
      date: normalizeDate(mapping.date != null ? row[mapping.date] ?? '' : '') || fallbackDate,
      amount: parseAmount(mapping.amount != null ? row[mapping.amount] ?? '' : ''),
      reference,
      description: mapping.description != null ? row[mapping.description] ?? '' : '',
      name: mapping.name != null ? row[mapping.name] ?? '' : '',
      isTaxFree: matchesOmitRule(reference, omitRules),
      include: true,
    }
  })
}

export type GroupedIncomeRow = {
  reference: string
  date: string
  amount: number
  passengerCount: number
  description: string
  isTaxFree: boolean
  include: boolean
}

// Groups rows that share the same reference/contact into one income entry —
// for passenger manifests where every row is one seat, not one transaction.
// Rows with no reference value are left as their own single-row group.
export function groupIncomeRowsByReference(rows: ParsedIncomeRow[]): GroupedIncomeRow[] {
  const order: string[] = []
  const groups = new Map<string, ParsedIncomeRow[]>()
  rows.forEach((r, i) => {
    const key = r.reference.trim() || `__row_${i}`
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(r)
  })
  return order.map((key) => {
    const group = groups.get(key)!
    const names = group.map((r) => r.name.trim()).filter(Boolean)
    const description =
      names.length > 2
        ? `${names[0]}, ${names[1]} +${names.length - 2} more`
        : names.length > 0
          ? names.join(', ')
          : group[0].description || (group.length > 1 ? `${group.length} passengers` : '')
    return {
      reference: group[0].reference,
      date: group[0].date,
      amount: group.reduce((sum, r) => sum + r.amount, 0),
      passengerCount: group.length,
      description,
      isTaxFree: group[0].isTaxFree,
      include: true,
    }
  })
}
