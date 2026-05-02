'use client'
import clsx from 'clsx'
import { HOUSE_COLORS, DISASTER_AREAS, ALL_AREAS } from '@/lib/constants'
import { ShieldAlert } from 'lucide-react'

interface MapProps {
  ownership:       Record<string, number>
  selected?:       string[]
  onSelect?:       (area: string) => void
  filterDisaster?: number | null
  readOnly?:       boolean
  kingDisaster?:   number | null
  compact?:        boolean
}

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

export default function GameMap({
  ownership, selected = [], onSelect, filterDisaster, readOnly, kingDisaster, compact
}: MapProps) {
  
  return (
    <div className="flex flex-col gap-4">
      {/* 🗺️ MAP GRID แบบรวม 1 ก้อน ล้ำๆ */}
      <div className={clsx("grid gap-3", compact ? "grid-cols-5 sm:grid-cols-7" : "grid-cols-4 sm:grid-cols-5 md:grid-cols-7")}>
        {ALL_AREAS.map((area) => {
          const ownerId   = ownership[area]
          const isSel     = selected.includes(area)
          const color     = ownerId ? HOUSE_COLORS[ownerId] : null
          const dis       = getAreaDisasters(area)
          
          // ระบบ Highlight ตอนกด Filter หรือ King เลือกภัยพิบัติ
          const isTargetDisaster = filterDisaster ? dis.includes(filterDisaster) : (kingDisaster ? dis.includes(kingDisaster) : false)
          const showDim   = (filterDisaster || kingDisaster) && !isTargetDisaster

          return (
            <button
              key={area}
              onClick={() => !readOnly && onSelect?.(area)}
              disabled={readOnly}
              className={clsx(
                'relative flex flex-col items-center justify-center overflow-hidden rounded-xl border transition-all duration-300',
                compact ? 'h-16' : 'h-24 md:h-28',
                isSel ? 'border-yellow-400 bg-yellow-400/10 shadow-[0_0_20px_rgba(250,204,21,0.3)] scale-105 z-10' 
                      : color ? 'border-white/20 bg-white/5' : 'border-white/5 bg-[#0d1117] hover:border-blue-400/50 hover:bg-blue-500/10',
                showDim && 'opacity-20 grayscale'
              )}
              style={color && !isSel ? { borderBottomColor: color, borderBottomWidth: '3px', boxShadow: `inset 0 -15px 30px -20px ${color}` } : undefined}
            >
              {/* ชื่อเกาะ */}
              <div className={clsx("font-display font-bold tracking-wider", compact ? "text-lg" : "text-2xl md:text-3xl", isSel ? "text-yellow-400" : "text-white")}>
                {area}
              </div>

              {/* ป้ายชื่อเจ้าของเดิม */}
              {ownerId && (
                <div className="mt-1 flex items-center justify-center w-full px-2">
                  <div className="truncate rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm" style={{ backgroundColor: color! }}>
                    บ้าน {ownerId}
                  </div>
                </div>
              )}

              {/* ภัยพิบัติ Emojis */}
              {dis.length > 0 && (
                <div className="absolute bottom-1 flex w-full justify-center gap-0.5 px-1">
                  {dis.map(d => (
                    <span key={d} className={clsx(
                      "rounded px-1 text-[9px] font-bold leading-tight",
                      isTargetDisaster ? "bg-red-500 text-white animate-pulse" : "bg-slate-800 text-slate-400"
                    )}>
                      {D_IDS[(d-1)%9]}
                    </span>
                  ))}
                </div>
              )}
              
              {/* เอฟเฟกต์ Hologram เวลาเลือก */}
              {isSel && <div className="absolute inset-0 bg-gradient-to-t from-yellow-400/20 to-transparent pointer-events-none" />}
            </button>
          )
        })}
      </div>

      {/* Legend / คำอธิบาย */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-white/10 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-[#0d1117] border border-white/20" />
          <span className="text-xs text-slate-400">พื้นที่ว่าง</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-400/20 border-2 border-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
          <span className="text-xs text-slate-400">กำลังเลือก</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldAlert size={14} className="text-red-400" />
          <span className="text-xs text-slate-400">มีภัยพิบัติ</span>
        </div>
      </div>
    </div>
  )
}