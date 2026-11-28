<!--
 * @Author: Himmeltala
 * @Date: 2026-11-12 18:48:07
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 18:40:00
 * @FilePath: \idex\web\src\features\browse\components\BrowsePanel.vue
 * @Description: 浏览工作副本目录，预览、编辑、新建、重命名与删除文件。
-->
<template>
  <div
    class="panel"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDropFiles"
  >
    <div ref="splitRef" class="body" :class="{ resizing }">
      <aside
        class="tree"
        :style="{ '--tree-width': `${treeWidth}px` }"
        @mouseover="onRowHover"
        @mousemove="onRowMove"
        @click.capture="onTreeClick"
        @mouseleave="cancelHover"
      >
        <div class="tree-head">
          <div class="tree-tools-row">
            <v-btn
              :icon="searchOpen ? 'mdi-close' : 'mdi-magnify'"
              size="x-small"
              variant="text"
              :title="searchOpen ? '关闭搜索（Esc）' : '搜索（Ctrl+Shift+E）'"
              @click="searchOpen ? closeSearch() : openSearch()"
            />
            <v-spacer />
            <v-btn
              icon="mdi-collapse-all-outline"
              size="x-small"
              variant="text"
              title="全部收起已展开的目录"
              @click="collapseAll"
            />
          </div>
          <template v-if="searchOpen">
            <v-text-field
              ref="searchRef"
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
              @keydown.esc="closeSearch"
            />
            <div class="tree-tools-row">
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
              <v-spacer />
              <v-btn
                v-if="searching"
                size="small"
                variant="text"
                prepend-icon="mdi-arrow-left"
                title="退出搜索，回到目录树"
                @click="closeSearch"
              >
                返回目录
              </v-btn>
            </div>
          </template>
          <input ref="uploadInput" type="file" multiple hidden @change="onUploadPicked" />
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
          <EmptyState
            v-if="!search.loading && !search.error && !search.matches.length"
            icon="mdi-file-search-outline"
            :icon-size="40"
            title="没有找到匹配的文件"
          />
          <div v-for="row in resultRows" :key="`${row.type}:${row.path}`" class="snode">
            <div
              class="srow"
              :class="{
                dir: row.type === 'dir',
                active: row.type === 'file' && activePath === row.path,
              }"
              :style="{ paddingLeft: `${10 + row.depth * 14}px` }"
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
          :extractable="extractablePath"
          :selected="selectedPaths"
          :selection-menu="selectionMenu"
          selectable
          pick-on-row-click
          :texts="treeTexts"
          editable
          refreshable
          movable
          @pick="pick"
          @action="onTreeAction"
          @select="toggleNodeSelection"
          @clear-selection="clearSelection"
          @drag-start="onTreeDragStart"
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
            @click="activateTab(tab)"
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
            <span v-if="tab.stale" class="tab-stale" title="磁盘上已更新，点页签重新载入" />
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
                :url="viewerUrl(tab)"
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
                  :initial-mode="preferences.markdownMode"
                  @mode-change="rememberViewMode"
                  @saved="onSaved"
                  @dirty="(on) => setDirty(tab.path, on)"
                  @edit="onEdit"
                >
                  <template #editor="{ value, update, register }">
                    <CodeEditorShell
                      :model-value="value"
                      @update:model-value="update"
                      :path="tab.path"
                      :minimap="editorSettings.minimap"
                      :register="register"
                      :markers="markers"
                      v-bind="editorViewProps"
                      @definition="onDefinition"
                      @menu="openSymbolMenu"
                      @rename="openRename"
                      @caret="onCaret"
                      @edit="onEdit"
                      @hover="onHover"
                      @hover-end="onHoverEnd"
                      @diffhunk="openDiffHunk"
                    />
                  </template>
                </FileEditor>
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
      v-model="selDel.on"
      :initial-width="480"
      :initial-height="280"
      :min-width="380"
      :min-height="220"
      persistent
    >
      <template #title>删除选中的 {{ selectedPaths.length }} 项</template>
      <p class="ask-hint">
        选中的目录会连同里面的文件一起删除。已纳入版本控制的能从版本库里找回，未纳管的删了就没了。
      </p>
      <p v-if="selDel.error" class="ask-error">{{ selDel.error }}</p>
      <template #actions>
        <v-btn variant="text" @click="selDel.on = false">取消</v-btn>
        <v-spacer />
        <v-btn color="error" variant="flat" :loading="selDel.busy" @click="submitSelectionDelete">
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
      storage-key="idex-problems"
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
      storage-key="idex-outline"
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
      storage-key="idex-quick-open"
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

    <!-- 悬浮 1.5 秒给的基础信息；位置跟着鼠标指针走，不挡操作。 -->
    <div v-if="hoverInfo.on" class="hover-card" :style="{ left: `${hoverInfo.x}px`, top: `${hoverInfo.y}px` }">
      <template v-if="hoverInfo.loading">正在读取…</template>
      <template v-else-if="hoverInfo.error">{{ hoverInfo.error }}</template>
      <template v-else>
        <div v-for="row in hoverInfo.rows" :key="row.label" class="hover-row">
          <span class="hover-key">{{ row.label }}</span>
          <span class="hover-val" :class="{ mono: row.mono }">{{ row.value }}</span>
        </div>
      </template>
    </div>

    <div v-if="uploads.length" class="upload-panel">
      <div class="upload-head">
        <span>{{ uploadBusy ? '正在上传' : '上传完成' }}</span>
        <button type="button" class="upload-close" title="关闭" @click="clearUploads">
          <v-icon size="14">mdi-close</v-icon>
        </button>
      </div>
      <div v-for="item in uploads" :key="item.id" class="upload-row">
        <div class="upload-line">
          <span class="upload-name" :title="item.error || item.name">{{ item.name }}</span>
          <span class="upload-state" :class="item.state">{{ uploadStateText(item) }}</span>
        </div>
        <v-progress-linear
          v-if="item.state === 'uploading'"
          :model-value="item.percent"
          height="3"
          color="primary"
        />
      </div>
    </div>

    <FloatingDialog
      v-model="uploadAsk.on"
      :initial-width="420"
      :initial-height="250"
      :min-width="340"
      :min-height="200"
      persistent
    >
      <template #title>同名文件已存在</template>
      <p class="up-conflict">{{ uploadAsk.name }}</p>
      <p class="ask-hint">覆盖会替换目录里现有的同名文件。</p>
      <template #actions>
        <v-btn variant="text" @click="answerUpload('skip')">跳过</v-btn>
        <v-btn variant="text" @click="answerUpload('cancel')">取消其余</v-btn>
        <v-spacer />
        <v-btn color="error" variant="flat" @click="answerUpload('overwrite')">覆盖</v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="propsAsk.on"
      :initial-width="540"
      :initial-height="380"
      :min-width="380"
      :min-height="240"
    >
      <template #title>属性</template>
      <LoadingState v-if="propsAsk.loading" hint="正在读取…" />
      <p v-else-if="propsAsk.error" class="ask-error">{{ propsAsk.error }}</p>
      <div v-else class="props-list">
        <div v-for="row in propsRows" :key="row.label" class="props-row">
          <span class="props-key">{{ row.label }}</span>
          <span class="props-val" :class="{ mono: row.label === '路径' || row.label === '权限' }">
            {{ row.value }}
          </span>
        </div>
      </div>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="propsAsk.on = false">关闭</v-btn>
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

    <ContextMenu
      v-model="tabMenu.on"
      :x="tabMenu.x"
      :y="tabMenu.y"
      :items="TAB_MENU"
      @select="tabAction"
    />

    <ContextMenu
      v-model="symMenu.on"
      :x="symMenu.x"
      :y="symMenu.y"
      :items="SYMBOL_MENU"
      @select="runSymbol"
    />

    <div
      v-if="diffMenu.on"
      class="sym-menu diff-menu"
      :style="{ left: `${diffMenu.x}px`, top: `${diffMenu.y}px` }"
    >
      <p class="diff-menu-title">这一块的原文</p>
      <pre class="diff-menu-text mono">{{ diffMenu.original }}</pre>
      <div class="diff-menu-actions">
        <v-btn size="small" variant="text" @click="diffMenu.on = false">关闭</v-btn>
        <v-btn
          size="small"
          color="primary"
          variant="flat"
          :loading="diffMenu.busy"
          @click="restoreHunk"
        >
          还原此块
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { api } from '../../../utils/api'
import { useBrowseProps } from '../composables/useBrowseProps'
import { useBrowseUploads } from '../composables/useBrowseUploads'
import { useBrowseDiskSync } from '../composables/useBrowseDiskSync'
import { FileEditor, FileTree, copyText, fileIcon } from '@bash-scripts/web-shared'
import { EmptyState, LoadingState, SplitHandle } from '@bash-scripts/web-shared/layouts'
import { ContextMenu, FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { formatBytes, formatTimestamp } from '@bash-scripts/web-shared/format'
import { PREVIEW_MAX, isHeldNode } from '../lib/browseOps'
import { compressiblePath } from '../lib/browseCompress'
import { extractablePath } from '../lib/browseArchive'
import { sharesParent, togglePath } from '../lib/browseSelection'
import { SOURCE_LABELS, previewKindOf } from '../../editor/core/previews/previewTypes'
import { SYMBOL_MENU, TAB_MENU } from '../lib/browseMenus'
import { matchesBinding } from '../../settings/lib/shortcuts'
import { PROBLEM_LEVELS, SEVERITY_ICONS } from '../../editor/core/diagnostics'
import { useDiagnostics } from '../../editor/composables/useDiagnostics'
import { useCodeIndex } from '../../editor/composables/useCodeIndex'
import { handlerOf } from '../../editor/core/handlers/registry'
import CodeEditorShell from '../../editor/components/CodeEditorShell.vue'
import { useBrowseSearch } from '../composables/useBrowseSearch'
import { useBrowseEditors } from '../composables/useBrowseEditors'
import { useBrowseFiles } from '../composables/useBrowseFiles'
import ImagePreview from '../../editor/components/previews/ImagePreview.vue'
import PdfPreview from '../../editor/components/previews/PdfPreview.vue'
import { tabOf, updateTab } from '../lib/browseTabs'
import { saveSession, sessionOf } from '../lib/browseSessions'
import { filterPaths } from '../lib/fuzzyMatch'
import { toast } from '../../../utils/notice'
import { dirName } from '../../../utils/format'
import { diffMarks, hunkOriginal, parseDiffHunks } from '../../editor/core/diffLines'
import { usePreferencesStore } from '../../../stores/preferences'
import { useSettingsStore } from '../../../stores/settings'
import { useEditorSettings, useShortcutBindings } from '../../settings/composables/useSettings'
import { useSplitPane } from '@bash-scripts/web-shared'

const props = defineProps({
  ws: { type: Object, required: true },
  // 工作副本的推送计数：外部有变动就加一，浏览页据此重读目录并标记已打开的文件。
  refresh: { type: Number, default: 0 },
  // 这一轮变动的路径；为空表示只知道变了，不知道是哪几处。
  changedPaths: { type: Array, default: () => [] },
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
  // 读完文件记下这一代已核对；组合式函数在后面创建，回调到时才用到。
  onLoaded: (path) => diskSync.markSynced(path),
})
// 按扩展名挑预览器；加新类型在 previewTypes 里登记，再补一个组件挂进这张表。
const VIEWERS = { image: ImagePreview, office: PdfPreview }
// 预览切回源码的页签；不改源码的类型一直走预览。
const sourceView = reactive(new Set())
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
  disabledServers: () => new Set(settings.get('lsp.disabled') || []),
})

