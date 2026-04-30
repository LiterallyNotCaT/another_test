'use client'
import { useState, useEffect, useCallback } from 'react'
import AuthGuard from '@/components/AuthGuard'
import HomeButton from '@/components/HomeButton'
import Scoreboard from '@/components/Scoreboard'
import { HOUSE_COLORS, HOUSE_NAMES, SHEET_ID } from '@/lib/constants'
import { RefreshCw } from 'lucide-react'
import clsx from 'clsx'

interface Score { baan:number; morning:number; betray:number; total:number }

function MorningContent() {
  const [scores,      setScores]      = useState<Score[]>([])
  const [loading,     setLoading]     = useState(true)
  const [lastUpdate,  setLastUpdate]  = useState('')
  const [tab,         setTab]         = useState<'rank'|'detail'>('rank')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Recap%20Morning`
      const text = await (await fetch(url,{cache:'no-store'})).text()
      const js   = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
      if (!js) return
      const rows: any[] = JSON.parse(js)?.table?.rows ?? []
      const parsed: Score[] = []
      for (const r of rows) {
        const baan = parseInt(r?.c?.[0]?.v)
        if (isNaN(baan)||baan<1||baan>12) continue
        parsed.push({
          baan,
          morning: parseFloat(r?.c?.[1]?.v??0)||0,
          betray:  parseFloat(r?.c?.[2]?.v??0)||0,
          total:   parseFloat(r?.c?.[3]?.v??0)||0,
        })
      }
      setScores(parsed)
      setLastUpdate(new Date().toLocaleTimeString('th-TH'))
    } catch(e){console.error(e)}
    finally { setLoading(false) }
  }, [])

  useEffect(()=>{ fetchData(); const t=setInterval(fetchData,30000); return()=>clearInterval(t) },[fetchData])

  const sorted = [...scores].sort((a,b)=>b.total-a.total)

  return (
    <div className="wire-page">
      <header className="wire-topbar">
        <div className="flex items-center gap-6">
          <HomeButton className="bg-white/10 border-white/20 text-white hover:text-white" />
          <div className="wire-title">Morning Scoreboard</div>
        </div>
        <div className="wire-time">{lastUpdate ? `Updated ${lastUpdate}` : 'Loading...'}</div>
      </header>

      <main className="wire-content">
        <div className="wire-pill-row">
          <button onClick={()=>setTab('rank')}
            className={clsx('wire-pill', tab==='rank' ? '' : 'opacity-70')}>Ranking</button>
          <button onClick={()=>setTab('detail')}
            className={clsx('wire-pill', tab==='detail' ? '' : 'opacity-70')}>Details</button>
          <button onClick={fetchData} className="btn btn-ghost ml-auto">
            <RefreshCw size={14} className={clsx(loading && 'animate-spin')} /> Refresh
          </button>
        </div>

        <section className="wire-panel">
          <div className="wire-section-title">Scoreboard เช้า</div>
          <div className="wire-panel-body">
            {loading && scores.length===0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-600">กำลังโหลดข้อมูล...</p>
              </div>
            ) : tab==='rank' ? (
              <div className="mx-auto max-w-3xl space-y-5">
                {sorted.length >= 3 && (
                  <div className="podium-grid">
                    {[
                      { item: sorted[1], rank: 2, icon: '🥈' },
                      { item: sorted[0], rank: 1, icon: '🥇' },
                      { item: sorted[2], rank: 3, icon: '🥉' },
                    ].map(({ item, rank, icon }) => (
                      <div key={item.baan} className={clsx('podium-card', rank === 1 && 'podium-card-first')}>
                        <div className="text-3xl animate-float">{icon}</div>
                        <div className="mt-2 font-display text-sm font-bold" style={{ color: HOUSE_COLORS[item.baan] }}>
                          {HOUSE_NAMES[item.baan]}
                        </div>
                        <div className="font-mono text-xl font-bold text-slate-900">{item.total.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
                <Scoreboard entries={sorted.map(s=>({baan:s.baan,score:s.total}))} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">บ้าน</th>
                      <th className="px-4 py-3 text-right">เช้า</th>
                      <th className="px-4 py-3 text-right">Betray</th>
                      <th className="px-4 py-3 text-right">รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s,i)=>(
                      <tr key={s.baan} className="border-b border-slate-100">
                        <td className="px-4 py-3">#{i+1}</td>
                        <td className="px-4 py-3 font-semibold" style={{color:HOUSE_COLORS[s.baan]}}>{HOUSE_NAMES[s.baan]}</td>
                        <td className="px-4 py-3 text-right font-mono">{s.morning.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono">{s.betray.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">{s.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )

}

export default function ScoreboardMorningPage() {
  return (
    <AuthGuard pageKey="web1" expectedPassword="web1"
      title="Scoreboard เช้า" subtitle="กรอกรหัสเพื่อดูผลคะแนน"
      accentColor="#f59e0b">
      <MorningContent />
    </AuthGuard>
  )
}
