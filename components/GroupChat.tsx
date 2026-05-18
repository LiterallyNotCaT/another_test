'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { MessageCircle, Send, X } from 'lucide-react'
import { HOUSE_COLORS, HOUSE_NAMES } from '@/lib/constants'
import {
  fetchGroupChatMessages,
  sendGroupChatMessage,
  type GroupChatActor,
  type GroupChatMessage,
} from '@/lib/sheets'

function isSameActor(message: GroupChatMessage, actor: GroupChatActor) {
  return actor === 'admin'
    ? message.sender.toLowerCase() === 'admin'
    : message.baan === actor
}

function actorTarget(actor: GroupChatActor) {
  return actor === 'admin' ? 'admin' : String(actor)
}

function senderTarget(message: GroupChatMessage) {
  return message.sender.toLowerCase() === 'admin' ? 'admin' : message.baan ? String(message.baan) : ''
}

function targetLabel(target: string) {
  if (target === 'all') return 'All'
  if (target === 'public') return 'Group chat'
  if (target === 'admin') return 'Admin'
  const baan = Number(target)
  return Number.isInteger(baan) && baan >= 1 && baan <= 12 ? HOUSE_NAMES[baan] : 'Group chat'
}

function canViewMessage(message: GroupChatMessage, actor: GroupChatActor) {
  const target = message.sendTo || 'public'
  if (target === 'public') return true
  const currentActor = actorTarget(actor)
  return target === currentActor || senderTarget(message) === currentActor
}

function chatTargetOptions(actor: GroupChatActor, includeAll = false) {
  const self = actorTarget(actor)
  return [
    ...(includeAll ? [{ value: 'all', label: 'All' }] : []),
    { value: 'public', label: 'Group chat' },
    ...(self === 'admin' ? [] : [{ value: 'admin', label: 'Admin' }]),
    ...Array.from({ length: 12 }, (_, index) => index + 1)
      .filter(baan => String(baan) !== self)
      .map(baan => ({ value: String(baan), label: HOUSE_NAMES[baan] })),
  ]
}

function messageChannelForActor(message: GroupChatMessage, actor: GroupChatActor) {
  const target = message.sendTo || 'public'
  if (target === 'public') return 'public'
  const currentActor = actorTarget(actor)
  const sender = senderTarget(message)
  if (sender === currentActor) return target
  if (target === currentActor) return sender
  return target
}

function canSendToTarget(target: string, actor: GroupChatActor) {
  return target === 'public' || target !== actorTarget(actor)
}

function privateReplyTarget(message: GroupChatMessage, actor: GroupChatActor) {
  const currentActor = actorTarget(actor)
  const sender = senderTarget(message)
  const originalTarget = message.sendTo || 'public'
  if (originalTarget === 'public') return ''
  if (sender && sender !== currentActor) return sender
  if (originalTarget !== currentActor) return originalTarget
  return ''
}

function actorLabel(actor: GroupChatActor) {
  return actor === 'admin' ? 'Admin' : HOUSE_NAMES[actor]
}

function messageSenderName(message: GroupChatMessage) {
  if (message.sender.toLowerCase() === 'admin') return 'Admin'
  if (message.baan) return HOUSE_NAMES[message.baan]
  return message.sender || 'Unknown'
}

function optimisticChatTime() {
  const now = new Date()
  const date = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return {
    timestamp: `${date} ${time}`,
    dateKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    dateLabel: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    timeLabel: time,
  }
}

