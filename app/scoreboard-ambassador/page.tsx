'use client'
import { useState, useEffect, useCallback } from 'react'
import AuthGuard from '@/components/AuthGuard'
import HomeButton from '@/components/HomeButton'
import GameMap from '@/components/GameMap'
import Scoreboard from '@/components/Scoreboard'
import Timer from '@/components/Timer'
import clsx from 'clsx'
import { RefreshCw, Map, History, Crown } from 'lucide-react'
import { HOUSE_COLORS, HOUSE_NAMES, SHEET_ID, TOTAL_WAVES, getWaveSheetQuery } from '@/lib/constants'
import {
  getMapOwnership, getSubmissionsForWave, getGameState,
  subscribeStore, getActiveDisasterForWave,
} from '@/lib/store'

const D_EMOJI   = ['🌊','🌋','🔥','🌪️','☀️']
const D_NAMES   = ['น้ำท่วม','แผ่นดินไหว','ไฟป่า','พายุ','แล้ง']

function AmbassadorContent() {
  const [tab,         setTab]         = useState<'map'|'history'>('map')
  const [selBaan,     setSelBaan]     = useState<number|null>(null)
  const [selWave,     setSelWave]     = useState(1)
  const [filterDis,   setFilterDis]   = useState<number|null>(null)
  const [ownership,   setOwnership]   = useState(getMapOwnership)
  const [gs,          setGS]          = useState(getGameState)
  const [totalScores, setTotalScores] = useState<{baan:number;score:number}[]>([])
  const [waveBalances,setWaveBalances]= useState<{baan:number;balance:number}[]>([])
  const [loading,     setLoading]     = useState(true)
  const [lastUpdate,  setLastUpdate]  = useState('')

  const fetchScores = useCallback(async () => {
    try {
      // Total score
      const urlT  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=TOTALSCORE`
      const textT = await (await fetch(urlT,{cache:'no-store'})).text()
      const jsT   = textT.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
      if (jsT) {
        const rows: any[] = JSON.parse(jsT)?.table?.rows ?? []
        setTotalScores(rows
          .filter((r:any)=>!isNaN(parseInt(String(r?.c?.[0]?.v??''))))
          .map((r:any)=>({ baan:parseInt(String(r.c[0].v)), score:parseFloat(String(r.c[1]?.v??0))||0 })))
      }
      // Wave balances
      const urlW  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&${getWaveSheetQuery(selWave)}`
      const textW = await (await fetch(urlW,{cache:'no-store'})).text()
      const jsW   = textW.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
      if (jsW) {
        const rows: any[] = JSON.parse(jsW)?.table?.rows ?? []
        setWaveBalances(rows
          .filter((r:any)=>!isNaN(parseInt(String(r?.c?.[0]?.v??''))))
          .map((r:any)=>({ baan:parseInt(String(r.c[0].v)), balance:parseFloat(String(r.c[1]?.v??0))||0 })))
      }
      setLastUpdate(new Date().toLocaleTimeString('th-TH'))
    } catch(e){console.error(e)}
    finally { setLoading(false) }
  }, [selWave])

  useEffect(()=>{
    fetchScores()
    const t = setInterval(fetchScores, 20000)
    return () => clearInterval(t)
  }, [fetchScores])

  useEffect(()=>{
    const unsub = subscribeStore(()=>{ setOwnership(getMapOwnership()); setGS(getGameState()) })
    const poll  = setInterval(()=>{ setOwnership(getMapOwnership()); setGS(getGameState()) }, 3000)
    return ()=>{ unsub(); clearInterval(poll) }
  }, [])

  const waveSubmissions = getSubmissionsForWave(selWave).filter(s => !selBaan || s.baan === selBaan)

  return (
    <div className="wire-page-full">
      <header className="wire-topbar">
        <div className="flex items-center gap-6">
          <HomeButton className="bg-white/10 border-white/20 text-white hover:text-white" />
          <div className="wire-title">Small Group Discussion</div>
        </div>
        <div className="wire-time">
          <Timer endTime={gs.timerEnd} isOpen={gs.isOpen} compact />
        </div>
      </header>

      <main className="wire-scroll">
        <div className="wire-content">
          <section className="wire-layout-two">
            <div className="wire-panel wire-panel-soft">
              <div className="wire-panel-body">
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <button onClick={()=>setTab('map')}
                    className={clsx('btn', tab==='map' ? 'btn-primary' : 'btn-ghost')}>
                    <Map size={14}/> MAP
                  </button>
                  <button onClick={()=>setTab('history')}
                    className={clsx('btn', tab==='history' ? 'btn-primary' : 'btn-ghost')}>
                    <History size={14}/> HISTORY
                  </button>
                  <select value={selBaan||''} onChange={e=>setSelBaan(e.target.value?parseInt(e.target.value):null)}
                    className="input-base w-auto min-w-40">
                    <option value="">ทุกบ้าน</option>
                    {Array.from({length:12},(_,i)=>i+1).map(b=>(
                      <option key={b} value={b}>{HOUSE_NAMES[b]}</option>
                    ))}
                  </select>
                  <div className="ml-auto flex flex-wrap gap-1">
                    {Array.from({length:TOTAL_WAVES},(_,i)=>i+1).map(w=>(
                      <button key={w} onClick={()=>setSelWave(w)}
                        className={clsx('btn px-3', selWave===w ? 'btn-success' : 'btn-ghost')}>
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                {tab==='map' ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {D_NAMES.map((n,i)=>(
                        <button key={i+1} onClick={()=>setFilterDis(filterDis===i+1?null:i+1)}
                          className={clsx('btn disaster-filter', filterDis===i+1 ? 'active' : '')}>
                          D{i+1} <span>{n}</span>
                        </button>
                      ))}
                    </div>
                    <GameMap ownership={ownership} filterDisaster={filterDis} readOnly
                      kingDisaster={getActiveDisasterForWave(gs.currentWave)} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="wire-section-title">History - Wave {selWave}</div>
                    {waveSubmissions.length === 0 ? (
                      <div className="wire-panel bg-white p-10 text-center text-slate-600">ยังไม่มีข้อมูล Wave {selWave}</div>
                    ) : waveSubmissions.map(sub=>(
                      <div key={`${sub.baan}-${sub.wave}`} className="wire-panel bg-white p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{background:HOUSE_COLORS[sub.baan]}} />
                          <strong style={{color:HOUSE_COLORS[sub.baan]}}>{HOUSE_NAMES[sub.baan]}</strong>
                          {sub.isKing && <span className="badge badge-gold"><Crown size={10}/> KING</span>}
                          <span className="ml-auto text-xs text-slate-500">{sub.timestamp}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {sub.bets.map(bet=>(
                            <span key={bet.area} className="rounded bg-slate-100 px-3 py-1 text-sm">
                              {bet.area}: {bet.amount.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside className="wire-panel wire-panel-green wire-sidebar-fill">
              <div className="w-full">
                <h2 className="mb-6 text-4xl font-semibold leading-tight">Leader Board<br />12 บ้าน</h2>
                {loading ? (
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
                ) : (
                  <Scoreboard entries={totalScores} compact />
                )}
              </div>
            </aside>
          </section>
        </div>
      </main>
    </div>
  )

}

export default function AmbassadorPage() {
  return (
    <AuthGuard pageKey="web4" expectedPassword="web4"
      title="ห้องทูต" subtitle="กรอกรหัสเพื่อดู Scoreboard"
      accentColor="#10b981">
      <AmbassadorContent />
    </AuthGuard>
  )
}
