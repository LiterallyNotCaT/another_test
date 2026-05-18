'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { MessageCircle, Send, X } from 'lucide-react'
import { HOUSE_COLORS, HOUSE_NAMES } from '@/lib/constants'
import {
  fetchGroupChatMessages,
  sendGroupChatMessage,
  type GroupChatActor,
  type GroupChatMessage,
} from '@/lib/sheets'

function parseChatDate(raw: string) {
  const dateParts = raw.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/)
  return dateParts
    ? new Date(
      Number(dateParts[1]),
      Number(dateParts[2]),
      Number(dateParts[3]),
      Number(dateParts[4] ?? 0),
      Number(dateParts[5] ?? 0),
      Number(dateParts[6] ?? 0),
    )
    : new Date(raw)
}

function formatChatTime(raw: string) {
  const amPmParts = raw.match(/(?:^|\s)(1[0-2]|0?\d):([0-5]\d)\s*([AP]M)(?:\s|$)/i)
  if (amPmParts) {
    const hour = Number(amPmParts[1])
    const normalizedHour = amPmParts[3].toUpperCase() === 'PM'
      ? hour === 12 ? 12 : hour + 12
      : hour === 12 ? 0 : hour
    return `${String(normalizedHour).padStart(2, '0')}:${amPmParts[2]}`
  }

  const timeParts = raw.match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?:\s|$)/)
  if (timeParts) return `${timeParts[1].padStart(2, '0')}:${timeParts[2]}`

  const date = parseChatDate(raw)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return raw
}

function isSameActor(message: GroupChatMessage, actor: GroupChatActor) {
  return actor === 'admin'
    ? message.sender.toLowerCase() === 'admin'
    : message.baan === actor
}

function actorLabel(actor: GroupChatActor) {
  return actor === 'admin' ? 'Admin' : HOUSE_NAMES[actor]
}

function optimisticTimestamp() {
  const now = new Date()
  const date = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return `${date} ${time}`
}

export default function GroupChat({ actor, label }: { actor: GroupChatActor; label?: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<GroupChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [unread, setUnread] = useState(false)
  const [error, setError] = useState('')
  const seenLatestRef = useRef('')
  const initializedRef = useRef(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await fetchGroupChatMessages()
      const latestId = next.at(-1)?.id ?? ''
      setMessages(next)
      setError('')
      if (!initializedRef.current) {
        initializedRef.current = true
        seenLatestRef.current = latestId
        return
      }
      if (latestId && latestId !== seenLatestRef.current && !open) setUnread(true)
      if (open) {
        seenLatestRef.current = latestId
        setUnread(false)
      }
    } catch (e) {
      console.error(e)
      setError('Cannot load chat')
    }
  }, [open])

  useEffect(() => {
    refresh()
    const intervalId = window.setInterval(refresh, 5000)
    return () => window.clearInterval(intervalId)
  }, [refresh])

  useEffect(() => {
    if (!open) {
      return
    }
    const latestId = messages.at(-1)?.id ?? ''
    seenLatestRef.current = latestId
    setUnread(false)
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [open, messages])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const message = draft.trim()
    if (!message || sending) return
    setSending(true)
    setDraft('')
    const now = Date.now()
    setMessages(prev => [...prev, {
      id: `local-${now}`,
      row: -now,
      timestamp: optimisticTimestamp(),
      sender: actor === 'admin' ? 'Admin' : String(actor),
      baan: actor === 'admin' ? null : actor,
      message,
    }])
    const result = await sendGroupChatMessage(actor, message)
    if (!result.ok) setError(result.message ?? 'Cannot send message')
    window.setTimeout(refresh, 900)
    setSending(false)
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost group-chat-trigger" aria-label="Open group chat">
        <MessageCircle size={15} />
        {label ?? 'Group chat'}
        {unread && <span className="group-chat-dot" />}
      </button>

      {open && (
        <div className="group-chat-backdrop" role="dialog" aria-modal="true" aria-label="Group chat">
          <div className="group-chat-panel">
            <div className="group-chat-header">
              <div>
                <div className="group-chat-title">Group chat</div>
                <div className="group-chat-subtitle">{actorLabel(actor)}</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="group-chat-close" aria-label="Close group chat">
                <X size={18} />
              </button>
            </div>

            <div ref={listRef} className="group-chat-list">
              {messages.map(message => {
                const isMine = isSameActor(message, actor)
                const isAdmin = message.sender.toLowerCase() === 'admin'
                const color = isAdmin ? '#111827' : message.baan ? HOUSE_COLORS[message.baan] : '#64748b'
                const senderName = isAdmin ? 'Admin' : message.baan ? HOUSE_NAMES[message.baan] : message.sender || 'Unknown'
                return (
                  <div key={message.id} className={clsx('group-chat-message-row', isMine && 'is-mine')}>
                    <div className="group-chat-message-meta">
                      <span style={{ color }}>{senderName}</span>
                      <span>{formatChatTime(message.timestamp)}</span>
                    </div>
                    <div className={clsx('group-chat-bubble', isMine && 'is-mine')} style={isMine ? { background: color } : undefined}>
                      {message.message}
                    </div>
                  </div>
                )
              })}
              {!messages.length && (
                <div className="group-chat-empty">No messages yet.</div>
              )}
            </div>

            {error && <div className="group-chat-error">{error}</div>}
            <form onSubmit={submit} className="group-chat-form">
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                maxLength={500}
                placeholder="Type a message"
                className="group-chat-input"
              />
              <button type="submit" disabled={!draft.trim() || sending} className="group-chat-send" aria-label="Send message">
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
