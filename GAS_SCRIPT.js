// ============================================================
// GOOGLE APPS SCRIPT — BigGame Web App
// Paste this entire file into Google Apps Script editor
// then Deploy as Web App (see setup steps below)
// ============================================================

const SHEET_ID = '1FKv1l9zpF85V_oUKQCjAjYyb4DZcMRCvN671DzU_Dq4'
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

// ── Write one house's wave data ────────────────────────────
function handleWriteWave(payload) {
  const { wave, baan, betTarget, betAmount, kingAmount, kingDisaster, islands } = payload

  // Validate
  if (!wave || wave < 1 || wave > 5)  return { status: 'error', message: 'Invalid wave' }
  if (!baan || baan < 1 || baan > 12) return { status: 'error', message: 'Invalid baan' }
  if (kingDisaster !== undefined && kingDisaster !== null && (kingDisaster < 1 || kingDisaster > 9)) {
    return { status: 'error', message: 'Invalid king disaster' }
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
  const currentBalance = sheet.getRange(row, COL.BALANCE).getValue()
  const hasIslandPayload = Array.isArray(islands)
  const islandSpend = hasIslandPayload ? islands.reduce((sum, isl) => sum + (isl.amount || 0), 0) : 0
  const totalSpend = betAmount || islandSpend || kingAmount || 0

  if (totalSpend > currentBalance) {
    return {
      status: 'error',
      message: `ยอดรวม ${totalSpend} เกินกว่า balance ${currentBalance}`
    }
  }

  // ── Write Bet game ─────────────────────────────────────
  const hasBetPayload = betTarget !== undefined || betAmount !== undefined
  if (hasBetPayload) {
    sheet.getRange(row, COL.KING_AMOUNT).clearContent()
    for (const c of [
      { name: COL.ISLAND1_NAME, amt: COL.ISLAND1_AMT },
      { name: COL.ISLAND2_NAME, amt: COL.ISLAND2_AMT },
      { name: COL.ISLAND3_NAME, amt: COL.ISLAND3_AMT },
    ]) {
      sheet.getRange(row, c.name).clearContent()
      sheet.getRange(row, c.amt).clearContent()
    }
  }
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
    // Bid mode should not leave stale bet-game inputs in C:D.
    sheet.getRange(row, COL.BET_TARGET).clearContent()
    sheet.getRange(row, COL.BET_AMOUNT).clearContent()

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
      remainingBalance: currentBalance - totalSpend,
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
