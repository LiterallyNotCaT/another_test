// ============================================================
// GOOGLE SHEETS — Read & Write
// ============================================================
// READ  : Google Visualization API (no auth needed, sheet must be public/shared)
// WRITE : Google Apps Script Web App (doPost) — see GAS code below
// ============================================================

import { SHEET_ID, getWaveSheetQuery } from './constants'

export { SHEET_ID } from './constants'

// Your deployed GAS Web App URL — set this after deploying the script
// See STEP 2 in the setup guide
const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL ?? ''

// ── Column map (1-indexed, for reference) ──────────────────
// Wave sheet rows 5–16 = บ้าน 1–12
// Col A (1)  = บ้านที่
// Col B (2)  = เงินก่อน (calculated, read-only)
// Col C (3)  = Bet: บ้านที่เดิมพัน
// Col D (4)  = Bet: จำนวนเงิน
// Col F (6)  = King bid: จำนวนเงิน
// Col H (8)  = เกาะ 1: ชื่อเกาะ
// Col I (9)  = เกาะ 1: จำนวนเงิน
// Col K (11) = เกาะ 2: ชื่อเกาะ
// Col L (12) = เกาะ 2: จำนวนเงิน
// Col N (14) = เกาะ 3: ชื่อเกาะ
// Col O (15) = เกาะ 3: จำนวนเงิน

// ── GViz helper ────────────────────────────────────────────
async function fetchGViz(sheet: string): Promise<any[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheet)}`
  try {
    const text = await (await fetch(url, { cache: 'no-store' })).text()
    const js = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
    if (!js) return []
    const rows: any[] = JSON.parse(js)?.table?.rows ?? []
    return rows.map(r =>
      (r.c ?? []).map((cell: any) => (cell?.v != null ? String(cell.v) : ''))
    )
  } catch (e) {
    console.error(`fetchGViz(${sheet}):`, e)
    return []
  }
}

async function fetchWaveGViz(wave: number): Promise<any[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&${getWaveSheetQuery(wave)}`
  try {
    const text = await (await fetch(url, { cache: 'no-store' })).text()
    const js = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
    if (!js) return []
    const rows: any[] = JSON.parse(js)?.table?.rows ?? []
    return rows.map(r =>
      (r.c ?? []).map((cell: any) => (cell?.v != null ? String(cell.v) : ''))
    )
  } catch (e) {
    console.error(`fetchWaveGViz(${wave}):`, e)
    return []
  }
}

// ── READ: Morning scoreboard ────────────────────────────────
export async function fetchMorningScores() {
  const rows = await fetchGViz('Recap Morning')
  return rows
    .filter(r => !isNaN(parseInt(r[0])))
    .map(r => ({
      baan:    parseInt(r[0]),
      morning: parseFloat(r[1]) || 0,
      betray:  parseFloat(r[2]) || 0,
      total:   parseFloat(r[3]) || 0,
    }))
}

// ── READ: Total scores ──────────────────────────────────────
export async function fetchTotalScores() {
  const rows = await fetchGViz('TOTALSCORE')
  return rows
    .filter(r => !isNaN(parseInt(r[0])) && parseInt(r[0]) >= 1)
    .map(r => ({
      baan:  parseInt(r[0]),
      score: parseFloat(r[1]) || 0,
      rank:  parseInt(r[2])   || 0,
    }))
}

// ── READ: Single wave data ─────────────────────────────────
// Returns balance for each house in that wave
export async function fetchWaveBalances(wave: number) {
  const rows = await fetchWaveGViz(wave)
  // Data rows start at index 4 (row 5 in sheet = index 4 after 0-based GViz)
  // Filter rows where col A is a number 1-12
  return rows
    .filter(r => {
      const b = parseInt(r[0])
      return !isNaN(b) && b >= 1 && b <= 12
    })
    .map(r => ({
      baan:    parseInt(r[0]),
      balance: parseFloat(r[1]) || 0,   // Col B = เงินก่อน
    }))
}

export interface WaveInputRow {
  baan: number
  balance: number
  betTarget: string
  betAmount: number
  betReturn: number
  kingAmount: number
  islands: Array<{ name: string; amount: number; returnAmount: number }>
  adjustments: Array<{ label: string; amount: number }>
  hasInput: boolean
}

