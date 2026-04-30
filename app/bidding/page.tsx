'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import HomeButton from '@/components/HomeButton'
import GameMap from '@/components/GameMap'
import BiddingCart from '@/components/BiddingCart'
import HistoryPanel from '@/components/HistoryPanel'
import Timer from '@/components/Timer'
import clsx from 'clsx'
import { LogOut, PanelRight, Sparkles } from 'lucide-react'
import { HOUSE_NAMES, SHEET_ID, getBaanPassword, getWaveSheetQuery } from '@/lib/constants'
import {
  getGameState, getMapOwnership, saveSubmission, getSubmissionsForBaan,
  subscribeStore, getActiveDisasterForWave,
} from '@/lib/store'
import { writeToSheet } from '@/lib/sheets'

const DISASTER_NAMES = ['Disaster 1','Disaster 2','Disaster 3','Disaster 4','Disaster 5','Disaster 6','Disaster 7','Disaster 8','Disaster 9']
const DISASTER_EMOJI = ['D1','D2','D3','D4','D5','D6','D7','D8','D9']

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
interface HistoryEntry { wave?:number;label:string;detail?:string;amount:number;type:'income'|'bet'|'reward'|'lose'|'start'|'disaster';timestamp?:string }
interface SheetHistoryEntry extends HistoryEntry { order: number }

