'use client'
import { useState, useEffect, useCallback } from 'react'
import AuthGuard from '@/components/AuthGuard'
import HomeButton from '@/components/HomeButton'
import Scoreboard from '@/components/Scoreboard'
import { SHEET_ID } from '@/lib/constants'
import { RefreshCw, Sunrise } from 'lucide-react'
import clsx from 'clsx'

interface Score { baan:number; morning:number; betray:number; total:number }

function MorningContent() {
  const [scores,      setScores]      = useState<Score[]>([])
  const [loading,     setLoading]     = useState(true)
  const [lastUpdate,  setLastUpdate]  = useState('')

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
          morning: parseFloat(r?.c?.[1]?.v)||0,
          betray:  parseFloat(r?.c?.[2]?.v)||0,
          total:   parseFloat(r?.c?.[3]?.v)||0,
        })
      }
      setScores(parsed)
      setLastUpdate(new Date().toLocaleTimeString('th-TH'))
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // แปลงข้อมูลให้เข้ากับ Component Scoreboard แบบ Kahoot
  const scoreEntries = scores.map(s => ({
    baan: s.baan,
    score: s.total,
    extra: {
      'เกมเช้า': s.morning.toLocaleString(),
      'หักหลัง (Betray)': s.betray.toLocaleString()
    }
  }))

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background FX */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-[#07090f] to-[#07090f] pointer-events-none" />

      <header className="wire-topbar sticky top-0 z-50 flex items-center justify-between px-6 h-16 bg-[#07090f]/80 backdrop-blur-md border-b border-white/10">
        <HomeButton />
        <div className="flex items-center gap-3">
          <div className="text-xs text-amber-500/70 font-mono">
            {lastUpdate ? `Updated: ${lastUpdate}` : 'Fetching...'}
          </div>
          <button onClick={fetchData} disabled={loading} className="p-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors">
            <RefreshCw size={18} className={clsx(loading && "animate-spin")} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full z-10">
        <div className="text-center mb-10 mt-6">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
            <Sunrise size={32} className="text-amber-400" />
          </div>
          <h1 className="font-display font-black text-4xl md:text-5xl text-white tracking-widest drop-shadow-lg">
            MORNING <span className="text-amber-400">RESULTS</span>
          </h1>
          <p className="text-slate-400 mt-3 tracking-wide">สรุปผลคะแนนรวมกิจกรรมช่วงเช้าทั้งหมด</p>
        </div>

        <div className="glass-md p-6 md:p-10 rounded-3xl border-white/10 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
          {loading && scores.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
            </div>
          ) : (
            <Scoreboard entries={scoreEntries} />
          )}
        </div>
      </main>
    </div>
  )
}

export default function ScoreboardMorningPage() {
  return (
    <AuthGuard pageKey="web1" expectedPassword="web1"
      title="MORNING SCOREBOARD" subtitle="ระบบแสดงผลคะแนนช่วงเช้า" accentColor="#f59e0b">
      <MorningContent />
    </AuthGuard>
  )
}