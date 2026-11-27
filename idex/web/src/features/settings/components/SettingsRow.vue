<!--
 * @Author: Himmeltala
 * @Date: 2026-11-28 10:33:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 10:33:00
 * @FilePath: \idex\web\src\features\settings\components\SettingsRow.vue
 * @Description: 设置列表的一行：标题、说明、控件与已修改标记，单项撤销与恢复默认。
-->
<template>
  <div class="row" :class="{ dirty, stacked: stacked }">
    <div class="text">
      <div class="label">
        {{ item.label }}
        <v-chip v-if="advanced" size="x-small" variant="tonal" color="warning" class="tag">
          高级
        </v-chip>
      </div>
      <p v-if="item.description" class="desc">{{ item.description }}</p>
    </div>
    <div class="control" :class="{ full: stacked }">
      <SettingControl :item="item" />
    </div>
    <div class="mark">
      <v-btn
        v-if="dirty"
        icon="mdi-undo"
        size="x-small"
        variant="text"
        title="撤销这一项的修改"
        @click="settings.reset(item.key)"
      />
      <v-btn
        v-else-if="!atDefault"
        icon="mdi-restore"
        size="x-small"
        variant="text"
        title="恢复默认值（保存后生效）"
        @click="settings.resetToDefault(item.key)"
      />
      <span v-if="dirty" class="dot" title="已修改，未保存" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSettingsStore } from '../../../stores/settings'
import SettingControl from './SettingControl.vue'

const props = defineProps({
  item: { type: Object, required: true },
})

const settings = useSettingsStore()
const dirty = computed(() => settings.isDirty(props.item.key))
const atDefault = computed(
  () => JSON.stringify(settings.get(props.item.key)) === JSON.stringify(props.item.default),
)
const advanced = computed(() => (props.item.tags || []).includes('advanced'))
// 快捷键、多行名单与预览这类需要横向空间的控件占整行，标题放在上方；其余保持一行。
const stacked = computed(
  () =>
    props.item.renderer === 'shortcuts'
    || props.item.renderer === 'animation-preview'
    || props.item.type === 'dir_list',
)
</script>

<style scoped>
.row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 4px 10px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-left: 3px solid transparent;
}
.row:last-child {
  border-bottom: 0;
}
.row.dirty {
  border-left-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.05);
}
.row.stacked {
  flex-wrap: wrap;
}
.text {
  flex: 1 1 auto;
  min-width: 0;
}
.label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.84rem;
  font-weight: 500;
}
.tag {
  height: 18px;
}
.desc {
  margin: 3px 0 0;
  font-size: 0.76rem;
  line-height: 1.4;
  color: rgb(var(--v-theme-on-surface-variant));
}
.control {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  min-width: 0;
}
.control.full {
  order: 3;
  flex: 1 1 100%;
  padding-right: 8px;
}
.mark {
  position: relative;
  flex: 0 0 auto;
  width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 2px;
}
.dot {
  position: absolute;
  top: 0;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
}
</style>
