<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\src\features\editor\components\EditorFindBar.vue
 * @Description: 编辑器里的 Vuetify 查找条：查找、匹配数、上下跳转与替换。
-->
<template>
  <div v-if="controller.find.open" class="find-bar">
    <div class="find-row">
      <v-text-field
        v-model="controller.find.text"
        density="compact"
        variant="outlined"
        hide-details
        autofocus
        placeholder="查找"
        class="find-input"
        @update:model-value="controller.refresh()"
        @keydown.enter.prevent="controller.step(1)"
        @keydown.esc.prevent="controller.close()"
      />
      <span class="find-count" :class="{ bad: controller.find.count === '没找到' }">
        {{ controller.find.count }}
      </span>
      <v-btn icon size="x-small" variant="text" title="上一个" @click="controller.step(-1)">
        <v-icon size="18">mdi-chevron-up</v-icon>
      </v-btn>
      <v-btn icon size="x-small" variant="text" title="下一个" @click="controller.step(1)">
        <v-icon size="18">mdi-chevron-down</v-icon>
      </v-btn>
      <v-btn
        v-if="replaceable"
        icon
        size="x-small"
        variant="text"
        :title="controller.find.showReplace ? '收起替换' : '替换'"
        @click="controller.find.showReplace = !controller.find.showReplace"
      >
        <v-icon size="18">mdi-find-replace</v-icon>
      </v-btn>
      <v-btn icon size="x-small" variant="text" title="关闭（Esc）" @click="controller.close()">
        <v-icon size="18">mdi-close</v-icon>
      </v-btn>
    </div>
    <div v-if="replaceable && controller.find.showReplace" class="find-row">
      <v-text-field
        v-model="controller.find.replace"
        density="compact"
        variant="outlined"
        hide-details
        placeholder="替换为"
        class="find-input"
        @keydown.enter.prevent="controller.replaceOne()"
        @keydown.esc.prevent="controller.close()"
      />
      <v-btn size="small" variant="text" @click="controller.replaceOne()">替换</v-btn>
      <v-btn size="small" variant="text" @click="controller.replaceEvery()">全部替换</v-btn>
    </div>
  </div>
</template>

<script setup>
defineProps({
  controller: { type: Object, required: true },
  replaceable: { type: Boolean, default: true },
})
</script>

<style scoped>
.find-bar {
  position: absolute;
  top: 6px;
  right: 16px;
  z-index: 5;
  width: min(420px, calc(100% - 32px));
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
}
.find-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.find-input {
  flex: 1 1 auto;
  min-width: 0;
}
.find-count {
  flex: 0 0 auto;
  min-width: 44px;
  text-align: right;
  font-size: 0.72rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.find-count.bad {
  color: rgb(var(--v-theme-error));
}
</style>