// 代码编辑器的补全与格式化适配器：拿当前工作区、当前草稿全文去问服务端。
function capabilitiesOf(path) {
  const id = handlerOf(path).server
  if (id && (settings.get('lsp.disabled') || []).includes(id)) return {}
  const info = id ? servers.value.find((item) => item.id === id) : null
  return (info && info.capabilities) || {}
}

const editorViewProps = computed(() => ({
  complete: ({ path, text, line, character, trigger }) =>
    api.completion(props.ws.id, path, text, line, character, trigger),
  format: ({ path, text }) => {
    const options = handlerOf(path).formatOptions?.(path) || {}
    return api.format(
      props.ws.id,
      path,
      text,
      options.tabSize ?? 4,
      options.insertSpaces ?? true,
    )
  },
  capabilities: capabilitiesOf,
  notice: (text) => flash(text),
  theme: editorSettings.value.theme,
  diff: diffCache.value,
}))

// 打开文件、换工作区时取一次尚未提交的差异，给编辑器画行级标记。
// 各文件的 Git 行级标记，按路径分开存；换页签时编辑器各取各的。
const diffCache = ref({})
let diffSeq = 0

watch(activePath, (path) => loadDiff(path), { immediate: true })
watch(
  () => props.ws.id,
  () => {
    diffCache.value = {}
    loadDiff()
  }
)

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
  serverDisabled: (path) => {
    const id = handlerOf(path).server
    return !!(id && (settings.get('lsp.disabled') || []).includes(id))
  },
})

