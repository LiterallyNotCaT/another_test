'use client'

import { SHEET_ID } from './constants'

const PASSWORD_GID = '1524637408'
const CACHE_MS = 30000

export interface PasswordConfig {
  pages: Record<string, string>
  baans: Record<number, string>
  kingPro: string
}

let cachedConfig: PasswordConfig | null = null
let cachedAt = 0

function parseCSVLine(line: string) {
  const cols: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]
    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      i++
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      cols.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cols.push(current)
  return cols.map(col => col.trim())
}

function parseCSV(text: string) {
  if (/^\s*</.test(text)) return []
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).map(parseCSVLine)
}

function parseGViz(text: string): any[] {
  const js = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
  return js ? JSON.parse(js)?.table?.rows ?? [] : []
}

function cellText(row: any, idx: number) {
  return String(row?.c?.[idx]?.v ?? '').trim()
}

function pageKeyFromLabel(label: string) {
  const value = label.toLowerCase()
  if (value.includes('morning')) return 'web1'
  if (value.includes('afternoon')) return 'web2'
  if (value.includes('ambassador')) return 'web4'
  if (value.includes('admin')) return 'web5'
  return ''
}

function buildPasswordConfig(rows: string[][]): PasswordConfig {
  const pages: Record<string, string> = {
    web1: rows[1]?.[1]?.trim() ?? '',
    web2: rows[2]?.[1]?.trim() ?? '',
    web4: rows[3]?.[1]?.trim() ?? '',
    web5: rows[4]?.[1]?.trim() ?? '',
  }
  const baans: Record<number, string> = {}
  let kingPro = rows[24]?.[1]?.trim() ?? ''

  rows.forEach(row => {
    const left = String(row?.[0] ?? '').trim()
    const password = String(row?.[1] ?? '').trim()
    if (!left || !password) return

    const normalizedLeft = left.toLowerCase().replace(/\s+/g, '')
    if (normalizedLeft.includes('king') && normalizedLeft.includes('pro')) {
      kingPro = password
      return
    }

    const pageKey = pageKeyFromLabel(left)
    if (pageKey) {
      pages[pageKey] = password
      return
    }

    const baan = parseInt(left)
    if (baan >= 1 && baan <= 12) baans[baan] = password
  })

  for (let baan = 1; baan <= 12; baan++) {
    const rowIndex = 8 + baan
    const password = rows[rowIndex]?.[1]?.trim()
    if (password) baans[baan] = password
  }

  return { pages, baans, kingPro }
}

async function fetchPasswordConfigFresh(): Promise<PasswordConfig> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${PASSWORD_GID}&range=A1:B25&t=${Date.now()}`
  const csvRows = parseCSV(await (await fetch(csvUrl, { cache: 'no-store' })).text())
  cachedConfig = buildPasswordConfig(csvRows)

  if (!Object.values(cachedConfig.pages).some(Boolean)) {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${PASSWORD_GID}&range=A1:B25&t=${Date.now()}`
    const text = await (await fetch(gvizUrl, { cache: 'no-store' })).text()
    const gvizRows = parseGViz(text).map(row => [cellText(row, 0), cellText(row, 1)])
    cachedConfig = buildPasswordConfig(gvizRows)
  }

  cachedAt = Date.now()
  return cachedConfig
}

export async function fetchPasswordConfig(force = false): Promise<PasswordConfig> {
  if (!force && cachedConfig && Date.now() - cachedAt < CACHE_MS) return cachedConfig
  return fetchPasswordConfigFresh()
}

export async function getPagePassword(pageKey: string, force = false) {
  const config = await fetchPasswordConfig(force)
  return config.pages[pageKey] ?? ''
}

export async function getBaanPasswordFromSheet(baan: number, force = false) {
  const config = await fetchPasswordConfig(force)
  return config.baans[baan] ?? ''
}

export async function getKingProPassword(force = false) {
  const config = await fetchPasswordConfig(force)
  return config.kingPro ?? ''
}

export async function passwordSessionToken(scope: string, password: string) {
  const value = `${scope}:${password}`
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(value)
    const hash = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  }
  return btoa(unescape(encodeURIComponent(value)))
}
