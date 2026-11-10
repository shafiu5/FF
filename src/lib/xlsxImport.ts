import * as XLSX from 'xlsx'

export type ParsedSheet = {
  headers: string[]
  rows: string[][]
}

export async function parseWorkbookFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer()
  // CSVs are decoded as UTF-8 text here: handed raw bytes, SheetJS guesses a
  // legacy codepage when there's no BOM and garbles characters like "·".
  const workbook = /\.csv$/i.test(file.name)
    ? XLSX.read(new TextDecoder('utf-8').decode(buffer), { type: 'string', cellDates: true })
    : XLSX.read(buffer, { type: 'array', cellDates: true })
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
  contact: number | null
  description: number | null
  name: number | null
  soldBy: number | null
}

export const EMPTY_MAPPING: ColumnMapping = {
  date: null,
  amount: null,
  reference: null,
  contact: null,
  description: null,
  name: null,
  soldBy: null,
}

export type ParsedIncomeRow = {
  date: string
  amount: number
  reference: string
  description: string
  name: string
  isTaxFree: boolean
  include: boolean
  // Set when the ticket was sold by an agent: `amount` is already net of
  // `agentDeduction` (0 = no deduction applied).
  agent: string
  agentDeduction: number
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

export type FieldKey = 'date' | 'amount' | 'reference' | 'contact' | 'description' | 'name' | 'soldBy'

const FIELD_KEYWORDS: Record<FieldKey, string[]> = {
  date: ['date'],
  amount: ['amount', 'amt', 'value', 'total', 'credit', 'price', 'fare'],
  reference: ['reference', 'ref', 'invoice', 'txn', 'transaction id', 'contact', 'phone'],
  contact: ['mobile', 'contact', 'phone'],
  description: ['description', 'desc', 'narration', 'details', 'particulars', 'remarks'],
  name: ['name', 'passenger', 'customer'],
  soldBy: ['sold by', 'seller', 'agent'],
}

export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { ...EMPTY_MAPPING }
  ;(Object.keys(FIELD_KEYWORDS) as FieldKey[]).forEach((field) => {
    // A lone "Contact"/"Phone" column is already taken as the reference
    // (older manifests), so only claim a separate contact column if there's
    // another one.
    const idx = headers.findIndex(
      (h, i) =>
        !(field === 'contact' && i === mapping.reference) &&
        FIELD_KEYWORDS[field].some((kw) => h.toLowerCase().includes(kw))
    )
    if (idx !== -1) mapping[field] = idx
  })
  return mapping
}

// Agent sales are tagged like "Agent · Shibaan"; walk-ups say "Counter".
export function isAgentSale(soldBy: string): boolean {
  return /^agent\b/i.test(soldBy.trim())
}

const MAPPING_STORAGE_KEY = 'vessel-finance:income-import-mapping'
const ALL_FIELDS: FieldKey[] = ['date', 'amount', 'reference', 'contact', 'description', 'name', 'soldBy']

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
// `agentDeductionPerTicket` comes off every paid ticket whose "sold by" value
// is an agent (never below zero; free tickets are left alone).
// A row is tax-free if either its reference or its contact matches the omit
// list, since an entry there may have been saved as either.
export function buildIncomeRows(
  sheet: ParsedSheet,
  mapping: ColumnMapping,
  omitRules: OmitRuleLike[],
  fallbackDate = '',
  agentDeductionPerTicket = 0
): ParsedIncomeRow[] {
  return sheet.rows.map((row) => {
    const reference = mapping.reference != null ? row[mapping.reference] ?? '' : ''
    const contact = mapping.contact != null ? row[mapping.contact] ?? '' : ''
    const soldBy = mapping.soldBy != null ? row[mapping.soldBy] ?? '' : ''
    const gross = parseAmount(mapping.amount != null ? row[mapping.amount] ?? '' : '')
    const agentDeduction =
      isAgentSale(soldBy) && gross > 0 && agentDeductionPerTicket > 0
        ? Math.min(agentDeductionPerTicket, gross)
        : 0
    return {
      date: normalizeDate(mapping.date != null ? row[mapping.date] ?? '' : '') || fallbackDate,
      amount: gross - agentDeduction,
      reference,
      description: mapping.description != null ? row[mapping.description] ?? '' : '',
      name: mapping.name != null ? row[mapping.name] ?? '' : '',
      isTaxFree: matchesOmitRule(reference, omitRules) || matchesOmitRule(contact, omitRules),
      include: true,
      agent: agentDeduction > 0 ? soldBy.trim() : '',
      agentDeduction,
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
  agentDeduction: number
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
      agentDeduction: group.reduce((sum, r) => sum + r.agentDeduction, 0),
    }
  })
}
