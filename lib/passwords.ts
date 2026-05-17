'use client'

import { SHEET_ID } from './constants'

const PASSWORD_GID = '1524637408'
const CACHE_MS = 30000

export interface PasswordConfig {
  pages: Record<string, string>
  baans: Record<number, string>
}

let cachedConfig: PasswordConfig | null = null
let cachedAt = 0

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

async function fetchPasswordConfigFresh(): Promise<PasswordConfig> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${PASSWORD_GID}&range=A1:B21&t=${Date.now()}`
  const text = await (await fetch(url, { cache: 'no-store' })).text()
  const rows = parseGViz(text)
  const pages: Record<string, string> = {}
  const baans: Record<number, string> = {}

  rows.forEach(row => {
    const left = cellText(row, 0)
    const password = cellText(row, 1)
    if (!left || !password) return

    const pageKey = pageKeyFromLabel(left)
    if (pageKey) {
      pages[pageKey] = password
      return
    }

    const baan = parseInt(left)
    if (baan >= 1 && baan <= 12) baans[baan] = password
  })

  cachedConfig = { pages, baans }
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

export async function passwordSessionToken(scope: string, password: string) {
  const value = `${scope}:${password}`
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(value)
    const hash = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  }
  return btoa(unescape(encodeURIComponent(value)))
}
