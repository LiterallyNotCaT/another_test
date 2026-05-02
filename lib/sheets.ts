// ============================================================
// GOOGLE SHEETS — Read & Write
// ============================================================
import { SHEET_ID, getWaveSheetQuery } from './constants'

export { SHEET_ID } from './constants'

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL ?? ''

async function fetchGViz(sheet: string): Promise<any[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&${sheet}`
  const res = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)
  if (!match) return []
  try {
    const json = JSON.parse(match[1])
    return json.table?.rows?.map((r: any) => r.c?.map((c: any) => c?.v ?? null)) ?? []
  } catch { return [] }
}

export async function fetchWaveInputs(wave: number) {
  const rows = await fetchGViz(getWaveSheetQuery(wave))
  const data = []
  for (let i = 4; i < Math.min(rows.length, 16); i++) {
    const r = rows[i] || []
    const b = parseInt(r[0])
    if (isNaN(b) || b < 1 || b > 12) continue
    data.push({
      baan: b,
      balanceBefore: parseFloat(r[1]) || 0,
      betTarget: parseInt(r[2]) || null,
      betAmount: parseFloat(r[3]) || 0,
      kingAmount: parseFloat(r[5]) || 0,
      island1: { name: String(r[7] || ''), amount: parseFloat(r[8]) || 0 },
      island2: { name: String(r[10] || ''), amount: parseFloat(r[11]) || 0 },
      island3: { name: String(r[13] || ''), amount: parseFloat(r[14]) || 0 },
    })
  }
  let king: number | null = null
  let disaster: number | null = null
  for (let i = 18; i < rows.length; i++) {
    const row = rows[i] || []
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
  return { data, king, disaster }
}

export interface WritePayload {
  action: 'writeWave'
  wave:   number
  baan:   number
  betTarget?: number
  betAmount?: number
  kingAmount?: number
  kingDisaster?: number | null
  islands?: Array<{ name: string; amount: number }>
}

export async function writeToSheet(payload: WritePayload): Promise<{ ok: boolean; message?: string }> {
  if (!GAS_URL) return { ok: false, message: 'GAS URL not configured' }
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      // ใช้ text/plain หลอกบราวเซอร์เพื่อหลีกเลี่ยงปัญหา CORS
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
    const txt = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt}`)
    return { ok: true }
  } catch (err: any) {
    console.error('writeToSheet error:', err)
    return { ok: false, message: err.message }
  }
}