const quickRows = computed(() => filterPaths(quickAsk.files, quickAsk.filter))

// 右键标识符弹出的代码菜单：位置、词，以及来源文件与行列。
const symMenu = reactive({ on: false, x: 0, y: 0, path: '', line: 0, character: 0, word: '' })
// 标签页右键菜单。
const tabMenu = reactive({ on: false, x: 0, y: 0, path: '' })
// 编辑器行级改动的菜单：显示这一块原文，可以还原。
const diffMenu = reactive({ on: false, x: 0, y: 0, path: '', hunk: null, original: '', busy: false })
async function loadDiff(path = activePath.value) {
  if (!path) return
  if (props.ws.vcs !== 'git') {
    diffCache.value = { ...diffCache.value, [path]: null }
    return
  }
  const mine = ++diffSeq
  try {
    const data = await api.diff(props.ws.id, path, '', false, 'head')
    if (mine !== diffSeq) return
    const hunks = parseDiffHunks(data.text || '')
    diffCache.value = {
      ...diffCache.value,
      [path]: hunks.length ? { hunks, marks: diffMarks(hunks) } : null,
    }
  } catch (err) {
    if (mine === diffSeq) diffCache.value = { ...diffCache.value, [path]: null }
  }
}

function openDiffHunk(payload) {
  if (!payload || !payload.hunk) return
  diffMenu.x = Math.max(0, Math.min(payload.x, window.innerWidth - 340))
  diffMenu.y = Math.max(0, Math.min(payload.y, window.innerHeight - 260))
  diffMenu.path = payload.path
  diffMenu.hunk = payload.hunk
  diffMenu.original = hunkOriginal(payload.hunk)
  diffMenu.busy = false
  diffMenu.on = true
}

