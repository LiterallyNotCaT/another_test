'use client'
import clsx from 'clsx'
import { HOUSE_COLORS, HOUSE_NAMES, RANK_REWARDS } from '@/lib/constants'
import { withCompetitionRanks } from '@/lib/ranking'

interface ScoreEntry {
  baan:    number
  score:   number
  extra?:  Record<string, string | number>
}

interface ScoreboardProps {
  entries:      ScoreEntry[]
  title?:       string
  wave?:        number
  showRewards?: boolean
  compact?:     boolean
  highlight?:   number
}

const RANK_ICONS = ['🥇','🥈','🥉']

export default function Scoreboard({
  entries, title, wave, showRewards, compact, highlight,
}: ScoreboardProps) {
  const sorted = withCompetitionRanks(
    [...entries].sort((a, b) => b.score - a.score),
    entry => entry.score,
  )
  const max    = sorted[0]?.score || 1

  return (
    <div className="space-y-2">
      {/* Header */}
      {(title || wave !== undefined) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="font-display font-semibold text-sm text-white">{title}</h3>}
          {wave !== undefined && (
            <span className="badge badge-blue">Wave {wave}</span>
          )}
        </div>
      )}

      {/* Entries */}
      <div className="space-y-1.5">
        {sorted.map((entry) => {
          const rank      = entry.rank
          const color     = HOUSE_COLORS[entry.baan]
          const isTop3    = rank <= 3
          const isHighlit = highlight === entry.baan
          const reward    = showRewards ? RANK_REWARDS[rank] : null
          const barW      = max > 0 ? Math.max(4, (entry.score / max) * 100) : 0

          return (
            <div key={entry.baan}
              className={clsx(
                'relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group overflow-hidden',
                isHighlit
                  ? 'ring-1 ring-blue-500/50'
                  : 'hover:bg-white/3',
                isTop3 ? 'surface-elevated' : 'glass-light'
              )}
              style={isTop3 ? {
                borderColor: color + '25',
              } : undefined}>

              {/* Score bar background */}
              <div className="absolute inset-0 rounded-xl transition-all duration-500 pointer-events-none"
                style={{
                  background: `linear-gradient(90deg, ${color}10 0%, transparent ${barW}%)`,
                  opacity: isTop3 ? 1 : 0.6,
                }} />

              {/* Rank */}
              <div className="w-7 flex-shrink-0 flex items-center justify-center relative z-10">
                {isTop3
                  ? <span className="text-base leading-none">{RANK_ICONS[rank - 1]}</span>
                  : <span className="font-mono text-xs text-slate-600 font-bold">#{rank}</span>}
              </div>

              {/* Color dot */}
              <div className="w-2 h-2 rounded-full flex-shrink-0 relative z-10"
                style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />

              {/* Name */}
              <div className="flex-1 min-w-0 relative z-10">
                <div className={clsx('font-display font-semibold text-sm truncate',
                  isHighlit ? 'text-blue-300' : isTop3 ? 'text-white' : 'text-slate-300')}>
                  {HOUSE_NAMES[entry.baan]}
                </div>
                {entry.extra && (
                  <div className="flex gap-2 mt-0.5">
                    {Object.entries(entry.extra).map(([k, v]) => (
                      <span key={k} className="text-2xs text-slate-600">{k}: <span className="text-slate-500">{v}</span></span>
                    ))}
                  </div>
                )}
              </div>

              {/* Reward */}
              {reward && !compact && (
                <span className="text-2xs text-slate-600 font-mono relative z-10">×{reward}</span>
              )}

              {/* Score */}
              <div className="text-right flex-shrink-0 relative z-10">
                <div className={clsx('font-mono font-bold text-sm')}
                  style={{ color, textShadow: isTop3 ? `0 0 12px ${color}60` : 'none' }}>
                  {entry.score.toLocaleString()}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-10 text-slate-700 text-sm">ยังไม่มีข้อมูล</div>
      )}
    </div>
  )
}
