<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 11:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 11:00:00
 * @FilePath: \idex\web\src\components\previews\SheetPreview.vue
 * @Description: Excel 只读预览：动态加载 ExcelJS，多工作表、虚拟滚动与常用格式。
-->
<template>
  <div class="sheet-pane">
    <div v-if="state === 'loading' || state === 'building'" class="sheet-state">
      {{ state === 'loading' ? '正在解析表格…' : '正在生成表格…' }}
    </div>

    <div v-else-if="state === 'oversize'" class="sheet-state">
      <p>这个文件有 {{ formatBytes(size) }}，超过表格预览上限，请下载后查看。</p>
      <a class="sheet-act" :href="url" download>下载文件</a>
    </div>

    <div v-else-if="state === 'error'" class="sheet-state">
      <p>无法解析这个表格。</p>
      <div class="sheet-actions">
        <button type="button" class="sheet-act" @click="load">重试</button>
        <a class="sheet-act" :href="url" download>下载文件</a>
      </div>
    </div>

    <div v-else-if="state === 'empty'" class="sheet-state">
      <p>这个工作簿没有工作表。</p>
      <a class="sheet-act" :href="url" download>下载文件</a>
    </div>

    <template v-else-if="state === 'ready' && model">
      <div v-if="sheets.length > 1" class="sheet-tabs">
        <button
          v-for="(tab, index) in sheets"
          :key="tab.name"
          type="button"
          class="sheet-tab"
          :class="{ on: index === activeIndex }"
          @click="selectSheet(index)"
        >
          {{ tab.name }}
        </button>
      </div>

      <div v-if="model.truncated" class="sheet-warn">
        仅显示前 {{ SHEET_LIMITS.cells }} 个单元格，其余请下载查看。
      </div>

      <div ref="scroller" class="sheet-scroll" @scroll.passive="onScroll">
        <div
          class="sheet-canvas"
          :style="{ width: `${totalWidth}px`, height: `${canvasHeight}px` }"
        >
          <table class="sheet-head" :style="{ width: `${totalWidth}px` }">
            <colgroup>
              <col style="width: 48px" />
              <col v-for="(width, col) in colWidths" :key="col" :style="{ width: `${width}px` }" />
            </colgroup>
            <tr>
              <th class="sheet-corner"></th>
              <th
                v-for="(width, col) in colWidths"
                :key="col"
                class="sheet-col-head"
                :class="{ frozen: col < freezeCols }"
                :style="frozenStyle(col)"
              >
                {{ columnName(col) }}
              </th>
            </tr>
          </table>

          <table
            v-if="freezeRows"
            class="sheet-frozen"
            :style="{ width: `${totalWidth}px` }"
          >
            <colgroup>
              <col style="width: 48px" />
              <col v-for="(width, col) in colWidths" :key="col" :style="{ width: `${width}px` }" />
            </colgroup>
            <tr
              v-for="row in frozenVisible"
              :key="row.number"
              :style="{ height: `${ROW_HEIGHT}px` }"
            >
              <th class="sheet-row-no">{{ row.number }}</th>
              <td
                v-for="cell in row.cells"
                :key="cell.col"
                :rowspan="cell.rowspan"
                :colspan="cell.colspan"
                class="sheet-cell"
                :class="{ frozen: cell.col < freezeCols, selected: isSelected(row.number, cell.col) }"
                :style="cellStyle(cell)"
                @click="select(row.number, cell.col)"
                v-text="cell.text"
              ></td>
            </tr>
          </table>

          <div class="sheet-body" :style="{ top: `${bodyTop}px`, width: `${totalWidth}px` }">
            <table class="sheet-table" :style="{ width: `${totalWidth}px` }">
              <colgroup>
                <col style="width: 48px" />
                <col v-for="(width, col) in colWidths" :key="col" :style="{ width: `${width}px` }" />
              </colgroup>
              <tr
                v-for="row in visible"
                :key="row.number"
                :style="{ height: `${ROW_HEIGHT}px` }"
              >
                <th class="sheet-row-no">{{ row.number }}</th>
                <td
                  v-for="cell in row.cells"
                  :key="cell.col"
                  :rowspan="cell.rowspan"
                  :colspan="cell.colspan"
                  class="sheet-cell"
                  :class="{ frozen: cell.col < freezeCols, selected: isSelected(row.number, cell.col) }"
                  :style="cellStyle(cell)"
                  @click="select(row.number, cell.col)"
                  v-text="cell.text"
                ></td>
              </tr>
            </table>
          </div>
        </div>
      </div>

      <div class="sheet-status">
        <span class="sheet-status-name">{{ model.name }}</span>
        <span v-if="selectedCell" class="sheet-status-cell">
          <b>{{ cellAddress(selected.row - 1, selected.col) }}</b>
          <span class="sheet-status-value" :title="selectedValue">{{ selectedValue }}</span>
        </span>
        <span class="sheet-status-size">{{ model.rowCount }} 行 × {{ model.colCount }} 列</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatBytes } from '@bash-scripts/web-shared/format'
