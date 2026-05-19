import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

type GasWriteResponse = {
  status?: string
  message?: string
  [key: string]: unknown
}

const GAS_URL = process.env.GAS_URL || process.env.NEXT_PUBLIC_GAS_URL || ''

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, message }, { status })
}

function statusForGasError(message: string) {
  return /busy|retry|lock|timeout|timed out/i.test(message) ? 503 : 400
}

export async function POST(req: Request) {
  if (!GAS_URL) return jsonError('GAS URL not configured')

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return jsonError('Invalid JSON payload', 400)
  }
  if (!payload || typeof payload !== 'object' || (payload as { action?: unknown }).action !== 'writeWave') {
    return jsonError('Invalid sheet write action', 400)
  }

  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    const text = await res.text()
    let data: GasWriteResponse = {}
    try {
      data = text ? JSON.parse(text) as GasWriteResponse : {}
    } catch {
      return jsonError(`Apps Script returned non-JSON response: ${text.slice(0, 160)}`, 502)
    }

    if (!res.ok) return jsonError(data.message || `Apps Script HTTP ${res.status}`, 502)
    if (data.status !== 'ok') {
      const message = data.message || 'Apps Script rejected the write'
      return jsonError(message, statusForGasError(message))
    }

    return NextResponse.json({ ok: true, message: data.message || 'Sent to Google Sheet', data })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return jsonError(message)
  }
}
