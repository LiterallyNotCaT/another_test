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
    const update = () => {
      const target = document.getElementById(targetId)
      setActive(document.fullscreenElement?.id === targetId || target?.classList.contains('fullscreen-fallback') === true)
    }
    document.addEventListener('fullscreenchange', update)
    update()
    return () => {
      document.removeEventListener('fullscreenchange', update)
      document.getElementById(targetId)?.classList.remove('fullscreen-fallback')
      document.body.classList.remove('fullscreen-fallback-open')
    }
  }, [targetId])

  const toggle = async () => {
    const target = document.getElementById(targetId)
    if (!target) return
    if (!target.requestFullscreen) {
      target.classList.toggle('fullscreen-fallback')
      document.body.classList.toggle('fullscreen-fallback-open', target.classList.contains('fullscreen-fallback'))
      setActive(target.classList.contains('fullscreen-fallback'))
      return
    }
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
