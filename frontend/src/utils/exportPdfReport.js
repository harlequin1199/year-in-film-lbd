import jsPDF from 'jspdf'
import { getLanguageRu } from './languageRu.js'
import { fontBase64 } from './pdfFont.js'

// ---------------------------------------------------------------------------
// A) Global layout system
// ---------------------------------------------------------------------------
const MM = 72 / 25.4
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN_X = 18 * MM
const MARGIN_TOP = 16 * MM
const MARGIN_BOTTOM = 16 * MM
const CONTENT_W = PAGE_W - 2 * MARGIN_X
const FOOTER_HEIGHT = 14
const CONTENT_BOTTOM = PAGE_H - MARGIN_BOTTOM - FOOTER_HEIGHT

const FONT = 'DejaVuSans'
const FONT_STYLE = 'normal'

// Typography
const FONT_SIZE = {
  reportTitle: 22,
  sectionTitle: 15,
  subtitle: 11,
  normal: 10,
  small: 8,
}
const LINE_HEIGHT = {
  normal: 5.5,
  table: 5.5,
  compact: 4.5,
}

// E) Spacing rules
const SPACING_AFTER_SECTION = 6 * MM
const SPACING_AFTER_SUBTITLE = 3 * MM
const CELL_PADDING = 2 * MM

// Stats block vertical rhythm (issue 1)
const LH = 5.2
const GAP_SM = 2.0
const GAP_MD = 4.0

function ensureSpace(doc, y, requiredHeight) {
  if (y + requiredHeight > CONTENT_BOTTOM) {
    doc.addPage()
    return MARGIN_TOP
  }
  return y
}

// ---------------------------------------------------------------------------
// A) Robust text helpers
// ---------------------------------------------------------------------------
function wrapText(doc, text, maxWidth) {
  return doc.splitTextToSize(String(text ?? ''), Math.max(1, maxWidth))
}

function measureLines(doc, text, maxWidth) {
  return wrapText(doc, text, maxWidth).length
}

/**
 * Draw text with wrapping; returns new y position.
 */
function textBlock(doc, text, x, y, maxWidth, lineHeight) {
  const lines = wrapText(doc, text, maxWidth)
  if (lines.length === 0) return y + lineHeight
  doc.setFont(FONT, FONT_STYLE)
  lines.forEach((line, i) => {
    doc.text(line, x, y + (i + 1) * lineHeight - 2)
  })
  return y + lines.length * lineHeight
}

// ---------------------------------------------------------------------------
// Section title and optional debug
// ---------------------------------------------------------------------------
function drawSectionTitle(doc, y, text) {
  y = ensureSpace(doc, y, 28)
  doc.setFont(FONT, FONT_STYLE)
  doc.setFontSize(FONT_SIZE.sectionTitle)
  doc.setTextColor(0, 0, 0)
  const lines = wrapText(doc, text, CONTENT_W)
  lines.forEach((line) => {
    doc.text(line, MARGIN_X, y + 4)
    y += LINE_HEIGHT.normal + 1
  })
  y += 3
  doc.setDrawColor(200, 200, 200)
  doc.line(MARGIN_X, y, MARGIN_X + CONTENT_W, y)
  y += 8
  doc.setFontSize(FONT_SIZE.normal)
  return y
}

