// ============================================================
// GOOGLE APPS SCRIPT — BigGame Web App
// Paste this entire file into Google Apps Script editor
// then Deploy as Web App (see setup steps below)
// ============================================================

const SHEET_ID = '1FKv1l9zpF85V_oUKQCjAjYyb4DZcMRCvN671DzU_Dq4'
const STATE_SHEET = 'GAME_STATE'
const CHAT_GID = 398958693
const WAVE_GIDS = {
  1: 1448591830,
}

// Row where data starts (row 5 in sheet = index 4 in GAS which is 1-based, so row 5)
const DATA_START_ROW = 5  // บ้าน 1 is at row 5
// บ้าน X is at row (DATA_START_ROW + X - 1)

// Column numbers (1-indexed, A=1, B=2, ...)
const COL = {
  BAAN:        1,   // A  - บ้านที่
  BALANCE:     2,   // B  - เงินก่อน (read-only, formula)
  BET_TARGET:  3,   // C  - Bet: บ้านที่เดิมพัน
  BET_AMOUNT:  4,   // D  - Bet: จำนวนเงิน
  // E = ได้คืน (formula, skip)
  KING_AMOUNT: 6,   // F  - King bid: จำนวนเงิน
  // G = ได้ king? (formula, skip)
  ISLAND1_NAME:  8, // H  - เกาะ 1: ชื่อเกาะ
  ISLAND1_AMT:   9, // I  - เกาะ 1: จำนวนเงิน
  // J = ได้คืน (formula, skip)
  ISLAND2_NAME: 11, // K  - เกาะ 2: ชื่อเกาะ
  ISLAND2_AMT:  12, // L  - เกาะ 2: จำนวนเงิน
  // M = ได้คืน (formula, skip)
  ISLAND3_NAME: 14, // N  - เกาะ 3: ชื่อเกาะ
  ISLAND3_AMT:  15, // O  - เกาะ 3: จำนวนเงิน
}

// ── Entry point ────────────────────────────────────────────
function doPost(e) {
  // CORS headers
  const output = ContentService.createTextOutput()
  output.setMimeType(ContentService.MimeType.JSON)

  try {
    const payload = JSON.parse(e.postData.contents)

    if (payload.action === 'writeWave') {
      const result = handleWriteWave(payload)
      output.setContent(JSON.stringify(result))
    } else if (payload.action === 'writeChat') {
      const result = handleWriteChat(payload)
      output.setContent(JSON.stringify(result))
    } else if (payload.action === 'writeGameState') {
      const result = handleWriteGameState(payload.state || {})
      output.setContent(JSON.stringify(result))
    } else {
      output.setContent(JSON.stringify({ status: 'error', message: 'Unknown action' }))
    }
  } catch (err) {
    output.setContent(JSON.stringify({ status: 'error', message: String(err) }))
  }

  return output
}

function handleWriteChat(payload) {
  const rawActor = payload.actor !== undefined ? payload.actor : payload.baan
  const actor = normalizeChatActor_(rawActor)
  const message = String(payload.message || '').trim()
  const replyToId = normalizeChatReplyId_(payload.replyToId)
  let sendTo = normalizeChatRecipient_(payload.sendTo)
  if (!actor) return { status: 'error', message: 'Invalid chat actor' }
  if (!message) return { status: 'error', message: 'Message is blank' }
  if (chatActorKey_(sendTo) === chatActorKey_(actor)) sendTo = 'public'

  const lock = LockService.getScriptLock()
  let locked = false
  try {
    lock.waitLock(15000)
    locked = true

    const ss = SpreadsheetApp.openById(SHEET_ID)
    const sheet = getSheetByGid_(ss, CHAT_GID)
    if (!sheet) return { status: 'error', message: `Chat sheet gid ${CHAT_GID} not found` }

    const targetRow = Math.max(sheet.getLastRow() + 1, 2)
    const lockedReplyTarget = getPrivateReplyTarget_(sheet, replyToId, actor)
    if (lockedReplyTarget) sendTo = lockedReplyTarget
    const previousRow = targetRow > 2 ? targetRow - 1 : 1
    const previousId = Number(sheet.getRange(previousRow, 1).getValue())
    const chatId = Number.isFinite(previousId) && previousId > 0 ? previousId + 1 : targetRow - 1

    const now = new Date()
    const timeZone = Session.getScriptTimeZone()
    const dateText = Utilities.formatDate(now, timeZone, 'M/d/yyyy')
    const timeText = Utilities.formatDate(now, timeZone, 'HH:mm')
    sheet.getRange(targetRow, 1, 1, 7).setValues([[
      chatId,
      dateText,
      timeText,
      actor,
      message.slice(0, 500),
      sendTo,
      replyToId,
    ]])
    SpreadsheetApp.flush()
    return { status: 'ok', row: targetRow, id: chatId }
  } catch (err) {
    return { status: 'error', message: 'Chat is busy. Please retry.' }
  } finally {
    if (locked) lock.releaseLock()
  }
}

