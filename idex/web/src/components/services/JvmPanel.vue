<!--
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 00:59:41
 * @FilePath: \idex\web\src\components\services\JvmPanel.vue
 * @Description: JVM 页签：扫描 Maven 或 Gradle 工作区的模块与目标，在同一张表里启动、停止、重启、打包与安装。
-->

<template>
  <div class="panel">
    <header class="head">
      <div class="titles">
        <h2>{{ baseName(root) }}</h2>
        <p class="root" :title="root">{{ root }}</p>
      </div>
      <div v-if="registered" class="actions">
        <v-chip size="small" variant="tonal" :prepend-icon="kind === 'gradle' ? 'mdi-elephant' : 'mdi-language-java'">
          {{ jvmKindLabel(kind) || kind }}
        </v-chip>
        <v-select
          v-if="kind !== 'gradle'"
          :model-value="engineWs.jdk || ''"
          :items="jdkItems"
          item-title="label"
          item-value="path"
          label="JDK"
          density="compact"
          variant="outlined"
          hide-details
          class="jdk"
          :prepend-inner-icon="engineWs.jdk_missing ? 'mdi-alert' : 'mdi-language-java'"
          :title="jdkTitle"
          @update:model-value="pickJdk"
        />
        <v-chip v-if="kind === 'mvn'" size="small" variant="tonal">{{ poms.length }} 个模块</v-chip>
        <v-chip v-else size="small" variant="tonal">{{ services.length }} 个目标</v-chip>
        <v-chip v-if="running" size="small" color="ready" variant="tonal">{{ running }} 个在跑</v-chip>
        <v-btn size="small" variant="text" prepend-icon="mdi-refresh" :loading="scanning" @click="rescan">
          重新扫描
        </v-btn>
      </div>
    </header>

    <EngineRegisterState
      v-if="!registered"
      :loading="loading"
      :error="error"
      :waiting="waiting"
      :enabling="enabling"
      :enable-error="enableError"
      :labels="ENGINE_LABELS"
      @retry="retry"
      @enable="enable"
    />

    <template v-else>
      <div v-if="error" class="banner">
        <v-icon size="18" color="warning">mdi-alert</v-icon>
        <span>{{ error }}</span>
        <v-spacer />
        <v-btn size="small" variant="text" @click="retry">重试</v-btn>
      </div>

      <div v-if="!rows.length" class="none">
        没扫到可执行的模块，或点重新扫描。
      </div>

      <ServiceTable
        v-else
        :rows="rows"
        name-title="模块"
        :focus-id="focus && focus.kind === 'jvm' ? focus.svcId : ''"
        :focus-seq="focus ? focus.seq : 0"
        show-restart
        @start="start"
        @stop="stop"
        @restart="restart"
        @settings="openSettings"
        @log="openLog"
      />
    </template>

    <JvmSettingsDialog
      v-model="settings.on"
      :svc="settings.svc"
      :kind="kind"
      :log-text="logText"
      :log-more="logMore"
      :log-status="logStatus"
      :dark="dark"
      @save="onSave"
      @load-more="loadMoreLog"
    />

    <FloatingDialog
      v-model="custom.on"
      :initial-width="640"
      :initial-height="560"
      :min-width="480"
      :min-height="380"
    >
      <template #title>自定义 JDK</template>
      <!-- 目录树从家目录往下点；家目录之外的 JDK（如 /usr/lib/jvm）直接填在输入框里。 -->
      <DirectoryPicker
        v-model="custom.path"
        tip="点目录树选，或直接填 JDK 根目录；目录下要有 bin/java 与 bin/javac。"
        label="JAVA_HOME"
        placeholder="/opt/jdk-17"
        :loader="jvmApi.dirs"
        :validate="() => true"
      />
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="custom.on = false">取消</v-btn>
        <v-btn color="primary" variant="flat" @click="saveCustom">保存</v-btn>
      </template>
    </FloatingDialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import EngineRegisterState from './EngineRegisterState.vue'
import JvmSettingsDialog from './JvmSettingsDialog.vue'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { DirectoryPicker } from '@bash-scripts/web-shared'
import {
  LIVE_STATUSES,
  ServiceTable,
  runningCount,
  serviceIcon,
  useServiceActions,
} from '@bash-scripts/web-shared'
import { formatAgo as ago } from '@bash-scripts/web-shared/format'
import { baseName } from '../../utils/format'
import { TYPE_TEXT } from '../../utils/jvmFormat'
import { STATUS_COLOR, STATUS_TEXT } from '../../utils/serviceStatus'
import { jvmKindLabel } from '../../utils/workspaceTabs'
import { jvmApi, toolsApi } from '../../utils/toolApi'
import { useToolWorkspace } from '../../composables/useToolWorkspace'
import { useEngineEnable } from '../../composables/useEngineEnable'
import { toast } from '../../utils/notice'