function drawMarginGuides(doc) {
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_X, 0, MARGIN_X, PAGE_H)
  doc.line(PAGE_W - MARGIN_X, 0, PAGE_W - MARGIN_X, PAGE_H)
  doc.line(0, MARGIN_TOP, PAGE_W, MARGIN_TOP)
  doc.line(0, CONTENT_BOTTOM, PAGE_W, CONTENT_BOTTOM)
  doc.setLineWidth(0.5)
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function formatNumberRu(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function formatYearNoSpace(value) {
  if (value === null || value === undefined) return '—'
  return String(value)
}

function ratingToStars(rating) {
  if (rating == null || Number.isNaN(rating)) return '—'
  const r = Math.max(0, Math.min(5, rating))
  const full = Math.floor(r)
  const half = r - full >= 0.25 && r - full < 0.75
  const star = '★'
  const halfChar = '½'
  return star.repeat(full) + (half ? halfChar : '')
}

function formatRatingRu(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(2).replace('.', ',')
}

// ---------------------------------------------------------------------------
// D) Table with header repetition on page break
// ---------------------------------------------------------------------------
function drawTableHeader(doc, y, columns, colWidths, tableWidth, rowHeight, pad, headerFill) {
  doc.setFont(FONT, FONT_STYLE)
  doc.setFontSize(FONT_SIZE.normal)
  const headerCellHeights = columns.map((col, i) => {
    const lines = wrapText(doc, col.title, colWidths[i] - 2 * pad)
    return lines.length * rowHeight
  })
  const headerRowH = Math.max(...headerCellHeights) + 2 * pad
  if (headerFill) {
    doc.setFillColor(240, 240, 240)
    doc.rect(MARGIN_X, y, tableWidth, headerRowH, 'F')
  }
  doc.setTextColor(0, 0, 0)
  let x = MARGIN_X
  columns.forEach((col, i) => {
    const lines = wrapText(doc, col.title, colWidths[i] - 2 * pad)
    let cy = y + pad
    lines.forEach((line) => {
      doc.text(line, x + pad, cy + rowHeight - 1.5)
      cy += rowHeight
    })
    x += colWidths[i]
  })
  doc.setDrawColor(200, 200, 200)
  doc.line(MARGIN_X, y + headerRowH, MARGIN_X + tableWidth, y + headerRowH)
  return y + headerRowH
}

/**
 * Render table with repeated header on each page.
 */
function renderTable(doc, y, { columns, rows, rowHeight = LINE_HEIGHT.table, headerFill = true, zebraRows = true }) {
  const colWidths = columns.map((c) => (c.widthPct / 100) * CONTENT_W)
  const tableWidth = colWidths.reduce((a, b) => a + b, 0)
  const pad = CELL_PADDING

  doc.setFont(FONT, FONT_STYLE)
  doc.setFontSize(FONT_SIZE.normal)

  const headerCellHeights = columns.map((col, i) => {
    const lines = wrapText(doc, col.title, colWidths[i] - 2 * pad)
    return lines.length * rowHeight
  })
  const headerRowH = Math.max(...headerCellHeights) + 2 * pad

  y = ensureSpace(doc, y, headerRowH)
  y = drawTableHeader(doc, y, columns, colWidths, tableWidth, rowHeight, pad, headerFill)

  rows.forEach((row, rowIndex) => {
    const cellLines = columns.map((col, i) =>
      wrapText(doc, String(row[col.key] ?? '—'), colWidths[i] - 2 * pad),
    )
    const rowH = Math.max(...cellLines.map((lines) => lines.length * rowHeight)) + 2 * pad

    if (y + rowH > CONTENT_BOTTOM) {
      doc.addPage()
      y = MARGIN_TOP
      y = drawTableHeader(doc, y, columns, colWidths, tableWidth, rowHeight, pad, headerFill)
    }

    y = ensureSpace(doc, y, rowH)

    if (zebraRows && rowIndex % 2 === 1) {
      doc.setFillColor(248, 248, 248)
      doc.rect(MARGIN_X, y, tableWidth, rowH, 'F')
    }
    doc.setTextColor(0, 0, 0)

    let x = MARGIN_X
    columns.forEach((col, i) => {
      const lines = cellLines[i]
      const align = col.align || 'left'
      let cy = y + pad
      lines.forEach((line) => {
        const tx = align === 'right' ? x + colWidths[i] - pad - doc.getTextWidth(line) : x + pad
        doc.text(line, tx, cy + rowHeight - 1.5)
        cy += rowHeight
      })
      doc.setDrawColor(230, 230, 230)
      doc.line(x + colWidths[i], y, x + colWidths[i], y + rowH)
      x += colWidths[i]
    })
    doc.setDrawColor(230, 230, 230)
    doc.line(MARGIN_X, y, MARGIN_X + tableWidth, y)
    doc.line(MARGIN_X, y + rowH, MARGIN_X + tableWidth, y + rowH)
    y += rowH
  })
  return y + 10
}

// ---------------------------------------------------------------------------
// B) Lists: one item per line; reprint title on page break (issue 3)
// ---------------------------------------------------------------------------
const LIST_ITEM_GAP = 4
const LIST_TWO_COL_THRESHOLD = 12
const LIST_COL_GAP = 12
const LIST_MIN_ITEMS_AFTER_TITLE = 3

function renderVerticalList(doc, y, title, items, formatItem, maxItems = 20) {
  y = drawSectionTitle(doc, y, title)
  y += SPACING_AFTER_SUBTITLE
  const list = (items || []).slice(0, maxItems)
  if (list.length === 0) return y + SPACING_AFTER_SECTION

  doc.setFontSize(FONT_SIZE.normal)
  doc.setTextColor(0, 0, 0)
  const lineH = LINE_HEIGHT.normal + 1

  // Reserve space for at least 3 items so list does not start near page bottom
  const minReserve = Math.min(LIST_MIN_ITEMS_AFTER_TITLE, list.length) * (lineH + LIST_ITEM_GAP)
  y = ensureSpace(doc, y, minReserve)

  if (list.length <= LIST_TWO_COL_THRESHOLD) {
    list.forEach((item, i) => {
      const text = formatItem(item, i + 1)
      const numLines = measureLines(doc, text, CONTENT_W - 10)
      const need = numLines * lineH + LIST_ITEM_GAP
      const nextY = ensureSpace(doc, y, need)
      if (nextY === MARGIN_TOP && i > 0) {
        y = drawSectionTitle(doc, MARGIN_TOP, title)
        y += SPACING_AFTER_SUBTITLE
      } else {
        y = nextY
      }
      y = textBlock(doc, text, MARGIN_X + 8, y, CONTENT_W - 10, lineH)
      y += LIST_ITEM_GAP
    })
    return y + SPACING_AFTER_SECTION
  }

  const colW = (CONTENT_W - LIST_COL_GAP) / 2
  const leftItems = list.slice(0, Math.ceil(list.length / 2))
  const rightItems = list.slice(Math.ceil(list.length / 2))
  let yLeft = y
  let yRight = y

  leftItems.forEach((item, i) => {
    const text = formatItem(item, i + 1)
    const numLines = measureLines(doc, text, colW - 4)
    const need = numLines * lineH + LIST_ITEM_GAP
    let nextY = ensureSpace(doc, yLeft, need)
    if (nextY === MARGIN_TOP && i > 0) {
      yLeft = drawSectionTitle(doc, MARGIN_TOP, title)
      yLeft += SPACING_AFTER_SUBTITLE
    } else {
      yLeft = nextY
    }
    yLeft = textBlock(doc, text, MARGIN_X + 8, yLeft, colW - 4, lineH)
    yLeft += LIST_ITEM_GAP
  })

  rightItems.forEach((item, i) => {
    const text = formatItem(item, leftItems.length + i + 1)
    const numLines = measureLines(doc, text, colW - 4)
    const need = numLines * lineH + LIST_ITEM_GAP
    let nextY = ensureSpace(doc, yRight, need)
    if (nextY === MARGIN_TOP && i > 0) {
      yRight = drawSectionTitle(doc, MARGIN_TOP, title)
      yRight += SPACING_AFTER_SUBTITLE
    } else {
      yRight = nextY
    }
    yRight = textBlock(doc, text, MARGIN_X + colW + LIST_COL_GAP + 8, yRight, colW - 4, lineH)
    yRight += LIST_ITEM_GAP
  })

  return Math.max(yLeft, yRight) + SPACING_AFTER_SECTION
}

// ---------------------------------------------------------------------------
// Page footer
// ---------------------------------------------------------------------------
function addFooters(doc) {
  const totalPages = doc.internal.getNumberOfPages()
  doc.setFont(FONT, FONT_STYLE)
  doc.setFontSize(FONT_SIZE.small)
  doc.setTextColor(120, 120, 120)
  const footerY = PAGE_H - MARGIN_BOTTOM + 4
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.text('Твой год в кино', MARGIN_X, footerY)
    doc.text(`Страница ${p} из ${totalPages}`, PAGE_W - MARGIN_X, footerY, { align: 'right' })
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
/**
 * @param {Object} opts
 * @param {Object} opts.stats
 * @param {Object} [opts.watchTime]
 * @param {string} opts.selectedYearsLabel
 * @param {string} [opts.filePeriod]
 * @param {Array} opts.topRatedFilms
 * @param {Array} opts.topGenres
 * @param {Array} opts.topGenresByAvg
 * @param {Array} opts.topTags
 * @param {Array} opts.decades
 * @param {Array} opts.topDirectorsByCount
 * @param {Array} opts.topActorsByCount
 * @param {Array} opts.topCountriesByCount
 * @param {Array} opts.topLanguagesByCount
 * @param {Array} opts.badges
 * @param {boolean} [opts.debugLayout=false]
 */
export function exportPdfReport({
  stats,
  watchTime,
  selectedYearsLabel,
  filePeriod,
  topRatedFilms,
  topGenres,
  topGenresByAvg,
  topTags,
  decades,
  topDirectorsByCount,
  topActorsByCount,
  topCountriesByCount,
  topLanguagesByCount,
  badges,
  debugLayout = false,
}) {
  const doc = new jsPDF('p', 'pt', 'a4')
  doc.addFileToVFS('DejaVuSans.ttf', fontBase64)
  doc.addFont('DejaVuSans.ttf', FONT, FONT_STYLE)
  doc.setFont(FONT, FONT_STYLE)
  let y = MARGIN_TOP

  if (debugLayout) drawMarginGuides(doc)

  // ---------- Header (page 1) ----------
  doc.setFontSize(FONT_SIZE.reportTitle)
  doc.setTextColor(0, 0, 0)
  doc.text('Твой год в кино', MARGIN_X, y + 5)
  y += 14

  doc.setFontSize(FONT_SIZE.subtitle)
  doc.setTextColor(80, 80, 80)
  doc.text(`Период: ${selectedYearsLabel || 'все годы'}`, MARGIN_X, y + 4)
  const generatedDate = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  doc.text(generatedDate, MARGIN_X + CONTENT_W - doc.getTextWidth(generatedDate), y + 4)
  y += 18

  const col1X = MARGIN_X
  const col2X = MARGIN_X + CONTENT_W / 2
  const leftStats = [
    { label: 'Просмотрено фильмов', value: formatNumberRu(stats?.totalFilms) },
    { label: 'Средняя оценка', value: formatRatingRu(stats?.avgRating) },
    { label: '4.5–5★', value: formatNumberRu(stats?.count45) },
  ]
  const rightStats = [
    { label: 'Самый ранний год', value: formatYearNoSpace(stats?.oldestYear) },
    { label: 'Самый поздний год', value: formatYearNoSpace(stats?.newestYear) },
    {
      label: 'Время просмотра',
      value: watchTime?.totalRuntimeMinutes ? `${formatNumberRu(watchTime.totalRuntimeHours)} ч` : '—',
    },
  ]

  let yLeftCol = y
  leftStats.forEach((s) => {
    doc.setFontSize(FONT_SIZE.small)
    doc.setTextColor(100, 100, 100)
    doc.text(s.label, col1X, yLeftCol + 3)
    yLeftCol += LH
    doc.setFontSize(FONT_SIZE.normal)
    doc.setTextColor(0, 0, 0)
    doc.text(s.value, col1X, yLeftCol + 3)
    yLeftCol += LH + GAP_MD
  })
  let yRightCol = y
  rightStats.forEach((s) => {
    doc.setFontSize(FONT_SIZE.small)
    doc.setTextColor(100, 100, 100)
    doc.text(s.label, col2X, yRightCol + 3)
    yRightCol += LH
    doc.setFontSize(FONT_SIZE.normal)
    doc.setTextColor(0, 0, 0)
    doc.text(s.value, col2X, yRightCol + 3)
    yRightCol += LH + GAP_MD
  })
  y = Math.max(yLeftCol, yRightCol) + SPACING_AFTER_SECTION

  // ---------- Top films (issue 2: fixed columns rank / stars / title) ----------
  y = drawSectionTitle(doc, y, 'Лучшие фильмы')
  y += SPACING_AFTER_SUBTITLE
  const films = (topRatedFilms || []).slice(0, 12)
  const filmLineH = LINE_HEIGHT.normal + 5
  const colRankX = MARGIN_X
  const colStarsX = MARGIN_X + 10
  const colTitleX = MARGIN_X + 42
  const titleMaxW = CONTENT_W - (colTitleX - MARGIN_X)
  films.forEach((film, i) => {
    const stars = ratingToStars(film.rating)
    const titleYear = `${film.title || 'Без названия'} (${formatYearNoSpace(film.year)})`
    const titleLines = wrapText(doc, titleYear, titleMaxW)
    const blockH = Math.max(filmLineH, titleLines.length * (filmLineH - 2)) + 8
    y = ensureSpace(doc, y, blockH)
    doc.setFontSize(FONT_SIZE.small)
    doc.setTextColor(80, 80, 80)
    doc.text(`${i + 1}`, colRankX, y + 4)
    doc.setFontSize(FONT_SIZE.normal)
    doc.setTextColor(0, 0, 0)
    doc.text(stars, colStarsX, y + 4)
    titleLines.forEach((line, li) => {
      doc.text(line, colTitleX, y + 4 + li * (filmLineH - 2))
    })
    y += blockH
    if ((i + 1) % 3 === 0 && i < films.length - 1) {
      doc.setDrawColor(230, 230, 230)
      doc.line(MARGIN_X, y, MARGIN_X + CONTENT_W, y)
      y += 8
    }
  })
  y += SPACING_AFTER_SECTION

  // ---------- Genres tables ----------
  y = drawSectionTitle(doc, y, 'Жанры')
  y += SPACING_AFTER_SUBTITLE
  doc.setFontSize(FONT_SIZE.small)
  doc.setTextColor(100, 100, 100)
  doc.text('Топ-10 по количеству', MARGIN_X, y + 3)
  y += 10

  const genresByCount = (topGenres || []).slice(0, 10)
  if (genresByCount.length) {
    y = renderTable(doc, y, {
      columns: [
        { key: 'name', title: 'Жанр', widthPct: 40, align: 'left' },
        { key: 'count', title: 'Фильмов', widthPct: 20, align: 'right' },
        { key: 'avg', title: 'Средняя', widthPct: 20, align: 'right' },
        { key: 'high45', title: '4.5–5★', widthPct: 20, align: 'right' },
      ],
      rows: genresByCount.map((g) => ({
        name: g.name,
        count: formatNumberRu(g.count),
        avg: formatRatingRu(g.avg_rating),
        high45: formatNumberRu(g.high_45),
      })),
      rowHeight: LINE_HEIGHT.table,
      headerFill: true,
      zebraRows: true,
    })
  }

  doc.setFontSize(FONT_SIZE.small)
  doc.setTextColor(100, 100, 100)
  doc.text('Топ-10 по средней оценке (не менее 5 фильмов)', MARGIN_X, y + 4)
  y += 12

  const genresByAvg = (topGenresByAvg || []).slice(0, 10)
  if (genresByAvg.length) {
    y = renderTable(doc, y, {
      columns: [
        { key: 'name', title: 'Жанр', widthPct: 40, align: 'left' },
        { key: 'count', title: 'Фильмов', widthPct: 20, align: 'right' },
        { key: 'avg', title: 'Средняя', widthPct: 20, align: 'right' },
        { key: 'high45', title: '4.5–5★', widthPct: 20, align: 'right' },
      ],
      rows: genresByAvg.map((g) => ({
        name: g.name,
        count: formatNumberRu(g.count),
        avg: formatRatingRu(g.avg_rating),
        high45: formatNumberRu(g.high_45),
      })),
      rowHeight: LINE_HEIGHT.table,
      headerFill: true,
      zebraRows: true,
    })
  }
  y += SPACING_AFTER_SECTION

  // ---------- Themes table ----------
  y = drawSectionTitle(doc, y, 'Любимые темы')
  y += SPACING_AFTER_SUBTITLE
  doc.setFontSize(FONT_SIZE.small)
  doc.setTextColor(100, 100, 100)
  doc.text('Индекс любви = (4.5–5★) × (средняя оценка)', MARGIN_X, y + 3)
  y += 12

  const tags = (topTags || []).slice(0, 20)
  if (tags.length) {
    y = renderTable(doc, y, {
      columns: [
        { key: 'name', title: 'Тема', widthPct: 32, align: 'left' },
        { key: 'count', title: 'Фильмов', widthPct: 14, align: 'right' },
        { key: 'avg', title: 'Средняя', widthPct: 14, align: 'right' },
        { key: 'high45', title: '4.5–5★', widthPct: 14, align: 'right' },
        { key: 'love', title: 'Индекс любви', widthPct: 26, align: 'right' },
      ],
      rows: tags.map((t) => ({
        name: t.name,
        count: formatNumberRu(t.count),
        avg: formatRatingRu(t.avg_rating),
        high45: formatNumberRu(t.high_45),
        love: formatNumberRu(t.loveScore),
      })),
      rowHeight: LINE_HEIGHT.table,
      headerFill: true,
      zebraRows: true,
    })
  }
  y += SPACING_AFTER_SECTION

  // ---------- Decades ----------
  y = drawSectionTitle(doc, y, 'Десятилетия')
  y += SPACING_AFTER_SUBTITLE
  const topDecades = (decades || []).slice(0, 5)
  topDecades.forEach((d) => {
    const text = `${formatYearNoSpace(d.decade)}-е — средняя ${formatRatingRu(d.avgRating)} (фильмов: ${formatNumberRu(d.count)})`
    const need = LINE_HEIGHT.normal + 8
    y = ensureSpace(doc, y, need)
    doc.setFontSize(FONT_SIZE.normal)
    doc.setTextColor(0, 0, 0)
    y = textBlock(doc, text, MARGIN_X, y, CONTENT_W, LINE_HEIGHT.normal + 1)
    y += 4
  })
  y += SPACING_AFTER_SECTION

  // ---------- Directors & Actors (lists with optional 2-col) ----------
  y = renderVerticalList(
    doc,
    y,
    'Режиссёры',
    topDirectorsByCount || [],
    (d, n) => `${n}) ${d.name} — ${formatNumberRu(d.count)}`,
    20,
  )
  y = renderVerticalList(
    doc,
    y,
    'Актёры',
    topActorsByCount || [],
    (a, n) => `${n}) ${a.name} — ${formatNumberRu(a.count)}`,
    20,
  )
  y = renderVerticalList(
    doc,
    y,
    'Страны',
    topCountriesByCount || [],
    (c, n) => `${n}) ${c.name} — ${formatNumberRu(c.count)}`,
    20,
  )
  y = renderVerticalList(
    doc,
    y,
    'Языки',
    topLanguagesByCount || [],
    (l, n) => `${n}) ${getLanguageRu(l.language) || l.language} — ${formatNumberRu(l.count)}`,
    20,
  )

  // ---------- Badges (issue 4): 2-col cards, 3mm padding, title / value / subtitle spacing ----------
  y = drawSectionTitle(doc, y, 'Бейджи')
  y += SPACING_AFTER_SUBTITLE
  const badgeList = badges || []
  const BADGE_GUTTER = 6 * MM
  const BADGE_ROW_GAP = 6 * MM
  const cardW = (CONTENT_W - BADGE_GUTTER) / 2
  const CARD_PAD = 3 * MM
  const BADGE_LH = LH
  let badgeRowStartY = y

  badgeList.forEach((b, i) => {
    const titleLines = wrapText(doc, b.title, cardW - 2 * CARD_PAD)
    const valueStr = b.value != null ? String(b.value) : '—'
    const valueLines = wrapText(doc, valueStr, cardW - 2 * CARD_PAD)
    const subtitleLines = b.subtitle ? wrapText(doc, b.subtitle, cardW - 2 * CARD_PAD) : []
    const cardH =
      CARD_PAD * 2 +
      titleLines.length * BADGE_LH +
      BADGE_LH +
      valueLines.length * (BADGE_LH + 1) +
      (BADGE_LH + 1) +
      (subtitleLines.length ? subtitleLines.length * BADGE_LH + BADGE_LH : 0)

    const col = i % 2
    if (col === 0) {
      badgeRowStartY = ensureSpace(doc, badgeRowStartY, cardH + BADGE_ROW_GAP)
    }
    const bx = MARGIN_X + col * (cardW + BADGE_GUTTER)
    const by = badgeRowStartY

    doc.setFont(FONT, FONT_STYLE)
    doc.setFontSize(FONT_SIZE.normal)
    doc.setTextColor(0, 0, 0)
    let cy = by + CARD_PAD
    titleLines.forEach((line) => {
      doc.text(line, bx + CARD_PAD, cy + BADGE_LH - 2)
      cy += BADGE_LH
    })
    cy += BADGE_LH
    doc.setFontSize(16)
    valueLines.forEach((line) => {
      doc.text(line, bx + CARD_PAD, cy + BADGE_LH - 2)
      cy += BADGE_LH + 1
    })
    cy += BADGE_LH + 1
    if (subtitleLines.length) {
      doc.setFontSize(FONT_SIZE.small)
      doc.setTextColor(100, 100, 100)
      subtitleLines.forEach((line) => {
        doc.text(line, bx + CARD_PAD, cy + BADGE_LH - 2)
        cy += BADGE_LH
      })
    }
    if (col === 1) {
      badgeRowStartY += cardH + BADGE_ROW_GAP
    }
  })
  if (badgeList.length % 2 === 1) {
    const lastTitle = wrapText(doc, badgeList[badgeList.length - 1].title, cardW - 2 * CARD_PAD)
    const lastValue = wrapText(doc, String(badgeList[badgeList.length - 1].value ?? '—'), cardW - 2 * CARD_PAD)
    const lastSub = badgeList[badgeList.length - 1].subtitle
      ? wrapText(doc, badgeList[badgeList.length - 1].subtitle, cardW - 2 * CARD_PAD)
      : []
    const lastCardH =
      CARD_PAD * 2 +
      lastTitle.length * BADGE_LH +
      BADGE_LH +
      lastValue.length * (BADGE_LH + 1) +
      (BADGE_LH + 1) +
      (lastSub.length ? lastSub.length * BADGE_LH + BADGE_LH : 0)
    y = badgeRowStartY + lastCardH + BADGE_ROW_GAP
  } else {
    y = badgeRowStartY
  }
  y += SPACING_AFTER_SECTION

  addFooters(doc)

  const period = filePeriod ?? (selectedYearsLabel || 'all').replace(/\s+/g, '-').replace(/[–—]/g, '-')
  doc.save(`year-in-film_${period}.pdf`)
}