async function restoreHunk() {
  if (!diffMenu.path || !diffMenu.hunk || diffMenu.busy) return
  diffMenu.busy = true
  try {
    await api.restoreHunk(props.ws.id, diffMenu.path, diffMenu.hunk.text)
    diffMenu.on = false
    const editor = editorOf(diffMenu.path)
    if (editor && editor.dirty) {
      // 草稿里还有没保存的改动，不能拿磁盘内容盖掉它。
      flash('已还原磁盘上的这块改动；编辑器里的草稿没保存，未重新载入')
    } else {
      flash('已还原这块改动')
      if (editor) {
        await editor.reload()
        diskSync.markSynced(diffMenu.path)
      }
    }
    await loadDiff(diffMenu.path)
    refreshDiagnostics(diffMenu.path)
  } catch (err) {
    flash(`还原失败：${err && err.message ? err.message : '服务端没有响应'}`)
  } finally {
    diffMenu.busy = false
  }
}
// 左侧目录树的宽度随分隔条拖动改变，双击分隔条还原。
const splitRef = ref(null)
const { size: treeWidth, resizing, start: startSplit, reset: resetSplit } = useSplitPane({
  area: splitRef,
  initial: 300,
  min: 180,
  rightMin: 320,
  persist: 'idex.browse.tree-width',
})
// 搜索：query 非空时左侧换成结果列表，模式在文件名与内容之间切换。
const preferences = usePreferencesStore()
const settings = useSettingsStore()
const editorSettings = useEditorSettings()
const shortcuts = useShortcutBindings()
const { searchMode: mode } = storeToRefs(preferences)
const searchOpen = ref(false)
const searchRef = ref(null)
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
const rowClass = (node) => ({
  selected: node.type === 'file' && node.path === activePath.value,
  // 拖拽时给落点目录描虚线，让人一眼看到文件会传进哪一层。
  'drop-target': dragOn.value && node.type === 'dir' && node.path === dropDir.value,
})
const treeTexts = { truncated: '这一层文件太多，只列了前面一部分。' }