import {
  SHEET_LIMITS,
  buildSheetModel,
  cellAddress,
  columnName,
  visibleRows,
} from '../../utils/sheetModel'

const props = defineProps({
  url: { type: String, required: true },
  name: { type: String, default: '' },
  path: { type: String, default: '' },
  size: { type: Number, default: 0 },
})

const ROW_HEIGHT = 24
const HEADER_HEIGHT = 24
const OVERSCAN = 10

const state = ref('loading')
const sheets = ref([])
const models = new Map()
const activeIndex = ref(0)
const model = ref(null)
const colWidths = ref([])
const scroller = ref(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)
const selected = ref(null)

let workbook = null
let controller = null
let resizeObserver = null

const freezeRows = computed(() => {
  if (!model.value) return 0
  return Math.min(model.value.freeze.rows, Math.max(0, model.value.rowCount - 1))
})
const freezeCols = computed(() => {
  if (!model.value) return 0
  return Math.min(model.value.freeze.cols, Math.max(0, model.value.colCount - 1))
})
const totalWidth = computed(() => 48 + colWidths.value.reduce((sum, width) => sum + width, 0))
const start = computed(() => {
  if (!model.value) return 0
  const first = Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN
  return Math.max(freezeRows.value, Math.min(first, model.value.rowCount))
})
const visibleCount = computed(() => Math.ceil(viewportHeight.value / ROW_HEIGHT) + OVERSCAN * 2)
const visible = computed(() =>
  model.value ? visibleRows(model.value, start.value, visibleCount.value) : [],
)
const frozenVisible = computed(() =>
  model.value && freezeRows.value ? visibleRows(model.value, 0, freezeRows.value) : [],
)
const bodyTop = computed(
  () => HEADER_HEIGHT + (freezeRows.value + start.value) * ROW_HEIGHT,
)
const canvasHeight = computed(() =>
  model.value ? HEADER_HEIGHT + model.value.rowCount * ROW_HEIGHT : 0,
)

const selectedCell = computed(() => {
  if (!selected.value || !model.value) return null
  const row = model.value.rows.find((item) => item.number === selected.value.row)
  return row ? row.cells.find((cell) => cell.col === selected.value.col) || null : null
})
const selectedValue = computed(() => {
  if (!selectedCell.value) return ''
  const formula = selectedCell.value.formula
  const text = formula ? `=${formula}` : selectedCell.value.text
  return text.length > 160 ? `${text.slice(0, 160)}…` : text
})

function frozenStyle(col) {
  return col < freezeCols.value ? { left: `${frozenLeft(col)}px` } : {}
}

function frozenLeft(col) {
  let left = 48
  for (let index = 0; index < col; index += 1) left += colWidths.value[index] || 0
  return left
}

function cellStyle(cell) {
  return cell.col < freezeCols.value
    ? { ...cell.style, left: `${frozenLeft(cell.col)}px` }
    : cell.style
}

function isSelected(row, col) {
  return !!selected.value && selected.value.row === row && selected.value.col === col
}

function select(row, col) {
  selected.value = { row, col }
}

function onScroll(event) {
  scrollTop.value = event.target.scrollTop
}

