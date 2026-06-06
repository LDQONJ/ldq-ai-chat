<template>
  <router-view v-slot="{ Component, route: currentRoute }">
    <transition :name="transitionName">
      <keep-alive :include="['Home']">
        <component
          :is="Component"
          :key="currentRoute.name === 'Home' ? 'Home' : currentRoute.path"
          class="page-view"
        />
      </keep-alive>
    </transition>
  </router-view>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { updateApi } from '@/api/update'
import { ElMessageBox } from 'element-plus'
import { useChatStore } from '@/store/chat'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const transitionName = ref('')

const checkUpdate = async () => {
  // 仅在原生 Android 平台执行
  if (Capacitor.getPlatform() !== 'android') return

  try {
    const info = await CapApp.getInfo()

    const res = await updateApi.checkUpdate({
      versionName: 'v' + info.version,
    })

    // 如果返回 "yes"，说明有新版本
    if (res === 'yes') {
      ElMessageBox.confirm('发现新版本应用，是否立即下载更新？', '检查更新', {
        confirmButtonText: '立即下载',
        cancelButtonText: '稍后再说',
        type: 'info',
      })
        .then(async () => {
          const baseUrl = import.meta.env.VITE_API_HOST || ''
          const downloadUrl = `${baseUrl}/updates/latestRelease`

          // 使用系统浏览器打开下载链接
          await Browser.open({ url: downloadUrl })
        })
        .catch(() => {
          // 用户取消更新
        })
    }
  } catch (error) {
    console.error('[更新检查失败]', error)
  }
}

// 监听安卓系统返回键
let backButtonListener = null
const setupBackButton = () => {
  if (Capacitor.getPlatform() !== 'android') return

  backButtonListener = CapApp.addListener('backButton', ({ canGoBack }) => {
    // 1. 如果侧边栏展开（仅限移动端），则收起
    if (window.innerWidth < 768 && chatStore.sidebarVisible) {
      chatStore.setSidebarVisible(false)
      return
    }

    // 2. 如果在设置页，则返回主页
    if (route.path === '/settings') {
      router.push('/home')
      return
    }

    // 3. 其他情况：如果有历史记录则返回，否则退出应用
    if (canGoBack) {
      window.history.back()
    } else {
      CapApp.exitApp()
    }
  })
}

onMounted(() => {
  checkUpdate()
  setupBackButton()
})

onUnmounted(() => {
  if (backButtonListener) {
    backButtonListener.remove()
  }
})

watch(
  () => route.path,
  (to, from) => {
    if (to === '/settings' && from === '/home') {
      transitionName.value = 'slide-left'
    } else if (to === '/home' && from === '/settings') {
      transitionName.value = 'slide-right'
    } else {
      transitionName.value = ''
    }
  },
)
</script>

<style>
#app {
  height: 100%;
  overflow: hidden;
  position: relative;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.page-view {
  width: 100%;
  height: 100%;
}

.slide-left-enter-active,
.slide-right-enter-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  will-change: transform;
}

.slide-left-leave-active,
.slide-right-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
  will-change: transform;
}

/* 返回主页时让设置页处于上层，才能看到“右滑缩回” */
.slide-right-enter-active {
  z-index: 1;
}

.slide-right-leave-active {
  z-index: 2;
}

.slide-left-enter-from {
  transform: translateX(100%);
}
.slide-left-enter-to {
  transform: translateX(0);
}
.slide-left-leave-from {
  transform: translateX(0);
}
.slide-left-leave-to {
  transform: translateX(0);
}

.slide-right-enter-from {
  transform: translateX(-100%);
}
.slide-right-enter-to {
  transform: translateX(0);
}
.slide-right-leave-from {
  transform: translateX(0);
}
.slide-right-leave-to {
  transform: translateX(100%);
}
</style>
