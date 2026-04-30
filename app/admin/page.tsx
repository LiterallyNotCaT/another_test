'use client'
import { useState, useEffect, useCallback } from 'react'
import AuthGuard from '@/components/AuthGuard'
import HomeButton from '@/components/HomeButton'
import GameMap from '@/components/GameMap'
import Scoreboard from '@/components/Scoreboard'
import Timer from '@/components/Timer'
import clsx from 'clsx'
import {
  RefreshCw, ChevronLeft, ChevronRight, Play, Square,
  Zap, RotateCcw, Map, History, Trophy,
  LayoutDashboard, CheckCircle2, Clock, ExternalLink,
} from 'lucide-react'
import { HOUSE_COLORS, HOUSE_NAMES, SHEET_BASE, SHEET_ID, TOTAL_WAVES, getWaveSheetQuery } from '@/lib/constants'
import { fetchWaveInputs, type WaveInputRow } from '@/lib/sheets'
import {
  getGameState, setGameState, getMapOwnership, setMapOwnership,
  getSubmissionsForWave,
  getActiveDisasterForWave, subscribeStore,
} from '@/lib/store'

function AdminContent() {
  const [gs,          setGS]          = useState(getGameState)
  const [ownership,   setOwnership]   = useState(getMapOwnership)
  const [tab,         setTab]         = useState<'dashboard'|'map'|'history'|'leaderboard'>('dashboard')
  const [selBaan,     setSelBaan]     = useState<number|null>(null)
  const [selWave,     setSelWave]     = useState(1)
  const [totalScores, setTotalScores] = useState<{baan:number;score:number}[]>([])
  const [sheetInputs, setSheetInputs] = useState<Record<number, WaveInputRow[]>>({})
  const [sheetKingDisasters, setSheetKingDisasters] = useState<Record<number, number | null>>({})
  const filterDis = null
  const [toast,       setToast]       = useState<{msg:string;type:'ok'|'warn'|'err'}>()
  const [duration,    setDuration]    = useState('10')
  const [processing,  setProcessing]  = useState(false)

  const notify = (msg:string, type:'ok'|'warn'|'err'='ok') => {
    setToast({msg,type}); setTimeout(()=>setToast(undefined), 3500)
  }

  const applyGS = (patch: Parameters<typeof setGameState>[0]) => {
    setGameState(patch); setGS(getGameState())
  }

  // ── Fetch all sheet scores ──────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const fetchSheet = async (sheet: string) => {
        const waveMatch = sheet.match(/^Wave (\d+)$/)
        const query = waveMatch ? getWaveSheetQuery(parseInt(waveMatch[1])) : `sheet=${encodeURIComponent(sheet)}`
        const url  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&${query}`
        const text = await (await fetch(url,{cache:'no-store'})).text()
        const js   = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
        return js ? (JSON.parse(js)?.table?.rows ?? []) : []
      }

      // Total
      const totalRows: any[] = await fetchSheet('TOTALSCORE')
      setTotalScores(totalRows
        .filter((r:any)=>!isNaN(parseInt(String(r?.c?.[0]?.v??''))))
        .map((r:any)=>({ baan:parseInt(String(r.c[0].v)), score:parseFloat(String(r.c[1]?.v??0))||0 })))

      const inputs: Record<number, WaveInputRow[]> = {}
      const disasters: Record<number, number | null> = {}
      for (let w=1; w<=TOTAL_WAVES; w++) {
        const data = await fetchWaveInputs(w)
        inputs[w] = data.rows
        disasters[w] = data.kingDisaster
      }
      setSheetInputs(inputs)
      setSheetKingDisasters(disasters)
    } catch(e){ console.error(e) }
  }, [])

  useEffect(()=>{ fetchAll(); const t=setInterval(fetchAll,15000); return()=>clearInterval(t) },[fetchAll])

  useEffect(()=>{
    const u=subscribeStore(()=>{ setGS(getGameState()); setOwnership(getMapOwnership()) })
    return u
  },[])

  // ── Controls ────────────────────────────────────────────
  const gotoWave = (w:number) => {
    applyGS({currentWave:w, isOpen:false, timerEnd:null})
    notify(`➡ เข้าสู่ Wave ${w}`)
  }
  const startTimer = () => {
    const mins = parseFloat(duration)||10
    applyGS({isOpen:true, timerEnd:new Date(Date.now()+mins*60000).toISOString(), duration:mins})
    notify(`▶ เปิดรับข้อมูล ${mins} นาที`)
  }
  const stopTimer = () => { applyGS({isOpen:false}); notify('⏹ ปิดรับข้อมูลแล้ว') }
  const addTime = (m:number) => {
    const cur = gs.timerEnd ? new Date(gs.timerEnd).getTime() : Date.now()
    applyGS({timerEnd:new Date(Math.max(Date.now(),cur)+m*60000).toISOString(), isOpen:true})
    notify(`+${m} นาที`)
  }
  const processWave = async () => {
    setProcessing(true)
    await fetchAll()
    notify(`${gs.gameMode === 'bet' ? 'Bet' : 'Bid'} Wave ${gs.currentWave} refreshed from Google Sheet`)
    setProcessing(false)
  }
  const resetMap = () => {
    if (!confirm('รีเซ็ต Map ทั้งหมด?')) return
    setMapOwnership({}); setOwnership({}); notify('🗺 Reset Map แล้ว')
  }

  const localSubmittedBaans = getSubmissionsForWave(gs.currentWave).map(s=>s.baan)
  const sheetSubmittedBaans = (sheetInputs[gs.currentWave] ?? []).filter(r=>r.hasInput).map(r=>r.baan)
  const submittedBaans = Array.from(new Set([...localSubmittedBaans, ...sheetSubmittedBaans]))
  const waveSubmissions = getSubmissionsForWave(selWave).filter(s=>!selBaan||s.baan===selBaan)
  const selectedSheetRows = (sheetInputs[selWave] ?? [])
    .filter(r=>!selBaan||r.baan===selBaan)
  const selectedSheetSubmitted = selectedSheetRows.filter(r=>r.hasInput)

  // ── Toast color ─────────────────────────────────────────
  const toastStyle = toast?.type==='err'
    ? 'border-red-500/30 bg-red-950/60'
    : toast?.type==='warn'
    ? 'border-yellow-500/30 bg-yellow-950/60'
    : 'border-emerald-500/30 bg-emerald-950/60'

  return (
    <div className="wire-page-full">
      <header className="wire-topbar">
        <div className="flex items-center gap-6">
          <HomeButton className="bg-white/10 border-white/20 text-white hover:text-white" />
          <div className="wire-title">ADMIN</div>
        </div>
        <div className="wire-time">
          <Timer endTime={gs.timerEnd} isOpen={gs.isOpen} compact />
        </div>
      </header>

      <main className="wire-scroll">
        <div className="wire-content">
          {toast && (
            <div className={clsx('fixed right-5 top-24 z-50 rounded px-4 py-3 text-sm text-white shadow-lg', toastStyle)}>
              {toast.msg}
            </div>
          )}

          <div className="wire-pill-row">
            <div className="wire-pill">TIMER</div>
            <div className="wire-toolbar-panel">Panel คุมการเปลี่ยนรอบ, คุมช่วงเวลาส่งข้อมูล</div>
            <button onClick={()=>applyGS({gameMode:'bid'})}
              className={clsx('btn', gs.gameMode !== 'bet' ? 'btn-primary' : 'btn-ghost')}>
              Bid game
            </button>
            <button onClick={()=>applyGS({gameMode:'bet'})}
              className={clsx('btn', gs.gameMode === 'bet' ? 'btn-primary' : 'btn-ghost')}>
              Bet game
            </button>
            <div className={clsx('badge', gs.isOpen?'badge-green':'badge-red')}>
              <span className={clsx('status-dot', gs.isOpen?'online':'offline')} />
              {gs.isOpen?'OPEN':'CLOSED'}
            </div>
            <a href={SHEET_BASE} target="_blank" rel="noreferrer" className="btn btn-ghost">
              <ExternalLink size={14} /> Google Sheet
            </a>
          </div>

          <section className="wire-layout-admin">
            <div className="wire-panel wire-panel-purple wire-main-hero">
              <div className="wire-panel-body w-full">
                <div className="mb-6 flex flex-wrap justify-center gap-2">
                  {([
                    ['dashboard','Dashboard',<LayoutDashboard key="d" size={14}/>],
                    ['map','MAP',<Map key="m" size={14}/>],
                    ['history','History',<History key="h" size={14}/>],
                    ['leaderboard','Leaderboard',<Trophy key="t" size={14}/>],
                  ] as const).map(([value,label,icon])=>(
                    <button key={value} onClick={()=>setTab(value as any)}
                      className={clsx('btn', tab===value ? 'btn-primary' : 'btn-ghost')}>
                      {icon} {label}
                    </button>
                  ))}
                </div>

                {tab==='dashboard' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="wire-panel bg-white p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="text-label">Wave {gs.currentWave} submissions</p>
                        <span className="badge badge-blue">Sheet + local</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({length:12},(_,i)=>i+1).map(b=>(
                          <div key={b} className={clsx('rounded border p-3 text-center',
                            submittedBaans.includes(b) ? 'border-green-400 bg-green-50' : 'border-slate-200 bg-white')}>
                            <div className="font-bold" style={{color:HOUSE_COLORS[b]}}>{b}</div>
                            {submittedBaans.includes(b) ? <CheckCircle2 className="mx-auto text-green-500" size={16}/> : <Clock className="mx-auto text-slate-300" size={16}/>}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded bg-green-50 px-3 py-2 text-green-700">Sent: {submittedBaans.length}/12</div>
                        <div className="rounded bg-amber-50 px-3 py-2 text-amber-700">Waiting: {12-submittedBaans.length}</div>
                      </div>
                    </div>
                    <div className="wire-panel bg-white p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="text-label">Wave {gs.currentWave} sheet input</p>
                        <button onClick={fetchAll} className="btn btn-ghost py-1.5 px-2 text-xs">
                          <RefreshCw size={12} /> Refresh
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(sheetInputs[gs.currentWave] ?? []).map(row=>{
                          const local = getSubmissionsForWave(gs.currentWave).find(s=>s.baan===row.baan)
                          const betText = row.betTarget || local?.betTarget
                          const betAmountText = row.betAmount || local?.betAmount || 0
                          const islandText = row.islands.filter(x=>x.name || x.amount).map(x=>`${x.name || '-'}:${x.amount.toLocaleString()}`)
                          return (
                            <div key={row.baan} className={clsx('rounded border px-3 py-2 text-sm', row.hasInput || local ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50')}>
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{background:HOUSE_COLORS[row.baan]}} />
                                <span className="w-20 font-semibold" style={{color:HOUSE_COLORS[row.baan]}}>{HOUSE_NAMES[row.baan]}</span>
                                <span className="ml-auto font-mono text-xs">{row.balance.toLocaleString()}</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-600">
                                Bet: {betText ? `บ้าน ${betText} / ${Number(betAmountText).toLocaleString()}` : '-'} · King: {row.kingAmount ? row.kingAmount.toLocaleString() : '-'} · Islands: {islandText.length ? islandText.join(', ') : '-'}
                              </div>
                            </div>
                          )
                        })}
                        {(sheetInputs[gs.currentWave] ?? []).length === 0 && (
                          <div className="rounded bg-amber-50 px-3 py-4 text-center text-sm text-amber-700">
                            Cannot read Wave {gs.currentWave} from Google Sheet yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {tab==='map' && (
                  <GameMap ownership={ownership} filterDisaster={filterDis}
                    kingDisaster={getActiveDisasterForWave(gs.currentWave)} readOnly />
                )}

                {tab==='history' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {Array.from({length:TOTAL_WAVES},(_,i)=>i+1).map(w=>(
                        <button key={w} onClick={()=>setSelWave(w)}
                          className={clsx('btn', selWave===w ? 'btn-primary' : 'btn-ghost')}>W{w}</button>
                      ))}
                      <select value={selBaan||''} onChange={e=>setSelBaan(e.target.value?parseInt(e.target.value):null)}
                        className="input-base w-auto">
                        <option value="">ทุกบ้าน</option>
                        {Array.from({length:12},(_,i)=>i+1).map(b=><option key={b} value={b}>{HOUSE_NAMES[b]}</option>)}
                      </select>
                    </div>
                    <div className="wire-panel bg-white p-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="badge badge-blue">Google Sheet Wave {selWave}</span>
                        <span className="badge badge-green">{selectedSheetSubmitted.length}/12 sent</span>
                        {sheetKingDisasters[selWave] && <span className="badge badge-gold">H22: D{sheetKingDisasters[selWave]}</span>}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="px-3 py-2 text-left">House</th>
                              <th className="px-3 py-2 text-left">Bet C:D</th>
                              <th className="px-3 py-2 text-left">King F</th>
                              <th className="px-3 py-2 text-left">Island 1 H:I</th>
                              <th className="px-3 py-2 text-left">Island 2 K:L</th>
                              <th className="px-3 py-2 text-left">Island 3 N:O</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSheetRows.map(row=>(
                              <tr key={row.baan} className="border-b border-slate-100">
                                <td className="px-3 py-2 font-semibold" style={{color:HOUSE_COLORS[row.baan]}}>{HOUSE_NAMES[row.baan]}</td>
                                <td className="px-3 py-2 font-mono">{row.betTarget ? `${row.betTarget} / ${row.betAmount.toLocaleString()}` : '-'}</td>
                                <td className="px-3 py-2 font-mono">{row.kingAmount ? row.kingAmount.toLocaleString() : '-'}</td>
                                {row.islands.map((island, idx)=>(
                                  <td key={idx} className="px-3 py-2 font-mono">
                                    {island.name || island.amount ? `${island.name || '-'} / ${island.amount.toLocaleString()}` : '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {waveSubmissions.map(sub=>(
                      <div key={`${sub.baan}-${sub.wave}`} className="wire-panel bg-white p-4 text-sm">
                        <strong style={{color:HOUSE_COLORS[sub.baan]}}>{HOUSE_NAMES[sub.baan]}</strong>
                        {(sub.betTarget || sub.betAmount) && (
                          <div className="mt-2 rounded bg-blue-50 px-3 py-2 text-slate-700">
                            Bet: บ้าน {sub.betTarget ?? '-'} / {(sub.betAmount ?? 0).toLocaleString()}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sub.bets.map(bet=><span key={bet.area} className="rounded bg-slate-100 px-3 py-1">{bet.area}: {bet.amount}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tab==='leaderboard' && (
                  <div className="wire-panel bg-white p-5">
                    <Scoreboard entries={totalScores} showRewards />
                  </div>
                )}
              </div>
            </div>

            <aside className="wire-panel wire-panel-green wire-sidebar-fill">
              <div className="w-full space-y-5">
                <h2 className="text-4xl font-bold leading-tight">Panel คุมการเปลี่ยน<br />รอบ, คุมช่วงเวลาส่ง<br />ข้อมูล</h2>
                <div className="wire-panel bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <button onClick={()=>gs.currentWave>1&&gotoWave(gs.currentWave-1)} className="btn btn-ghost"><ChevronLeft size={18}/></button>
                    <div className="text-5xl font-bold text-blue-600">{gs.currentWave}</div>
                    <button onClick={()=>gs.currentWave<TOTAL_WAVES&&gotoWave(gs.currentWave+1)} className="btn btn-ghost"><ChevronRight size={18}/></button>
                  </div>
                  <div className="mb-3 flex items-center gap-2">
                    <input type="number" min={1} max={120} value={duration}
                      onChange={e=>setDuration(e.target.value)} className="input-base text-center" />
                    <span>นาที</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={startTimer} className="btn btn-success"><Play size={14}/> เปิด</button>
                    <button onClick={stopTimer} className="btn btn-danger"><Square size={14}/> ปิด</button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {[1,2,5,10].map(m=><button key={m} onClick={()=>addTime(m)} className="btn btn-ghost flex-1">+{m}</button>)}
                  </div>
                </div>
                <button onClick={processWave} disabled={processing} className="btn btn-primary w-full">
                  <Zap size={15}/> Refresh Sheet Wave {gs.currentWave}
                </button>
                <button onClick={resetMap} className="btn btn-ghost w-full">
                  <RotateCcw size={14}/> Reset Map
                </button>
              </div>
            </aside>
          </section>
        </div>
      </main>
    </div>
  )

}

export default function AdminPage() {
  return (
    <AuthGuard pageKey="web5" expectedPassword="web5"
      title="Admin Panel" subtitle="กรอกรหัส Admin เพื่อเข้าสู่ระบบ"
      accentColor="#3b82f6">
      <AdminContent />
    </AuthGuard>
  )
}
