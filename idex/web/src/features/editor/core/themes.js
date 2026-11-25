// 编辑器主题预设：每套同时给出编辑器底色与语法高亮，避免只换背景。

import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { EDITOR_THEME_OPTIONS } from './themeOptions.js'

const CODE_FONT = 'var(--bash-font-mono)'

const PALETTES = {
  'github-light': {
    dark: false,
    bg: '#ffffff',
    fg: '#24292f',
    gutterBg: '#f6f8fa',
    gutterFg: '#57606a',
    border: '#d0d7de',
    selection: '#0969da33',
    activeLine: '#f6f8fa',
    activeGutter: '#eaeef2',
    keyword: '#cf222e',
    string: '#0a3069',
    number: '#0550ae',
    comment: '#6e7781',
    function: '#8250df',
    variable: '#953800',
    type: '#0550ae',
    operator: '#24292f',
    link: '#0969da',
    heading: '#0550ae',
    invalid: '#82071e',
  },
  'github-dark': {
    dark: true,
    bg: '#0d1117',
    fg: '#c9d1d9',
    gutterBg: '#010409',
    gutterFg: '#8b949e',
    border: '#30363d',
    selection: '#3392ff44',
    activeLine: '#161b22',
    activeGutter: '#161b22',
    keyword: '#ff7b72',
    string: '#a5d6ff',
    number: '#79c0ff',
    comment: '#8b949e',
    function: '#d2a8ff',
    variable: '#ffa657',
    type: '#79c0ff',
    operator: '#c9d1d9',
    link: '#58a6ff',
    heading: '#79c0ff',
    invalid: '#f85149',
  },
  'one-dark': {
    dark: true,
    bg: '#282c34',
    fg: '#abb2bf',
    gutterBg: '#282c34',
    gutterFg: '#5c6370',
    border: '#3e4451',
    selection: '#3e4451',
    activeLine: '#2c313c',
    activeGutter: '#2c313c',
    keyword: '#c678dd',
    string: '#98c379',
    number: '#d19a66',
    comment: '#5c6370',
    function: '#61afef',
    variable: '#e06c75',
    type: '#e5c07b',
    operator: '#56b6c2',
    link: '#61afef',
    heading: '#e06c75',
    invalid: '#ffffff',
  },
  dracula: {
    dark: true,
    bg: '#282a36',
    fg: '#f8f8f2',
    gutterBg: '#282a36',
    gutterFg: '#6272a4',
    border: '#44475a',
    selection: '#44475a',
    activeLine: '#44475a',
    activeGutter: '#44475a',
    keyword: '#ff79c6',
    string: '#f1fa8c',
    number: '#bd93f9',
    comment: '#6272a4',
    function: '#50fa7b',
    variable: '#ffb86c',
    type: '#8be9fd',
    operator: '#ff79c6',
    link: '#8be9fd',
    heading: '#bd93f9',
    invalid: '#ff5555',
  },
}

function chrome(palette) {
  return EditorView.theme(
    {
      '&': { height: '100%', color: palette.fg, backgroundColor: palette.bg },
      '.cm-scroller': { fontFamily: CODE_FONT, fontSize: '0.86rem', lineHeight: '1.6' },
      '.cm-content': { caretColor: palette.fg },
      '.cm-gutters': {
        backgroundColor: palette.gutterBg,
        color: palette.gutterFg,
        borderRight: `1px solid ${palette.border}`,
      },
      '.cm-activeLine': { backgroundColor: palette.activeLine },
      '.cm-activeLineGutter': { backgroundColor: palette.activeGutter },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: palette.selection,
      },
      '.cm-tooltip': {
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.bg,
      },
      '.cm-panels': { backgroundColor: palette.gutterBg, color: palette.fg },
      '.cm-searchMatch': { backgroundColor: palette.selection },
      '.cm-button': {
        backgroundImage: 'none',
        backgroundColor: palette.gutterBg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
      },
    },
    { dark: palette.dark },
  )
}

