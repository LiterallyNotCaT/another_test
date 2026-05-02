// ============================================================
// GAME CONSTANTS & TYPES
// ============================================================

export const SHEET_ID = '1FKv1l9zpF85V_oUKQCjAjYyb4DZcMRCvN671DzU_Dq4'
export const SHEET_BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`
export const WAVE_GIDS: Partial<Record<number, string>> = {
  1: '1448591830',
}
export const getWaveSheetQuery = (wave: number) =>
  WAVE_GIDS[wave]
    ? `gid=${WAVE_GIDS[wave]}`
    : `sheet=${encodeURIComponent(`Wave ${wave}`)}`

// Password config
export const PASSWORDS: Record<string, string> = {
  web1: 'web1',
  web4: 'web4',
  web5: 'web5',
}
export const getBaanPassword = (baan: number) => `Baan ${baan}`

// Areas (For Map)
export const AREAS = {
  A: ['A1','A2','A3','A4','A5'],
  B: ['B1','B2','B3','B4','B5','B6'],
  C: ['C1','C2','C3','C4','C5','C6','C7','C8','C9'],
}
// แผนที่รวม 20 ช่อง
export const ALL_AREAS = [...AREAS.A, ...AREAS.B, ...AREAS.C]

// Disasters
export const DISASTER_AREAS: Record<number, Record<string, number[]>> = {
  1: { A: [1,2,3], B: [1,2], C: [] },
  2: { A: [4,5], B: [3,4], C: [1,2,3] },
  3: { A: [], B: [5,6], C: [4,5,6] },
  4: { A: [1,5], B: [1,6], C: [7,8,9] },
  5: { A: [2,3], B: [2,3], C: [8,9] },
}

export const HOUSES = Array.from({ length: 12 }, (_, i) => i + 1)

// --- Types ---
export interface BiddingEntry {
  area: string
  amount: number
}

export interface WaveSubmission {
  baan: number
  wave: number
  bets: BiddingEntry[]
  isKing: boolean
  kingDisaster?: number
  betTarget?: number
  betAmount?: number
  timestamp: string
  balance: number
}

// 🚨 เพิ่ม Type ของ Scoreboard เพื่อแก้ Error: Property 'entries' does not exist
export interface ScoreEntry {
  baan: number;
  score: number;
  extra?: Record<string, string | number>;
}

// House color palette
export const HOUSE_COLORS: Record<number, string> = {
  1:  '#ef4444', 2:  '#f97316', 3:  '#eab308', 4:  '#22c55e',
  5:  '#3b82f6', 6:  '#8b5cf6', 7:  '#d946ef', 8:  '#f43f5e',
  9:  '#06b6d4', 10: '#14b8a6', 11: '#6366f1', 12: '#64748b'
}
export const HOUSE_NAMES: Record<number, string> = {
  1: 'บ้าน 1', 2: 'บ้าน 2', 3: 'บ้าน 3', 4: 'บ้าน 4',
  5: 'บ้าน 5', 6: 'บ้าน 6', 7: 'บ้าน 7', 8: 'บ้าน 8',
  9: 'บ้าน 9', 10:'บ้าน 10',11:'บ้าน 11',12:'บ้าน 12'
}