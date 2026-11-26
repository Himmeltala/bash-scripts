<!--
 * @Author: Himmeltala
 * @Date: 2026-11-26 16:35:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 16:35:00
 * @FilePath: \idex\web\src\features\settings\components\sections\AnimationSettings.vue
 * @Description: 动画设置：一套全局方案加一个速度倍率，作用于面板、对话框与提示条。
-->
<template>
  <SettingsItem label="动画方案" hint="面板、对话框、提示条与右键菜单都按这一套走。">
    <v-select
      v-model="form.preset"
      :items="PRESET_ITEMS"
      item-title="title"
      item-value="value"
      density="compact"
      variant="outlined"
      hide-details
      class="pick"
    />
  </SettingsItem>
  <SettingsItem label="速度" hint="0.5 慢一半，2 快一倍。">
    <v-text-field
      v-model.number="form.speed"
      type="number"
      step="0.1"
      min="0.5"
      max="2"
      density="compact"
      variant="outlined"
      hide-details
      class="pick"
    />
  </SettingsItem>
  <SettingsItem label="预览" hint="点一下按当前方案动一次。">
    <div class="preview">
      <span class="dot" :class="{ moved: moved }" style="transition: transform var(--bash-anim-dur) var(--bash-anim-ease)" />
      <v-btn size="small" variant="text" @click="play">播放</v-btn>
    </div>
  </SettingsItem>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ANIMATION_DEFAULTS, ANIMATION_PRESETS } from '@bash-scripts/web-shared'
import { usePreferencesStore } from '../../../../stores/preferences'
import { api } from '../../../../utils/api'
import { toast } from '../../../../utils/notice'
import SettingsItem from '../SettingsItem.vue'

const PRESET_ITEMS = ANIMATION_PRESETS.map((item) => ({ title: item.title, value: item.id }))

const preferences = usePreferencesStore()
const form = reactive({ ...ANIMATION_DEFAULTS })
const defaults = ref({ ...ANIMATION_DEFAULTS })
const moved = ref(false)

// 改一项就先预览：写进偏好，根节点的动画变量马上跟着换。
watch(form, () => {
  preferences.animation = { ...form }
})

function play() {
  moved.value = !moved.value
}

async function load() {
  const data = await api.settings()
  defaults.value = data.defaults?.animation || defaults.value
  Object.assign(form, defaults.value, data.animation || {})
  preferences.animation = { ...form }
}

function reset() {
  Object.assign(form, defaults.value)
}

async function save() {
  try {
    await api.saveSettings({ animation: { ...form } })
    preferences.animation = { ...form }
    return true
  } catch (err) {
    toast(`保存动画设置失败：${err.message}`, 'error')
    return false
  }
}

onMounted(load)

defineExpose({ save, reset })
</script>

<style scoped>
.pick {
  max-width: 220px;
}
.preview {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
}
.dot.moved {
  transform: translateX(120px);
}
</style>