export default function GroupChat({ actor, label }: { actor: GroupChatActor; label?: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<GroupChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sendTo, setSendTo] = useState('public')
  const [channelFilter, setChannelFilter] = useState('all')
  const [replyTo, setReplyTo] = useState<GroupChatMessage | null>(null)
  const [sending, setSending] = useState(false)
  const [unread, setUnread] = useState(false)
  const [error, setError] = useState('')
  const seenLatestRef = useRef('')
  const initializedRef = useRef(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const sendTargetOptions = useMemo(() => chatTargetOptions(actor), [actor])
  const channelOptions = useMemo(() => chatTargetOptions(actor, true), [actor])
  const viewableMessages = useMemo(
    () => messages.filter(message => canViewMessage(message, actor)),
    [actor, messages]
  )
  const visibleMessages = useMemo(
    () => viewableMessages.filter(message => channelFilter === 'all' || messageChannelForActor(message, actor) === channelFilter),
    [actor, channelFilter, viewableMessages]
  )
  const messageByChatId = useMemo(
    () => new Map(viewableMessages.map(message => [message.chatId, message])),
    [viewableMessages]
  )
  const lockedReplyTarget = replyTo ? privateReplyTarget(replyTo, actor) : ''

  useEffect(() => {
    if (!sendTargetOptions.some(option => option.value === sendTo)) setSendTo('public')
  }, [sendTargetOptions, sendTo])

  useEffect(() => {
    if (!channelOptions.some(option => option.value === channelFilter)) setChannelFilter('all')
  }, [channelFilter, channelOptions])

  const refresh = useCallback(async () => {
    try {
      const next = await fetchGroupChatMessages()
      const viewableNext = next.filter(message => canViewMessage(message, actor))
      const latestId = viewableNext.at(-1)?.id ?? ''
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
  }, [actor, open])

  useEffect(() => {
    refresh()
    const intervalId = window.setInterval(refresh, 5000)
    return () => window.clearInterval(intervalId)
  }, [refresh])

  useEffect(() => {
    if (!open) {
      return
    }
    const latestId = viewableMessages.at(-1)?.id ?? ''
    seenLatestRef.current = latestId
    setUnread(false)
  }, [open, viewableMessages])

  const beginReply = (message: GroupChatMessage) => {
    setReplyTo(message)
    const lockedTarget = privateReplyTarget(message, actor)
    if (lockedTarget) {
      setSendTo(lockedTarget)
    } else if (!isSameActor(message, actor)) {
      const target = senderTarget(message)
      if (target) setSendTo(target)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const message = draft.trim()
    if (!message || sending) return
    setSending(true)
    setDraft('')
    const now = Date.now()
    const time = optimisticChatTime()
    const effectiveSendTo = canSendToTarget(lockedReplyTarget || sendTo, actor) ? lockedReplyTarget || sendTo : 'public'
    setMessages(prev => [...prev, {
      id: `local-${now}`,
      row: -now,
      timestamp: time.timestamp,
      dateKey: time.dateKey,
      dateLabel: time.dateLabel,
      timeLabel: time.timeLabel,
      sender: actor === 'admin' ? 'Admin' : String(actor),
      baan: actor === 'admin' ? null : actor,
      message,
      chatId: `local-${now}`,
      sendTo: effectiveSendTo,
      replyToId: replyTo?.chatId ?? '',
    }])
    const result = await sendGroupChatMessage(actor, message, { sendTo: effectiveSendTo, replyToId: replyTo?.chatId ?? '' })
    if (!result.ok) setError(result.message ?? 'Cannot send message')
    setReplyTo(null)
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
            <div className="group-chat-channel-filter">
              <label className="group-chat-target">
                <span>Channel</span>
                <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)}>
                  {channelOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div ref={listRef} className="group-chat-list">
              {visibleMessages.map((message, index) => {
                const isMine = isSameActor(message, actor)
                const isAdmin = message.sender.toLowerCase() === 'admin'
                const color = isAdmin ? '#111827' : message.baan ? HOUSE_COLORS[message.baan] : '#64748b'
                const senderName = messageSenderName(message)
                const replySource = message.replyToId ? messageByChatId.get(message.replyToId) : null
                const dateKey = message.dateKey || 'unknown-date'
                const prevDateKey = index > 0 ? visibleMessages[index - 1].dateKey || 'unknown-date' : ''
                const showDateDivider = dateKey !== 'unknown-date' && dateKey !== prevDateKey
                return (
                  <Fragment key={message.id}>
                    {showDateDivider && (
                      <div className="group-chat-date-divider">{message.dateLabel || 'Unknown date'}</div>
                    )}
                    <div className={clsx('group-chat-message-row', isMine && 'is-mine')}>
                      <div className="group-chat-message-meta">
                        <span style={{ color }}>{senderName}</span>
                        <span>sent to {targetLabel(message.sendTo)}</span>
                      </div>
                      {message.replyToId && (
                        <div className="group-chat-reply-context">
                          <div className="group-chat-reply-author">
                            Replying to {replySource ? messageSenderName(replySource) : 'private message'}
                          </div>
                          {replySource && (
                            <div className="group-chat-reply-text">{replySource.message}</div>
                          )}
                        </div>
                      )}
                      <div className="group-chat-bubble-line">
                        <div className={clsx('group-chat-bubble', isMine && 'is-mine')} style={isMine ? { background: color } : undefined}>
                          {message.message}
                        </div>
                        <span className="group-chat-message-actions">
                          <span className="group-chat-time">{message.timeLabel}</span>
                          <button type="button" className="group-chat-reply-btn" onClick={() => beginReply(message)}>
                            reply
                          </button>
                        </span>
                      </div>
                    </div>
                  </Fragment>
                )
              })}
              {!visibleMessages.length && (
                <div className="group-chat-empty">No messages yet.</div>
              )}
            </div>

            {error && <div className="group-chat-error">{error}</div>}
            <form onSubmit={submit} className="group-chat-form">
              <div className="group-chat-compose-tools">
                <label className="group-chat-target">
                  <span>To</span>
                  <select value={sendTo} onChange={e => setSendTo(e.target.value)} disabled={Boolean(lockedReplyTarget)}>
                    {sendTargetOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                {replyTo && (
                  <div className="group-chat-replying">
                    <span>
                      Replying to {messageSenderName(replyTo)}: {replyTo.message}
                    </span>
                    <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">x</button>
                  </div>
                )}
              </div>
              <div className="group-chat-input-row">
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
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
