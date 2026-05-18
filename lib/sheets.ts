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
const CHAT_GID = '398958693'

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
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheet)}&t=${Date.now()}`
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
  return fetchWaveRangeGViz(wave)
}

async function fetchWaveRangeGViz(wave: number, range?: string): Promise<any[][]> {
  const rangeQuery = range ? `&range=${encodeURIComponent(range)}` : ''
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&${getWaveSheetQuery(wave)}${rangeQuery}&t=${Date.now()}`
  try {
    const text = await (await fetch(url, { cache: 'no-store' })).text()
    const js = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
    if (!js) return []
    const rows: any[] = JSON.parse(js)?.table?.rows ?? []
    return rows.map(r =>
      (r.c ?? []).map((cell: any) => (cell?.v != null ? String(cell.v) : ''))
    )
  } catch (e) {
    console.error(`fetchWaveGViz(${wave}${range ? `, ${range}` : ''}):`, e)
    return []
  }
}

async function fetchGidRangeGViz(gid: string, range?: string): Promise<any[][]> {
  const rangeQuery = range ? `&range=${encodeURIComponent(range)}` : ''
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}${rangeQuery}&t=${Date.now()}`
  try {
    const text = await (await fetch(url, { cache: 'no-store' })).text()
    const js = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
    if (!js) return []
    const rows: any[] = JSON.parse(js)?.table?.rows ?? []
    return rows.map(r =>
      (r.c ?? []).map((cell: any) => (cell?.f != null ? String(cell.f) : cell?.v != null ? String(cell.v) : ''))
    )
  } catch (e) {
    console.error(`fetchGidRangeGViz(${gid}${range ? `, ${range}` : ''}):`, e)
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
    .slice(4, 16)
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
  currentBalance: number
  betTarget: string
  betAmount: number
  betReturn: number
  kingAmount: number
  kingResult: string
  islands: Array<{ name: string; amount: number; returnAmount: number }>
  adjustments: Array<{ label: string; amount: number }>
  hasInput: boolean
  hasBetInput: boolean
  hasBidInput: boolean
}

export async function fetchWaveInputs(wave: number): Promise<{ rows: WaveInputRow[]; king: number | null; kingDisaster: number | null }> {
  const rows = await fetchWaveRangeGViz(wave, 'A5:U16')
  const numberAt = (row: string[], idx: number) => parseFloat(String(row[idx] ?? 0)) || 0
  const textAt = (row: string[], idx: number) => String(row[idx] ?? '').trim()
  const isFilled = (value: string) => value !== '' && value !== '-'
  const isAreaName = (value: string) => /^[ABC](?:[1-9])$/.test(value)
  const parsedRows = rows
    // Exact input range A5:U16. Do not read lower tables; they also contain 1-12.
    .filter(r => {
      const b = parseInt(textAt(r, 0))
      return !isNaN(b) && b >= 1 && b <= 12
    })
    .map(r => {
      const islandInputs = [
        { name: textAt(r, 7), amountText: textAt(r, 8), returnText: textAt(r, 9), amount: numberAt(r, 8), returnAmount: numberAt(r, 9) },
        { name: textAt(r, 10), amountText: textAt(r, 11), returnText: textAt(r, 12), amount: numberAt(r, 11), returnAmount: numberAt(r, 12) },
        { name: textAt(r, 13), amountText: textAt(r, 14), returnText: textAt(r, 15), amount: numberAt(r, 14), returnAmount: numberAt(r, 15) },
      ]
      const islands = islandInputs.map(({ name, amount, returnAmount }) => ({
        name,
        amount,
        returnAmount,
      }))
      const adjustments = [
        { label: 'MiniGame', amount: numberAt(r, 17) },
        { label: 'MoneyDrop', amount: numberAt(r, 18) },
        { label: 'Event', amount: numberAt(r, 19) },
      ].filter(x => x.amount)
      const betTarget = textAt(r, 2)
      const betAmount = numberAt(r, 3)
      const betAmountText = textAt(r, 3)
      const kingAmount = numberAt(r, 5)
      const kingAmountText = textAt(r, 5)
      // Submission status should mirror sheet ownership of the input cells:
      // Bet saved = C and D contain data. Bid saved = king bid F or any H:I/K:L/N:O pair.
      const hasBetInput = isFilled(betTarget) && isFilled(betAmountText)
      const hasKingBidInput = isFilled(kingAmountText)
      const hasIslandBidInput = islandInputs.some(x => isFilled(x.name) && isAreaName(x.name) && isFilled(x.amountText))
      const hasBidInput = hasKingBidInput || hasIslandBidInput
      const hasInput = Boolean(
        hasBetInput || hasBidInput
      )
      return {
        baan: parseInt(textAt(r, 0)),
        balance: numberAt(r, 1),
        currentBalance: numberAt(r, 20) || numberAt(r, 1),
        betTarget,
        betAmount,
        betReturn: numberAt(r, 4),
        kingAmount,
        kingResult: textAt(r, 6),
        islands,
        adjustments,
        hasInput,
        hasBetInput,
        hasBidInput,
      }
    })
  const parsed = Array.from(
    parsedRows.reduce((byBaan, row) => byBaan.set(row.baan, row), new Map<number, WaveInputRow>()).values()
  ).sort((a, b) => a.baan - b.baan)
  const infoRows = await fetchWaveRangeGViz(wave, 'H20:H22')
  let king: number | null = parseInt(infoRows?.[0]?.[0] ?? '')
  let kingDisaster: number | null = parseInt(infoRows?.[2]?.[0] ?? '')
  if (isNaN(king)) king = null
  if (isNaN(kingDisaster)) kingDisaster = null
  return { rows: parsed, king, kingDisaster }
}

export interface GroupChatMessage {
  id: string
  row: number
  timestamp: string
  sender: string
  baan: number | null
  readCount: number
  message: string
}

export type GroupChatActor = number | 'admin'

export async function fetchGroupChatMessages(): Promise<GroupChatMessage[]> {
  const rows = await fetchGidRangeGViz(CHAT_GID, 'A2:E')
  const messages: GroupChatMessage[] = []
  for (let i = 0; i < rows.length; i++) {
    const dateText = String(rows[i]?.[0] ?? '').trim()
    const timeText = String(rows[i]?.[1] ?? '').trim()
    const baanRaw = String(rows[i]?.[2] ?? '').trim()
    const message = String(rows[i]?.[3] ?? '').trim()
    const readCount = parseInt(String(rows[i]?.[4] ?? ''))
    if (!dateText && !timeText && !baanRaw && !message) break
    const baan = parseInt(baanRaw)
    const isAdmin = baanRaw.toLowerCase() === 'admin'
    const timestamp = [dateText, timeText].filter(Boolean).join(' ')
    messages.push({
      id: `${i + 2}-${dateText}-${timeText}-${baanRaw}-${message}`,
      row: i + 2,
      timestamp,
      sender: isAdmin ? 'Admin' : baanRaw,
      baan: !isNaN(baan) && baan >= 1 && baan <= 12 ? baan : null,
      readCount: Number.isFinite(readCount) ? Math.max(0, Math.min(12, readCount)) : 0,
      message,
    })
  }
  return messages
}

export async function sendGroupChatMessage(actor: GroupChatActor, message: string): Promise<{ ok: boolean; message?: string }> {
  if (!GAS_URL) return { ok: false, message: 'GAS URL not configured' }
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'writeChat', actor, baan: actor, message }),
    })
    return { ok: true, message: 'Sent' }
  } catch (e) {
    console.error('sendGroupChatMessage:', e)
    return { ok: false, message: String(e) }
  }
}

export async function markGroupChatRead(actor: GroupChatActor, rows: number[]): Promise<{ ok: boolean; message?: string }> {
  if (!GAS_URL || !rows.length) return { ok: false, message: 'No rows to mark' }
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'markChatRead', actor, rows }),
    })
    return { ok: true }
  } catch (e) {
    console.error('markGroupChatRead:', e)
    return { ok: false, message: String(e) }
  }
}

export function parseAreaTokens(value: string): string[] {
  const matches = String(value || '').toUpperCase().match(/KING|[ABC]\s*\d+/g) ?? []
  return Array.from(new Set(matches.map(token => token.replace(/\s+/g, ''))))
}

export interface LieHistoryCell {
  baan: number
  promises: string[]
  actual: string[]
}

export async function fetchLieHistoryWave(wave: number): Promise<LieHistoryCell[]> {
  const rows = await fetchWaveRangeGViz(wave, 'R20:U31')
  return rows.slice(0, 12).map((row, i) => ({
    baan: i + 1,
    promises: parseAreaTokens(String(row?.[0] ?? '')),
    actual: parseAreaTokens(String(row?.[3] ?? '')),
  }))
}

// ── READ: King info for a wave ─────────────────────────────
// INFO section in sheet: H20 = current king, H22 = king disaster
export async function fetchWaveInfo(wave: number): Promise<{ king: number | null; disaster: number | null }> {
  const rows = await fetchWaveGViz(wave)
  let king: number | null = parseInt(rows?.[19]?.[7] ?? '')
  let disaster: number | null = parseInt(rows?.[21]?.[7] ?? '')
  if (isNaN(king)) king = null
  if (isNaN(disaster)) disaster = null
  const firstNumber = (row: string[]) => {
    for (const idx of [7, 6, 5, 4, 3, 2, 1, 0]) {
      const v = parseInt(String(row[idx] ?? ''))
      if (!isNaN(v)) return v
    }
    return null
  }
  for (const row of rows) {
    if (king != null && disaster != null) break
    const joined = row.join(' ').toLowerCase()
    if (joined.includes('king') && king == null) {
      const v = firstNumber(row)
      if (v != null) king = v
    }
    if (joined.includes('disaster') && disaster == null) {
      const v = firstNumber(row)
      if (v != null) disaster = v
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
