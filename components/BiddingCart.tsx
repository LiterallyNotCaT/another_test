'use client'
import { memo, useEffect, useState } from 'react'
import clsx from 'clsx'
import { X, Minus, Plus, ChevronRight } from 'lucide-react'
import { HOUSE_COLORS, DISASTER_AREAS } from '@/lib/constants'

interface CartItem { area: string; amount: number }

interface BiddingCartProps {
  baan:          number
  balance:       number
  items:         CartItem[]
  isKing:        boolean
  kingDisaster:  number | null
  onUpdate:      (items: CartItem[]) => void
  onKingDisaster:(d: number | null) => void
  onSubmit:      () => void
  isSaved:       boolean
  savedAt?:      string
  isOpen:        boolean
  bidOpen?:      boolean
  disasterOpen?: boolean
  isDisasterPhase?: boolean
}

const PRESETS = [100, 500, 1000]
const DISASTER_IDS = Array.from({ length: 9 }, (_, i) => i + 1)

function getAreaDisasters(area: string): number[] {
  if (area === 'KING') return []
  const out: number[] = []
  for (const [num, data] of Object.entries(DISASTER_AREAS)) {
    const n=parseInt(num); const g=area[0] as 'A'|'B'|'C'; const i=parseInt(area.slice(1))
    if (data[g]?.includes(i)) out.push(n)
  }
  return out
}

