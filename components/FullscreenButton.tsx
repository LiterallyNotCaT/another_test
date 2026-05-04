'use client'

import { useEffect, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import clsx from 'clsx'

interface FullscreenButtonProps {
  targetId: string
  className?: string
}

export default function FullscreenButton({ targetId, className }: FullscreenButtonProps) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const update = () => setActive(document.fullscreenElement?.id === targetId)
    document.addEventListener('fullscreenchange', update)
    update()
    return () => document.removeEventListener('fullscreenchange', update)
  }, [targetId])

  const toggle = async () => {
    const target = document.getElementById(targetId)
    if (!target) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await target.requestFullscreen()
  }

  const Icon = active ? Minimize2 : Maximize2

  return (
    <button
      type="button"
      onClick={toggle}
      className={clsx('fullscreen-button', className)}
      title={active ? 'Exit fullscreen' : 'Fullscreen'}
      aria-label={active ? 'Exit fullscreen' : 'Fullscreen'}
    >
      <Icon size={16} />
    </button>
  )
}
