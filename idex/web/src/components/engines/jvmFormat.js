/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 21:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \idex\web\src\components\engines\jvmFormat.js
 * @Description: JVM 页签与参数弹窗共用的动作、状态与启动方式词汇。
 */

// 打包与安装跑完就结束，运行记录留在列表里，点开日志能看到结果。
export const TYPE_TEXT = {
  run: '启动',
  war: '启动',
  package: '打包',
  install: '安装',
  build: '构建',
}
// 类型列的颜色：启动蓝、打包/构建橙、安装绿。
export const TYPE_COLOR = {
  run: 'primary',
  war: 'primary',
  package: 'warning',
  build: 'warning',
  install: 'success',
}

export const MODE_ITEMS = [
  { value: 'auto', title: '自动判编译', hint: '源码、生成源与构建入口都没更新就跳过编译' },
  { value: 'compile', title: '正常编译', hint: '不追加跳过参数，是否重编由 Maven 自己判断' },
  { value: 'no-compile', title: '跳过编译', hint: '直接用已有的 class 跑，没有 class 会拒绝' },
  { value: 'rebuild', title: '先 clean', hint: '先清理再执行，等于 mvn clean <目标>' },
]

// Gradle 没有 Maven 的编译判定，只提供直接跑与先 clean 两档。
export const GRADLE_MODE_ITEMS = [
  { value: 'auto', title: '直接执行', hint: '按 Gradle 自己的增量规则跑' },
  { value: 'rebuild', title: '先 clean', hint: '先清理再执行，改动大时用' },
]

// 模块清单用扫描给出的 pom 路径：去掉开头的 ./ 之后与 mvn -pl 写法一致。
export function moduleOf(rel) {
  return String(rel || '').replace(/^(\.\/)+/, '')
}
