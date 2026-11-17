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