async function load() {
  if (controller) controller.abort()
  controller = new AbortController()
  state.value = 'loading'
  try {
    const response = await fetch(props.url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    const module = await import('exceljs')
    const ExcelJS = module.default || module
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(buffer)
    workbook = book
    sheets.value = book.worksheets.map((sheet) => ({ name: sheet.name, sheet }))
    if (!sheets.value.length) {
      state.value = 'empty'
      return
    }
    activeIndex.value = 0
    await showSheet(0)
  } catch (error) {
    if (error && error.name === 'AbortError') return
    state.value = 'error'
  }
}

async function showSheet(index) {
  const tab = sheets.value[index]
  if (!tab) return
  state.value = 'building'
  await nextTick()
  if (!models.has(index)) models.set(index, buildSheetModel(tab.sheet))
  const next = models.get(index)
  model.value = next
  colWidths.value = Array.from({ length: next.colCount }, (_, col) => {
    const width = tab.sheet.getColumn(col + 1).width
    return Math.max(64, Math.min(480, Math.round((Number(width) || 12) * 8)))
  })
  selected.value = null
  scrollTop.value = 0
  activeIndex.value = index
  state.value = 'ready'
  await nextTick()
  if (scroller.value) {
    scroller.value.scrollTop = 0
    scroller.value.scrollLeft = 0
  }
  observeScroller()
}

function selectSheet(index) {
  if (index === activeIndex.value) return
  showSheet(index)
}

onMounted(() => {
  if (Number(props.size) > SHEET_LIMITS.fileBytes) {
    state.value = 'oversize'
    return
  }
  load()
})

onBeforeUnmount(() => {
  if (controller) controller.abort()
  if (resizeObserver) resizeObserver.disconnect()
})

function observeScroller() {
  if (!scroller.value) return
  if (!resizeObserver) {
    resizeObserver = new ResizeObserver((entries) => {
      viewportHeight.value = entries[0].contentRect.height
    })
  }
  resizeObserver.disconnect()
  resizeObserver.observe(scroller.value)
  viewportHeight.value = scroller.value.clientHeight
}
</script>

<style scoped>
/* 状态页与表格共用这块底色，切换时不闪。 */
.sheet-pane {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.78rem;
}
.sheet-state {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: rgb(var(--v-theme-on-surface-variant));
  text-align: center;
}
.sheet-actions {
  display: flex;
  gap: 8px;
}
.sheet-act {
  padding: 4px 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-primary));
  font-size: 0.78rem;
  text-decoration: none;
  cursor: pointer;
}
.sheet-act:hover {
  background: rgba(var(--v-theme-primary), 0.1);
}
.sheet-tabs {
  display: flex;
  gap: 2px;
  padding: 2px 6px 0;
  overflow-x: auto;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  flex: 0 0 auto;
}
.sheet-tab {
  padding: 4px 10px;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.76rem;
  white-space: nowrap;
  cursor: pointer;
}
.sheet-tab.on {
  border-color: rgba(var(--v-theme-on-surface), 0.16);
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}
.sheet-warn {
  flex: 0 0 auto;
  padding: 3px 10px;
  background: rgba(var(--v-theme-warning), 0.14);
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.72rem;
}
.sheet-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  position: relative;
}
.sheet-canvas {
  position: relative;
}
.sheet-head {
  position: sticky;
  top: 0;
  z-index: 4;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  background: rgb(var(--v-theme-surface));
}
.sheet-head th {
  height: 24px;
  padding: 0 4px;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.2);
  background: rgba(var(--v-theme-on-surface), 0.05);
  color: rgb(var(--v-theme-on-surface-variant));
  font-weight: 500;
  font-size: 0.7rem;
  text-align: center;
}
.sheet-corner {
  position: sticky;
  left: 0;
  z-index: 6;
}
.sheet-col-head {
  position: sticky;
  top: 0;
  z-index: 4;
}
.sheet-col-head.frozen {
  z-index: 5;
}
.sheet-frozen {
  position: sticky;
  top: 24px;
  z-index: 3;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 1px 0 rgba(var(--v-theme-on-surface), 0.2);
}
.sheet-body {
  position: absolute;
  left: 0;
}
.sheet-table,
.sheet-frozen {
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
}
.sheet-cell {
  height: 24px;
  max-width: 0;
  padding: 0 4px;
  overflow: hidden;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: cell;
}
.sheet-row-no {
  position: sticky;
  left: 0;
  z-index: 2;
  width: 48px;
  height: 24px;
  padding: 0 4px;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.2);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background: rgba(var(--v-theme-on-surface), 0.05);
  color: rgb(var(--v-theme-on-surface-variant));
  font-weight: 500;
  font-size: 0.7rem;
  text-align: right;
}
.sheet-cell.frozen {
  position: sticky;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
}
.sheet-cell.selected {
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-primary));
}
.sheet-status {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 24px;
  padding: 2px 10px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.72rem;
}
.sheet-status-name {
  font-weight: 600;
}
.sheet-status-cell {
  display: flex;
  gap: 6px;
  min-width: 0;
}
.sheet-status-value {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 48vw;
}
.sheet-status-size {
  margin-left: auto;
  white-space: nowrap;
}
</style>
