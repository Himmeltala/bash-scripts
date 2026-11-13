<script setup>
import { computed } from 'vue'
import { BRANDS } from '../composables/brandIcons'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 16 },
})

const brand = computed(() => BRANDS[props.name] || null)
</script>

<template>
  <svg
    v-if="brand"
    class="brand-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    role="img"
    :aria-label="brand.title"
  >
    <path :d="brand.path" :fill="brand.hex || 'currentColor'" />
  </svg>
</template>

<style scoped>
.brand-icon {
  display: block;
  flex: 0 0 auto;
}
</style>
