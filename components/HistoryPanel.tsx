'use client'
import clsx from 'clsx'
import { HOUSE_COLORS, HOUSE_NAMES } from '@/lib/constants'
import { TrendingUp, TrendingDown, Target, Star, AlertTriangle, Sunrise } from 'lucide-react'

interface HistoryEntry {
  wave?:      number
  label:      string
  detail?:    string
  amount:     number
  type:       'income' | 'bet' | 'reward' | 'lose' | 'start' | 'disaster'
  timestamp?: string
  betTarget?: number
}

interface HistoryPanelProps {
  entries:    HistoryEntry[]
  baan?:      number
  balance?:   number
  title?:     string
  maxHeight?: string
  chronological?: boolean
  onBetReturnRankingClick?: (wave: number, betTarget?: number) => void
  onLadderRankingClick?: (wave: number) => void
}

const TYPE_META = {
  income:   { icon: TrendingUp,    color: 'text-green-400',  bg: 'bg-green-500/10',  sign: '+' },
  bet:      { icon: Target,        color: 'text-orange-400', bg: 'bg-orange-500/10', sign: '−' },
  reward:   { icon: Star,          color: 'text-yellow-400', bg: 'bg-yellow-500/10', sign: '+' },
  lose:     { icon: TrendingDown,  color: 'text-red-400',    bg: 'bg-red-500/10',    sign: '−' },
  start:    { icon: Sunrise,       color: 'text-blue-400',   bg: 'bg-blue-500/10',   sign: '+' },
  disaster: { icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-500/10',    sign: '−' },
}

export default function HistoryPanel({
  entries, baan, balance, title, maxHeight = '420px', chronological = false,
  onBetReturnRankingClick,
  onLadderRankingClick,
}: HistoryPanelProps) {
  const color = baan ? HOUSE_COLORS[baan] : '#3b82f6'

  // Group by wave
  const grouped: Record<string | number, HistoryEntry[]> = {}
  for (const e of entries) {
    const key = e.wave ?? 'start'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(e)
  }
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (chronological) {
      if (a === 'start') return -1
      if (b === 'start') return 1
      return Number(a) - Number(b)
    }
    if (a === 'start') return 1
    if (b === 'start') return -1
    return Number(b) - Number(a)
  })

  return (
    <div className="history-panel flex flex-col gap-3">
      {/* Title row */}
      {(title || baan) && (
        <div className="flex items-center justify-between flex-shrink-0">
          {title && <h3 className="history-panel-title font-display font-semibold text-sm text-slate-300">{title}</h3>}
          {baan && (
            <span className="badge" style={{
              background: color + '18',
              color,
              borderColor: color + '30',
            }}>
              {HOUSE_NAMES[baan]}
            </span>
          )}
        </div>
      )}

      {balance !== undefined && (
        <div className="glass-light rounded-xl px-4 py-3 flex items-center justify-between flex-shrink-0">
          <span className="text-label">Current Balance</span>
          <span className="font-mono font-bold text-lg text-green-400 text-glow-green">
            {balance.toLocaleString()}
          </span>
        </div>
      )}

      {/* Scrollable list */}
      <div className="history-panel-list flex-1 space-y-4 pr-0.5" style={{ maxHeight }}>
        {groupKeys.map(key => {
          const groupEntries = grouped[key]
          const isStart = key === 'start'
          return (
            <div key={key}>
              {/* Wave divider */}
              <div className="flex items-center gap-3 mb-2.5">
                <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${color}40, transparent)` }} />
                <span className="history-wave-divider-label text-2xs font-display font-bold tracking-widest px-3 py-1.5 rounded-full"
                  style={{ background: color + '18', color }}>
                  {isStart ? 'เริ่มต้น' : `รอบที่ ${key}`}
                </span>
                <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}40)` }} />
              </div>

              {/* Entries */}
              <div className="space-y-1.5">
                {(chronological ? groupEntries : [...groupEntries].reverse()).map((entry, i) => {
                  const meta = TYPE_META[entry.type]
                  const Icon = meta.icon
                  const isPositive = entry.amount === 0 || ['income','reward','start'].includes(entry.type)
                  const showBetReturnRanking = entry.wave !== undefined && entry.label.startsWith('Bet return')
                  const showLadderRanking = entry.wave !== undefined && entry.label === 'เกมพลิกเกม - บันไดงูพิสดาร'
                  return (
                    <div key={i} className="glass-light rounded-xl px-3 py-2.5 flex items-start gap-3">
                      {/* Icon */}
                      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', meta.bg)}>
                        <Icon size={13} className={meta.color} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-300 leading-snug">{entry.label}</div>
                        {entry.detail && (
                          <div className="text-2xs text-slate-600 mt-0.5 leading-relaxed whitespace-pre-line">{entry.detail}</div>
                        )}
                        {entry.timestamp && (
                          <div className="text-2xs text-slate-700 mt-0.5 font-mono">{entry.timestamp}</div>
                        )}
                        {showBetReturnRanking && onBetReturnRankingClick && (
                          <button
                            type="button"
                            onClick={() => onBetReturnRankingClick(entry.wave!, entry.betTarget)}
                            className="mini-game-ranking-button"
                          >
                            ดูอันดับการเล่นเกมเดี่ยว
                          </button>
                        )}
                        {showLadderRanking && onLadderRankingClick && (
                          <button
                            type="button"
                            onClick={() => onLadderRankingClick(entry.wave!)}
                            className="mini-game-ranking-button"
                          >
                            ดูอันดับเงินที่ได้จากเกมบันไดงู
                          </button>
                        )}
                      </div>

                      {/* Amount */}
                      <div className={clsx('font-mono font-bold text-sm flex-shrink-0', meta.color)}>
                        {isPositive ? '+' : '−'}{Math.abs(entry.amount).toLocaleString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-700">
            <div className="text-4xl mb-3 opacity-40">📭</div>
            <div className="text-sm">ยังไม่มีประวัติ</div>
          </div>
        )}
      </div>
    </div>
  )
}
