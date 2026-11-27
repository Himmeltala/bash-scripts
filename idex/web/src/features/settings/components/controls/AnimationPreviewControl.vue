<!--
 * @Author: Himmeltala
 * @Date: 2026-11-28 11:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 11:40:00
 * @FilePath: \idex\web\src\features\settings\components\controls\AnimationPreviewControl.vue
 * @Description: 动画方案控件：下拉选预设，旁边一个按当前时长与缓动走一遍的小圆点。
-->
<template>
  <div class="anim">
    <v-select
      v-model="preset"
      :items="item.choices"
      item-title="title"
      item-value="value"
      density="compact"
      variant="outlined"
      hide-details
      class="pick"
    />
    <div class="preview">
      <span class="dot" :class="{ moved }" />
      <v-btn size="small" variant="text" @click="moved = !moved">播放</v-btn>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useSettingsStore } from '../../../../stores/settings'

const props = defineProps({
  item: { type: Object, required: true },
})

const settings = useSettingsStore()
const moved = ref(false)

// 选中的方案直接写进草稿，根节点变量与这里的小圆点同时跟着变。
const preset = computed({
  get: () => settings.get(props.item.key),
  set: (value) => settings.set(props.item.key, value),
})
</script>

<style scoped>
.anim {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}
.pick {
  width: 220px;
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
  transition: transform var(--bash-anim-dur) var(--bash-anim-ease);
}
.dot.moved {
  transform: translateX(120px);
}
</style>