function normalizeChatActor_(actor) {
  const raw = String(actor || '').trim()
  if (raw.toLowerCase() === 'admin') return 'Admin'
  const baan = Number(raw)
  if (baan >= 1 && baan <= 12) return baan
  return ''
}

function normalizeChatRecipient_(recipient) {
  const raw = String(recipient || '').trim()
  const lower = raw.toLowerCase()
  if (!raw || lower === 'public' || lower === 'all') return 'public'
  if (lower === 'admin') return 'admin'
  const baan = Number(raw)
  if (baan >= 1 && baan <= 12) return baan
  return 'public'
}

function normalizeChatReplyId_(replyToId) {
  const id = Number(replyToId)
  return Number.isFinite(id) && id > 0 ? id : ''
}

function chatActorKey_(actor) {
  const normalized = normalizeChatActor_(actor) || normalizeChatRecipient_(actor)
  return String(normalized || '').toLowerCase()
}

function getPrivateReplyTarget_(sheet, replyToId, actor) {
  if (!replyToId) return ''
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return ''

  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues()
  const replyRow = rows.find(row => String(row[0]).trim() === String(replyToId))
  if (!replyRow) return ''

  const originalSender = normalizeChatActor_(replyRow[3])
  const originalTarget = normalizeChatRecipient_(replyRow[5])
  if (!originalSender || !originalTarget || originalTarget === 'public') return ''

  const actorKey = chatActorKey_(actor)
  const senderKey = chatActorKey_(originalSender)
  const targetKey = chatActorKey_(originalTarget)

  if (senderKey && senderKey !== actorKey) return originalSender
  if (targetKey && targetKey !== actorKey) return originalTarget
  return ''
}

// Allow GET for health check
function doGet(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID)
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'BigGame GAS is running',
      sheetId: SHEET_ID,
      sheets: ss.getSheets().map(s => ({ name: s.getName(), gid: s.getSheetId() })),
    }))
    .setMimeType(ContentService.MimeType.JSON)
}

function handleWriteGameState(state) {
  const wave = Number(state.currentWave)
  const duration = Number(state.duration || 10)
  if (!wave || wave < 1 || wave > 5) return { status: 'error', message: 'Invalid currentWave' }

  const ss = SpreadsheetApp.openById(SHEET_ID)
  let sheet = ss.getSheetByName(STATE_SHEET)
  if (!sheet) {
    sheet = ss.insertSheet(STATE_SHEET)
    sheet.hideSheet()
  }

  const rows = [
    ['currentWave', wave],
    ['isOpen', state.isOpen === true ? 'true' : 'false'],
    ['timerEnd', state.timerEnd || ''],
    ['duration', duration],
    ['gameMode', state.gameMode === 'bet' ? 'bet' : 'bid'],
    ['gamePhase', state.gamePhase === 'select-disaster' ? 'select-disaster' : 'play'],
    ['showResults', state.showResults === true ? 'true' : 'false'],
    ['ambassadorVisibility', JSON.stringify(state.ambassadorVisibility || {})],
    ['updatedAt', state.updatedAt || new Date().toISOString()],
  ]
  sheet.getRange(1, 1, rows.length, 2).setValues(rows)
  SpreadsheetApp.flush()
  return { status: 'ok', state: Object.fromEntries(rows) }
}

// ── Write one house's wave data ────────────────────────────
function isProvided_(value) {
  return value !== undefined && value !== null && value !== ''
}

function numberFrom_(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value || '').replace(/,/g, '').trim()
  if (!cleaned) return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

