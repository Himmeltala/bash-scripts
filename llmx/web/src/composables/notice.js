// 全局提示条：页面与弹窗共用一条 v-snackbar，反馈不再用占位的 v-alert。
import { useToast } from '@bash-scripts/web-shared/ui'

export const { snack, toast, close } = useToast()
