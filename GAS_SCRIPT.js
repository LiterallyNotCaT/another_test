// ============================================================
// GOOGLE APPS SCRIPT — BigGame Web App
// Paste this entire file into Google Apps Script editor
// then Deploy as Web App (see setup steps below)
// ============================================================

const SHEET_ID = '1FKv1l9zpF85V_oUKQCjAjYyb4DZcMRCvN671DzU_Dq4'
const STATE_SHEET = 'GAME_STATE'
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
    ['updatedAt', state.updatedAt || new Date().toISOString()],
  ]
  sheet.getRange(1, 1, rows.length, 2).setValues(rows)
  SpreadsheetApp.flush()
  return { status: 'ok', state: Object.fromEntries(rows) }
}

// ── Write one house's wave data ────────────────────────────
function handleWriteWave(payload) {
  const { wave, baan, betTarget, betAmount, kingAmount, kingDisaster, islands } = payload

  // Validate
  if (!wave || wave < 1 || wave > 5)  return { status: 'error', message: 'Invalid wave' }
  if (!baan || baan < 1 || baan > 12) return { status: 'error', message: 'Invalid baan' }
  if (kingDisaster !== undefined && kingDisaster !== null && (kingDisaster < 1 || kingDisaster > 9)) {
    return { status: 'error', message: 'Invalid king disaster' }
  }
  if (kingAmount !== undefined && kingAmount !== null && kingAmount < 100) {
    return { status: 'error', message: 'King bid minimum is 100' }
  }
  if (Array.isArray(islands) && islands.length > 0 && islands.some(isl => (isl.amount || 0) < 100)) {
    return { status: 'error', message: 'Island bid minimum is 100' }
  }

  const ss        = SpreadsheetApp.openById(SHEET_ID)
  const sheetName = `Wave ${wave}`
  const sheet     = getWaveSheet_(ss, wave)
  if (!sheet) {
    return {
      status: 'error',
      message: `Sheet "${sheetName}" not found. Available sheets: ${ss.getSheets().map(s => s.getName()).join(', ')}`,
    }
  }

  // Row for this baan (บ้าน 1 = row 5, บ้าน 2 = row 6, ...)
  const row = DATA_START_ROW + baan - 1

  // ── Read current balance to validate ──────────────────
  const currentBalance = Number(sheet.getRange(row, COL.BALANCE).getValue()) || 0
  const minBetAmount = Math.ceil(currentBalance * 0.1)
  const hasIslandPayload = Array.isArray(islands) && islands.length > 0
  const islandSpend = hasIslandPayload ? islands.reduce((sum, isl) => sum + (isl.amount || 0), 0) : 0
  const hasBetPayload = betTarget !== undefined || betAmount !== undefined
  const hasDisasterOnlyPayload = kingDisaster !== undefined && !hasBetPayload && !hasIslandPayload && (kingAmount === undefined || kingAmount === null)
  const existingBetSpend = sheet.getRange(row, COL.BET_AMOUNT).getValue() || 0
  const existingKingSpend = sheet.getRange(row, COL.KING_AMOUNT).getValue() || 0
  const existingIslandSpend =
    (sheet.getRange(row, COL.ISLAND1_AMT).getValue() || 0) +
    (sheet.getRange(row, COL.ISLAND2_AMT).getValue() || 0) +
    (sheet.getRange(row, COL.ISLAND3_AMT).getValue() || 0)
  const nextBetSpend = hasBetPayload ? (betAmount || 0) : existingBetSpend
  const nextKingSpend = kingAmount !== undefined && kingAmount !== null ? kingAmount : existingKingSpend
  const nextIslandSpend = hasIslandPayload ? islandSpend : existingIslandSpend
  const totalSpend = (hasBetPayload ? (betAmount || 0) : 0) +
    (kingAmount !== undefined && kingAmount !== null ? kingAmount : 0) +
    (hasIslandPayload ? islandSpend : 0)
  const totalSpendAfterSave = nextBetSpend + nextKingSpend + nextIslandSpend

  if (betAmount !== undefined && betAmount !== null && betAmount < minBetAmount) {
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
  if (betTarget !== undefined && betTarget !== null) {
    sheet.getRange(row, COL.BET_TARGET).setValue(betTarget)
  }
  if (betAmount !== undefined && betAmount !== null) {
    sheet.getRange(row, COL.BET_AMOUNT).setValue(betAmount)
  }

  // ── Write King bid ─────────────────────────────────────
  if (kingAmount !== undefined && kingAmount !== null) {
    sheet.getRange(row, COL.KING_AMOUNT).setValue(kingAmount)
  }

  // Write this wave's king disaster to INFO cell H22.
  // H22 is shared per wave, so only the king client should send this field.
  if (kingDisaster !== undefined) {
    const disasterCell = sheet.getRange(22, 8)
    if (kingDisaster === null || kingDisaster === '') disasterCell.clearContent()
    else disasterCell.setValue(kingDisaster)
  }

  // ── Write Islands (up to 3) ────────────────────────────
  const islandCols = [
    { name: COL.ISLAND1_NAME, amt: COL.ISLAND1_AMT },
    { name: COL.ISLAND2_NAME, amt: COL.ISLAND2_AMT },
    { name: COL.ISLAND3_NAME, amt: COL.ISLAND3_AMT },
  ]

  const islandList = hasIslandPayload ? islands.slice(0, 3) : []
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
      betTarget,
      betAmount,
      kingAmount,
      kingDisaster,
      islands: islandList,
      totalSpend,
      remainingBalance: currentBalance - totalSpendAfterSave,
    }
  }
}

function getWaveSheet_(ss, wave) {
  const gid = WAVE_GIDS[wave]
  if (gid) {
    const byGid = ss.getSheets().find(sheet => sheet.getSheetId() === gid)
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
