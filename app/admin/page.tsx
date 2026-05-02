'use client'
import { useState, useEffect } from 'react'
import AuthGuard from '@/components/AuthGuard'
import HomeButton from '@/components/HomeButton'
import GameMap from '@/components/GameMap'
import Scoreboard from '@/components/Scoreboard'
import Timer from '@/components/Timer'
import HistoryPanel from '@/components/HistoryPanel'
import { 
  Play, Square, RotateCcw, Clock, ShieldAlert, 
  Map as MapIcon, History, Crown, Settings2
} from 'lucide-react'
import { getGameState, setGameState, getMapOwnership, getActiveDisasters, subscribeStore } from '@/lib/store'

function AdminContent() {
  const [gs, setGS] = useState(getGameState)
  const [ownership, setOwnership] = useState(getMapOwnership)
  const [activeDisasters, setActiveDisasters] = useState(getActiveDisasters)
  const [tab, setTab] = useState<'control'|'map'>('control')
  
  // Timer Settings
  const [durationStr, setDurationStr] = useState(gs.duration.toString())

  useEffect(() => {
    return subscribeStore((key) => {
      if (key === 'biggame_state') setGS(getGameState())
      if (key === 'biggame_map') setOwnership(getMapOwnership())
      if (key === 'biggame_disasters') setActiveDisasters(getActiveDisasters())
    })
  }, [])

  // ควบคุมเวลาและสถานะเกม
  const startTimer = () => {
    const mins = parseInt(durationStr) || 5
    const end = new Date(Date.now() + mins * 60000).toISOString()
    setGameState({ isOpen: true, timerEnd: end, duration: mins })
  }

  const stopTimer = () => {
    setGameState({ isOpen: false, timerEnd: null })
  }

  const changeWave = (newWave: number) => {
    if (!confirm(`ยืนยันการเปลี่ยนไป WAVE ${newWave} ? (ข้อมูลเดิมจะไม่หาย แต่ระบบจะเริ่มรอบใหม่)`)) return
    setGameState({ currentWave: newWave, isOpen: false, timerEnd: null })
  }

  return (
    <div className="min-h-screen flex flex-col bg-base">
      <header className="wire-topbar sticky top-0 z-50 flex items-center justify-between px-4 h-16 bg-blue-900/20 backdrop-blur-md border-b border-blue-500/30">
        <HomeButton />
        <div className="font-display font-black text-blue-400 tracking-widest text-lg flex items-center gap-2">
          <ShieldAlert size={20} /> ADMIN COMMAND CENTER
        </div>
        <div className="flex items-center gap-4">
          <Timer endTime={gs.timerEnd} isOpen={gs.isOpen} compact />
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-6 max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        
        {/* เลนซ้าย: แผงควบคุมหลัก */}
        <aside className="space-y-6">
          {/* Game Controls */}
          <div className="glass-md p-6 rounded-3xl border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[40px]"></div>
            
            <h2 className="font-display font-bold text-xl text-white mb-6 flex items-center gap-2">
              <Settings2 className="text-blue-400" /> SYSTEM CONTROL
            </h2>

            <div className="space-y-6 relative z-10">
              {/* Wave Selector */}
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-widest mb-2 block font-bold">Current Wave</label>
                <div className="flex bg-black/40 p-1 rounded-xl">
                  {[1,2,3,4,5].map(w => (
                    <button key={w} onClick={() => changeWave(w)}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${gs.currentWave === w ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                      W{w}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-white/10 w-full" />

              {/* Timer Control */}
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-widest mb-2 block font-bold">Countdown Timer</label>
                <div className="flex gap-2 mb-3">
                  <input type="number" value={durationStr} onChange={e=>setDurationStr(e.target.value)}
                    className="input-base text-center text-xl font-mono w-24 bg-black/40" />
                  <span className="flex items-center text-slate-500 text-sm">นาที</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={startTimer} disabled={gs.isOpen} 
                    className={`btn h-12 flex items-center justify-center gap-2 font-bold ${!gs.isOpen ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-emerald-900/50 text-emerald-700 cursor-not-allowed'}`}>
                    <Play size={18} /> เปิดระบบ
                  </button>
                  <button onClick={stopTimer} disabled={!gs.isOpen}
                    className={`btn h-12 flex items-center justify-center gap-2 font-bold ${gs.isOpen ? 'bg-red-500 hover:bg-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-red-900/50 text-red-700 cursor-not-allowed'}`}>
                    <Square size={18} /> ปิดรับข้อมูล
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="glass p-5 rounded-2xl border-white/5 space-y-4">
            <h3 className="font-display font-bold text-slate-300 text-sm">สถานะระบบปัจจุบัน</h3>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">สถานะฟอร์ม</span>
              <span className={gs.isOpen ? 'text-emerald-400 font-bold animate-pulse' : 'text-red-400 font-bold'}>
                {gs.isOpen ? 'เปิดรับข้อมูล (LIVE)' : 'ปิดการส่ง'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">จำนวนพื้นที่ถูกยึด</span>
              <span className="text-blue-400 font-bold">{Object.keys(ownership).length} / 20</span>
            </div>
          </div>
        </aside>

        {/* เลนขวา: Monitor Board */}
        <section className="flex flex-col gap-4">
          <div className="glass p-1.5 rounded-xl inline-flex w-fit border border-white/5">
            <button onClick={()=>setTab('control')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${tab==='control' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
              <Crown size={16}/> ลีดเดอร์บอร์ด & ประวัติ
            </button>
            <button onClick={()=>setTab('map')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${tab==='map' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
              <MapIcon size={16}/> แผนที่ (Live)
            </button>
          </div>

          <div className="glass-md p-6 rounded-3xl border-white/10 flex-1 min-h-[600px]">
            {tab === 'control' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                <div>
                  <h3 className="font-display font-bold text-xl text-white mb-4">LIVE LEADERBOARD</h3>
                  {/* พื้นที่สำหรับต่อ Google Sheet Data ของจริง */}
                  <Scoreboard entries={[]} compact />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-white mb-4">SYSTEM LOGS / HISTORY</h3>
                  <HistoryPanel entries={[]} title="Logs" />
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in zoom-in-95 duration-300">
                <h3 className="font-display font-bold text-xl text-white mb-6">GLOBAL MAP STATUS</h3>
                <GameMap ownership={ownership} readOnly kingDisaster={activeDisasters[gs.currentWave]} />
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  )
}

export default function AdminPage() {
  return (
    <AuthGuard pageKey="web5" expectedPassword="web5"
      title="ADMIN LOGIN" subtitle="ศูนย์ควบคุมระบบ BigGame"
      accentColor="#3b82f6">
      <AdminContent />
    </AuthGuard>
  )
}