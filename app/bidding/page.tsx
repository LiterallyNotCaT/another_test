'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import HomeButton from '@/components/HomeButton'
import GameMap from '@/components/GameMap'
import BiddingCart from '@/components/BiddingCart'
import FinanceHistory from '@/components/FinanceHistory'
import FullscreenButton from '@/components/FullscreenButton'
import { useWaveOwnership } from '@/components/OwnershipHistory'
import Timer from '@/components/Timer'
import clsx from 'clsx'
import { LogOut, PanelRight, Sparkles } from 'lucide-react'
import { HOUSE_NAMES, SHEET_ID, getBaanPassword, getWaveSheetQuery } from '@/lib/constants'
import {
  getGameState, saveSubmission, getSubmissionsForBaan,
  subscribeStore, getActiveDisasterForWave, startCloudSync,
} from '@/lib/store'
import { fetchWaveInfo, writeToSheet } from '@/lib/sheets'

const DISASTER_IDS = Array.from({ length: 9 }, (_, i) => i + 1)

/* ── Login screen ──────────────────────────────────────────── */
function BaanLogin({ onLogin }: { onLogin:(b:number)=>void }) {
  const [baan,  setBaan]  = useState('')
  const [pass,  setPass]  = useState('')
  const [err,   setErr]   = useState('')
  const [shake, setShake] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const b = parseInt(baan)
    if (isNaN(b)||b<1||b>12) { setErr('กรอกเลขบ้าน 1–12 เท่านั้น'); return }
    if (pass !== getBaanPassword(b)) {
      setErr('รหัสไม่ถูกต้อง'); setShake(true)
      setTimeout(()=>setShake(false),500); return
    }
    sessionStorage.setItem('baan_login',String(b)); onLogin(b)
  }

  return (
    <div className="min-h-screen app-shell flex items-center justify-center px-4 py-6">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-[100px] bg-violet-600/10" />
      </div>

      <div className={clsx('relative z-10 w-full max-w-[22rem] content-card compact-auth-card p-5 sm:p-6',
        shake && 'animate-[shake_0.4s_ease-in-out]')}>

        <div className="text-center mb-5">
          <div className="text-4xl mb-3 animate-float">🏛️</div>
          <h1 className="font-display font-bold text-xl text-white">เข้าสู่ระบบ</h1>
          <p className="text-sm text-slate-500 mt-1.5">เกมลงทุนพื้นที่ · ช่วงบ่าย</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-label block mb-2">เลขบ้าน (1–12)</label>
            <input type="number" min={1} max={12} value={baan}
              onChange={e=>setBaan(e.target.value)} placeholder="กรอกเลขบ้าน" autoFocus
              className="input-base text-center font-mono text-xl tracking-widest" />
          </div>
          <div>
            <label className="text-label block mb-2">รหัสผ่าน</label>
            <input type="password" value={pass}
              onChange={e=>setPass(e.target.value)} placeholder="Baan X"
              className="input-base text-center font-mono tracking-[0.3em]" />
          </div>
          {err && <p className="text-xs text-red-400 text-center">{err}</p>}
          <button type="submit" className="btn w-full py-2.5 text-sm font-semibold"
            style={{ background:'linear-gradient(135deg,#7c3aed,#a78bfa)', boxShadow:'0 0 20px rgba(124,58,237,0.3)' }}>
            เข้าสู่เกม
          </button>
        </form>
        <div className="flex justify-center mt-4"><HomeButton /></div>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
    </div>
  )
}

/* ── Game screen ───────────────────────────────────────────── */
interface CartItem { area:string; amount:number }
type GoogleSheetCell = { v?: string | number | null } | null
type GoogleSheetRow = { c?: GoogleSheetCell[] }