const props = defineProps({
  ws: { type: Object, required: true },
  dark: { type: Boolean, default: false },
  // 顶栏点「正在启动」跳过来时，定位到具体一行。
  focus: { type: Object, default: null },
})

const LIVE = LIVE_STATUSES

const ENGINE_LABELS = {
  engine: 'JVM',
  listHint: '取到引擎状态后就会列出这个工作区的模块与目标。',
  project: 'Maven 或 Gradle 工程',
  scanHint: '启用后会登记并扫描模块。',
  waitHint: '已发出启用，扫描完成后这里会自动列出模块。',
}

// 引擎工作区由 idex 探测结果里的 id 定位，状态走 JVM 引擎自己的推送。
const engineId = computed(() => {
  const tools = props.ws.tools
  const jvm = tools && typeof tools === 'object' ? tools.jvm : null
  return (jvm && jvm.id) || ''
})

const { state: engineState, ws: engineWs, registered, loading, error, refresh, reload } = useToolWorkspace({
  api: jvmApi,
  engineId: () => engineId.value,
  localApi: toolsApi,
  localId: () => props.ws.id,
})

const root = computed(() => {
  if (engineWs.value && engineWs.value.root) return engineWs.value.root
  const jvm = props.ws.tools && props.ws.tools.jvm
  return (jvm && jvm.root) || props.ws.root
})
const kind = computed(() => {
  if (engineWs.value && engineWs.value.kind) return engineWs.value.kind
  const jvm = props.ws.tools && props.ws.tools.jvm
  return (jvm && jvm.kind) || ''
})
const poms = computed(() => (engineWs.value && engineWs.value.poms) || [])
const services = computed(() => (engineWs.value && engineWs.value.services) || [])
const running = computed(() => (engineWs.value ? runningCount(engineWs.value) : 0))

// 引擎登记、扫描等待与重试走共享流程，只有超时文案是本页签自己的。
const { enabling, waiting, enableError, enable, retry } = useEngineEnable({
  toolsApi,
  engineApi: jvmApi,
  wsId: () => props.ws.id,
  registered,
  error,
  reload,
  timeoutText: '扫描超过两分钟还没回来；检查 JVM 引擎后重试。',
  // 扫描失败的具体原因在引擎那边，等待期间轮询，拿到就提前放开。
  rescanStatus: (id) => jvmApi.rescanStatus(id),
})

const scanning = ref(false)
const custom = reactive({ on: false, path: '' })

// JDK 候选随引擎状态推送过来，不再单独请求 jdks：离本机打开页面时那个接口是 403。
const jdks = computed(() => engineState.value.jdks || [])
const currentJdk = computed(() => engineState.value.currentJdk || '')

// 启动、停止与设置弹窗走共享流程，启动载荷带本应用的启动方式与刷新选项。
const {
  starting,
  stopping,
  settings,
  logText,
  logMore,
  logStatus,
  loadMoreLog,
  start,
  stop,
  openSettings,
  openLog,
} = useServiceActions({
  ws: () => engineWs.value,
  api: jvmApi,
  statusText: STATUS_TEXT,
  startPayload: (row) => ({
    svc: row.svc.id,
    mode: row.svc.mode || 'auto',
    refresh: !!row.svc.refresh,
  }),
  onStart: (payload) => startService(payload),
  onStop: (runId) => stopService(runId),
})

const CUSTOM = '__idex_jvm_custom__'

const jdkItems = computed(() => {
  const items = [{ label: '跟随当前环境', path: '' }]
  for (const item of jdks.value) items.push({ label: item.label, path: item.path })
  // 存着但没扫到的路径也要列出来，否则下拉里看不到当前值。
  const cur = (engineWs.value && engineWs.value.jdk) || ''
  if (cur && !jdks.value.some((item) => item.path === cur)) items.push({ label: cur, path: cur })
  items.push({ label: '自定义路径…', path: CUSTOM })
  return items
})

const jdkTitle = computed(() => {
  const cur = engineWs.value ? engineWs.value.jdk : ''
  if (engineWs.value && engineWs.value.jdk_missing) {
    return `选中的 JDK 已不存在，启动时回退到当前环境：${cur}`
  }
  if (cur) return cur
  return currentJdk.value ? `跟随当前环境：${currentJdk.value}` : '跟随启动服务时的环境'
})

async function pickJdk(value) {
  if (value === CUSTOM) {
    custom.path = (engineWs.value && engineWs.value.jdk) || ''
    custom.on = true
    return
  }
  await setJdk(value)
}

