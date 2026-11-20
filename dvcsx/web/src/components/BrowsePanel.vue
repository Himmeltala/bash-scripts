<!--
 * @Author: Himmeltala
 * @Date: 2026-11-12 18:48:07
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-19 00:10:49
 * @FilePath: \dvcsx\web\src\components\BrowsePanel.vue
 * @Description: 浏览工作副本目录，预览、编辑、新建、重命名与删除文件。
-->
<template>
  <div class="panel" @keydown.ctrl.s.prevent="save" @keydown="onPanelKey">
    <div class="bar">
      <div class="left">
        <v-text-field
          :model-value="query"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          placeholder="搜索文件名或文件内容"
          prepend-inner-icon="mdi-magnify"
          class="search"
          @update:model-value="query = $event ?? ''"
          @keyup.enter="runSearch"
          @keydown.esc="clearSearch"
        />
        <v-btn-toggle
          v-model="mode"
          density="compact"
          variant="text"
          divided
          mandatory
          class="modes"
        >
          <v-btn value="name" size="small" title="只看文件本身的名字，不看所在目录">文件名</v-btn>
          <v-btn value="content" size="small">内容</v-btn>
        </v-btn-toggle>
      </div>
      <v-btn
        v-if="searching"
        size="small"
        variant="text"
        prepend-icon="mdi-arrow-left"
        title="退出搜索，回到目录树"
        @click="clearSearch"
      >
        返回目录
      </v-btn>
      <v-btn
        icon="mdi-file-find-outline"
        size="small"
        variant="text"
        title="快速打开（Ctrl+P）"
        @click="openQuickOpen"
      />
      <v-btn
        icon="mdi-format-list-bulleted-type"
        size="small"
        variant="text"
        title="符号大纲（Ctrl+Shift+O）"
        @click="openOutline"
      />
      <v-btn
        size="small"
        variant="text"
        class="problems-btn"
        :title="`问题（${problems.length}）`"
        @click="problemsAsk.on = true"
      >
        <v-badge :content="problems.length" :model-value="problems.length > 0" color="error">
          <v-icon>mdi-alert-circle-outline</v-icon>
        </v-badge>
      </v-btn>
      <v-progress-circular v-if="defining" indeterminate size="16" class="busy" />
      <v-btn
        size="small"
        variant="text"
        color="primary"
        prepend-icon="mdi-refresh"
        :loading="refreshing"
        @click="refresh"
      >
        刷新
      </v-btn>
    </div>

    <div ref="splitRef" class="body" :class="{ resizing }">
      <aside class="tree" :style="{ '--tree-width': `${treeWidth}px` }">
        <div v-if="!searching" class="tree-tools">
          <v-btn
            icon="mdi-collapse-all-outline"
            size="x-small"
            variant="text"
            title="全部收起已展开的目录"
            @click="collapseAll"
          />
        </div>
        <template v-if="searching">
          <div class="result-head">
            <span v-if="search.loading">正在搜索…</span>
            <span v-else-if="search.error" class="bad">{{ search.error }}</span>
            <span v-else>
              {{ search.matches.length }} 条结果
              <template v-if="search.truncated">，只列了前面一部分</template>
            </span>
          </div>
          <p v-if="!search.loading && !search.error && !search.matches.length" class="hint">
            没有找到匹配的文件。
          </p>
          <div v-for="row in resultRows" :key="`${row.type}:${row.path}`" class="snode">
            <div
              class="srow"
              :class="{
                dir: row.type === 'dir',
                active: row.type === 'file' && activePath === row.path,
              }"
              :style="{ paddingLeft: `${10 + row.depth * 14}px` }"
              :title="row.path"
              @click="onResultRow(row)"
            >
              <v-icon v-if="row.type === 'dir'" size="16" class="sicon">
                {{ collapsedDirs.has(row.path) ? 'mdi-chevron-right' : 'mdi-chevron-down' }}
              </v-icon>
              <v-icon
                v-else
                size="16"
                class="sicon"
                :style="iconOf(row).color ? { color: iconOf(row).color } : null"
              >
                {{ iconOf(row).icon }}
              </v-icon>
              <span class="sname mono">{{ row.name }}</span>
              <span v-if="row.type === 'file' && row.hits.length > 1" class="scount">
                {{ row.hits.length }}
              </span>
            </div>
            <div
              v-for="hit in row.hits || []"
              :key="hit.line"
              class="shit"
              :style="{ paddingLeft: `${10 + (row.depth + 1) * 14}px` }"
              @click="openResultHit(row, hit)"
            >
              <span class="shit-line mono">{{ hit.line }}</span>
              <span class="shit-text mono">{{ hit.text }}</span>
            </div>
          </div>
        </template>
        <FileTree
          v-show="!searching"
          :key="ws.id"
          ref="treeRef"
          :loader="loadLayer"
          :root="rootNode"
          :root-path="ws.root"
          :download-of="downloadOf"
          :row-class="rowClass"
          pick-on-row-click
          :texts="treeTexts"
          editable
          @pick="pick"
          @action="onTreeAction"
        />
      </aside>

      <SplitHandle axis="x" :active="resizing" @start="startSplit" @reset="resetSplit" />

      <div class="main">
        <div v-if="tabs.length" ref="tabbarRef" class="tabbar">
          <div
            v-for="tab in tabs"
            :key="tab.path"
            class="tab"
            :class="{ active: tab.path === activePath }"
            :data-path="tab.path"
            :title="tab.path"
            @click="activate(tab)"
            @mousedown.middle.prevent="closeTab(tab)"
            @contextmenu.prevent="openTabMenu(tab, $event)"
          >
            <v-icon
              size="14"
              class="tab-icon"
              :style="tabIcon(tab).color ? { color: tabIcon(tab).color } : null"
            >
              {{ tabIcon(tab).icon }}
            </v-icon>
            <span class="tab-name">{{ tab.name }}</span>
            <span v-if="tab.dirty" class="tab-dirty" title="还没保存" />
            <button
              class="tab-close"
              type="button"
              :title="`关闭 ${tab.name}`"
              @click.stop="closeTab(tab)"
            >
              <v-icon size="14">mdi-close</v-icon>
            </button>
          </div>
        </div>

        <div class="panes">
          <template v-if="tabs.length">
            <div
              v-for="tab in tabs"
              v-show="tab.path === activePath"
              :key="tab.path"
              class="pane"
            >
              <component
                :is="viewerFor(tab)"
                v-if="viewerFor(tab) && !sourceView.has(tab.path)"
                :key="`preview:${tab.path}`"
                :url="rawUrl(tab)"
                :name="tab.name"
                :path="tab.path"
                :size="tab.size"
                @source="toggleSource(tab.path)"
              />
              <EmptyState
                v-else-if="isHeldNode(tab)"
                icon="mdi-file-hidden"
                :icon-size="28"
                :path="tab.path"
                :hint="`这个文件有 ${formatBytes(tab.size)}，超过 ${formatBytes(PREVIEW_MAX)} 的预览上限，默认不加载。`"
                action="下载文件"
                action-icon="mdi-download"
                @action="downloadHeld"
              />
              <template v-else>
                <div v-if="viewerFor(tab)" class="preview-bar">
                  <button
                    type="button"
                    class="preview-act"
                    @click="toggleSource(tab.path)"
                  >
                    {{ SOURCE_LABELS[previewKindOf(tab.path)] || '查看预览' }}
                  </button>
                </div>
                <FileEditor
                  :ref="(el) => setEditor(tab.path, el)"
                  :root-name="rootName"
                  :size="tab.size"
                  :loader="loadFile"
                  :saver="saveFile"
                  @navigate="reveal"
                  @saved="onSaved"
                  @dirty="(on) => setDirty(tab.path, on)"
                  @definition="onDefinition"
                  @menu="openSymbolMenu"
                  @rename="openRename"
                  @caret="onCaret"
                  @edit="onEdit"
                  @hover="onHover"
                  @hover-end="onHoverEnd"
                  :markers="markers"
                />
              </template>
            </div>
          </template>
          <EmptyState
            v-else
            icon="mdi-file-outline"
            hint="从左边选一个文件，右边显示它的内容。"
          />
        </div>
      </div>
    </div>

    <div v-if="activePath" class="statusbar">
      <button type="button" class="cell link" title="跳到行（Ctrl+G）" @click="openGotoLine">
        {{ caret.line }}:{{ caret.column }}
      </button>
      <span class="cell">{{ languageLabel }}</span>
      <span class="cell" :class="{ muted: !serverReady }" :title="serverTitle">{{ serverLabel }}</span>
      <v-spacer />
      <span class="cell">UTF-8</span>
    </div>

    <FloatingDialog
      v-model="nameAsk.on"
      :initial-width="420"
      :initial-height="280"
      :min-width="340"
      :min-height="220"
      persistent
    >
      <template #title>{{ nameTitle }}</template>
      <v-text-field
        v-model="nameAsk.value"
        density="compact"
        variant="outlined"
        autofocus
        hide-details
        :label="nameLabel"
        :error-messages="nameAsk.error ? [nameAsk.error] : []"
        @keyup.enter="submitName"
      />
      <template #actions>
        <v-btn variant="text" @click="nameAsk.on = false">取消</v-btn>
        <v-spacer />
        <v-btn color="primary" variant="flat" :loading="nameAsk.busy" @click="submitName">
          确定
        </v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="delAsk.on"
      :initial-width="460"
      :initial-height="280"
      :min-width="360"
      :min-height="220"
      persistent
    >
      <template #title>删除{{ delAsk.node && delAsk.node.type === 'dir' ? '目录' : '文件' }}</template>
      <p class="ask-path mono">{{ delAsk.node ? delAsk.node.path : '' }}</p>
      <p class="ask-hint">
        目录会连同里面的文件一起删除。已纳入版本控制的能从版本库里找回，未纳管的删了就没了。
      </p>
      <p v-if="delAsk.error" class="ask-error">{{ delAsk.error }}</p>
      <template #actions>
        <v-btn variant="text" @click="delAsk.on = false">取消</v-btn>
        <v-spacer />
        <v-btn color="error" variant="flat" :loading="delAsk.busy" @click="submitDelete">
          删除
        </v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="defAsk.on"
      :initial-width="560"
      :initial-height="400"
      :min-width="380"
      :min-height="240"
    >
      <template #title>「{{ defAsk.word }}」的{{ defAsk.title }}</template>
      <p class="ask-hint">找到 {{ defAsk.list.length }} 处，选一个跳过去。</p>
      <div class="def-list">
        <button
          v-for="loc in defAsk.list"
          :key="`${loc.path}:${loc.line}:${loc.character}`"
          type="button"
          class="def-item"
          @click="openLocation(loc)"
        >
          <v-icon size="16">mdi-file-outline</v-icon>
          <span class="mono def-path">{{ loc.path }}</span>
          <span class="mono def-line">{{ loc.line + 1 }}</span>
        </button>
      </div>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="defAsk.on = false">取消</v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="renameAsk.on"
      :initial-width="540"
      :initial-height="420"
      :min-width="380"
      :min-height="260"
      persistent
    >
      <template #title>重命名「{{ renameAsk.word }}」</template>
      <template v-if="renameAsk.step === 'input'">
        <v-text-field
          v-model="renameAsk.value"
          label="新名字"
          density="compact"
          variant="outlined"
          hide-details
          autofocus
          @keyup.enter="previewRename"
        />
        <p class="ask-hint">改的是这个标识符在所有文件里的出现位置，先预览要改哪些文件。</p>
      </template>
      <template v-else>
        <p class="ask-hint">
          要改 {{ renameAsk.total }} 处，分布在 {{ renameAsk.files.length }} 个文件：
        </p>
        <div class="def-list">
          <div v-for="item in renameAsk.files" :key="item.path" class="def-item">
            <v-icon size="16">mdi-file-outline</v-icon>
            <span class="mono def-path">{{ item.path }}</span>
            <span class="mono def-line">{{ item.edits }} 处</span>
          </div>
        </div>
      </template>
      <p v-if="renameAsk.error" class="ask-error">{{ renameAsk.error }}</p>
      <template #actions>
        <v-btn variant="text" :disabled="renameAsk.busy" @click="renameAsk.on = false">取消</v-btn>
        <v-spacer />
        <v-btn
          v-if="renameAsk.step === 'preview'"
          variant="text"
          :disabled="renameAsk.busy"
          @click="renameAsk.step = 'input'"
        >
          返回
        </v-btn>
        <v-btn
          v-if="renameAsk.step === 'input'"
          color="primary"
          variant="flat"
          :loading="renameAsk.busy"
          @click="previewRename"
        >
          预览
        </v-btn>
        <v-btn v-else color="primary" variant="flat" :loading="renameAsk.busy" @click="applyRename">
          重命名
        </v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="problemsAsk.on"
      storage-key="dvcsx-problems"
      :initial-width="520"
      :initial-height="420"
      :min-width="360"
      :min-height="240"
    >
      <template #title>问题</template>
      <div v-if="!problemsLoading && problemStats.length" class="problem-stats">
        <span
          v-for="level in problemStats"
          :key="level.id"
          class="problem-stat"
          :class="level.id"
        >
          <v-icon size="14">{{ level.icon }}</v-icon>
          {{ level.label }} {{ level.count }}
        </span>
      </div>
      <LoadingState v-if="problemsLoading" hint="正在取诊断…" />
      <EmptyState
        v-else-if="!problems.length"
        icon="mdi-check-circle-outline"
        :icon-size="40"
        hint="这个文件现在没有错误或警告。"
      />
      <div v-else class="def-list">
        <button
          v-for="(item, i) in problems"
          :key="`${item.line}:${item.character}:${i}`"
          type="button"
          class="def-item"
          @click="onProblem(item)"
        >
          <v-icon
            size="16"
            :color="item.severity === 'error' ? 'error' : item.severity === 'warning' ? 'warning' : 'info'"
          >
            {{ SEVERITY_ICONS[item.severity] || 'mdi-information' }}
          </v-icon>
          <span class="mono def-line">{{ item.line + 1 }}</span>
          <span class="def-path">{{ item.message }}</span>
        </button>
      </div>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="problemsAsk.on = false">关闭</v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="outlineAsk.on"
      storage-key="dvcsx-outline"
      :initial-width="520"
      :initial-height="460"
      :min-width="360"
      :min-height="300"
    >
      <template #title>符号大纲</template>
      <v-text-field
        v-model="outlineAsk.filter"
        density="compact"
        variant="outlined"
        hide-details
        autofocus
        placeholder="筛选符号"
        prepend-inner-icon="mdi-magnify"
        class="dialog-filter"
      />
      <LoadingState v-if="outlineAsk.loading" hint="正在取符号…" />
      <p v-else-if="outlineAsk.error" class="ask-error">{{ outlineAsk.error }}</p>
      <EmptyState
        v-else-if="!outlineRows.length"
        icon="mdi-format-list-bulleted"
        :icon-size="40"
        :hint="outlineAsk.filter.trim() ? '没有匹配的符号。' : '这个文件里没有可列的符号。'"
      />
      <div v-else class="def-list">
        <button
          v-for="item in outlineRows"
          :key="`${item.line}:${item.character}:${item.name}`"
          type="button"
          class="def-item"
          :style="{ paddingLeft: `${10 + item.depth * 14}px` }"
          @click="pickSymbol(item)"
        >
          <v-icon size="16">{{ symbolIcon(item) }}</v-icon>
          <span class="mono def-path">{{ item.name }}</span>
          <span class="mono def-line">{{ item.line + 1 }}</span>
        </button>
      </div>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="outlineAsk.on = false">关闭</v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="quickAsk.on"
      storage-key="dvcsx-quick-open"
      :initial-width="560"
      :initial-height="480"
      :min-width="380"
      :min-height="300"
    >
      <template #title>快速打开</template>
      <v-text-field
        v-model="quickAsk.filter"
        density="compact"
        variant="outlined"
        hide-details
        autofocus
        placeholder="输入文件名"
        prepend-inner-icon="mdi-magnify"
        class="dialog-filter"
        @keyup.enter="pickQuick(quickRows[0])"
      />
      <LoadingState v-if="quickAsk.loading" hint="正在列文件…" />
      <p v-else-if="quickAsk.error" class="ask-error">{{ quickAsk.error }}</p>
      <EmptyState
        v-else-if="!quickRows.length"
        icon="mdi-file-search-outline"
        :icon-size="40"
        :hint="quickAsk.filter.trim() ? '没有匹配的文件。' : '这个工作副本里没有可打开的文件。'"
      />
      <div v-else class="def-list">
        <button
          v-for="path in quickRows"
          :key="path"
          type="button"
          class="def-item"
          @click="pickQuick(path)"
        >
          <v-icon size="16">mdi-file-outline</v-icon>
          <span class="mono def-path">{{ path }}</span>
        </button>
      </div>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="quickAsk.on = false">关闭</v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="lineAsk.on"
      :initial-width="360"
      :initial-height="220"
      :min-width="300"
      :min-height="180"
    >
      <template #title>跳到行</template>
      <v-text-field
        v-model="lineAsk.value"
        type="number"
        density="compact"
        variant="outlined"
        hide-details
        autofocus
        label="行号"
        @keyup.enter="submitGotoLine"
      />
      <p v-if="lineAsk.error" class="ask-error">{{ lineAsk.error }}</p>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="lineAsk.on = false">取消</v-btn>
        <v-btn color="primary" variant="flat" @click="submitGotoLine">跳过去</v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="hoverAsk.on"
      :initial-width="520"
      :initial-height="320"
      :min-width="340"
      :min-height="200"
    >
      <template #title>「{{ hoverAsk.word }}」</template>
      <pre class="hover-text mono">{{ hoverAsk.text }}</pre>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="hoverAsk.on = false">关闭</v-btn>
      </template>
    </FloatingDialog>

    <div
      v-if="hoverTip.on"
      class="hover-tip"
      :style="{ left: `${hoverTip.x}px`, top: `${hoverTip.y}px` }"
    >
      <pre class="hover-tip-text mono">{{ hoverTip.text }}</pre>
    </div>

    <div
      v-if="tabMenu.on"
      class="sym-menu tab-menu"
      :style="{ left: `${tabMenu.x}px`, top: `${tabMenu.y}px` }"
    >
      <template v-for="(item, index) in TAB_MENU" :key="index">
        <div v-if="item.sep" class="sym-sep" />
        <button v-else type="button" class="sym-item" @click="tabAction(item.action)">
          <v-icon size="16">{{ item.icon }}</v-icon>
          <span>{{ item.label }}</span>
        </button>
      </template>
    </div>

    <div
      v-if="symMenu.on"
      class="sym-menu"
      :style="{ left: `${symMenu.x}px`, top: `${symMenu.y}px` }"
    >
      <template v-for="(item, index) in SYMBOL_MENU" :key="index">
        <div v-if="item.sep" class="sym-sep" />
        <button v-else type="button" class="sym-item" @click="runSymbol(item.action)">
          <v-icon size="16">{{ item.icon }}</v-icon>
          <span>{{ item.label }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { api } from '../utils/api'
import { FileEditor, FileTree, copyText, fileIcon } from '@bash-scripts/web-shared'
import { EmptyState, LoadingState, SplitHandle } from '@bash-scripts/web-shared/layouts'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { formatBytes } from '@bash-scripts/web-shared/format'
import { PREVIEW_MAX, isHeldNode } from '../utils/browseOps'
import { SOURCE_LABELS, previewKindOf } from '../utils/previewTypes'
import { SHORTCUTS, SYMBOL_MENU, TAB_MENU } from '../utils/browseMenus'
import { PROBLEM_LEVELS, SEVERITY_ICONS } from '../utils/diagnostics'
import { useDiagnostics } from '../composables/useDiagnostics'
import { useCodeIndex } from '../composables/useCodeIndex'
import { useBrowseSearch } from '../composables/useBrowseSearch'
import { useBrowseEditors } from '../composables/useBrowseEditors'
import { useBrowseFiles } from '../composables/useBrowseFiles'
import ImagePreview from './previews/ImagePreview.vue'
import { tabOf, updateTab } from '../utils/browseTabs'
import { saveSession, sessionOf } from '../utils/browseSessions'
import { filterPaths } from '../utils/fuzzyMatch'
import { toast } from '../utils/notice'
import { dirName } from '../utils/format'
import { usePreferencesStore } from '../stores/preferences'
import { useSplitPane } from '@bash-scripts/web-shared'

const props = defineProps({
  ws: { type: Object, required: true },
})

const treeRef = ref(null)
const tabbarRef = ref(null)
// 打开过的文件各占一个页签，每个页签一个编辑器实例：草稿、视图与滚动都留在各自那份里。
// 面板换走再回来（换工作区、切到别的页签）接上次的样子：页签、停的位置与没保存的草稿都按工作区留着。
const kept = sessionOf(props.ws.id)
// 左侧树上次展开到哪些目录；换回这个工作区时原样摊开。
const keptExpanded = kept && kept.expanded ? kept.expanded : []
// 页签、编辑器实例与草稿交给组合式函数；读文件内容时顺手刷新诊断。
const {
  tabs,
  activePath,
  activeTab,
  drafts,
  editorOf,
  setEditor,
  takeDrafts,
  restoreDraft,
  setDirty,
  show,
  activate,
  closeTab,
} = useBrowseEditors({
  kept,
  refreshDiagnostics: (path) => refreshDiagnostics(path),
})
// 按扩展名挑预览器；加新类型在 previewTypes 里登记，再补一个组件挂进这张表。
const VIEWERS = { image: ImagePreview }
// 预览切回源码的页签；不改源码的类型一直走预览。
const sourceView = reactive(new Set())
const refreshing = ref(false)
// 状态栏的光标位置留在这一侧，代码索引那边只读它。
const caret = reactive({ line: 1, column: 1 })
// 代码索引：定义、引用、重命名、悬停、大纲与语言服务器状态。
const {
  defining,
  defAsk,
  renameAsk,
  servers,
  serversLoaded,
  outlineAsk,
  outlineRows,
  hoverAsk,
  hoverTip,
  languageLabel,
  serverReady,
  serverLabel,
  serverTitle,
  loadServers,
  onDefinition,
  askLocations,
  openRename,
  previewRename,
  applyRename,
  openOutline,
  symbolIcon,
  pickSymbol,
  onHover,
  onHoverEnd,
  showHoverAtCaret,
  openHover,
  dispose: disposeCodeIndex,
} = useCodeIndex({
  wsId: () => props.ws.id,
  activePath,
  activeTab,
  editorOf,
  caret,
  openLocation: (loc) => openLocation(loc),
  reloadDir: (path) => treeRef.value?.reloadDir(dirName(path)),
  flash: (text) => flash(text),
})
const quickAsk = reactive({ on: false, loading: false, error: '', files: [], filter: '', loaded: false })
const lineAsk = reactive({ on: false, value: '', error: '' })
// 诊断：当前文件的错误与警告，行号前的圆点与问题列表都用这份。
const {
  problems,
  problemsAsk,
  problemsLoading,
  problemStats,
  markers,
  refreshDiagnostics,
  onEdit,
  onProblem,
} = useDiagnostics({
  wsId: () => props.ws.id,
  activePath,
  editorOf,
  onOpen: (loc) => openLocation(loc),
})

const quickRows = computed(() => filterPaths(quickAsk.files, quickAsk.filter))

// 右键标识符弹出的代码菜单：位置、词，以及来源文件与行列。
const symMenu = reactive({ on: false, x: 0, y: 0, path: '', line: 0, character: 0, word: '' })
// 标签页右键菜单。
const tabMenu = reactive({ on: false, x: 0, y: 0, path: '' })
// 左侧目录树的宽度随分隔条拖动改变，双击分隔条还原。
const splitRef = ref(null)
const { size: treeWidth, resizing, start: startSplit, reset: resetSplit } = useSplitPane({
  area: splitRef,
  initial: 300,
  min: 180,
  rightMin: 320,
  persist: 'dvcsx.browse.tree-width',
})
// 搜索：query 非空时左侧换成结果列表，模式在文件名与内容之间切换。
const preferences = usePreferencesStore()
const { searchMode: mode } = storeToRefs(preferences)
const {
  query,
  searching,
  search,
  collapsedDirs,
  resultRows,
  clearSearch,
  toggleResultDir,
  runSearch,
} = useBrowseSearch({ wsId: () => props.ws.id, mode })

const rootName = computed(
  () => String(props.ws.root || '').replace(/\/+$/, '').split('/').pop() || '/',
)
const rootNode = computed(() => ({ name: rootName.value, path: '', type: 'dir' }))

// 取数函数与行内状态由这一侧给，树的展开与缓存交给共用组件。
const loadLayer = (path) => api.tree(props.ws.id, path)
const downloadOf = (node) => api.downloadUrl(props.ws.id, node.path)
const rowClass = (node) => ({ selected: node.type === 'file' && node.path === activePath.value })
const treeTexts = { truncated: '这一层文件太多，只列了前面一部分。' }

async function reveal(dirPath) {
  await treeRef.value?.reveal(dirPath)
}

// 一键收起左树：只合上当前展开的目录，根那层留着，读过的目录还在缓存里。
function collapseAll() {
  treeRef.value?.collapseAll()
}

// 文件的取数与落盘留在这一侧，编辑器只认路径和文本。
const loadFile = (path) => api.file(props.ws.id, path)
const saveFile = (path, text) => api.save(props.ws.id, path, text)

const held = computed(() => (isHeldNode(activeTab.value) ? activeTab.value : null))

function pick(node) {
  return show(node)
}

// 预览器拿到的是原始字节，走下载接口；文件换了大小就换地址，免得拿旧的那份。
function rawUrl(tab) {
  const base = api.downloadUrl(props.ws.id, tab.path)
  return tab.size ? `${base}&v=${tab.size}` : base
}

function viewerFor(tab) {
  return tab ? VIEWERS[previewKindOf(tab.path)] || null : null
}

// 预览与源码之间来回切；切回预览前有没保存的草稿先问一句，切回编辑器时把内容读进来。
async function toggleSource(path) {
  const editor = editorOf(path)
  if (sourceView.has(path)) {
    if (editor && editor.dirty && !(await editor.confirmLeave())) return
    sourceView.delete(path)
    return
  }
  sourceView.add(path)
  await nextTick()
  const opened = editorOf(path)
  if (!opened || opened.path) return
  if (await opened.open(path)) restoreDraft(path, opened)
  refreshDiagnostics(path)
}

// 右键标识符：在鼠标位置摆出代码菜单，点别处或按 Esc 收起。
function openSymbolMenu(payload) {
  symMenu.x = Math.max(0, Math.min(payload.x, window.innerWidth - 208))
  symMenu.y = Math.max(0, Math.min(payload.y, window.innerHeight - 220))
  symMenu.path = payload.path
  symMenu.line = payload.line
  symMenu.character = payload.character
  symMenu.word = payload.word
  symMenu.on = true
}

function closeSymbolMenu() {
  symMenu.on = false
}

function closeMenus() {
  symMenu.on = false
  tabMenu.on = false
}

function onMenuOutside(event) {
  const target = event.target
  if (target && target.closest && (target.closest('.sym-menu') || target.closest('.tab-menu'))) {
    return
  }
  closeMenus()
}

function onMenuKey(event) {
  if (event.key === 'Escape') closeMenus()
}

watch(
  () => symMenu.on || tabMenu.on,
  (on) => {
    if (on) {
      window.addEventListener('mousedown', onMenuOutside, true)
      window.addEventListener('keydown', onMenuKey, true)
    } else {
      window.removeEventListener('mousedown', onMenuOutside, true)
      window.removeEventListener('keydown', onMenuKey, true)
    }
  }
)

// 菜单里的动作：复制本地做，其余交给服务端问语言服务器。
async function runSymbol(action) {
  const item = {
    path: symMenu.path,
    line: symMenu.line,
    character: symMenu.character,
    word: symMenu.word,
  }
  closeSymbolMenu()
  if (action === 'copy') {
    try {
      await copyText(item.word)
      flash(`已复制「${item.word}」`)
    } catch (err) {
      flash(err.message || '复制失败')
    }
    return
  }
  if (action === 'rename') {
    openRename(item)
    return
  }
  if (action === 'hover') {
    await openHover(item.path, item.line, item.character, item.word)
    return
  }
  await askLocations(action, item)
}

// 状态栏与 IDE 快捷键：快速打开、符号大纲、跳到行。
function onCaret(position) {
  if (!position || position.path !== activePath.value) return
  caret.line = position.line
  caret.column = position.column
}

// 快捷键表在 browseMenus；这里只放 action 到处理函数的对应。
const SHORTCUT_RUN = {
  'quick-open': openQuickOpen,
  'goto-line': openGotoLine,
  outline: openOutline,
  hover: showHoverAtCaret,
}

function onPanelKey(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return
  const key = (event.key || '').toLowerCase()
  const hit = SHORTCUTS.find((item) => item.key === key && item.shift === event.shiftKey)
  if (!hit) return
  event.preventDefault()
  SHORTCUT_RUN[hit.action]()
}

async function openQuickOpen() {
  Object.assign(quickAsk, { on: true, filter: '', error: '' })
  if (quickAsk.loaded) return
  quickAsk.loading = true
  try {
    const data = await api.files(props.ws.id)
    quickAsk.files = data.files || []
    quickAsk.loaded = true
  } catch (err) {
    quickAsk.error = err.message
  } finally {
    quickAsk.loading = false
  }
}

async function pickQuick(path) {
  if (!path) return
  quickAsk.on = false
  await show({ path, name: path.split('/').pop(), type: 'file' })
}

function openGotoLine() {
  if (!activePath.value) return
  Object.assign(lineAsk, { on: true, value: String(caret.line || 1), error: '' })
}

async function submitGotoLine() {
  const tab = activeTab.value
  const line = Number.parseInt(String(lineAsk.value).trim(), 10)
  if (!tab || !Number.isFinite(line) || line < 1) {
    lineAsk.error = '给一个从 1 开始的行号'
    return
  }
  lineAsk.on = false
  await show(tab, line)
}

// 标签页右键：关闭、关闭其他、关闭全部、复制相对路径与绝对路径。
function openTabMenu(tab, event) {
  symMenu.on = false
  tabMenu.x = Math.max(0, Math.min(event.clientX, window.innerWidth - 208))
  tabMenu.y = Math.max(0, Math.min(event.clientY, window.innerHeight - 200))
  tabMenu.path = tab.path
  tabMenu.on = true
}

// 工作区登记的是绝对目录，拼上相对路径就是文件在磁盘上的位置。
function absolutePath(path) {
  const root = String(props.ws.root || '').replace(/\/+$/, '')
  return root ? `${root}/${path}` : path
}

async function tabAction(action) {
  const path = tabMenu.path
  closeMenus()
  if (action === 'copy') {
    await copyText(path)
    flash(`已复制 ${path}`)
    return
  }
  if (action === 'copy-abs') {
    const abs = absolutePath(path)
    await copyText(abs)
    flash(`已复制 ${abs}`)
    return
  }
  if (action === 'close') {
    const tab = tabOf(tabs.value, path)
    if (tab) await closeTab(tab)
    return
  }
  const keep = action === 'others' ? path : ''
  for (const tab of [...tabs.value]) {
    if (tab.path === keep) continue
    await closeTab(tab)
    // 有未保存草稿时用户可能取消，剩下就停手。
    if (tabOf(tabs.value, tab.path)) return
  }
}

// 跳到定义处：可能是别的文件，新开一个页签并按行定位。
async function openLocation(loc) {
  defAsk.on = false
  await show(
    { path: loc.path, name: loc.path.split('/').pop(), type: 'file' },
    (loc.line || 0) + 1
  )
}

// 提示走全页共用的那条 snackbar，颜色沿用原来提示条的警示色。
function flash(text) {
  toast(text, 'warning')
}

// 点目录行收起或展开，点文件行开到第一处命中，点命中行开到那一行。
function onResultRow(row) {
  if (row.type === 'dir') {
    toggleResultDir(row.path)
    return
  }
  const hit = row.hits[0]
  openHit({ name: row.name, path: row.path, size: row.size, line: hit ? hit.line : 0 })
}

function openResultHit(row, hit) {
  openHit({ name: row.name, path: row.path, size: row.size, line: hit.line })
}

function openHit(hit) {
  return show({ name: hit.name, path: hit.path, type: 'file', size: hit.size }, hit.line || 0)
}

function downloadHeld() {
  if (!held.value) return
  const link = document.createElement('a')
  link.href = downloadOf(held.value)
  link.download = held.value.name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

watch(activePath, (path) => {
  caret.line = 1
  caret.column = 1
  problems.value = []
  refreshDiagnostics(path)
  locate(path)
})
watch(searching, (on) => {
  if (!on) locate(activePath.value)
})

// 新建、改名与删除交给组合式函数：目录树只报动作，页签跟着路径走。
const {
  nameAsk,
  delAsk,
  nameTitle,
  nameLabel,
  onTreeAction,
  submitName,
  submitDelete,
} = useBrowseFiles({
  wsId: () => props.ws.id,
  tabs,
  activePath,
  drafts,
  editorOf,
  show,
  reveal: (dir) => treeRef.value?.reveal(dir),
  reload: (dir) => treeRef.value?.reloadDir(dir),
})

function save() {
  editorOf(activePath.value)?.save()
}

// 保存成功后刷新：页签与目录树里记着的那一份要跟上。
function onSaved({ path, data }) {
  // 保存期间可能已经切到别的页签，那边的内容不能被这份草稿盖掉。
  if (tabOf(tabs.value, path)) tabs.value = updateTab(tabs.value, path, { size: data.size })
  treeRef.value?.reloadDir(dirName(path))
  refreshDiagnostics(path)
}

function iconOf(hit) {
  return fileIcon(hit.name)
}

async function refresh() {
  refreshing.value = true
  try {
    if (searching.value) {
      await runSearch()
      return
    }
    await treeRef.value?.refreshAll()
    // 有没保存的改动就不重新读，免得草稿被磁盘上的旧内容盖掉。
    const editor = editorOf(activePath.value)
    if (editor && !editor.dirty) await editor.reload()
  } finally {
    refreshing.value = false
  }
}

// 回来时把树摊回原来的层次，读出停着的那一个页签，草稿跟着放回去；其余页签等点开再读。
onMounted(async () => {
  loadServers()
  if (keptExpanded.length) treeRef.value?.restoreExpanded(keptExpanded)
  const tab = tabOf(tabs.value, activePath.value) || tabs.value[0] || null
  if (!tab) return
  if (tab.path !== activePath.value) activePath.value = tab.path
  await show(tab)
  locate(activePath.value)
})

// 换走之前把页签、草稿与树的展开层次收进这个工作区的 session，下次回来接着用。
onBeforeUnmount(() => {
  takeDrafts()
  saveSession(props.ws.id, {
    tabs: tabs.value.map((tab) => ({ ...tab, dirty: drafts.has(tab.path) })),
    active: activePath.value,
    drafts,
    expanded: treeRef.value ? treeRef.value.expandedKeys() : keptExpanded,
  })
  disposeCodeIndex()
  window.removeEventListener('mousedown', onMenuOutside, true)
  window.removeEventListener('keydown', onMenuKey, true)
})
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.left {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.busy {
  flex: 0 0 auto;
  margin-right: 4px;
}
/* 问题弹窗顶部的分类统计：图标、级别与条数。 */
.problem-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.problem-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.problem-stat.error {
  color: rgb(var(--v-theme-error));
}
.problem-stat.warning {
  color: rgb(var(--v-theme-warning));
}
.problem-stat.info {
  color: rgb(var(--v-theme-info));
}
.def-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  overflow: auto;
}
.def-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}
.def-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.def-path {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.def-line {
  flex: 0 0 auto;
  font-size: 0.74rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.statusbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 12px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgba(var(--v-theme-on-surface), 0.03);
  font-size: 0.72rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.cell {
  flex: 0 0 auto;
}
.cell.link {
  padding: 0 2px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.cell.link:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.cell.muted {
  color: rgb(var(--v-theme-warning));
}
/* 弹窗正文是纵向 flex，v-input 默认 flex: 1 1 auto，会被拉高一整块；
   筛选框只占自己那一行，剩下的空间留给列表。 */
.dialog-filter {
  flex: 0 0 auto;
  margin-bottom: 8px;
}
.problems-btn {
  min-width: 0;
  padding: 0 8px;
}
.hover-tip {
  position: fixed;
  z-index: 3000;
  max-width: 440px;
  max-height: 260px;
  overflow: hidden;
  padding: 8px 10px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.24);
  pointer-events: none;
}
.hover-tip-text {
  margin: 0;
  max-height: 244px;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.76rem;
}
.hover-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.8rem;
  overflow: auto;
  min-height: 0;
}
.sym-menu {
  position: fixed;
  z-index: 3000;
  min-width: 196px;
  padding: 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.24);
}
.sym-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}
.sym-item:hover {
  background: rgba(var(--v-theme-primary), 0.12);
}
.sym-sep {
  height: 1px;
  margin: 4px 6px;
  background: rgba(var(--v-theme-on-surface), 0.1);
}
.search {
  flex: 0 1 460px;
  min-width: 180px;
}
.modes {
  flex: 0 0 auto;
}
.result-head {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgb(var(--v-theme-surface));
  font-size: 0.74rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.result-head .bad {
  color: rgb(var(--v-theme-error));
}
.srow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.07);
  font-size: 0.78rem;
  cursor: pointer;
}
.srow:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.srow.active {
  background: rgba(var(--v-theme-primary), 0.14);
}
.srow.dir {
  font-weight: 500;
}
.sicon {
  flex: 0 0 auto;
}
.sname {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.scount {
  flex: 0 0 auto;
  font-size: 0.68rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.shit {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 1px 10px 3px;
  font-size: 0.72rem;
  cursor: pointer;
}
.shit:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.shit-line {
  flex: 0 0 auto;
  min-width: 2.4em;
  text-align: right;
  color: rgb(var(--v-theme-on-surface-variant));
}
.shit-text {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.body {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
.body.resizing {
  cursor: col-resize;
  user-select: none;
}
.main {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.tabbar {
  flex: 0 0 auto;
  display: flex;
  overflow-x: auto;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.tabbar::-webkit-scrollbar {
  height: 6px;
}
.tab {
  flex: 0 0 auto;
  max-width: 220px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 6px 6px 10px;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.78rem;
  cursor: pointer;
  user-select: none;
}
.tab:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.tab.active {
  color: rgb(var(--v-theme-on-surface));
  background: rgb(var(--v-theme-surface));
  box-shadow: inset 0 -2px 0 rgb(var(--v-theme-primary));
}
.tab-icon {
  flex: 0 0 auto;
}
.tab-name {
  flex: 0 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tab-dirty {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(var(--v-theme-modified));
}
.tab-close {
  flex: 0 0 auto;
  display: flex;
  padding: 1px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  opacity: 0;
  cursor: pointer;
}
.tab:hover .tab-close,
.tab.active .tab-close {
  opacity: 0.7;
}
.tab .tab-close:hover {
  opacity: 1;
  background: rgba(var(--v-theme-on-surface), 0.12);
}
.panes {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}
.pane {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* 预览切源码时顶上一颗按钮；预览器自己的样式跟组件走。 */
.preview-bar {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px;
}
.preview-act {
  padding: 2px 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 4px;
  background: rgb(var(--v-theme-surface));
  color: inherit;
  font-size: 0.72rem;
  cursor: pointer;
}
.preview-act:hover {
  background: rgba(var(--v-theme-primary), 0.12);
}
.tree {
  width: var(--tree-width, 300px);
  flex: 0 0 var(--tree-width, 300px);
  overflow: auto;
  padding: 6px 4px;
}
/* 树顶的按钮浮在树上面：负的下边距把占位抵掉，不占文档流；sticky 让它滚动时也停在原处，
   平时藏起来，鼠标移进左树才露出来。只有按钮本身接鼠标，底下那行照常能点。 */
.tree-tools {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  justify-content: flex-end;
  height: 24px;
  margin: 0 -4px -24px;
  padding: 0 4px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
}
.tree:hover .tree-tools {
  opacity: 1;
}
.tree-tools :deep(.v-btn) {
  pointer-events: auto;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
}
.hint {
  margin: 16px;
  font-size: 0.84rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
.ask-path {
  margin: 0 0 8px;
  font-size: 0.82rem;
  word-break: break-all;
}
.ask-hint {
  margin: 0;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.ask-error {
  margin: 8px 0 0;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-error));
}
</style>