function cellNumber_(range) {
  const raw = numberFrom_(range.getValue())
  if (raw !== 0) return raw
  return numberFrom_(range.getDisplayValue())
}

function handleWriteWave(payload) {
  const { wave, baan, betTarget, betAmount, kingAmount, kingDisaster, islands } = payload
  const waveNumber = numberFrom_(wave)
  const baanNumber = numberFrom_(baan)
  const hasBetPayload = isProvided_(betTarget) || isProvided_(betAmount)
  const betTargetNumber = isProvided_(betTarget) ? numberFrom_(betTarget) : null
  const betAmountNumber = isProvided_(betAmount) ? numberFrom_(betAmount) : null
  const kingAmountNumber = isProvided_(kingAmount) ? numberFrom_(kingAmount) : null
  const hasKingDisasterPayload = kingDisaster !== undefined
  const kingDisasterNumber = isProvided_(kingDisaster) ? numberFrom_(kingDisaster) : null
  const normalizedIslands = Array.isArray(islands)
    ? islands
      .map(isl => ({ name: String(isl.name || '').trim().toUpperCase(), amount: numberFrom_(isl.amount) }))
      .filter(isl => isl.name)
    : []

  // Validate
  if (!waveNumber || waveNumber < 1 || waveNumber > 5)  return { status: 'error', message: 'Invalid wave' }
  if (!baanNumber || baanNumber < 1 || baanNumber > 12) return { status: 'error', message: 'Invalid baan' }
  if (hasBetPayload && (!betTargetNumber || betTargetNumber < 1 || betTargetNumber > 12 || !betAmountNumber)) {
    return { status: 'error', message: 'Invalid bet payload' }
  }
  if (kingDisasterNumber !== null && (kingDisasterNumber < 1 || kingDisasterNumber > 9)) {
    return { status: 'error', message: 'Invalid king disaster' }
  }
  if (kingAmountNumber !== null && kingAmountNumber < 100) {
    return { status: 'error', message: 'King bid minimum is 100' }
  }
  if (normalizedIslands.length > 0 && normalizedIslands.some(isl => isl.amount < 100)) {
    return { status: 'error', message: 'Island bid minimum is 100' }
  }

  const lock = LockService.getScriptLock()
  let locked = false
  try {
    lock.waitLock(20000)
    locked = true

  const ss        = SpreadsheetApp.openById(SHEET_ID)
  const sheetName = `Wave ${waveNumber}`
  const sheet     = getWaveSheet_(ss, waveNumber)
  if (!sheet) {
    return {
      status: 'error',
      message: `Sheet "${sheetName}" not found. Available sheets: ${ss.getSheets().map(s => s.getName()).join(', ')}`,
    }
  }

  // Row for this baan (บ้าน 1 = row 5, บ้าน 2 = row 6, ...)
  const row = DATA_START_ROW + baanNumber - 1

  // ── Read current balance to validate ──────────────────
  const currentBalance = cellNumber_(sheet.getRange(row, COL.BALANCE))
  const minBetAmount = Math.ceil(currentBalance * 0.1)
  const hasIslandPayload = normalizedIslands.length > 0
  const islandSpend = hasIslandPayload ? normalizedIslands.reduce((sum, isl) => sum + isl.amount, 0) : 0
  const hasDisasterOnlyPayload = hasKingDisasterPayload && !hasBetPayload && !hasIslandPayload && kingAmountNumber === null
  const existingBetSpend = cellNumber_(sheet.getRange(row, COL.BET_AMOUNT))
  const existingKingSpend = cellNumber_(sheet.getRange(row, COL.KING_AMOUNT))
  const existingIslandSpend =
    cellNumber_(sheet.getRange(row, COL.ISLAND1_AMT)) +
    cellNumber_(sheet.getRange(row, COL.ISLAND2_AMT)) +
    cellNumber_(sheet.getRange(row, COL.ISLAND3_AMT))
  const nextBetSpend = hasBetPayload ? (betAmountNumber || 0) : existingBetSpend
  const nextKingSpend = kingAmountNumber !== null ? kingAmountNumber : existingKingSpend
  const nextIslandSpend = hasIslandPayload ? islandSpend : existingIslandSpend
  const totalSpend = (hasBetPayload ? (betAmountNumber || 0) : 0) +
    (kingAmountNumber !== null ? kingAmountNumber : 0) +
    (hasIslandPayload ? islandSpend : 0)
  const totalSpendAfterSave = nextBetSpend + nextKingSpend + nextIslandSpend

  if (betAmountNumber !== null && betAmountNumber < minBetAmount) {
    return { status: 'error', message: `Bet minimum is ${minBetAmount}` }
  }
  if (totalSpend <= 0 && !hasDisasterOnlyPayload) {
    return {
      status: 'error',
      message: 'Amount must be greater than 0'
    }
  }
  if (totalSpendAfterSave > currentBalance) {
    return {
      status: 'error',
      message: `ยอดรวม ${totalSpendAfterSave} เกินกว่า balance ${currentBalance}`
    }
  }

  // ── Write Bet game ─────────────────────────────────────
  if (betTargetNumber !== null) {
    sheet.getRange(row, COL.BET_TARGET).setValue(betTargetNumber)
  }
  if (betAmountNumber !== null) {
    sheet.getRange(row, COL.BET_AMOUNT).setValue(betAmountNumber)
  }

  // ── Write King bid ─────────────────────────────────────
  if (kingAmountNumber !== null) {
    sheet.getRange(row, COL.KING_AMOUNT).setValue(kingAmountNumber)
  }

  // Write this wave's king disaster to INFO cell H22.
  // H22 is shared per wave, so only the king client should send this field.
  if (hasKingDisasterPayload) {
    const disasterCell = sheet.getRange(22, 8)
    if (kingDisaster === null || kingDisaster === '') disasterCell.clearContent()
    else disasterCell.setValue(kingDisasterNumber)
  }

  // ── Write Islands (up to 3) ────────────────────────────
  const islandCols = [
    { name: COL.ISLAND1_NAME, amt: COL.ISLAND1_AMT },
    { name: COL.ISLAND2_NAME, amt: COL.ISLAND2_AMT },
    { name: COL.ISLAND3_NAME, amt: COL.ISLAND3_AMT },
  ]

  const islandList = hasIslandPayload ? normalizedIslands.slice(0, 3) : []
  if (hasIslandPayload) {
    // Clear existing island data first
    for (const c of islandCols) {
      sheet.getRange(row, c.name).clearContent()
      sheet.getRange(row, c.amt).clearContent()
    }

    // Write new island data
    islandList.forEach((isl, i) => {
      if (isl.name)   sheet.getRange(row, islandCols[i].name).setValue(isl.name)
      if (isl.amount) sheet.getRange(row, islandCols[i].amt).setValue(isl.amount)
    })
  }

  // ── Flush to sheet ─────────────────────────────────────
  SpreadsheetApp.flush()

  return {
    status: 'ok',
    message: `บ้าน ${baan} Wave ${wave} บันทึกแล้ว`,
    written: {
      row,
      betTarget: betTargetNumber,
      betAmount: betAmountNumber,
      kingAmount: kingAmountNumber,
      kingDisaster: kingDisasterNumber,
      islands: islandList,
      totalSpend,
      remainingBalance: currentBalance - totalSpendAfterSave,
    }
  }
  } catch (err) {
    const message = String(err && err.message ? err.message : err)
    return {
      status: 'error',
      message: /lock|timeout|timed out/i.test(message)
        ? 'Wave sheet is busy. Please retry.'
        : `Wave sheet write failed: ${message}`,
    }
  } finally {
    if (locked) lock.releaseLock()
  }
}

function getWaveSheet_(ss, wave) {
  const gid = WAVE_GIDS[wave]
  if (gid) {
    const byGid = getSheetByGid_(ss, gid)
    if (byGid) return byGid
  }

  const candidates = [`Wave ${wave}`, `WAVE ${wave}`, `Wave${wave}`, `W${wave}`]
  for (const name of candidates) {
    const sheet = ss.getSheetByName(name)
    if (sheet) return sheet
  }

  const normalizedTarget = `wave${wave}`
  return ss.getSheets().find(sheet =>
    String(sheet.getName()).toLowerCase().replace(/\s+/g, '') === normalizedTarget
  ) || null
}

function getSheetByGid_(ss, gid) {
  return ss.getSheets().find(sheet => sheet.getSheetId() === Number(gid)) || null
}