async function setJdk(jdk) {
  try {
    await jvmApi.setJdk(props.ws.id, jdk)
    toast(jdk ? 'JDK 已设置，下次启动生效' : '已改为跟随当前环境', 'primary')
    await refresh()
    return true
  } catch (err) {
    toast(`设置 JDK 失败：${err.message}`, 'error')
    return false
  }
}

// 保存失败时留着弹窗，用户填的路径不丢。
async function saveCustom() {
  if (await setJdk(custom.path.trim())) custom.on = false
}

// 引擎扫描失败的原因放在工作区行上，扫不到目标时也至少说明为什么。
watch(
  () => engineWs.value && engineWs.value.scan_error,
  (text) => {
    if (text) toast(text, 'warning')
  },
)

async function rescan() {
  scanning.value = true
  try {
    await jvmApi.rescan(props.ws.id)
    toast('已开始重新扫描', 'primary')
    await refresh()
  } catch (err) {
    toast(`重新扫描失败：${err.message}`, 'error')
  } finally {
    scanning.value = false
  }
}

async function startService(payload) {
  try {
    await jvmApi.start(payload)
    toast('已发出启动', 'primary')
    await refresh()
  } catch (err) {
    toast(`启动失败：${err.message}`, 'error')
  }
}

async function stopService(runId) {
  try {
    await jvmApi.stop(runId)
    toast('已停止', 'primary')
    await refresh()
  } catch (err) {
    toast(`停止失败：${err.message}`, 'error')
  }
}

// 重启按钮的短暂忙碌态；真正的停止与重新启动在引擎里完成，状态由推送补上。
const restarting = ref({})

async function restart(row) {
  restarting.value[row.svc.id] = true
  try {
    await jvmApi.restart(row.run.id)
    toast('已发出重启', 'primary')
    await refresh()
  } catch (err) {
    toast(`重启失败：${err.message}`, 'error')
  } finally {
    setTimeout(() => {
      delete restarting.value[row.svc.id]
    }, 3000)
  }
}

// 一张表列出所有动作：启动、打包、安装混在一起，靠类型标签区分。
const rows = computed(() => {
  return services.value
    .map((svc) => {
      const run = svc.run
      const live = !!run && LIVE.includes(run.status)
      // 同一模块上的另一个动作在跑时不能起：打包与启动抢同一个 target；同工作区的别的模块不受影响。
      const blocked = services.value.some(
        (o) => o !== svc && o.run && LIVE.includes(o.run.status) && o.tag === svc.tag,
      )
      return {
        key: svc.id,
        svc,
        run,
        title: svc.tag,
        path: svc.display,
        cmd: svc.cmd,
        typeText: TYPE_TEXT[svc.type] || '',
        action: TYPE_TEXT[svc.type] || '执行',
        live,
        blocked,
        statusText: run ? STATUS_TEXT[run.status] || run.status : '',
        color: run ? STATUS_COLOR[run.status] || 'grey' : 'grey',
        icon: run ? serviceIcon(run.status) : 'mdi-circle-outline',
        err: run && run.err,
        port: run && run.port,
        started: run && run.started,
        ago: run ? ago(run.started) : '',
        stopping: !!stopping.value[svc.id],
        starting: !!starting.value[svc.id],
        restarting: !!restarting.value[svc.id],
      }
    })
})

// 弹窗给的是整份参数，模块与启动方式一起存回这一行。
async function onSave({ args, mode, refresh: refreshDeps }) {
  if (!settings.svc) return
  try {
    await jvmApi.update({
      svc: settings.svc.id,
      args,
      mode,
      refresh: refreshDeps,
    })
    toast('参数已保存', 'primary')
    await refresh()
  } catch (err) {
    toast(`保存参数失败：${err.message}`, 'error')
  }
}

// 换工作区时收起自定义 JDK 弹窗；启用请求与等待由共享流程按工作区作废。
watch(
  () => props.ws.id,
  () => {
    custom.on = false
  },
)

</script>

<style scoped>
/* 面板占满右侧剩下的高度：标题与栏目固定，表格自己滚。 */
.panel {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px;
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.titles h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}
.root {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-variant));
  word-break: break-all;
}
.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.jdk {
  max-width: 240px;
  min-width: 170px;
}
.table {
  flex: 1 1 auto;
  margin-top: 10px;
  min-height: 0;
  background: rgb(var(--v-theme-surface));
  border-radius: 10px;
}
.svc-name {
  font-weight: 500;
}
.svc-path {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 0.82rem;
  background: rgba(var(--v-theme-warning), 0.12);
}
.none {
  padding: 28px 8px;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
