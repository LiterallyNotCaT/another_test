'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import AuthGuard from '@/components/AuthGuard'
import HomeButton from '@/components/HomeButton'
import GameMap from '@/components/GameMap'
import FinanceHistory from '@/components/FinanceHistory'
import FullscreenButton from '@/components/FullscreenButton'
import OwnershipHistory, { useWaveOwnership } from '@/components/OwnershipHistory'
import SharedScoreboard from '@/components/SharedScoreboard'
import Timer from '@/components/Timer'
import clsx from 'clsx'
import {
  RefreshCw, ChevronLeft, ChevronRight, Play, Square,
  Zap, Map, History, Trophy,
  LayoutDashboard, CheckCircle2, Clock, ExternalLink,
} from 'lucide-react'
import { HOUSE_COLORS, HOUSE_NAMES, SHEET_BASE, TOTAL_WAVES } from '@/lib/constants'
import { AFTERNOON_SCORE_CSV_URL } from '@/lib/scoreboardSources'
import { fetchWaveInputs, type WaveInputRow } from '@/lib/sheets'
import {
  getGameState, setGameState, getMapOwnership,
  getActiveDisasterForWave, getSubmissions, getSubmissionsForWave, subscribeStore, startCloudSync,
} from '@/lib/store'

function AdminContent() {
  const [gs,          setGS]          = useState(getGameState)
  const [ownership,   setOwnership]   = useState(getMapOwnership)
  const [tab,         setTab]         = useState<'dashboard'|'map'|'history'|'ownership'|'leaderboard'>('dashboard')
  const [mapWave,     setMapWave]     = useState(getGameState().currentWave)
  const [submissionWave, setSubmissionWave] = useState(getGameState().currentWave)
  const [submissionGame, setSubmissionGame] = useState<'bid'|'bet'>(getGameState().gameMode === 'bet' ? 'bet' : 'bid')
  const [sheetInputs, setSheetInputs] = useState<Record<number, WaveInputRow[]>>({})
  const [savePulses,  setSavePulses]  = useState<Record<number, { count: number; at: number }>>({})
  const [nowTick,     setNowTick]     = useState(Date.now())
  const filterDis = null
  const [toast,       setToast]       = useState<{msg:string;type:'ok'|'warn'|'err'}>()
  const [duration,    setDuration]    = useState('10')
  const [processing,  setProcessing]  = useState(false)
  const [isLoaded,    setIsLoaded]    = useState(false)
  const submissionSnapshotRef = useRef<Record<string, number>>({})
  const sheetOwnership = useWaveOwnership(mapWave)

  const notify = (msg:string, type:'ok'|'warn'|'err'='ok') => {
    setToast({msg,type}); setTimeout(()=>setToast(undefined), 3500)
  }

  const applyGS = (patch: Parameters<typeof setGameState>[0]) => {
    setGameState(patch); setGS(getGameState())
  }

  useEffect(() => {
    const localState = getGameState()
    setGS(localState)
    setOwnership(getMapOwnership())
    setMapWave(localState.currentWave)
    setSubmissionWave(localState.currentWave)
    setSubmissionGame(localState.gameMode === 'bet' ? 'bet' : 'bid')
    setIsLoaded(true)
  }, [])

  useEffect(() => startCloudSync(800), [])

  // ── Fetch all sheet scores ──────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const inputs: Record<number, WaveInputRow[]> = {}
      for (let w=1; w<=TOTAL_WAVES; w++) {
        const data = await fetchWaveInputs(w)
        inputs[w] = data.rows
      }
      setSheetInputs(inputs)
    } catch(e){ console.error(e) }
  }, [])

  useEffect(()=>{
    const first = window.setTimeout(fetchAll, 0)
    const t = setInterval(fetchAll,15000)
    return()=>{ window.clearTimeout(first); clearInterval(t) }
  },[fetchAll])

  useEffect(()=>{
    if (!isLoaded) return
    const u=subscribeStore((key)=>{
      const nextState = getGameState()
      setGS(nextState)
      setOwnership(getMapOwnership())
      if (key === 'biggame_submissions') {
        const current = getSubmissionsForWave(nextState.currentWave)
        const snapshot = submissionSnapshotRef.current
        const changedBaans = current
          .filter(s => {
            const revision = s.revision ?? 1
            const id = `${s.wave}:${s.baan}`
            return snapshot[id] !== revision
          })
          .map(s => s.baan)
        submissionSnapshotRef.current = {
          ...snapshot,
          ...Object.fromEntries(current.map(s => [`${s.wave}:${s.baan}`, s.revision ?? 1])),
        }
        if (!changedBaans.length) return
        const now = Date.now()
        setSavePulses(prev => {
          const next = { ...prev }
          changedBaans.forEach(baan => {
            next[baan] = { count: (prev[baan]?.count ?? 0) + 1, at: now }
          })
          return next
        })
      }
    })
    return u
  },[isLoaded])

  useEffect(() => {
    submissionSnapshotRef.current = Object.fromEntries(
      getSubmissions().map(s => [`${s.wave}:${s.baan}`, s.revision ?? 1]),
    )
  }, [])

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    setMapWave(gs.currentWave)
    setSubmissionWave(gs.currentWave)
    setSubmissionGame(gs.gameMode === 'bet' ? 'bet' : 'bid')
  }, [gs.currentWave, gs.gameMode])

  useEffect(() => {
    if (!gs.isOpen || !gs.timerEnd) return
    const ms = new Date(gs.timerEnd).getTime() - Date.now()
    const timeout = window.setTimeout(() => applyGS({ isOpen: false }), Math.max(0, ms))
    return () => window.clearTimeout(timeout)
  }, [gs.isOpen, gs.timerEnd])

  // ── Controls ────────────────────────────────────────────
  const gotoWave = (w:number) => {
    applyGS({currentWave:w, isOpen:false, timerEnd:null, showResults:false})
    notify(`➡ เข้าสู่ Wave ${w}`)
  }
  const startTimer = () => {
    const mins = parseFloat(duration)||10
    applyGS({isOpen:true, timerEnd:new Date(Date.now()+mins*60000).toISOString(), duration:mins, showResults:false})
    notify(`▶ เปิดรับข้อมูล ${mins} นาที`)
  }
  const stopTimer = () => { applyGS({isOpen:false}); notify('⏹ ปิดรับข้อมูลแล้ว') }
  const addTime = (seconds:number) => {
    const now = new Date().getTime()
    const cur = gs.timerEnd ? new Date(gs.timerEnd).getTime() : now
    applyGS({timerEnd:new Date(Math.max(now,cur)+seconds*1000).toISOString(), isOpen:true})
    notify(seconds >= 60 ? '+1 min' : '+5s')
  }
  const processWave = async () => {
    setProcessing(true)
    await fetchAll()
    notify(`${gs.gameMode === 'bet' ? 'Bet' : 'Bid'} Wave ${gs.currentWave} refreshed from Google Sheet`)
    setProcessing(false)
  }
  const hasSubmittedForGame = (row: WaveInputRow, game: 'bid'|'bet') => game === 'bet' ? row.hasBetInput : row.hasBidInput
  const viewedSubmissionRows = sheetInputs[submissionWave] ?? []
  const sheetSubmittedBaans = viewedSubmissionRows.filter(row => hasSubmittedForGame(row, submissionGame)).map(r=>r.baan)
  const submittedBaans = Array.from(new Set(sheetSubmittedBaans))
  const localSubmissionsCurrent = getSubmissionsForWave(submissionWave)

  // ── Toast color ─────────────────────────────────────────
  const toastStyle = toast?.type==='err'
    ? 'border-red-500/30 bg-red-950/60'
    : toast?.type==='warn'
    ? 'border-yellow-500/30 bg-yellow-950/60'
    : 'border-emerald-500/30 bg-emerald-950/60'

  if (!isLoaded) return (
    <div className="wire-page-full">
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    </div>
  )

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

          <section className="wire-layout-admin">
            <div id="admin-main-fullscreen" className="wire-panel wire-panel-purple wire-main-hero admin-board-scroll fullscreen-scope">
              <FullscreenButton targetId="admin-main-fullscreen" />
              <div className="wire-panel-body w-full">
                <div className="mb-6 flex flex-wrap justify-center gap-2">
                  {([
                    ['dashboard','Dashboard',<LayoutDashboard key="d" size={14}/>],
                    ['map','MAP',<Map key="m" size={14}/>],
                    ['history','History',<History key="h" size={14}/>],
                    ['ownership','Ownership',<Map key="o" size={14}/>],
                    ['leaderboard','Leaderboard',<Trophy key="t" size={14}/>],
                  ] as const).map(([value,label,icon])=>(
                    <button key={value} onClick={()=>setTab(value)}
                      className={clsx('btn', tab===value ? 'btn-primary' : 'btn-ghost')}>
                      {icon} {label}
                    </button>
                  ))}
                </div>

                {tab==='dashboard' && (
                  <div className="wire-panel colorful-box colorful-box-blue bg-white p-5 admin-submission-panel">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-label">Wave {submissionWave} submissions</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge-blue">{submissionGame === 'bet' ? 'Bet game' : 'Bid game'} - Google Sheet</span>
                        <button onClick={fetchAll} className="btn btn-ghost py-1.5 px-2 text-xs">
                          <RefreshCw size={12} /> Refresh
                        </button>
                      </div>
                    </div>
                    <div className="admin-submission-wave-filter flex flex-wrap gap-2">
                      {Array.from({length:TOTAL_WAVES},(_,i)=>i+1).map(w=>(
                        <button key={w} onClick={()=>setSubmissionWave(w)}
                          className={clsx('btn px-3', submissionWave===w ? 'btn-primary' : 'btn-ghost')}>
                          W{w}
                        </button>
                      ))}
                      <div className="admin-submission-game-filter flex gap-2">
                        <button onClick={()=>setSubmissionGame('bid')}
                          className={clsx('btn px-3', submissionGame==='bid' ? 'btn-primary' : 'btn-ghost')}>
                          Bid
                        </button>
                        <button onClick={()=>setSubmissionGame('bet')}
                          className={clsx('btn px-3', submissionGame==='bet' ? 'btn-primary' : 'btn-ghost')}>
                          Bet
                        </button>
                      </div>
                    </div>
                    <div className="admin-submission-grid grid grid-cols-1 gap-2 xl:grid-cols-2">
                      {Array.from({length:12},(_,i)=>i+1).map(b=>{
                        const row = viewedSubmissionRows.find(r=>r.baan===b)
                        const done = row ? hasSubmittedForGame(row, submissionGame) : false
                        const localSub = localSubmissionsCurrent.find(s => s.baan === b)
                        const pulse = savePulses[b]
                        const saving = Boolean(pulse && nowTick - pulse.at < 5000)
                        const changes = localSub?.revision ?? pulse?.count ?? 0
                        return (
                          <div key={b} className={clsx('admin-submission-card flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2.5',
                            done ? 'border-green-300 bg-green-50' : 'border-amber-200 bg-amber-50')}>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono font-black text-white"
                              style={{background:HOUSE_COLORS[b]}}>
                              {b}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold" style={{color:HOUSE_COLORS[b]}}>{HOUSE_NAMES[b]}</div>
                              <div className="text-xs text-slate-500">
                                {changes ? `${changes} changes${localSub?.timestamp ? ` - ${localSub.timestamp}` : ''}` : 'No local changes yet'}
                              </div>
                            </div>
                            <span className={clsx('badge shrink-0', saving ? 'badge-blue' : done ? 'badge-green' : 'badge-red')}>
                              {saving ? 'Saving' : done ? 'Saved' : 'no data'}
                            </span>
                            {done ? <CheckCircle2 className="shrink-0 text-green-500" size={18}/> : <Clock className="shrink-0 text-amber-500" size={18}/>} 
                          </div>
                        )
                      })}
                    </div>
                    <div className="admin-submission-summary mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded bg-green-50 px-3 py-2 text-green-700">Saved: {submittedBaans.length}/12</div>
                      <div className="rounded bg-amber-50 px-3 py-2 text-amber-700">Waiting: {12-submittedBaans.length}</div>
                    </div>
                  </div>
                )}
                {tab==='map' && (
                  <div className="admin-map-tab">
                    <div className="map-wave-filter flex flex-wrap gap-2">
                      {Array.from({length:TOTAL_WAVES},(_,i)=>i+1).map(w=>(
                        <button key={w} onClick={()=>setMapWave(w)}
                          className={clsx('btn px-3', mapWave===w ? 'btn-success' : 'btn-ghost')}>
                          {w}
                        </button>
                      ))}
                    </div>
                    <GameMap ownership={sheetOwnership.ownership} filterDisaster={filterDis}
                      kingDisaster={getActiveDisasterForWave(mapWave)} readOnly compact />
                  </div>
                )}

                {tab==='ownership' && (
                  <OwnershipHistory />
                )}

                {tab==='history' && (
                  <div className="wire-panel bg-white p-4 admin-history-panel">
                    <FinanceHistory showResults />
                  </div>
                )}

                {tab==='leaderboard' && (
                  <div className="wire-panel admin-scoreboard-fit colorful-box colorful-box-sky bg-white p-5">
                    <SharedScoreboard
                      title="Afternoon Scoreboard"
                      subtitle="อันดับคะแนนเกมช่วงบ่าย"
                      bgColor="bg-[#9cd4f7]"
                      csvUrlTotal={AFTERNOON_SCORE_CSV_URL}
                      showDetails={false}
                      mode="embedded"
                    />
                  </div>
                )}
              </div>
            </div>

            <aside className="admin-control-stack">
              <div className="admin-sheet-row">
                <a href={SHEET_BASE} target="_blank" rel="noreferrer" className="btn btn-ghost admin-sheet-button">
                  <ExternalLink size={14} /> Sheet
                </a>
              </div>
              <div className="wire-panel wire-panel-green wire-sidebar-fill">
              <div className="admin-control-panel w-full space-y-4">
                <div className={clsx('admin-status-corner badge', gs.isOpen?'badge-green':'badge-red')}>
                  <span className={clsx('status-dot', gs.isOpen?'online':'offline')} />
                  {gs.isOpen?'OPEN':'CLOSED'}
                </div>
                <div className="admin-control-title">Admin Control</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={()=>applyGS({gameMode:'bid'})}
                    className={clsx('btn', gs.gameMode !== 'bet' ? 'btn-primary' : 'btn-ghost')}>
                    Bid game
                  </button>
                  <button onClick={()=>applyGS({gameMode:'bet'})}
                    className={clsx('btn', gs.gameMode === 'bet' ? 'btn-primary' : 'btn-ghost')}>
                    Bet game
                  </button>
                </div>
                <div className="wire-panel admin-wave-card colorful-box colorful-box-sky bg-white p-4">
                  <div className="mb-4 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
                    <button onClick={()=>gs.currentWave>1&&gotoWave(gs.currentWave-1)} className="btn btn-ghost admin-wave-arrow"><ChevronLeft size={18}/></button>
                    <div className="admin-wave-label">Wave {gs.currentWave}/{TOTAL_WAVES}</div>
                    <button onClick={()=>gs.currentWave<TOTAL_WAVES&&gotoWave(gs.currentWave+1)} className="btn btn-ghost admin-wave-arrow"><ChevronRight size={18}/></button>
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
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button onClick={()=>addTime(5)} className="btn btn-ghost">+5s</button>
                    <button onClick={()=>addTime(60)} className="btn btn-ghost">+1 min</button>
                  </div>
                  <button
                    onClick={() => {
                      applyGS({ showResults: !gs.showResults })
                      notify(!gs.showResults ? 'Showing player results' : 'Hiding player results')
                    }}
                    className={clsx('btn mt-3 w-full', gs.showResults ? 'btn-success' : 'btn-ghost')}
                  >
                    {gs.showResults ? 'Hide result' : 'Show result'}
                  </button>
                </div>
                <button onClick={processWave} disabled={processing} className="btn btn-primary w-full">
                  <Zap size={15}/> Refresh Sheet Wave {gs.currentWave}
                </button>
              </div>
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
