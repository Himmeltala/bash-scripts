/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 16:30:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 16:30:00
 * @FilePath: \\src\\components\\browse\\useBrowseUploads.js
 * @Description: 浏览页的上传：选文件与拖拽的落点、逐个上传的进度、同名文件的覆盖询问。
 */
import { reactive, ref } from 'vue'
import { uploadFile } from '../../utils/api.js'
import { dirName } from '../../utils/format.js'

export function useBrowseUploads({ wsId, activeDir, reload }) {
  const uploadInput = ref(null)
  const uploads = ref([])
  const uploadBusy = ref(false)
  const dragOn = ref(false)
  // 当前拖拽落点目录，目录树据此给目标行描虚线。
  const dropDir = ref('')
  const uploadAsk = reactive({ on: false, name: '' })
  let uploadSeq = 0
  let uploadAnswer = null
  let uploadHideTimer = 0
  let uploadTarget = null

  // 工具栏按钮不指定目录时，落到当前打开文件所在的那一层。
  function pickUpload(dir) {
    uploadTarget = typeof dir === 'string' ? dir : null
    uploadInput.value?.click()
  }

  function onUploadPicked(event) {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    const dir = uploadTarget === null ? activeDir() : uploadTarget
    uploadTarget = null
    startUpload(files, dir)
  }

  // 拖到目录行就传进那个目录，拖到文件行传进它所在目录，空白处传进当前文件所在目录。
  function dropTargetDir(event) {
    const row = event.target instanceof Element ? event.target.closest('.row[data-path]') : null
    if (!row) return activeDir()
    const path = row.dataset.path || ''
    if (!path) return ''
    return row.dataset.type === 'dir' ? path : dirName(path)
  }

  function onDragOver(event) {
    if (![...(event.dataTransfer?.types || [])].includes('Files')) return
    event.preventDefault()
    dragOn.value = true
    dropDir.value = dropTargetDir(event)
  }

  function onDragLeave(event) {
    if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return
    dragOn.value = false
    dropDir.value = ''
  }

  function onDropFiles(event) {
    if (!event.dataTransfer) return
    const files = [...event.dataTransfer.files]
    dragOn.value = false
    dropDir.value = ''
    if (!files.length) return
    event.preventDefault()
    startUpload(files, dropTargetDir(event))
  }

  function uploadStateText(item) {
    if (item.state === 'uploading') return `${item.percent}%`
    if (item.state === 'done') return '完成'
    if (item.state === 'skipped') return '跳过'
    return '失败'
  }

  function clearUploads() {
    clearTimeout(uploadHideTimer)
    uploads.value = []
  }

  function askUpload(name) {
    uploadAsk.name = name
    uploadAsk.on = true
    return new Promise((resolve) => {
      uploadAnswer = resolve
    })
  }

  function answerUpload(kind) {
    uploadAsk.on = false
    if (!uploadAnswer) return
    const resolve = uploadAnswer
    uploadAnswer = null
    resolve(kind)
  }

  async function startUpload(files, dir) {
    if (!files.length) return
    clearTimeout(uploadHideTimer)
    uploadBusy.value = true
    let cancelled = false
    for (const file of files) {
      if (cancelled) break
      const item = reactive({
        id: ++uploadSeq,
        name: file.name,
        state: 'uploading',
        percent: 0,
        error: '',
      })
      uploads.value.push(item)
      let overwrite = false
      while (true) {
        try {
          await uploadFile(wsId(), dir, file, {
            overwrite,
            onProgress: (loaded, total) => {
              item.percent = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0
            },
          })
          item.state = 'done'
          item.percent = 100
          break
        } catch (err) {
          if (err.status === 409 && !overwrite) {
            const answer = await askUpload(file.name)
            if (answer === 'overwrite') {
              overwrite = true
              continue
            }
            if (answer === 'skip') {
              item.state = 'skipped'
              break
            }
            cancelled = true
            item.state = 'skipped'
            break
          }
          item.state = 'failed'
          item.error = err.message
          break
        }
      }
    }
    uploadBusy.value = false
    await reload(dir)
    // 没有失败就过几秒自己收起来；有失败留给人看一眼。
    if (!uploads.value.some((item) => item.state === 'failed')) {
      uploadHideTimer = setTimeout(() => {
        uploads.value = []
      }, 4000)
    }
  }

  return {
    uploadInput,
    uploads,
    uploadBusy,
    dragOn,
    dropDir,
    uploadAsk,
    pickUpload,
    onUploadPicked,
    onDragOver,
    onDragLeave,
    onDropFiles,
    uploadStateText,
    clearUploads,
    answerUpload,
  }
}
