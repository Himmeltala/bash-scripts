import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'

// 记在浏览器里的单选值：只认 allowed 里的，存着别的就回到 fallback。
export function useStoredChoice(key, allowed, fallback) {
  const saved = useLocalStorage(key, fallback, { writeDefaults: false })
  return computed({
    get: () => (allowed.includes(saved.value) ? saved.value : fallback),
    set: (value) => {
      saved.value = value
    },
  })
}