// 悬浮 1.5 秒显示基础信息：停在同一行不重置计时，换行或移出目录树就取消。
const HOVER_DELAY = 1500
const HOVER_TYPE = { file: '文件', dir: '目录', link: '符号链接' }
const hoverInfo = reactive({ on: false, loading: false, error: '', x: 0, y: 0, rows: [] })
let hoverTimer = 0
let hoverSeq = 0
let hoverPath = ''
// 卡片跟手：位置按鼠标指针算，出现后继续跟着走。
const hoverPoint = { x: 0, y: 0 }

// 贴着指针右下摆；右边或下边放不开就翻到另一侧，再夹进窗口。
function placeHover(x, y) {
  const width = 280
  const height = 200
  hoverInfo.x = x + 16 + width > window.innerWidth ? Math.max(8, x - width - 16) : x + 16
  hoverInfo.y = y + 18 + height > window.innerHeight ? Math.max(8, y - height - 18) : y + 18
}

function cancelHover() {
  clearTimeout(hoverTimer)
  hoverTimer = 0
  hoverPath = ''
  hoverInfo.on = false
}

function onRowHover(event) {
  const row = event.target instanceof Element ? event.target.closest('.row[data-path]') : null
  if (!row) {
    cancelHover()
    return
  }
  hoverPoint.x = event.clientX
  hoverPoint.y = event.clientY
  const path = row.dataset.path || ''
  if (!path || path === hoverPath) return
  cancelHover()
  hoverPath = path
  hoverTimer = setTimeout(() => showHover(path), HOVER_DELAY)
}

function onRowMove(event) {
  hoverPoint.x = event.clientX
  hoverPoint.y = event.clientY
  if (hoverInfo.on) placeHover(hoverPoint.x, hoverPoint.y)
}

async function showHover(path) {
  const mine = ++hoverSeq
  hoverInfo.on = true
  hoverInfo.loading = true
  hoverInfo.error = ''
  hoverInfo.rows = []
  placeHover(hoverPoint.x, hoverPoint.y)
  try {
    const data = await api.stat(props.ws.id, path)
    if (mine !== hoverSeq) return
    hoverInfo.rows = [
      { label: '名称', value: data.name },
      { label: '类型', value: HOVER_TYPE[data.type] || data.type },
      { label: '大小', value: data.size == null ? '—' : formatBytes(data.size) },
      { label: '修改时间', value: formatTimestamp(data.mtime, { unit: 's', fallback: '—' }) },
      { label: '路径', value: data.abs, mono: true },
    ]
  } catch (err) {
    if (mine === hoverSeq) hoverInfo.error = err.message
  } finally {
    if (mine === hoverSeq) hoverInfo.loading = false
  }
}

onBeforeUnmount(() => clearTimeout(hoverTimer))

function tabIcon(tab) {
  return fileIcon(tab.name)
}

// 切换页签时左侧树跟着走：展开到所在目录，把这一行滚进视野；搜索时树是藏着的，等退出搜索再定位。
async function locate(path) {
  if (!path) return
  await nextTick()
  const rows = tabbarRef.value?.querySelectorAll('[data-path]')
  for (const el of rows || []) {
    if (el.dataset.path !== path) continue
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    break
  }
  if (searching.value) return
  await treeRef.value?.reveal(dirName(path))
  if (activePath.value !== path) return
  await nextTick()
  treeRef.value?.scrollTo(path)
}

// 一键收起左树：只合上当前展开的目录，根那层留着，读过的目录还在缓存里。
function collapseAll() {
  treeRef.value?.collapseAll()
}

// 文件的取数与落盘留在这一侧，编辑器只认路径和文本。
const loadFile = (path) => api.file(props.ws.id, path)
const statFile = (path) => api.stat(props.ws.id, path)
const saveFile = (path, text) => api.save(props.ws.id, path, text)

const held = computed(() => (isHeldNode(activeTab.value) ? activeTab.value : null))

// 多选：Ctrl/Cmd 点行加入或移出；多选时右键换成压缩、下载、删除这一套菜单。
const selectedPaths = ref([])
const sameParent = computed(() => sharesParent(selectedPaths.value))
const selectionMenu = computed(() => [
  {
    action: 'selection-compress',
    label: '压缩为 zip',
    icon: 'mdi-zip-box-outline',
    disabled: !sameParent.value,
  },
  // 下载不受同目录限制：跨目录时按工作区相对路径打进一个包。
  { action: 'selection-download', label: '下载', icon: 'mdi-download' },
  { action: 'selection-copy', label: '复制相对路径', icon: 'mdi-content-copy' },
  { sep: true },
  { action: 'selection-delete', label: '删除', icon: 'mdi-trash-can-outline', danger: true },
])