export async function fetchWaveInputs(wave: number): Promise<{ rows: WaveInputRow[]; kingDisaster: number | null }> {
  const rows = await fetchWaveGViz(wave)
  const numberAt = (row: string[], idx: number) => parseFloat(String(row[idx] ?? 0)) || 0
  const textAt = (row: string[], idx: number) => String(row[idx] ?? '').trim()
  const parsedRows = rows
    .filter(r => {
      const b = parseInt(textAt(r, 0))
      return !isNaN(b) && b >= 1 && b <= 12
    })
    .map(r => {
      const islands = [
        { name: textAt(r, 7), amount: numberAt(r, 8), returnAmount: numberAt(r, 9) },
        { name: textAt(r, 10), amount: numberAt(r, 11), returnAmount: numberAt(r, 12) },
        { name: textAt(r, 13), amount: numberAt(r, 14), returnAmount: numberAt(r, 15) },
      ]
      const adjustments = [
        { label: textAt(r, 17), amount: numberAt(r, 18) },
        { label: textAt(r, 19), amount: numberAt(r, 20) },
      ].filter(x => x.label || x.amount)
      const betTarget = textAt(r, 2)
      const betAmount = numberAt(r, 3)
      const kingAmount = numberAt(r, 5)
      const hasInput = Boolean(
        betTarget || betAmount || kingAmount ||
        islands.some(x => x.name || x.amount)
      )
      return {
        baan: parseInt(textAt(r, 0)),
        balance: numberAt(r, 1),
        betTarget,
        betAmount,
        betReturn: numberAt(r, 4),
        kingAmount,
        islands,
        adjustments,
        hasInput,
      }
    })
  const parsed = Array.from(
    parsedRows.reduce((byBaan, row) => byBaan.set(row.baan, row), new Map<number, WaveInputRow>()).values()
  ).sort((a, b) => a.baan - b.baan)
  let kingDisaster: number | null = parseInt(rows?.[21]?.[7] ?? '')
  if (isNaN(kingDisaster)) kingDisaster = null
  return { rows: parsed, kingDisaster }
}

// ── READ: King info for a wave ─────────────────────────────
// INFO section in sheet: H20 = current king, H22 = king disaster
export async function fetchWaveInfo(wave: number): Promise<{ king: number | null; disaster: number | null }> {
  const rows = await fetchWaveGViz(wave)
  let king: number | null = parseInt(rows?.[19]?.[7] ?? '')
  let disaster: number | null = parseInt(rows?.[21]?.[7] ?? '')
  if (isNaN(king)) king = null
  if (isNaN(disaster)) disaster = null
  for (const row of rows) {
    if (king != null && disaster != null) break
    if (String(row[4] ?? '').includes('KING')) {
      const v = parseInt(row[5])
      if (!isNaN(v) && king == null) king = v
    }
    if (String(row[4] ?? '').toLowerCase().includes('disaster')) {
      const v = parseInt(row[5])
      if (!isNaN(v) && disaster == null) disaster = v
    }
  }
  return { king, disaster }
}

// ── WRITE payload type ─────────────────────────────────────
export interface WritePayload {
  action: 'writeWave'
  wave:   number
  baan:   number
  // Bet game
  betTarget?: number   // Col C: บ้านที่เดิมพัน (1-12)
  betAmount?: number   // Col D: จำนวนเงิน
  // King bid
  kingAmount?: number  // Col F
  kingDisaster?: number | null // INFO section H22
  // Islands (up to 3)
  islands?: Array<{
    name:   string   // e.g. "A1", "B3"
    amount: number
  }>
}

// ── WRITE: Send submission to sheet via GAS ────────────────
export async function writeToSheet(payload: WritePayload): Promise<{ ok: boolean; message?: string }> {
  if (!GAS_URL) {
    console.warn('NEXT_PUBLIC_GAS_URL not set - submission not sent to sheet')
    return { ok: false, message: 'GAS URL not configured' }
  }
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
    return { ok: true, message: 'Sent to Google Sheet' }
  } catch (e) {
    console.error('writeToSheet:', e)
    return { ok: false, message: String(e) }
  }
}
