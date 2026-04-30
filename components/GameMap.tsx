'use client'
import clsx from 'clsx'
import { HOUSE_COLORS, DISASTER_AREAS } from '@/lib/constants'

interface MapProps {
  ownership:       Record<string, number>
  selected?:       string[]
  onSelect?:       (area: string) => void
  filterDisaster?: number | null
  readOnly?:       boolean
  kingDisaster?:   number | null
  compact?:        boolean
}

const GROUPS = [
  { id:'A', areas:['A1','A2','A3','A4','A5'],               income:'180%', dis:'90%' },
  { id:'B', areas:['B1','B2','B3','B4','B5','B6'],          income:'160%', dis:'80%' },
  { id:'C', areas:['C1','C2','C3','C4','C5','C6','C7','C8','C9'], income:'140%', dis:'70%' },
]
const GROUP_COLORS = { A: '#38bdf8', B: '#a78bfa', C: '#34d399' }

const D_IDS = ['D1','D2','D3','D4','D5','D6','D7','D8','D9']

function getAreaDisasters(area: string): number[] {
  const out: number[] = []
  for (const [num, data] of Object.entries(DISASTER_AREAS)) {
    const n = parseInt(num)
    const g = area[0] as 'A'|'B'|'C'
    const i = parseInt(area.slice(1))
    if (data[g]?.includes(i)) out.push(n)
  }
  return out
}

function getAffected(dn: number | null): Set<string> {
  if (!dn || !DISASTER_AREAS[dn]) return new Set()
  const s = new Set<string>()
  const d = DISASTER_AREAS[dn]
  d.A.forEach(n => s.add(`A${n}`))
  d.B.forEach(n => s.add(`B${n}`))
  d.C.forEach(n => s.add(`C${n}`))
  return s
}

