'use client'
import clsx from 'clsx'
import { X, Minus, Plus } from 'lucide-react'
import { HOUSE_COLORS, DISASTER_AREAS } from '@/lib/constants'

interface CartItem { area: string; amount: number }

interface BiddingCartProps {
  baan: number, balance: number, items: CartItem[],
  isKing: boolean, kingDisaster: number | null,
  onUpdate: (items: CartItem[]) => void,
  onKingDisaster: (d: number | null) => void,
  onSubmit: () => void, isSaved: boolean, savedAt?: string, isOpen: boolean
}

const D_NAMES = ['น้ำท่วม','แผ่นดินไหว','ไฟป่า','พายุ','แล้ง','ภัย 6','ภัย 7','ภัย 8','ภัย 9']
const PRESETS = [100, 200, 500]

export default function BiddingCart({
  baan, balance, items, isKing, kingDisaster,
  onUpdate, onKingDisaster, onSubmit, isSaved, savedAt, isOpen
}: BiddingCartProps) {
  const color = HOUSE_COLORS[baan] || '#3b82f6'
  const total = items.reduce((acc, curr) => acc + curr.amount, 0)
  const remaining = balance - total
  const overBudget = remaining < 0

  return (
    <div className="glass-panel-glow rounded-3xl flex flex-col h-full overflow-hidden border-t-4" style={{ borderTopColor: color }}>
      <div className="p-5 bg-black/40 border-b border-white/5">
        <h2 className="text-xl font-black tracking-widest flex justify-between items-center" style={{ color }}>
          COMMAND CENTER
          <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded text-white tracking-normal">
            Baan {baan}
          </span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50 space-y-3">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center text-2xl">📡</div>
            <p className="font-mono text-sm">SELECT SECTOR FROM MAP</p>
          </div>
        ) : (
          items.map((item, idx) => (
            <div key={item.area} className="glass-panel p-3 rounded-xl border border-white/10 relative group">
              <button onClick={() => onUpdate(items.filter(i => i.area !== item.area))}
                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-400 text-white rounded-full p-1 shadow-lg transition-transform hover:scale-110">
                <X size={14} />
              </button>
              
              <div className="flex justify-between items-center mb-2">
                <div className="text-lg font-black text-yellow-400 text-glow-gold">{item.area}</div>
                <div className="font-mono text-white bg-black/50 px-2 py-0.5 rounded border border-white/10">
                  ฿ {item.amount.toLocaleString()}
                </div>
              </div>

              <div className="flex gap-2">
                {PRESETS.map(p => (
                  <button key={p} onClick={() => {
                    const next = [...items]; next[idx].amount += p; onUpdate(next)
                  }} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md py-1 text-xs font-mono font-bold transition-colors">
                    +{p}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}

        {/* KING Panel */}
        {isKing && (
          <div className="mt-6 p-4 rounded-xl border-2 border-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <div className="text-red-400 font-black text-sm mb-3 flex items-center gap-2">
              👑 KING PROTOCOL: ACTIVATE DISASTER
            </div>
            <div className="grid grid-cols-3 gap-2">
              {D_NAMES.map((name, i) => (
                <button key={i} onClick={() => onKingDisaster(kingDisaster === i+1 ? null : i+1)}
                  className={clsx(
                    "text-[10px] font-bold py-2 rounded border transition-all",
                    kingDisaster === i+1 ? "bg-red-600 text-white border-red-400 shadow-[0_0_10px_red]" : "bg-black/50 text-slate-400 border-white/10 hover:border-red-500/50"
                  )}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Total & Submit */}
      <div className="p-5 bg-black/60 border-t border-white/10">
        <div className="flex justify-between items-end mb-4">
          <div>
            <div className="text-xs text-slate-400 font-mono mb-1">TOTAL INVESTMENT</div>
            <div className={clsx("text-3xl font-black font-mono", overBudget ? "text-red-500 animate-pulse" : "text-white")}>
              {total.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400 font-mono mb-1">BALANCE LEFT</div>
            <div className={clsx("text-xl font-bold font-mono", overBudget ? "text-red-500" : "text-emerald-400")}>
              {remaining.toLocaleString()}
            </div>
          </div>
        </div>

        <button onClick={onSubmit} disabled={!isOpen || items.length === 0 || overBudget}
          className={clsx(
            "w-full py-4 rounded-xl font-black tracking-widest text-lg transition-all duration-300",
            isOpen && items.length > 0 && !overBudget
              ? "bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.5)] hover:shadow-[0_0_30px_rgba(37,99,235,0.8)]"
              : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
          )}>
          {!isOpen ? 'SYSTEM LOCKED' : overBudget ? 'INSUFFICIENT FUNDS' : items.length === 0 ? 'AWAITING INPUT' : 'TRANSMIT DATA'}
        </button>

        <div className="mt-3 text-center text-xs font-mono flex items-center justify-center gap-2">
          {isSaved ? <span className="text-emerald-400">● {savedAt ? `SYNCED AT ${savedAt}` : 'DATA SYNCED'}</span> 
                   : <span className="text-amber-400 animate-pulse">● UNSAVED (AUTOSAVE IN 5S)</span>}
        </div>
      </div>
    </div>
  )
}