function BiddingCart({
  baan, balance, items, isKing, kingDisaster,
  onUpdate, onKingDisaster, onSubmit, isSaved, savedAt, isOpen,
  bidOpen = isOpen, disasterOpen = isOpen && isKing, isDisasterPhase = false,
}: BiddingCartProps) {
  const color      = HOUSE_COLORS[baan]
  const totalBet   = items.reduce((s,i)=>s+i.amount, 0)
  const remaining  = balance - totalBet
  const overBudget = remaining < 0
  const hasInvalidAmount = items.some(i=>i.amount < 100)
  const hasKingBid = items.some(i=>i.area === 'KING')
  const usagePct   = balance > 0 ? Math.min(1, totalBet / balance) : 0
  const submitEnabled = isDisasterPhase
    ? disasterOpen && kingDisaster != null
    : bidOpen && items.length > 0 && !overBudget && !hasInvalidAmount
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({})

  useEffect(() => {
    setDraftAmounts(prev => Object.fromEntries(items.map(i => [i.area, prev[i.area] ?? String(i.amount)])))
  }, [items])

  const updateAmount = (area: string, raw: number) => {
    const prev   = items.find(i=>i.area===area)?.amount || 0
    const maxAdd = remaining + prev
    const val    = maxAdd >= 100 ? Math.min(Math.max(100, isNaN(raw) ? 100 : raw), maxAdd) : 0
    onUpdate(items.map(i => i.area===area ? {...i, amount:val} : i))
    setDraftAmounts(prevDraft => ({ ...prevDraft, [area]: String(val) }))
  }
  const setRawAmount = (area: string, raw: string) => {
    setDraftAmounts(prevDraft => ({ ...prevDraft, [area]: raw }))
  }
  const clampAmount = (area: string) => {
    const val = Number(draftAmounts[area])
    updateAmount(area, Number.isFinite(val) ? val : 100)
  }
  const remove = (area: string)  => onUpdate(items.filter(i=>i.area!==area))
  const step   = (area: string, d: number) => {
    const cur = items.find(i=>i.area===area)?.amount||0
    updateAmount(area, cur+d)
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4 md:p-5">

      <div className="flex-shrink-0">
        <p className="text-label">Investment Plan</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-bold leading-none text-white">Bid Summary</h2>
          <span className={clsx('badge', isOpen ? (isDisasterPhase ? 'badge-gold' : 'badge-green') : 'badge-red')}>
            {isOpen ? (isDisasterPhase ? 'King turn' : 'Live') : 'Closed'}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">เลือกพื้นที่ได้สูงสุด 3 พื้นที่</p>
      </div>

      {/* ── Balance summary ────────── */}
      <div className="cart-card colorful-box colorful-box-balance rounded-3xl p-4">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <span className="text-label">Balance คงเหลือ</span>
          <span className={clsx('font-mono font-bold text-2xl leading-none',
            overBudget ? 'text-red-300' : 'text-green-300')}
            style={!overBudget ? { textShadow: '0 0 12px rgba(16,185,129,0.5)' } : undefined}>
            {remaining.toLocaleString()}
          </span>
        </div>

        {/* Usage bar */}
        <div className="h-2 rounded-full bg-slate-950/80 overflow-hidden mb-2 border border-white/5">
          <div className="progress-glow h-full rounded-full transition-all duration-500"
            style={{
              width: `${usagePct * 100}%`,
              color: overBudget ? '#ef4444' : color,
              background: overBudget
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : `linear-gradient(90deg, ${color}dd, #22d3eeaa, #f59e0baa)`,
            }} />
        </div>

        {totalBet > 0 && (
          <div className="flex justify-between text-2xs text-slate-600">
            <span>ลงทุนแล้ว</span>
            <span className="text-orange-400 font-mono">−{totalBet.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* ── King disaster picker ───── */}
      {isKing && (
        <div className="king-bid-card colorful-box colorful-box-gold cart-card rounded-3xl p-3 text-sm text-yellow-900">
          <div className="font-display font-bold">King control</div>
          <div className="mt-1 text-xs">
            {isDisasterPhase ? 'Select the disaster ID for this wave.' : 'KING bid is separate and can be added from the map.'}
          </div>
          {!isDisasterPhase && !hasKingBid && (
            <button type="button" onClick={()=>onUpdate([...items, { area: 'KING', amount: balance >= 100 ? 100 : 0 }])}
              disabled={!bidOpen || balance < 100}
              className="btn btn-ghost mt-2 w-full">
              Add KING bid
            </button>
          )}
          {isDisasterPhase ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DISASTER_IDS.map(n => {
              const active = kingDisaster === n
              return (
                <button key={n} onClick={()=>onKingDisaster(active?null:n)} disabled={!disasterOpen}
                  className={clsx(
                    'min-h-12 rounded-2xl px-3 py-3 text-center font-mono text-base font-black transition-all active:scale-95',
                    active
                      ? 'bg-pink-500 text-white shadow-[0_10px_24px_rgba(236,72,153,0.28)] ring-2 ring-pink-200'
                      : 'bg-white text-yellow-800 border border-yellow-200 hover:bg-yellow-50 disabled:opacity-40'
                  )}>
                  {n}
                </button>
              )
            })}
          </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-800">
              Disaster selection opens after the 10 min bid phase.
            </div>
          )}
        </div>
      )}
      {/* Area list ──────────────── */}
      <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-label">พื้นที่ที่เลือก <span className="text-blue-500">({items.length})</span></span>
          {items.length > 0 && (
            <button onClick={()=>onUpdate([])}
              disabled={!bidOpen}
              className={clsx(
                'rounded-lg border px-3 py-1.5 text-2xs font-display font-semibold transition-colors',
                bidOpen
                  ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'
                  : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed',
              )}>
              ล้างทั้งหมด
            </button>
          )}
        </div>

        {/* Scroll area */}
        <div className="bidding-cart-scroll flex-1 overflow-y-auto space-y-2 pr-2">
          {items.length === 0 && (
            <div className="cart-card rounded-3xl flex flex-col items-center justify-center py-12 text-slate-600">
              <div className="text-3xl mb-3 opacity-60 animate-float">🗺️</div>
              <div className="text-sm text-center leading-relaxed">
                แตะพื้นที่บน Map<br />เพื่อเพิ่มการลงทุน
              </div>
            </div>
          )}

          {items.map(item => {
            const aDisasters = getAreaDisasters(item.area)
            const grp        = item.area[0]
            const isKingItem = item.area === 'KING'
            const rate       = isKingItem ? 'King' : grp==='A'?'180%':grp==='B'?'160%':'140%'

            return (
              <div key={item.area} className={clsx(
                'cart-card rounded-3xl p-3 space-y-2.5 toast-lift',
                isKingItem && 'king-bid-card colorful-box colorful-box-gold'
              )}>
                {/* Row 1: area name + disasters + remove */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-sm text-white">{isKingItem ? 'KING' : item.area}</span>
                      <span className={clsx('badge', isKingItem ? 'badge-gold' : 'badge-green')} style={{ fontSize: '0.55rem' }}>{isKingItem ? rate : `+${rate}`}</span>
                      {aDisasters.map(d => (
                        <span key={d} className="rounded bg-slate-100 px-1 font-mono text-[10px] font-bold" title={`Disaster #${d}`}>{d}</span>
                      ))}
                    </div>
                    {aDisasters.length > 0 && (
                      <div className="text-2xs text-red-400/60 mt-0.5">
                        D {aDisasters.join(', ')}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>remove(item.area)} disabled={!bidOpen}
                    className="w-7 h-7 rounded-xl bg-red-500/10 text-red-500/60 hover:bg-red-500/20 hover:text-red-300
                      flex items-center justify-center transition-all disabled:opacity-30 flex-shrink-0">
                    <X size={11} />
                  </button>
                </div>

                {/* Row 2: amount stepper */}
                <div className="flex items-center gap-1.5">
                  <button onClick={()=>step(item.area,-100)} disabled={!bidOpen||item.amount<=100}
                    className="w-8 h-8 rounded-xl glass-light action-pill flex items-center justify-center text-slate-400
                      hover:text-white hover:bg-white/8 transition-all disabled:opacity-25 active:scale-90">
                    <Minus size={12} />
                  </button>
                  <input type="number" value={draftAmounts[item.area] ?? String(item.amount)} min={100} max={balance} step={100} disabled={!bidOpen}
                    onChange={e=>setRawAmount(item.area,e.target.value)}
                    onBlur={()=>clampAmount(item.area)}
                    className="flex-1 input-base text-center font-mono text-sm py-2 min-w-0" />
                  <button onClick={()=>step(item.area,100)} disabled={!bidOpen||remaining<=0}
                    className="w-8 h-8 rounded-xl glass-light action-pill flex items-center justify-center text-slate-400
                      hover:text-white hover:bg-white/8 transition-all disabled:opacity-25 active:scale-90">
                    <Plus size={12} />
                  </button>
                </div>

                {/* Row 3: presets */}
                {bidOpen && (
                  <div className="flex gap-1">
                    {PRESETS.map(p => (
                      <button key={p} onClick={()=>updateAmount(item.area,item.amount+p)}
                        disabled={p>remaining}
                        className="flex-1 py-1.5 rounded-xl glass-light action-pill text-2xs font-display font-semibold
                          text-slate-600 hover:text-slate-300 hover:bg-white/6 transition-all disabled:opacity-20">
                        +{p}
                      </button>
                    ))}
                    <button onClick={()=>updateAmount(item.area,remaining+item.amount)}
                      disabled={remaining<=0}
                      className="flex-1 py-1.5 rounded-xl action-pill text-2xs font-display font-semibold
                        text-cyan-700 hover:text-cyan-400 hover:bg-cyan-500/8 transition-all disabled:opacity-20">
                      MAX
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Footer ─────────────────── */}
      <div className="space-y-2.5 flex-shrink-0">
        {/* Save status */}
        <div className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-display transition-all toast-lift',
          isSaved
            ? 'bg-green-500/10 text-green-300 border border-green-400/20'
            : 'bg-yellow-500/10 text-yellow-300 border border-yellow-400/20'
        )}>
          <span className="text-base leading-none">{isSaved ? '✓' : '⏳'}</span>
          <span className="flex-1 truncate text-2xs">
            {isSaved ? (savedAt ? `Saved · ${savedAt}` : 'Saved') : 'Unsaved — autosave ใน 5 วิ'}
          </span>
        </div>

        {/* Submit */}
        <button onClick={onSubmit}
          disabled={!submitEnabled}
          className={clsx(
            'btn w-full text-sm action-pill',
            submitEnabled
              ? 'btn-primary'
              : 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border border-transparent'
          )}
          style={submitEnabled ? {
            background: `linear-gradient(135deg, ${color}, ${color}aa)`,
            boxShadow: `0 0 20px ${color}30`,
          } : undefined}>
          {!isOpen ? '🔒 ปิดรับการลงทุน'
            : isDisasterPhase && !disasterOpen ? 'King is choosing disaster'
            : isDisasterPhase && kingDisaster == null ? 'Select disaster ID'
            : isDisasterPhase ? `Confirm disaster D${kingDisaster}`
            : overBudget ? '⚠ เงินไม่เพียงพอ'
            : hasInvalidAmount ? 'ขั้นต่ำ 100 ต่อพื้นที่'
            : items.length===0 ? 'เลือกพื้นที่ก่อน'
            : (
              <span className="flex items-center gap-2">
                ยืนยัน {items.length} พื้นที่ · {totalBet.toLocaleString()}
                <ChevronRight size={14} />
              </span>
            )}
        </button>
      </div>
    </div>
  )
}

export default memo(BiddingCart)
