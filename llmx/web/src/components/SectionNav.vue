<template>
  <v-btn-toggle
    :model-value="modelValue"
    mandatory
    divided
    density="compact"
    variant="text"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-btn
      v-for="item in items"
      :key="item.key"
      :value="item.key"
      :prepend-icon="item.icon"
      size="small"
    >
      {{ item.title }}
    </v-btn>
  </v-btn-toggle>
</template>

<script setup>
defineProps({
  // [{ key, title, icon }]，切换条只负责导航，不认具体页面。
  items: { type: Array, required: true },
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])
</script>
