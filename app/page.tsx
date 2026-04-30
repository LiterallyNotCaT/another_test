import Link from 'next/link'
import { ArrowRight, BarChart3, Gauge, Gavel, ShieldCheck, Trophy } from 'lucide-react'

const pages = [
  {
    id: 'bidding',
    href: '/bidding',
    title: 'Bidding',
    desc: 'House login, map selection, and investment submission.',
    icon: Gavel,
    accent: '#38bdf8',
  },
  {
    id: 'morning',
    href: '/scoreboard-morning',
    title: 'Morning Scoreboard',
    desc: 'Rankings and score detail for the morning game.',
    icon: Trophy,
    accent: '#f59e0b',
  },
  {
    id: 'ambassador',
    href: '/scoreboard-ambassador',
    title: 'Ambassador View',
    desc: 'Shared map status, balances, history, and leaderboard.',
    icon: BarChart3,
    accent: '#10b981',
  },
  {
    id: 'admin',
    href: '/admin',
    title: 'Admin Panel',
    desc: 'Wave, timer, mode, and processing controls.',
    icon: ShieldCheck,
    accent: '#60a5fa',
  },
  {
    id: 'live-game',
    href: '/bidding',
    title: 'Live Game',
    desc: 'Jump straight into the current house action.',
    icon: Gauge,
    accent: '#a78bfa',
    wide: true,
  },
]

export default function HomePage() {
  return (
    <main className="wire-page min-h-screen">
      <header className="wire-topbar">
        <div className="wire-title">BigGame Control Suite</div>
        <div className="wire-time">Operations Portal</div>
      </header>

      <section className="wire-content">
        <div className="mx-auto max-w-4xl">
          <div className="py-6 md:py-10">
            <p className="text-label">BIGGAME 2025</p>
            <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold leading-tight text-slate-900">
              Game control.
            </h1>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {pages.map(page => {
              const Icon = page.icon
              return (
                <Link
                  key={page.id}
                  href={page.href}
                  className={`content-card group flex min-h-32 flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 ${page.wide ? 'md:col-span-2' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-slate-50"
                      style={{ color: page.accent }}
                    >
                      <Icon size={20} />
                    </div>
                    <ArrowRight size={18} className="text-slate-400 transition-colors group-hover:text-blue-600" />
                  </div>
                  <div className="mt-6">
                    <h2 className="font-display text-xl font-bold text-slate-900">{page.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{page.desc}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}