function toggleNodeSelection(node) {
  const path = String((node && node.path) || '')
  if (!path) return
  selectedPaths.value = togglePath(selectedPaths.value, path)
}

// 拖出资源管理器时带上绝对路径；拖的是多选里的一项就带上全部选中项。
function onTreeDragStart(node, event) {
  const path = String((node && node.path) || '')
  if (!path) return
  const root = String(props.ws.root || '').replace(/\/+$/, '')
  const paths = selectedPaths.value.includes(path) ? selectedPaths.value : [path]
  event.dataTransfer?.setData('text/plain', paths.map((rel) => `${root}/${rel}`).join('\n'))
}

function clearSelection() {
  if (selectedPaths.value.length) selectedPaths.value = []
}

// 不按 Ctrl 点树里的任何一行，都先清掉多选再走原来的打开/展开。
function onTreeClick(event) {
  if (event.ctrlKey || event.metaKey) return
  clearSelection()
}

watch(
  () => props.ws.id,
  () => clearSelection(),
)

// 视图偏好属于界面：统一走浏览器存储的单选工具，组件只给参数与事件。
function rememberViewMode(payload) {
  if (!payload || !payload.mode) return
  preferences.markdownMode = payload.mode
}

function pick(node) {
  return show(node)
}

// 预览器拿到的是原始字节，走下载接口；文件换了大小就换地址，免得拿旧的那份。
// 图片直接取原文件；Office 走后端转换后的 PDF。
function viewerUrl(tab) {
  if (previewKindOf(tab.path) === 'office') return api.previewUrl(props.ws.id, tab.path)
  return rawUrl(tab)
}

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

// 右键菜单自己管点外面与 Esc；这里只管下边那块原文浮层。
function onMenuOutside(event) {
  const target = event.target
  if (target && target.closest && target.closest('.diff-menu')) return
  diffMenu.on = false
}

function onMenuKey(event) {
  if (event.key === 'Escape') diffMenu.on = false
}

watch(
  () => diffMenu.on,
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

// 快捷键 ID 到处理函数的对应；绑定本身在设置里改。
const SHORTCUT_RUN = {
  save,
  quickOpen: openQuickOpen,
  gotoLine: openGotoLine,
  outline: openOutline,
  problems: () => {
    problemsAsk.on = true
  },
  hover: showHoverAtCaret,
}

function onPanelKey(event) {
  // 输入框、下拉与普通文本框里不抢键；编辑器内的 CodeMirror 快捷键仍照常处理。
  const target = event.target
  if (
    target instanceof Element &&
    target.closest('input, textarea, select, [contenteditable="true"]') &&
    !target.closest('.cm-editor, .find-bar')
  ) {
    return
  }
  for (const [id, run] of Object.entries(SHORTCUT_RUN)) {
    if (!matchesBinding(shortcuts.value[id], event)) continue
    event.preventDefault()
    run()
    return
  }
}

function openSearch() {
  searchOpen.value = true
  nextTick(() => {
    const input = searchRef.value && searchRef.value.$el
    const field = input && input.querySelector('input')
    if (field) field.focus()
  })
}

// 关闭搜索行：清掉查询、回到目录树；Ctrl+F 再打开。
function closeSearch() {
  clearSearch()
  searchOpen.value = false
}

// 全局快捷键只负责投递请求；切到资源管理器后由这里消费并打开搜索。
watch(
  () => preferences.pendingSearch,
  (request) => {
    if (!request) return
    mode.value = request.mode
    preferences.pendingSearch = null
    openSearch()
  },
  { immediate: true },
)

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
  tabMenu.on = false
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
  // 换到一个在外部被改过的页签：只打标记，点它才换内容。
  diskSync.markActiveStale()
})

// 其他页签要打开某个文件的某一行：消费一次，打开后清掉。
let pendingSeq = 0
watch(
  () => preferences.pendingOpen,
  async (target) => {
    if (!target || !target.path || target.seq === pendingSeq) return
    pendingSeq = target.seq
    preferences.pendingOpen = null
    const name = String(target.path).split('/').pop()
    await show({ name, path: target.path, type: 'file' }, Number(target.line) || 0)
  },
  { immediate: true },
)
watch(searching, (on) => {
  if (on) clearSelection()
  if (!on) {
    // 搜索期间攒下的外部变化，退出搜索时把目录树补读一遍。
    diskSync.flushSearchStale()
    locate(activePath.value)
  }
})