function BiddingGame({ baan }: { baan:number }) {
  const [gs,        setGS]        = useState(getGameState)
  const [cart,      setCart]      = useState<CartItem[]>([])
  const [kingDis,   setKingDis]   = useState<number|null>(null)
  const [filterDis, setFilterDis] = useState<number|null>(null)
  const [balance,   setBalance]   = useState(0)
  const [isKing,    setIsKing]    = useState(false)
  const [currentKing, setCurrentKing] = useState<number | null>(null)
  const [isSaved,   setIsSaved]   = useState(true)
  const [savedAt,   setSavedAt]   = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [panelOpen, setPanelOpen] = useState(true)
  const [betTarget, setBetTarget] = useState('')
  const [betAmount, setBetAmount] = useState('')
  const [sheetBetSpend, setSheetBetSpend] = useState(0)
  const [isLoaded] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const totalBet = useMemo(() => cart.reduce((s,i)=>s+i.amount,0), [cart])
  const islandCart = useMemo(() => cart.filter(i => i.area !== 'KING'), [cart])
  const kingBid = useMemo(() => cart.find(i => i.area === 'KING'), [cart])
  const selectedAreaKey = cart.map(i => i.area).join('|')
  const selectedAreas = useMemo(() => selectedAreaKey ? selectedAreaKey.split('|') : [], [selectedAreaKey])
  const kingBidAmount = kingBid?.amount || 0
  const betSpend = parseFloat(betAmount) || 0
  const betAmountNumber = betAmount.trim() === '' ? NaN : Number(betAmount)
  const isBetAmountValid = Number.isFinite(betAmountNumber) && betAmountNumber >= 500 && betAmountNumber <= balance
  const isBetMode = gs.gameMode === 'bet'
  const currentSubmission = getSubmissionsForBaan(baan).find(s => s.wave === gs.currentWave)
  const priorBetSpend = !isBetMode ? sheetBetSpend || currentSubmission?.betAmount || 0 : 0
  const effectiveBalance = Math.max(0, balance - priorBetSpend)
  const canChooseKingDisaster = isKing || currentKing === baan
  const sheetOwnership = useWaveOwnership(gs.currentWave)

  /* fetch balance from Wave sheet */
  const fetchBalance = useCallback(async()=>{
    try {
      const wave = getGameState().currentWave
      const url  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&${getWaveSheetQuery(wave)}`
      const text = await (await fetch(url,{cache:'no-store'})).text()
      const js   = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
      if(!js) return
      const rows = (JSON.parse(js)?.table?.rows??[]) as GoogleSheetRow[]
      const row = rows.find((r)=>parseInt(String(r?.c?.[0]?.v??''))===baan)
      if(row){
        const startingBalance = parseFloat(String(row?.c?.[1]?.v??0))||0
        setBalance(startingBalance)
        setSheetBetSpend(parseFloat(String(row?.c?.[3]?.v??0))||0)
      } else {
        setSheetBetSpend(0)
      }
    }catch(e){console.error(e)}
  },[baan])

  useEffect(()=>{
    const refresh = () => { void fetchBalance() }
    const initial = setTimeout(refresh, 0)
    const t=setInterval(refresh,20000)
    return()=>{ clearTimeout(initial); clearInterval(t) }
  },[fetchBalance])

  const fetchKingInfo = useCallback(async () => {
    try {
      const info = await fetchWaveInfo(getGameState().currentWave)
      setCurrentKing(info.king)
      setIsKing(info.king === baan)
      setKingDis(info.disaster)
    } catch(e) { console.error(e) }
  }, [baan])

  useEffect(()=>{
    const refresh = () => { void fetchKingInfo() }
    const initial = setTimeout(refresh, 0)
    const t=setInterval(refresh,20000)
    return()=>{ clearTimeout(initial); clearInterval(t) }
  },[fetchKingInfo])
  useEffect(()=>{
    const t = setTimeout(() => { void fetchKingInfo() }, 0)
    return () => clearTimeout(t)
  },[fetchKingInfo, gs.currentWave])

  /* subscribe store */
  useEffect(()=>{
    if (!isLoaded) return
    const u=subscribeStore(()=>{ setGS(getGameState()) })
    return u
  },[isLoaded])

  /* map select */
  const handleSelect = (area:string)=>{
    if(!gs.isOpen) return
    const alreadySelected = cart.some(i=>i.area===area)
    if (!alreadySelected && effectiveBalance - totalBet < 100) {
      setSaveMessage('Balance is still loading or below minimum')
      return
    }
    if (!alreadySelected && area !== 'KING' && islandCart.length >= 3) return
    setCart(prev=>prev.find(i=>i.area===area)?prev.filter(i=>i.area!==area):[...prev,{area,amount:100}])
    setIsSaved(false)
  }

  const handleCartUpdate = useCallback((items: CartItem[]) => {
    if (!getGameState().isOpen) return
    setCart([...items.filter(x=>x.area !== 'KING').slice(0,3), ...items.filter(x=>x.area === 'KING').slice(0,1)])
    setIsSaved(false)
  }, [])

  const handleKingDisasterUpdate = useCallback((disaster: number | null) => {
    if (!getGameState().isOpen) return
    setKingDis(disaster)
    setIsSaved(false)
  }, [])

  /* save — local store + write to Google Sheet */
  const handleSave = useCallback(async ()=>{
    if(!gs.isOpen) return
    const hasInvalidBidAmount = cart.some(i => i.amount <= 0)
    if(isBetMode && (betSpend < 500 || betSpend > balance)) return
    if(!isBetMode && (hasInvalidBidAmount || (totalBet <= 0 && !(canChooseKingDisaster && kingDis)) || totalBet > effectiveBalance)) return

    // 1. Save locally (instant, always works)
    saveSubmission({
      baan,
      wave: gs.currentWave,
      bets: isBetMode ? currentSubmission?.bets ?? [] : cart,
      isKing: canChooseKingDisaster,
      kingDisaster: canChooseKingDisaster ? kingDis ?? undefined : undefined,
      betTarget: isBetMode && betTarget ? parseInt(betTarget) : currentSubmission?.betTarget,
      betAmount: isBetMode ? betSpend : currentSubmission?.betAmount,
      timestamp: new Date().toLocaleTimeString('th-TH'),
      balance: isBetMode ? balance - betSpend : effectiveBalance,
    })
    setIsSaved(true); setSavedAt(new Date().toLocaleTimeString('th-TH'))

    // 2. Write to Google Sheet via GAS (async, non-blocking)
    // Map cart items to up to 3 islands (areas)
    const islands = islandCart.slice(0,3).map(i=>({ name: i.area, amount: i.amount }))
    setSaveMessage('Sending to admin...')
    writeToSheet({
      action: 'writeWave',
      wave:   gs.currentWave,
      baan,
      betTarget: isBetMode && betTarget ? parseInt(betTarget) : undefined,
      betAmount: isBetMode ? betSpend : undefined,
      kingAmount: !isBetMode && kingBid ? kingBidAmount : undefined,
      kingDisaster: canChooseKingDisaster ? kingDis : undefined,
      islands: isBetMode ? undefined : islands,
    }).then(res => {
      setSaveMessage(res.ok ? 'Sent to admin' : `Admin sync error: ${res.message ?? 'not sent'}`)
      if (!res.ok) console.warn('Sheet write failed:', res.message)
      fetchBalance()
    }).catch(e => {
      setSaveMessage('Admin sync error')
      console.error(e)
    })
  },[baan,cart,gs.currentWave,gs.isOpen,canChooseKingDisaster,kingDis,balance,totalBet,isBetMode,betTarget,betSpend,fetchBalance,effectiveBalance,currentSubmission,islandCart,kingBid,kingBidAmount])

  /* autosave */
  useEffect(()=>{
    if(!gs.isOpen) {
      clearTimeout(saveTimer.current)
      return
    }
    if(cart.length===0&&isSaved) return
    const markUnsaved = setTimeout(() => setIsSaved(false), 0)
    clearTimeout(saveTimer.current)
    saveTimer.current=setTimeout(handleSave,5000)
    return()=>{ clearTimeout(markUnsaved); clearTimeout(saveTimer.current) }
  },[cart,kingDis,gs.isOpen]) // eslint-disable-line

  const normalizeBetAmount = () => {
    if (betAmount.trim() === '') return
    const raw = Number(betAmount)
    if (!Number.isFinite(raw)) {
      setBetAmount('')
      return
    }
    setBetAmount(String(Math.min(Math.max(500, raw), balance)))
  }

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
        <div className="flex items-center gap-8">
          <HomeButton className="bg-white/10 border-white/20 text-white hover:text-white" />
          <div className="wire-title">ลงทุนเกาะรอบที่ {gs.currentWave}</div>
          <div className="wire-title flex items-center gap-3">
            {canChooseKingDisaster && <Sparkles size={24} className="text-yellow-200" />}
            {HOUSE_NAMES[baan]}
          </div>
        </div>
        <div className="wire-time">
          <Timer endTime={gs.timerEnd} isOpen={gs.isOpen} onExpire={handleSave} compact />
        </div>
      </header>

      <main className="wire-scroll">
        <div className="wire-content">
          <div className="wire-pill-row">
            <div className="wire-pill">{isBetMode ? 'Bet game' : 'Bid game'}</div>
            <div className="wire-pill">Balance : {effectiveBalance.toLocaleString()}</div>
            {!isBetMode && <div className="wire-pill">King : {currentKing ? HOUSE_NAMES[currentKing] : '-'}</div>}
            <div className={clsx('badge', gs.isOpen?'badge-green':'badge-red')}>
              <span className={clsx('status-dot', gs.isOpen?'online':'offline')} />
              {gs.isOpen?'OPEN':'CLOSED'}
            </div>
            {!isBetMode && (
              <button onClick={()=>setPanelOpen(p=>!p)} className="btn btn-ghost ml-auto">
                <PanelRight size={14} /> {panelOpen ? 'Hide menu' : 'Show menu'}
              </button>
            )}
            <button onClick={()=>{sessionStorage.removeItem('baan_login');window.location.reload()}}
              className={clsx('btn btn-ghost', isBetMode && 'ml-auto')}>
              <LogOut size={14} /> Logout
            </button>
          </div>

          <section className={clsx('wire-layout-bidding', isBetMode && 'wire-layout-bet-only')}>
            <div id="bidding-main-fullscreen" className="space-y-3 fullscreen-scope">
              <FullscreenButton targetId="bidding-main-fullscreen" />
              {!isBetMode && <div className="flex flex-wrap gap-2">
                <span className={clsx('badge', !isBetMode ? 'badge-blue' : 'badge-green')}>
                  {isBetMode ? 'Bet mode: guess minigame rank' : 'Bid mode: choose up to 3 islands'}
                </span>
              </div>}
              <div className="wire-panel wire-panel-soft">
                <div className="wire-panel-body">
                  {!gs.isOpen && (
                    <div className="mb-4 rounded bg-white/80 px-4 py-3 text-sm text-slate-700">
                      ยังไม่เปิดรับการลงทุน - รอ Admin เปิดรอบ
                    </div>
                  )}
                  {isBetMode ? (
                    <div className="mx-auto grid max-w-xl gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-label mb-2 block">House to bet on</label>
                        <select value={betTarget} onChange={e=>{setBetTarget(e.target.value); setIsSaved(false)}}
                          disabled={!gs.isOpen}
                          className="input-base">
                          <option value="">Choose house</option>
                          {Array.from({length:12},(_,i)=>i+1).map(b=><option key={b} value={b}>{HOUSE_NAMES[b]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-label mb-2 block">Bet amount</label>
                        <input type="number" value={betAmount} min={500} max={balance} step={100} disabled={!gs.isOpen}
                          onChange={e=>{
                            setBetAmount(e.target.value)
                            setIsSaved(false)
                          }}
                          onBlur={normalizeBetAmount}
                          className="input-base font-mono" placeholder="0" />
                        {betAmount && !isBetAmountValid && (
                          <div className="mt-1 text-xs font-semibold text-red-600">
                            Amount must be 500 - {balance.toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                        <div className="colorful-box colorful-box-blue rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                          <div className="text-label">Balance</div>
                          <div className="font-mono text-xl font-bold text-slate-900">{balance.toLocaleString()}</div>
                        </div>
                        <div className="colorful-box colorful-box-gold rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                          <div className="text-label">After Bet</div>
                          <div className={clsx('font-mono text-xl font-bold', balance - betSpend < 0 ? 'text-red-600' : 'text-slate-900')}>
                            {(balance - betSpend).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <button onClick={handleSave} disabled={!gs.isOpen || !betTarget || !isBetAmountValid}
                        className="btn btn-primary sm:col-span-2">
                        Submit bet {betSpend ? `· ${betSpend.toLocaleString()}` : ''}
                      </button>
                      {saveMessage && (
                        <div className="sm:col-span-2 px-2 py-1 text-center text-xs font-semibold text-emerald-700">
                          {saveMessage}
                        </div>
                      )}
                    </div>
                  ) : (
                    <GameMap ownership={sheetOwnership.ownership} selected={selectedAreas}
                      onSelect={handleSelect} filterDisaster={filterDis}
                      readOnly={!gs.isOpen}
                      kingDisaster={getActiveDisasterForWave(gs.currentWave)}
                      compact />
                  )}
                </div>
              </div>

              {!isBetMode && <div className="flex flex-wrap items-center gap-1.5">
                <span className="wire-toolbar-panel text-sm">Filter</span>
                {DISASTER_IDS.map((id)=>(
                  <button key={id} onClick={()=>setFilterDis(filterDis===id?null:id)}
                    className={clsx('btn disaster-filter', filterDis===id ? 'active' : '')}>
                    {id}
                  </button>
                ))}
                {filterDis && <button onClick={()=>setFilterDis(null)} className="btn btn-ghost">Clear</button>}
              </div>}
            </div>

            {panelOpen && !isBetMode && (
              <aside className="wire-panel wire-side-panel">
                <div className="wire-section-title">พื้นที่ที่เลือก</div>
                <BiddingCart baan={baan} balance={effectiveBalance} items={cart} isKing={canChooseKingDisaster}
                  kingDisaster={kingDis}
                  onUpdate={handleCartUpdate}
                  onKingDisaster={handleKingDisasterUpdate}
                  onSubmit={handleSave} isSaved={isSaved} savedAt={savedAt} isOpen={gs.isOpen} />
                <div className="wire-section-title bg-blue-500 text-white">
                  {isSaved?(savedAt?`Saved at ${savedAt}`:'Saved'):'Unsaved / autosave in 5s'}
                </div>
                {saveMessage && <div className="px-4 pb-3 text-center text-xs font-semibold text-emerald-700">{saveMessage}</div>}
              </aside>
            )}
          </section>
          {!isBetMode && <section className="wire-history wire-panel">
            <div className="wire-history-body">
              <FinanceHistory initialBaan={baan} lockBaan showFilters={false} showResults={gs.showResults === true} />
            </div>
          </section>}
        </div>
      </main>
    </div>
  )

}

/* Page root */
export default function BiddingPage() {
  const [baan,     setBaan]     = useState<number|null>(null)
  const [checking, setChecking] = useState(true)
  useEffect(() => startCloudSync(800), [])
  useEffect(()=>{
    const t = setTimeout(() => {
      const s=sessionStorage.getItem('baan_login')
      if(s) setBaan(parseInt(s))
      setChecking(false)
    }, 0)
    return () => clearTimeout(t)
  },[])
  if (checking) return (
    <div className="min-h-screen app-shell flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin shadow-[0_0_26px_rgba(34,211,238,0.55)]" />
    </div>
  )
  return baan ? <BiddingGame baan={baan} /> : <BaanLogin onLogin={setBaan} />
}
