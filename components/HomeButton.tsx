'use client'
import Link from 'next/link'
import { Home } from 'lucide-react'

export default function HomeButton({ className = '' }: { className?: string }) {
  return (
    <Link href="/"
      className={`home-button inline-flex items-center gap-2 glass-light rounded-lg px-3 py-2
        text-slate-400 hover:text-white hover:border-white/15
        transition-all duration-200 group ${className}`}>
      <Home size={14} className="group-hover:scale-110 transition-transform duration-200" />
      <span className="font-display text-2xs tracking-widest uppercase font-semibold">Home</span>
    </Link>
  )
}