// 新建、改名、拖动移动与删除交给组合式函数：目录树只报动作，页签跟着路径走。
const {
  nameAsk,
  delAsk,
  nameTitle,
  nameLabel,
  onTreeAction: onBrowseAction,
  moveNode,
  submitName,
  submitDelete,
  deleteMany,
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

// 目录树右键：上传与属性留在本组件，其余动作照旧交给组合式函数。
function onTreeAction(payload) {
  if (payload.action === 'refresh') {
    // 目录重读自己这层，文件重读所在的那层：外部改动后手动刷一下，比等推送快。
    const node = payload.node
    if (!node) return
    treeRef.value?.reloadDir(node.type === 'dir' ? node.path : dirName(node.path))
    return
  }
  if (payload.action === 'move') {
    moveNode(payload.node, payload.dir).catch((err) => {
      flash(err && err.message ? err.message : '移动失败')
    })
    return
  }
  if (payload.action === 'upload') {
    pickUpload(payload.node && payload.node.path)
    return
  }
  if (payload.action === 'compress') {
    compressDir(payload.node)
    return
  }
  if (payload.action === 'extract') {
    extractArchive(payload.node)
    return
  }
  if (payload.action === 'selection-compress') {
    compressSelection()
    return
  }
  if (payload.action === 'selection-download') {
    downloadSelection()
    return
  }
  if (payload.action === 'selection-copy') {
    copySelection()
    return
  }
  if (payload.action === 'selection-delete') {
    Object.assign(selDel, { on: true, error: '', busy: false })
    return
  }
  if (payload.action === 'props') {
    openProps(payload.node ? payload.node.path : '')
    return
  }
  return onBrowseAction(payload)
}

// 压缩目录：包落在同级，成功后提示包路径并重读父目录，让新包出现在树里。
async function compressDir(node) {
  const path = compressiblePath(node)
  if (!path) return
  try {
    const data = await api.compress(props.ws.id, path)
    flash(`已生成 ${data.path}`)
    treeRef.value?.reloadDir(dirName(path))
  } catch (err) {
    flash(err && err.message ? err.message : '压缩失败')
  }
}

// 解压 zip：解到同级同名目录，目标已存在时服务端会拒绝；成功后重读父目录。
async function extractArchive(node) {
  const path = extractablePath(node)
  if (!path) return
  try {
    const data = await api.extract(props.ws.id, path)
    flash(`已解压到 ${data.path}`)
    treeRef.value?.reloadDir(dirName(path))
  } catch (err) {
    flash(err && err.message ? err.message : '解压失败')
  }
}

// 多选压缩：服务端要求同一目录，包名按「名字.zip」或「父目录名-选中.zip」。
async function compressSelection() {
  const paths = [...selectedPaths.value]
  if (!paths.length) return
  try {
    const data = await api.compressSelection(props.ws.id, paths)
    flash(`已生成 ${data.path}`)
    reloadParents(paths)
    clearSelection()
  } catch (err) {
    flash(err && err.message ? err.message : '压缩失败')
  }
}

// 多选下载：单个文件直接下发，其余打成 zip 再下发。
async function downloadSelection() {
  const paths = [...selectedPaths.value]
  if (!paths.length) return
  try {
    api.downloadSelection(props.ws.id, paths)
    flash('已开始下载所选内容')
    clearSelection()
  } catch (err) {
    flash(err && err.message ? err.message : '下载失败')
  }
}

async function copySelection() {
  try {
    await navigator.clipboard.writeText(selectedPaths.value.join('\n'))
    flash(`已复制 ${selectedPaths.value.length} 条路径`)
  } catch (err) {
    flash('复制失败，浏览器不允许写剪贴板')
  }
}

function reloadParents(paths) {
  for (const dir of new Set(paths.map((path) => dirName(path)))) {
    treeRef.value?.reloadDir(dir)
  }
}

// 多选删除：先问清有草稿的页签，删完关掉对应页签并重读各自目录。
const selDel = reactive({ on: false, error: '', busy: false })

async function submitSelectionDelete() {
  if (selDel.busy) return
  selDel.busy = true
  selDel.error = ''
  try {
    const data = await deleteMany([...selectedPaths.value])
    if (data === false) return
    selDel.on = false
    clearSelection()
    if (data.failed && data.failed.length) {
      flash(`已删除 ${data.deleted.length} 项，${data.failed.length} 项失败：${data.failed[0].message}`)
    } else {
      flash(`已删除 ${data.deleted.length} 项`)
    }
  } catch (err) {
    selDel.error = err && err.message ? err.message : '删除失败'
  } finally {
    selDel.busy = false
  }
}

// 属性：文件或目录的基础信息，只有看的份，不改磁盘上的东西。
const { propsAsk, propsRows, openProps } = useBrowseProps({
  wsId: () => props.ws.id,
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
  loadDiff(path)
}

function iconOf(hit) {
  return fileIcon(hit.name)
}

// 外部变化的重读：事件合并、只重读展开的层、打开的文件只打标记，细节在同名组合式函数里。
const diskSync = useBrowseDiskSync({
  refresh: () => props.refresh,
  changedPaths: () => props.changedPaths,
  tabs,
  activeTab,
  editorOf,
  loadFile,
  statFile,
  refreshDiagnostics,
  activate,
  searching,
  treeRef,
})
const { activateTab } = diskSync

// 上传：选文件或拖进来，逐个传，各自显示进度；同名文件逐个问要不要覆盖。
const {
  uploadInput,
  uploads,
  uploadBusy,
  dragOn,
  dropDir,
  uploadAsk,
  pickUpload,
  onUploadPicked,
  onDragOver,
  onDragLeave,
  onDropFiles,
  uploadStateText,
  clearUploads,
  answerUpload,
} = useBrowseUploads({
  wsId: () => props.ws.id,
  activeDir: () => (activeTab.value && activeTab.value.path ? dirName(activeTab.value.path) : ''),
  reload: async (dir) => {
    await treeRef.value?.reloadDir(dir)
    await treeRef.value?.reveal(dir)
  },
})

// 回来时把树摊回原来的层次，读出停着的那一个页签，草稿跟着放回去；其余页签等点开再读。
onMounted(async () => {
  window.addEventListener('keydown', onPanelKey)
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
  window.removeEventListener('keydown', onPanelKey)
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
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.hover-card {
  position: fixed;
  z-index: 30;
  width: 280px;
  max-height: 220px;
  overflow: hidden;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
  pointer-events: none;
}
.hover-row {
  display: flex;
  gap: 8px;
  line-height: 1.5;
}
.hover-key {
  flex: 0 0 56px;
}
.hover-val {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgb(var(--v-theme-on-surface));
}
.panel :deep(.row.drop-target) {
  outline: 2px dashed rgb(var(--v-theme-primary));
  outline-offset: -2px;
  border-radius: 4px;
  background: rgba(var(--v-theme-primary), 0.08);
}
.upload-panel {
  position: absolute;
  right: 16px;
  bottom: 32px;
  z-index: 20;
  width: 280px;
  max-height: 240px;
  overflow-y: auto;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}
.upload-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.upload-close {
  display: flex;
  padding: 2px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  cursor: pointer;
}
.upload-row + .upload-row {
  margin-top: 6px;
}
.upload-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
}
.upload-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.upload-state {
  flex: 0 0 auto;
  color: rgb(var(--v-theme-on-surface-variant));
}
.upload-state.done {
  color: rgb(var(--v-theme-ready));
}
.upload-state.failed {
  color: rgb(var(--v-theme-error));
}
.props-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.props-row {
  display: flex;
  gap: 12px;
  font-size: 0.84rem;
}
.props-key {
  flex: 0 0 72px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.props-val {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-all;
}
.up-conflict {
  margin: 0;
  font-family: var(--bash-font-mono);
  font-size: 0.84rem;
  word-break: break-all;
}
.busy {
  flex: 0 0 auto;
  margin-right: 4px;
}
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
.diff-menu {
  width: 320px;
  padding: 10px;
}
.diff-menu-title {
  margin: 0 0 6px;
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.diff-menu-text {
  max-height: 180px;
  margin: 0;
  overflow: auto;
  white-space: pre;
  font-size: 12px;
  line-height: 1.5;
}
.diff-menu-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
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
  width: 100%;
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
.tab-stale {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
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
.tree-head {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: -2px -4px 6px;
  padding: 4px;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.tree-tools-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
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
