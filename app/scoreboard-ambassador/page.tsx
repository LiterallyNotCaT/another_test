'use client'
import { useState, useEffect } from 'react'
import AuthGuard from '@/components/AuthGuard'
import HomeButton from '@/components/HomeButton'
import FinanceHistory from '@/components/FinanceHistory'
import GameMap from '@/components/GameMap'
import OwnershipHistory, { useWaveOwnership } from '@/components/OwnershipHistory'
import SharedScoreboard from '@/components/SharedScoreboard'
import Timer from '@/components/Timer'
import clsx from 'clsx'
import { Map, History, Trophy } from 'lucide-react'
import { TOTAL_WAVES } from '@/lib/constants'
import { AFTERNOON_SCORE_CSV_URL } from '@/lib/scoreboardSources'
import { getGameState, subscribeStore, getActiveDisasterForWave, startCloudSync } from '@/lib/store'

const DISASTER_IDS = Array.from({ length: 9 }, (_, i) => i + 1)

function AmbassadorContent() {
  const [tab,         setTab]         = useState<'map'|'history'|'ownership'|'scoreboard'>('map')
  const [selWave,     setSelWave]     = useState(1)
  const [filterDis,   setFilterDis]   = useState<number|null>(null)
  const [gs,          setGS]          = useState(getGameState)
  const [isLoaded,    setIsLoaded]    = useState(false)
  const sheetOwnership = useWaveOwnership(selWave)

  useEffect(() => {
    const localState = getGameState()
    setGS(localState)
    setSelWave(localState.currentWave)
    setIsLoaded(true)
  }, [])

  useEffect(()=>{
    if (!isLoaded) return
    const unsub = subscribeStore(()=>{ setGS(getGameState()) })
    return unsub
  }, [isLoaded])

  useEffect(() => startCloudSync(800), [])

  if (!isLoaded) return (
    <div className="wire-page-full ambassador-fullscreen">
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    </div>
  )

  return (
    <div className="wire-page-full ambassador-fullscreen">
      <header className="wire-topbar">
        <div className="flex items-center gap-6">
          <HomeButton className="bg-white/10 border-white/20 text-white hover:text-white" />
          <div className="wire-title">Small Group Discussion</div>
        </div>
        <div className="wire-time">
          <Timer endTime={gs.timerEnd} isOpen={gs.isOpen} compact />
        </div>
      </header>

      <main className="wire-scroll ambassador-main">
        <div className="wire-content ambassador-content">
          <section className="wire-layout-two ambassador-tab-layout">
            <div className="wire-panel wire-panel-soft ambassador-tab-panel">
              <div className="wire-panel-body ambassador-tab-body">
                <div className="ambassador-tabs flex flex-wrap items-center gap-2">
                  <button onClick={()=>setTab('map')}
                    className={clsx('btn', tab==='map' ? 'btn-primary' : 'btn-ghost')}>
                    <Map size={14}/> MAP
                  </button>
                  <button onClick={()=>setTab('history')}
                    className={clsx('btn', tab==='history' ? 'btn-primary' : 'btn-ghost')}>
                    <History size={14}/> HISTORY
                  </button>
                  <button onClick={()=>setTab('scoreboard')}
                    className={clsx('btn', tab==='scoreboard' ? 'btn-primary' : 'btn-ghost')}>
                    <Trophy size={14}/> SCORE
                  </button>
                  <button onClick={()=>setTab('ownership')}
                    className={clsx('btn', tab==='ownership' ? 'btn-primary' : 'btn-ghost')}>
                    Ownership
                  </button>
                </div>

                {!gs.showResults && tab !== 'map' ? (
                  <div className="ambassador-tab-view result-locked-panel">
                    <div className="wire-panel colorful-box colorful-box-sky bg-white p-6 text-center">
                      <div className="text-label">Result hidden</div>
                      <div className="mt-2 text-sm font-semibold text-slate-700">
                        Admin has not shown this wave result yet.
                      </div>
                    </div>
                  </div>
                ) : tab==='map' ? (
                  <div className="ambassador-tab-view ambassador-map-view">
                    <div className="map-wave-filter flex flex-wrap gap-2">
                      {Array.from({length:TOTAL_WAVES},(_,i)=>i+1).map(w=>(
                        <button key={w} onClick={()=>setSelWave(w)}
                          className={clsx('btn px-3', selWave===w ? 'btn-success' : 'btn-ghost')}>
                          {w}
                        </button>
                      ))}
                    </div>
                    <GameMap ownership={sheetOwnership.ownership} filterDisaster={filterDis} readOnly
                      kingDisaster={getActiveDisasterForWave(gs.currentWave)}
                      compact />
                    <div className="ambassador-filter-row flex flex-wrap gap-2">
                      {DISASTER_IDS.map(id=>(
                        <button key={id} onClick={()=>setFilterDis(filterDis===id?null:id)}
                          className={clsx('btn disaster-filter', filterDis===id ? 'active' : '')}>
                          {id}
                        </button>
                      ))}
                      {filterDis && (
                        <button onClick={()=>setFilterDis(null)} className="btn btn-ghost">
                          Clear filter
                        </button>
                      )}
                    </div>
                  </div>
                ) : tab==='history' ? (
                  <div className="ambassador-tab-view space-y-3">
                    <FinanceHistory showResults={gs.showResults === true} />
                  </div>
                ) : tab==='ownership' ? (
                  <div className="ambassador-tab-view space-y-3">
                    <OwnershipHistory />
                  </div>
                ) : (
                  <div className="ambassador-tab-view">
                    <SharedScoreboard
                      title="Afternoon Scoreboard"
                      subtitle="อันดับคะแนนช่วงบ่าย"
                      bgColor="bg-[#9cd4f7]"
                      csvUrlTotal={AFTERNOON_SCORE_CSV_URL}
                      showDetails={false}
                      mode="embedded"
                    />
                  </div>
                )}
              </div>
            </div>
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
