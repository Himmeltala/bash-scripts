<!--
 * @Author: Himmeltala
 * @Date: 2026-11-28 10:31:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 10:31:00
 * @FilePath: \idex\web\src\features\settings\components\SettingControl.vue
 * @Description: 按登记表的类型渲染控件；值直接读写设置 store 的草稿，不自己存取。
-->
<template>
  <ShortcutsControl v-if="item.renderer === 'shortcuts'" :item="item" />
  <AnimationPreviewControl v-else-if="item.renderer === 'animation-preview'" :item="item" />
  <v-textarea
    v-else-if="item.type === 'dir_list'"
    :model-value="lines"
    rows="4"
    auto-grow
    density="compact"
    variant="outlined"
    hide-details
    spellcheck="false"
    class="wide"
    @update:model-value="setLines"
  />
  <v-switch
    v-else-if="item.type === 'bool'"
    v-model="value"
    color="primary"
    density="compact"
    hide-details
    inset
  />
  <v-select
    v-else-if="item.type === 'enum'"
    v-model="value"
    :items="item.choices"
    item-title="title"
    item-value="value"
    density="compact"
    variant="outlined"
    hide-details
    class="pick"
  />
  <v-text-field
    v-else-if="item.type === 'int' || item.type === 'float'"
    v-model.number="value"
    type="number"
    :min="item.minimum"
    :max="item.maximum"
    :step="item.step || (item.type === 'int' ? 1 : 'any')"
    density="compact"
    variant="outlined"
    hide-details
    class="pick"
  />
  <v-text-field
    v-else
    v-model="value"
    density="compact"
    variant="outlined"
    hide-details
    class="font"
    spellcheck="false"
  />
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useSettingsStore } from '../../../stores/settings'
import ShortcutsControl from './controls/ShortcutsControl.vue'
import AnimationPreviewControl from './controls/AnimationPreviewControl.vue'

const props = defineProps({
  item: { type: Object, required: true },
})

const settings = useSettingsStore()

// 基础控件双向绑到草稿；数字清空时退回已保存值，避免发 null。
const value = computed({
  get: () => settings.get(props.item.key),
  set: (next) => {
    if (next === '' || next === null || Number.isNaN(Number(next))) {
      if (props.item.type === 'int' || props.item.type === 'float') {
        settings.reset(props.item.key)
        return
      }
    }
    settings.set(props.item.key, next)
  },
})

// 目录名单在界面上是多行文本，存的是字符串数组。
const lines = ref(toText(settings.get(props.item.key)))
watch(
  () => settings.get(props.item.key),
  (next) => {
    const text = toText(next)
    if (text !== lines.value) lines.value = text
  },
)

function toText(value) {
  return Array.isArray(value) ? value.join('\n') : ''
}

function setLines(text) {
  lines.value = text
  settings.set(
    props.item.key,
    String(text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  )
}
</script>

<style scoped>
.pick {
  width: 220px;
}
.wide {
  width: 100%;
}
.font {
  width: 360px;
  max-width: 46vw;
}
</style>
