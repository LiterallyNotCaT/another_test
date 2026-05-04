import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import type { GameState } from '@/lib/constants'

const GAME_STATE_KEY = 'cloud_biggame_state'

const defaultState: GameState = {
  currentWave: 1,
  isOpen: false,
  timerEnd: null,
  duration: 10,
  gameMode: 'bid',
}

function normalizeGameState(value: unknown): GameState {
  const state = (value && typeof value === 'object' ? value : {}) as Partial<GameState>
  const currentWave = Number(state.currentWave)
  const duration = Number(state.duration)
  const gameMode = state.gameMode === 'bet' ? 'bet' : 'bid'

  return {
    ...defaultState,
    ...state,
    currentWave: Number.isFinite(currentWave) && currentWave >= 1 ? currentWave : defaultState.currentWave,
    isOpen: state.isOpen === true,
    timerEnd: typeof state.timerEnd === 'string' && state.timerEnd ? state.timerEnd : null,
    duration: Number.isFinite(duration) && duration > 0 ? duration : defaultState.duration,
    gameMode,
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : undefined,
  }
}

export async function GET() {
  try {
    const state = await kv.get<GameState>(GAME_STATE_KEY)
    return NextResponse.json(normalizeGameState(state), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Game state GET failed:', error)
    return NextResponse.json(defaultState, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}

export async function POST(req: Request) {
  try {
    const state = normalizeGameState(await req.json())
    await kv.set(GAME_STATE_KEY, state)
    return NextResponse.json({ success: true, state })
  } catch (error) {
    console.error('Game state POST failed:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