function BiddingGame({ baan }: { baan:number }) {
  const [gs,        setGS]        = useState(getGameState)
  const [ownership, setOwnership] = useState(getMapOwnership)
  const [cart,      setCart]      = useState<CartItem[]>([])
  const [kingDis,   setKingDis]   = useState<number|null>(null)
  const [filterDis, setFilterDis] = useState<number|null>(null)
  const [balance,   setBalance]   = useState(0)
  const [isKing,    setIsKing]    = useState(false)
  const [isSaved,   setIsSaved]   = useState(true)
  const [savedAt,   setSavedAt]   = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [panelOpen, setPanelOpen] = useState(true)
  const [history,   setHistory]   = useState<HistoryEntry[]>([])
  const [betTarget, setBetTarget] = useState('')
  const [betAmount, setBetAmount] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const totalBet = cart.reduce((s,i)=>s+i.amount,0)
  const betSpend = parseFloat(betAmount) || 0
  const remaining = balance - totalBet
  const isBetMode = gs.gameMode === 'bet'

  /* fetch balance from Wave sheet */
  const fetchBalance = useCallback(async()=>{
    try {
      const wave = getGameState().currentWave
      const url  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&${getWaveSheetQuery(wave)}`
      const text = await (await fetch(url,{cache:'no-store'})).text()
      const js   = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
      if(!js) return
      const rows:any[] = JSON.parse(js)?.table?.rows??[]
      const row = rows.find((r:any)=>parseInt(String(r?.c?.[0]?.v??''))===baan)
      if(row){ setBalance(parseFloat(String(row?.c?.[1]?.v??0))||0) }
      const kingFromH20 = parseInt(String(rows?.[19]?.c?.[7]?.v ?? ''))
      if(!isNaN(kingFromH20)) setIsKing(kingFromH20===baan)
      else {
        const infoRow = rows.find((r:any)=>String(r?.c?.[4]?.v??'').includes('KING'))
        if(infoRow){ const kb=parseInt(String(infoRow?.c?.[5]?.v??'')); setIsKing(!isNaN(kb)&&kb===baan) }
      }
    }catch(e){console.error(e)}
  },[baan])

  useEffect(()=>{ fetchBalance(); const t=setInterval(fetchBalance,20000); return()=>clearInterval(t) },[fetchBalance])

  /* subscribe store */
  useEffect(()=>{
    const u=subscribeStore(()=>{ setGS(getGameState()); setOwnership(getMapOwnership()) })
    const p=setInterval(()=>{ setGS(getGameState()); setOwnership(getMapOwnership()) },3000)
    return()=>{ u(); clearInterval(p) }
  },[])

  const fetchSheetHistory = useCallback(async()=> {
    const entries: SheetHistoryEntry[] = []
    try {
      const morningUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=Recap%20Morning`
      const morningText = await (await fetch(morningUrl,{cache:'no-store'})).text()
      const morningJs = morningText.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
      const morningRows:any[] = morningJs ? JSON.parse(morningJs)?.table?.rows ?? [] : []
      const morningRow = morningRows.find((r:any)=>parseInt(String(r?.c?.[0]?.v??''))===baan)
      if (morningRow) {
        const total = parseFloat(String(morningRow?.c?.[3]?.v ?? morningRow?.c?.[1]?.v ?? 0)) || 0
        entries.push({ order: 0, label: 'Morning score', detail: 'Score from morning game', amount: total, type: total >= 0 ? 'income' : 'lose' })
      }

      const currentWave = getGameState().currentWave
      for (let wave=1; wave<=currentWave; wave++) {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&${getWaveSheetQuery(wave)}`
        const text = await (await fetch(url,{cache:'no-store'})).text()
        const js = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
        const rows:any[] = js ? JSON.parse(js)?.table?.rows ?? [] : []
        const row = rows.find((r:any)=>parseInt(String(r?.c?.[0]?.v??''))===baan)
        if (!row) continue
        const c = row.c ?? []
        const read = (idx:number) => c?.[idx]?.v
        const numberAt = (idx:number) => parseFloat(String(read(idx) ?? 0)) || 0
        const textAt = (idx:number) => String(read(idx) ?? '').trim()

        const betHouse = textAt(2)
        const betAmountSheet = numberAt(3)
        const betReturn = numberAt(4)
        if (betHouse || betAmountSheet || betReturn) {
          entries.push({
            order: wave * 10 + 1,
            wave,
            label: betReturn >= betAmountSheet ? 'Bet game result' : 'Bet game result',
            detail: `Guessed house ${betHouse || '-'} · bet ${betAmountSheet.toLocaleString()} · return ${betReturn.toLocaleString()}`,
            amount: betReturn - betAmountSheet,
            type: betReturn >= betAmountSheet ? 'reward' : 'lose',
          })
        }

        const islandDetails: string[] = []
        ;[[7,8,9],[10,11,12],[13,14,15]].forEach(([nameIdx, amountIdx, returnIdx])=>{
          const area = textAt(nameIdx)
          const spent = numberAt(amountIdx)
          const got = numberAt(returnIdx)
          if (area || spent || got) islandDetails.push(`${area || '-'}: ${spent.toLocaleString()} -> ${got.toLocaleString()}`)
        })
        if (islandDetails.length) {
          const spent = numberAt(8)+numberAt(11)+numberAt(14)
          const got = numberAt(9)+numberAt(12)+numberAt(15)
          entries.push({
            order: wave * 10 + 2,
            wave,
            label: got >= spent ? 'Island bid result' : 'Island bid result',
            detail: islandDetails.join(', '),
            amount: got - spent,
            type: got >= spent ? 'income' : 'lose',
          })
        }

        const extras = [17,18,19].map((idx)=>({ label: textAt(idx), amount: numberAt(idx) })).filter(x=>x.label || x.amount)
        extras.forEach((x, idx)=>entries.push({
          order: wave * 10 + 3 + idx,
          wave,
          label: x.label || `Wave ${wave} adjustment`,
          detail: 'Sheet R:T input',
          amount: x.amount,
          type: x.amount >= 0 ? 'income' : 'lose',
        }))
      }
    } catch(e) { console.error(e) }
    return entries.sort((a,b)=>a.order-b.order)
  }, [baan])

  /* build history */
  useEffect(()=>{
    let cancelled = false
    const build = async () => {
    const sheetEntries = await fetchSheetHistory()
    const subs = getSubmissionsForBaan(baan).filter(s => s.wave <= gs.currentWave)
    const entries:HistoryEntry[] = sheetEntries.length ? sheetEntries : [{ label:'Starting balance', amount:balance, type:'start' }]
    for(const s of subs){
      const total=s.bets.reduce((sum,b)=>sum+b.amount,0)
      entries.push({ wave:s.wave, label:'ลงทุนพื้นที่',
        detail:s.bets.map(b=>`${b.area} ×${b.amount.toLocaleString()}`).join(', ')
          +(s.isKing&&s.kingDisaster?` · 👑 Disaster #${s.kingDisaster}`:''),
        amount:-total, type:'bet', timestamp:s.timestamp })
    }
    if (!cancelled) setHistory(entries)
    }
    build()
    return ()=>{ cancelled = true }
  },[baan,balance,gs.currentWave, fetchSheetHistory])

  /* map select */
  const handleSelect = (area:string)=>{
    if(!gs.isOpen) return
    const alreadySelected = cart.some(i=>i.area===area)
    if (!alreadySelected && cart.length >= 3) return
    setCart(prev=>prev.find(i=>i.area===area)?prev.filter(i=>i.area!==area):[...prev,{area,amount:0}])
    setIsSaved(false)
  }

  /* save — local store + write to Google Sheet */
  const handleSave = useCallback(async ()=>{
    if(isBetMode && betSpend>balance) return
    if(!isBetMode && totalBet>balance) return

    // 1. Save locally (instant, always works)
    saveSubmission({
      baan,
      wave: gs.currentWave,
      bets: isBetMode ? [] : cart,
      isKing,
      kingDisaster: kingDis ?? undefined,
      betTarget: isBetMode && betTarget ? parseInt(betTarget) : undefined,
      betAmount: isBetMode ? betSpend : undefined,
      timestamp: new Date().toLocaleTimeString('th-TH'),
      balance,
    })
    setIsSaved(true); setSavedAt(new Date().toLocaleTimeString('th-TH'))

    // 2. Write to Google Sheet via GAS (async, non-blocking)
    // Map cart items to up to 3 islands (areas)
    const islands = cart.slice(0,3).map(i=>({ name: i.area, amount: i.amount }))
    setSaveMessage('Sending to Google Sheet...')
    writeToSheet({
      action: 'writeWave',
      wave:   gs.currentWave,
      baan,
      betTarget: isBetMode && betTarget ? parseInt(betTarget) : undefined,
      betAmount: isBetMode ? betSpend : undefined,
      // King bid = king's total bet amount across all areas
      kingAmount: !isBetMode && isKing ? totalBet : undefined,
      kingDisaster: isKing ? kingDis : undefined,
      islands: isBetMode ? undefined : islands,
    }).then(res => {
      setSaveMessage(res.ok ? 'Sent to Google Sheet' : `Sheet error: ${res.message ?? 'not sent'}`)
      if (!res.ok) console.warn('Sheet write failed:', res.message)
      fetchBalance()
    }).catch(e => {
      setSaveMessage('Sheet error: not sent')
      console.error(e)
    })
  },[baan,cart,gs.currentWave,isKing,kingDis,balance,totalBet,isBetMode,betTarget,betSpend,fetchBalance])

  /* autosave */
  useEffect(()=>{
    if(cart.length===0&&isSaved) return
    setIsSaved(false); clearTimeout(saveTimer.current)
    saveTimer.current=setTimeout(handleSave,5000)
    return()=>clearTimeout(saveTimer.current)
  },[cart,kingDis]) // eslint-disable-line

  return (
    <div className="wire-page-full">
      <header className="wire-topbar">
        <div className="flex items-center gap-8">
          <HomeButton className="bg-white/10 border-white/20 text-white hover:text-white" />
          <div className="wire-title">ลงทุนเกาะรอบที่ {gs.currentWave}</div>
          <div className="wire-title flex items-center gap-3">
            {isKing && <Sparkles size={24} className="text-yellow-200" />}
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
            <div className="wire-pill">Balance : {balance.toLocaleString()}</div>
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
            <div className="space-y-3">
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
                        <input type="number" value={betAmount} min={0} disabled={!gs.isOpen}
                          onChange={e=>{setBetAmount(e.target.value); setIsSaved(false)}}
                          className="input-base font-mono" placeholder="0" />
                      </div>
                      <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                          <div className="text-label">Balance</div>
                          <div className="font-mono text-xl font-bold text-slate-900">{balance.toLocaleString()}</div>
                        </div>
                        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                          <div className="text-label">After Bet</div>
                          <div className={clsx('font-mono text-xl font-bold', balance - betSpend < 0 ? 'text-red-600' : 'text-slate-900')}>
                            {(balance - betSpend).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <button onClick={handleSave} disabled={!gs.isOpen || !betTarget || !betSpend || betSpend > balance}
                        className="btn btn-primary sm:col-span-2">
                        Submit bet {betSpend ? `· ${betSpend.toLocaleString()}` : ''}
                      </button>
                      {saveMessage && (
                        <div className="sm:col-span-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2 text-center text-sm text-emerald-700">
                          {saveMessage}
                        </div>
                      )}
                    </div>
                  ) : (
                    <GameMap ownership={ownership} selected={cart.map(i=>i.area)}
                      onSelect={handleSelect} filterDisaster={filterDis}
                      readOnly={!gs.isOpen}
                      kingDisaster={getActiveDisasterForWave(gs.currentWave)} />
                  )}
                </div>
              </div>

              {!isBetMode && <div className="flex flex-wrap gap-2">
                <span className="wire-toolbar-panel text-base">Filter ดูว่า disaster ไหนอยู่ในช่องใด</span>
                {DISASTER_NAMES.map((n,i)=>(
                  <button key={i+1} onClick={()=>setFilterDis(filterDis===i+1?null:i+1)}
                    className={clsx('btn disaster-filter', filterDis===i+1 ? 'active' : '')}>
                    {DISASTER_EMOJI[i]} <span>{n}</span>
                  </button>
                ))}
                {filterDis && <button onClick={()=>setFilterDis(null)} className="btn btn-ghost">Clear</button>}
              </div>}
            </div>

            {panelOpen && !isBetMode && (
              <aside className="wire-panel wire-side-panel">
                <div className="wire-section-title">พื้นที่ที่เลือก</div>
                <BiddingCart baan={baan} balance={balance} items={cart} isKing={isKing}
                  kingDisaster={kingDis}
                  onUpdate={i=>{setCart(i.slice(0,3));setIsSaved(false)}}
                  onKingDisaster={d=>{setKingDis(d);setIsSaved(false)}}
                  onSubmit={handleSave} isSaved={isSaved} savedAt={savedAt} isOpen={gs.isOpen} />
                <div className="wire-section-title bg-blue-500 text-white">
                  {isSaved?(savedAt?`Saved at ${savedAt}`:'Saved'):'Unsaved / autosave in 5s'}
                </div>
                {saveMessage && <div className="wire-section-title bg-emerald-600 text-white">{saveMessage}</div>}
              </aside>
            )}
          </section>

          {!isBetMode && <section className="wire-history wire-panel">
            <div className="wire-section-title">การเงิน(คะแนน) HISTORY</div>
            <div className="wire-history-body">
              <HistoryPanel entries={history} baan={baan} balance={balance}
                title="ประวัติการเงิน" maxHeight="none" />
            </div>
            <div className="wire-section-title bg-blue-500 text-white">
              BALANCE : {remaining.toLocaleString()} (Real time)
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
  useEffect(()=>{ const s=sessionStorage.getItem('baan_login'); if(s) setBaan(parseInt(s)); setChecking(false) },[])
  if (checking) return (
    <div className="min-h-screen app-shell flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin shadow-[0_0_26px_rgba(34,211,238,0.55)]" />
    </div>
  )
  return baan ? <BiddingGame baan={baan} /> : <BaanLogin onLogin={setBaan} />
}
