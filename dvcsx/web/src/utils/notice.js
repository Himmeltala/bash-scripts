// 全页提示条：页面与各面板共用 App 里那一条 snackbar，反馈不自己搭元素。
import { useToast } from '@bash-scripts/web-shared/feedbacks'

export const { snack, toast, close } = useToast()
