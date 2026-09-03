import { defineStore } from 'pinia'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'
import githubLightUrl from 'highlight.js/styles/github.css?url'
import githubDarkUrl from 'highlight.js/styles/github-dark.css?url'

const STORAGE_KEY = 'theme'
const HLJS_LINK_ID = 'hljs-theme'

function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function ensureStylesheetLink(id) {
  const existing = document.getElementById(id)
  if (existing && existing.tagName === 'LINK') return existing
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  document.head.appendChild(link)
  return link
}

function setMetaThemeColor(color) {
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', color)
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: 'system',
    systemTheme: 'dark',
  }),
  getters: {
    theme(state) {
      return state.mode === 'system' ? state.systemTheme : state.mode
    },
  },
  actions: {
    init() {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        this.mode = saved
      } else {
        this.mode = 'system'
      }

      this.systemTheme = getSystemTheme()
      
      // 初始化状态栏为沉浸式（仅在原生平台）
      if (Capacitor.isNativePlatform()) {
        StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
        // 确保 Android 状态栏背景彻底透明，不带任何系统遮罩
        StatusBar.setBackgroundColor({ color: '#00000000' }).catch(() => {})
      }

      this.apply()

      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => {
        this.systemTheme = getSystemTheme()
        if (this.mode === 'system') {
          this.apply()
        }
      }
      if (media.addEventListener) {
        media.addEventListener('change', onChange)
      } else if (media.addListener) {
        media.addListener(onChange)
      }
    },

    setMode(mode) {
      this.mode =
        mode === 'dark' || mode === 'light' || mode === 'system'
          ? mode
          : 'system'
      localStorage.setItem(STORAGE_KEY, this.mode)
      this.apply()
    },

    toggle(event, buttonEl) {
      const isAppearanceTransition = !!document.startViewTransition

      if (!isAppearanceTransition) {
        const next = this.theme === 'dark' ? 'light' : 'dark'
        this.setMode(next)
        return
      }

      // 始终精准锚定在主题切换按钮的几何中心
      const targetEl =
        buttonEl || (event && event.currentTarget) || document.querySelector('.theme-toggle')
      let x = window.innerWidth - 35
      let y = 35
      if (targetEl && targetEl.getBoundingClientRect) {
        const rect = targetEl.getBoundingClientRect()
        x = rect.left + rect.width / 2
        y = rect.top + rect.height / 2
      } else if (event && typeof event.clientX === 'number' && event.clientX > 0) {
        x = event.clientX
        y = event.clientY
      }

      // 将坐标转换为视口百分比（Percentage），彻底免疫 Windows 系统 DPI 缩放（125%、150% 等）与物理/逻辑像素脱节导致的圆心漂移
      const xPercent = Number(((x / window.innerWidth) * 100).toFixed(3))
      const yPercent = Number(((y / window.innerHeight) * 100).toFixed(3))

      // 计算从圆心到视口四个角的最大物理跨度，并乘以安全倍率，确保完全覆盖屏幕死角，绝无停顿与残缺
      const dpr = window.devicePixelRatio || 1
      const vw = Math.max(window.innerWidth * dpr, window.innerWidth)
      const vh = Math.max(window.innerHeight * dpr, window.innerHeight)
      const physicalX = (xPercent / 100) * vw
      const physicalY = (yPercent / 100) * vh

      const maxDist = Math.hypot(
        Math.max(physicalX, vw - physicalX),
        Math.max(physicalY, vh - physicalY),
      )
      const endRadius = Math.ceil(maxDist * 1.15) // 留出 15% 裕量，确保圆弧高速扫出屏幕外，绝不停留

      // 动态注入包含百分比圆心与绝对全覆盖半径的 @keyframes
      const styleId = 'theme-vt-keyframes'
      let styleEl = document.getElementById(styleId)
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = styleId
        document.head.appendChild(styleEl)
      }
      styleEl.textContent = `
        @keyframes vt-expand {
          0% {
            clip-path: circle(0px at ${xPercent}% ${yPercent}%);
          }
          100% {
            clip-path: circle(${endRadius}px at ${xPercent}% ${yPercent}%);
          }
        }
        @keyframes vt-shrink {
          0% {
            clip-path: circle(${endRadius}px at ${xPercent}% ${yPercent}%);
          }
          100% {
            clip-path: circle(0px at ${xPercent}% ${yPercent}%);
          }
        }
      `

      const next = this.theme === 'dark' ? 'light' : 'dark'
      document.startViewTransition(() => {
        this.setMode(next)
      })
    },

    apply() {
      const t = this.theme
      document.documentElement.setAttribute('data-theme', t)

      // 同步 Element Plus 的深色模式
      if (t === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }

      const hljsLink = ensureStylesheetLink(HLJS_LINK_ID)
      hljsLink.href = t === 'dark' ? githubDarkUrl : githubLightUrl

      setMetaThemeColor(t === 'dark' ? '#0f172a' : '#ffffff')

      // 同步原生状态栏样式
      if (Capacitor.isNativePlatform()) {
        StatusBar.setStyle({
          style: t === 'dark' ? Style.Dark : Style.Light,
        }).catch(() => {})
      }
    },
  },
})
