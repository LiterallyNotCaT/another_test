'use client'
// ============================================================
// CLIENT-SIDE GAME STATE  (localStorage + BroadcastChannel)
// ============================================================
import { GameState, WaveSubmission } from './constants'

const KEY_GAME_STATE    = 'biggame_state'
const KEY_SUBMISSIONS   = 'biggame_submissions'
const KEY_MAP_OWNERSHIP = 'biggame_map'
const KEY_DISASTERS     = 'biggame_disasters'

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
  try { const ch = new BroadcastChannel('biggame'); ch.postMessage({ key }); ch.close() } catch {}
}

export function subscribeStore(cb: (key: string) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  let bc: BroadcastChannel | null = null
  try { bc = new BroadcastChannel('biggame'); bc.onmessage = (e) => cb(e.data?.key ?? '') } catch {}
  const onStorage = (e: StorageEvent) => { if (e.key) cb(e.key) }
  window.addEventListener('storage', onStorage)
  return () => { bc?.close(); window.removeEventListener('storage', onStorage) }
}

export const defaultGameState: GameState = { currentWave: 1, isOpen: false, timerEnd: null, duration: 10, gameMode: 'bid' }

export function getGameState(): GameState {
  return { ...defaultGameState, ...read<Partial<GameState>>(KEY_GAME_STATE, {}) }
}
export function setGameState(patch: Partial<GameState>) {
  write(KEY_GAME_STATE, { ...getGameState(), ...patch })
}

export function getMapOwnership(): Record<string, number> {
  return read<Record<string, number>>(KEY_MAP_OWNERSHIP, {})
}
export function setMapOwnership(map: Record<string, number>) {
  write(KEY_MAP_OWNERSHIP, map)
}

export function getSubmissions(): WaveSubmission[] {
  return read<WaveSubmission[]>(KEY_SUBMISSIONS, [])
}
export function saveSubmission(sub: WaveSubmission) {
  const subs = getSubmissions()
  const idx = subs.findIndex(s => s.baan === sub.baan && s.wave === sub.wave)
  if (idx >= 0) subs[idx] = sub; else subs.push(sub)
  write(KEY_SUBMISSIONS, subs)
}
export { saveSubmission as addSubmission }

export function getSubmissionsForWave(wave: number): WaveSubmission[] {
  return getSubmissions().filter(s => s.wave === wave)
}
export function getSubmissionsForBaan(baan: number): WaveSubmission[] {
  return getSubmissions().filter(s => s.baan === baan)
}

export function getActiveDisasters(): Record<number, number> {
  return read<Record<number, number>>(KEY_DISASTERS, {})
}
export function setActiveDisaster(wave: number, num: number | null) {
  const d = getActiveDisasters()
  if (num === null) delete d[wave]; else d[wave] = num
  write(KEY_DISASTERS, d)
}
export function getActiveDisasterForWave(wave: number): number | null {
  return getActiveDisasters()[wave] ?? null
}