function highlight(palette) {
  return syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: palette.keyword },
      {
        tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName],
        color: palette.fg,
      },
      { tag: [tags.function(tags.variableName), tags.labelName], color: palette.function },
      { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: palette.number },
      { tag: [tags.definition(tags.name), tags.separator], color: palette.fg },
      {
        tag: [
          tags.typeName,
          tags.className,
          tags.number,
          tags.changed,
          tags.annotation,
          tags.modifier,
          tags.self,
          tags.namespace,
        ],
        color: palette.type,
      },
      {
        tag: [
          tags.operator,
          tags.operatorKeyword,
          tags.url,
          tags.escape,
          tags.regexp,
          tags.link,
          tags.special(tags.string),
        ],
        color: palette.operator,
      },
      { tag: [tags.meta, tags.comment], color: palette.comment },
      { tag: tags.strong, fontWeight: 'bold' },
      { tag: tags.emphasis, fontStyle: 'italic' },
      { tag: tags.strikethrough, textDecoration: 'line-through' },
      { tag: tags.link, color: palette.link, textDecoration: 'underline' },
      { tag: tags.heading, fontWeight: 'bold', color: palette.heading },
      { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: palette.number },
      { tag: [tags.processingInstruction, tags.string, tags.inserted], color: palette.string },
      { tag: tags.invalid, color: palette.invalid },
    ]),
  )
}

function paletteTheme(name) {
  const palette = PALETTES[name]
  return [chrome(palette), highlight(palette)]
}

function autoTheme() {
  return [
    EditorView.theme({
      '&': {
        height: '100%',
        color: 'rgb(var(--v-theme-on-surface))',
        backgroundColor: 'rgb(var(--v-theme-surface))',
      },
      '.cm-scroller': { fontFamily: CODE_FONT, fontSize: '0.86rem', lineHeight: '1.6' },
      '.cm-content': { caretColor: 'rgb(var(--v-theme-on-surface))' },
      '.cm-gutters': {
        backgroundColor: 'rgb(var(--v-theme-surface))',
        color: 'rgb(var(--v-theme-on-surface-variant))',
        borderRight: '1px solid rgba(var(--v-theme-on-surface), 0.08)',
      },
      '.cm-activeLine': { backgroundColor: 'rgba(var(--v-theme-primary), 0.1)' },
      '.cm-activeLineGutter': { backgroundColor: 'rgba(var(--v-theme-primary), 0.06)' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: 'rgba(var(--v-theme-primary), 0.28)',
      },
      '.cm-tooltip': {
        border: '1px solid rgba(var(--v-theme-on-surface), 0.12)',
        backgroundColor: 'rgb(var(--v-theme-surface))',
      },
      '.cm-panels': {
        backgroundColor: 'rgb(var(--v-theme-surface-variant))',
        color: 'rgb(var(--v-theme-on-surface))',
      },
      '.cm-searchMatch': { backgroundColor: 'rgba(var(--v-theme-primary), 0.28)' },
      '.cm-button': {
        backgroundImage: 'none',
        backgroundColor: 'rgb(var(--v-theme-surface))',
        color: 'rgb(var(--v-theme-on-surface))',
        border: '1px solid rgba(var(--v-theme-on-surface), 0.12)',
      },
    }),
  ]
}

const BUILDERS = {
  auto: autoTheme,
  'github-light': () => paletteTheme('github-light'),
  'github-dark': () => paletteTheme('github-dark'),
  'one-dark': () => paletteTheme('one-dark'),
  dracula: () => paletteTheme('dracula'),
}

export const EDITOR_THEMES = EDITOR_THEME_OPTIONS.map((item) => ({
  ...item,
  build: BUILDERS[item.id],
}))

export function editorThemeOf(id) {
  return EDITOR_THEMES.find((item) => item.id === id) || EDITOR_THEMES[0]
}

export function editorThemeExtensions(id) {
  return editorThemeOf(id).build()
}
