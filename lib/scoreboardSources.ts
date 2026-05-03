import { SHEET_ID } from './constants'

export const AFTERNOON_SCORE_CSV_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('TOTALSCORE')}`
