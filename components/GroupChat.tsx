'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { MessageCircle, Send, X } from 'lucide-react'
import { HOUSE_COLORS, HOUSE_NAMES } from '@/lib/constants'
import {
  fetchGroupChatMessages,
  markGroupChatRead,
  sendGroupChatMessage,
  type GroupChatActor,
  type GroupChatMessage,
} from '@/lib/sheets'

function formatChatTime(raw: string) {
  const dateParts = raw.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/)
  const date = dateParts
    ? new Date(
      Number(dateParts[1]),
      Number(dateParts[2]),
      Number(dateParts[3]),
      Number(dateParts[4] ?? 0),
      Number(dateParts[5] ?? 0),
      Number(dateParts[6] ?? 0),
    )
    : new Date(raw)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  return raw
}

function actorKey(actor: GroupChatActor) {
  return String(actor)
}

function isSameActor(message: GroupChatMessage, actor: GroupChatActor) {
  return actor === 'admin'
    ? message.sender.toLowerCase() === 'admin'
    : message.baan === actor
}

function actorLabel(actor: GroupChatActor) {
  return actor === 'admin' ? 'admin' : HOUSE_NAMES[actor]
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
  const actorId = actorKey(actor)

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
    if (!open) return
    const latestId = messages.at(-1)?.id ?? ''
    seenLatestRef.current = latestId
    setUnread(false)
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [open, messages])

  useEffect(() => {
    if (!open || !messages.length) return
    const storageKey = `biggame_chat_read_${actorId}`
    let readRows: number[] = []
    try { readRows = JSON.parse(localStorage.getItem(storageKey) || '[]') } catch {}
    const readSet = new Set(readRows)
    const rowsToMark = messages
      .filter(message => !isSameActor(message, actor) && !readSet.has(message.row))
      .map(message => message.row)
    if (!rowsToMark.length) return

    rowsToMark.forEach(row => readSet.add(row))
    localStorage.setItem(storageKey, JSON.stringify(Array.from(readSet).slice(-400)))
    setMessages(prev => prev.map(message => rowsToMark.includes(message.row)
      ? { ...message, readCount: Math.min(13, message.readCount + 1) }
      : message
    ))
    void markGroupChatRead(actor, rowsToMark)
  }, [actor, actorId, messages, open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const message = draft.trim()
    if (!message || sending) return
    setSending(true)
    setDraft('')
    const result = await sendGroupChatMessage(actor, message)
    if (!result.ok) setError(result.message ?? 'Cannot send message')
    await refresh()
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
                const color = message.sender.toLowerCase() === 'admin'
                  ? '#111827'
                  : message.baan ? HOUSE_COLORS[message.baan] : '#64748b'
                return (
                  <div key={message.id} className={clsx('group-chat-message-row', isMine && 'is-mine')}>
                    <div className="group-chat-message-meta">
                      <span style={{ color }}>{message.sender.toLowerCase() === 'admin' ? 'admin' : message.baan ? HOUSE_NAMES[message.baan] : 'Unknown'}</span>
                      <span>{formatChatTime(message.timestamp)}</span>
                    </div>
                    <div className={clsx('group-chat-bubble', isMine && 'is-mine')} style={isMine ? { background: color } : undefined}>
                      {message.message}
                    </div>
                    <div className="group-chat-read">อ่านแล้ว {message.readCount}</div>
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