export default function GameMap({
  ownership, selected=[], onSelect, filterDisaster, readOnly, kingDisaster, compact,
}: MapProps) {
  const filterSet = filterDisaster != null ? getAffected(filterDisaster) : null
  const kingSet   = kingDisaster   != null ? getAffected(kingDisaster)   : null

  const tileSize = compact ? 'w-10 h-10' : 'aspect-square min-h-[54px]'

  return (
    <div className="space-y-5 select-none">
      {/* Filter notice */}
      {filterDisaster != null && (
        <div className="toast-lift flex items-center gap-2 px-3 py-2 rounded-2xl bg-red-950/50 border border-red-400/25 text-xs text-red-300 shadow-[0_18px_45px_rgba(127,29,29,0.22)]">
          <span className="font-mono font-bold">D{filterDisaster}</span>
          <span>Showing areas affected by disaster {filterDisaster}</span>
        </div>
      )}
      {kingDisaster != null && !filterDisaster && (
        <div className="toast-lift flex items-center gap-2 px-3 py-2 rounded-2xl bg-yellow-950/45 border border-yellow-400/25 text-xs text-yellow-300 shadow-[0_18px_45px_rgba(113,63,18,0.20)]">
          <span className="font-mono font-bold">D{kingDisaster}</span>
          <span>King disaster {kingDisaster} is highlighted</span>
        </div>
      )}

      {/* Map groups */}
      <div className="map-infographic">
      {GROUPS.map(group => {
        const gc = GROUP_COLORS[group.id as 'A'|'B'|'C']
        return (
          <div key={group.id} className="map-group-card">
            {/* Group label */}
            <div className="map-group-header">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center font-display font-bold text-xs"
                style={{ background: `linear-gradient(135deg, ${gc}30, rgba(255,255,255,0.04))`, color: gc, border: `1px solid ${gc}45`, boxShadow: `0 0 18px ${gc}20` }}>
                {group.id}
              </div>
              <div className="min-w-0">
                <span className="font-display font-semibold text-sm text-slate-200">Group {group.id}</span>
                <div className="map-group-meta">
                  <span className="badge badge-green text-green-500" style={{ fontSize: '0.55rem' }}>+{group.income}</span>
                  <span className="badge badge-red text-red-500" style={{ fontSize: '0.55rem' }}>dis {group.dis}</span>
                </div>
              </div>
            </div>

            {/* Tiles */}
            <div className="map-tile-grid">
              {group.areas.map(area => {
                const owner       = ownership[area] || 0
                const isSelected  = selected.includes(area)
                const disasters   = getAreaDisasters(area)
                const isFiltered  = filterSet?.has(area) ?? false
                const isKingHit   = kingSet?.has(area)   ?? false
                const dimmed      = filterSet != null && !isFiltered

                // Compute visual state
                let bg        = 'rgba(19,25,34,0.9)'
                let border    = 'rgba(255,255,255,0.06)'
                let textColor = '#475569'

                if (owner > 0 && !dimmed) {
                  const c = HOUSE_COLORS[owner]
                  bg = `${c}1a`; border = `${c}55`; textColor = c
                }
                if (isSelected) {
                  bg = 'rgba(245,158,11,0.15)'; border = 'rgba(245,158,11,0.7)'
                  textColor = '#fbbf24'
                }
                if (filterSet != null) {
                  if (isFiltered)  { bg='rgba(127,29,29,0.4)'; border='rgba(239,68,68,0.6)'; textColor='#fca5a5' }
                  if (dimmed)      { bg='rgba(13,17,23,0.5)'; border='rgba(255,255,255,0.03)'; textColor='#1e293b' }
                }
                if (isKingHit && !isSelected && !filterSet) {
                  border = 'rgba(239,68,68,0.45)'
                }

                return (
                  <button key={area}
                    onClick={() => !readOnly && onSelect?.(area)}
                    disabled={readOnly}
                    title={[
                      area,
                      owner ? `บ้าน ${owner}` : 'ว่าง',
                      disasters.length ? 'Disaster ' + disasters.join(', ') : ''
                    ].filter(Boolean).join(' · ')}
                    className={clsx(
                      tileSize,
                      'map-tile-deluxe relative rounded-2xl flex flex-col items-center justify-center transition-all duration-150',
                      !readOnly && !dimmed && 'map-tile cursor-pointer',
                      readOnly && 'cursor-default',
                      isSelected && 'map-tile-selected ring-2 ring-yellow-300/80 ring-offset-2 ring-offset-[#07090f]',
                      isKingHit && !isSelected && 'ring-1 ring-red-500/40',
                    )}
                    style={{ background: bg, border: `1.5px solid ${border}` }}>

                    {/* Area name */}
                    <span className="font-display font-bold text-xs leading-none" style={{ color: textColor }}>
                      {area}
                    </span>

                    {/* Owner badge */}
                    {owner > 0 && !dimmed && (
                      <span className="font-mono text-[8px] font-bold mt-0.5 opacity-80"
                        style={{ color: HOUSE_COLORS[owner] }}>#{owner}</span>
                    )}

                    {/* Disaster mini-icons */}
                    {disasters.length > 0 && !dimmed && (
                      <div className="mt-1 flex max-w-full justify-center gap-px overflow-hidden">
                        {disasters.slice(0,3).map(d => (
                          <span key={d} className="rounded bg-slate-100 px-1 text-[9px] font-bold leading-tight text-slate-700">{D_IDS[(d-1)%9]}</span>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: 'rgba(19,25,34,0.9)', border: '1.5px solid rgba(255,255,255,0.10)' }} />
          <span className="text-2xs text-slate-700">ว่าง</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded ring-1 ring-yellow-400/70 ring-offset-1 ring-offset-[#07090f]"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1.5px solid rgba(245,158,11,0.7)' }} />
          <span className="text-2xs text-slate-700">เลือก</span>
        </div>
        {Object.entries(HOUSE_COLORS).slice(0,4).map(([b,c]) => (
          <div key={b} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: c+'1a', border: `1.5px solid ${c}55` }} />
            <span className="text-2xs text-slate-700">บ้าน{b}</span>
          </div>
        ))}
        <span className="text-2xs text-slate-800">…</span>
      </div>
    </div>
  )
}
