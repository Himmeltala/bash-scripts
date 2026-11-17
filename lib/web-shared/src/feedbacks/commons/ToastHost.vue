<!--
 * @Author: Himmeltala
 * @Date: 2026-11-17 00:15:49
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-17 23:30:14
 * @FilePath: \lib\web-shared\src\feedbacks\commons\ToastHost.vue
 * @Description: 页面级提示条，用一条 snackbar 显示反馈信息。
-->
<template>
  <v-snackbar
    :model-value="modelValue"
    :color="color"
    :timeout="timeout"
    location="bottom right"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    {{ text }}
  </v-snackbar>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  text: { type: String, default: '' },
  color: { type: String, default: 'grey' },
  timeout: { type: [Number, String], default: 4000 },
})

defineEmits(['update:modelValue'])
</script>
