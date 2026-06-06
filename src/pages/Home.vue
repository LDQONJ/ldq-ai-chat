<!-- 首页 -->

<template>
  <div
    class="app"
    :class="{ 'sidebar-hidden': !store.sidebarVisible, 'is-mobile': isMobile }"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
  >
    <div class="top-mask" />
    <div
      v-if="messages.length > 0"
      class="top-title-container"
    >
      <div class="top-title">
        {{ currentChatTitle }}
      </div>
    </div>
    <div
      v-if="!store.sidebarVisible"
      class="top-left-actions"
    >
      <button
        class="action-btn"
        title="展开侧边栏"
        @click="toggleSidebar"
      >
        <Icon
          :icon-class="'icon-sidebar'"
          :font-size="16"
        />
      </button>
      <span class="action-divider" />
      <button
        class="action-btn"
        title="新对话"
        @click="createChatFromCollapsed"
      >
        <Icon
          :icon-class="'icon-chat_add'"
          :font-size="16"
        />
      </button>
    </div>
    <!-- 主题切换和设置 -->
    <div class="top-right-actions">
      <ThemeToggle />
      <template v-if="!store.sidebarVisible">
        <span class="action-divider" />
        <button
          class="action-btn"
          title="设置"
          @click="goToSettings"
        >
          <Icon
            :icon-class="'icon-settings'"
            :font-size="16"
          />
        </button>
      </template>
    </div>
    <!-- 移动端侧边栏展开时的遮罩 -->
    <div
      v-if="isMobile && store.sidebarVisible"
      class="sidebar-overlay"
      @click="store.setSidebarVisible(false)"
    />
    <Sidebar />
    <div
      ref="mainRef"
      class="main"
      @scroll="handleScroll"
    >
      <ChatWindow />
    </div>
    <div
      ref="inputContainerRef"
      class="input-container"
    >
      <InputBox />
    </div>
    <div class="footer-container">
      <div
        ref="footerRef"
        class="footer"
      >
        <span>内容由 AI 生成，请仔细甄别</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  watch,
  nextTick,
  computed,
  onMounted,
  onUnmounted,
  onActivated,
  onDeactivated,
} from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/store/chat'
import { useUserStore } from '@/store/user'
import { userApi } from '@/api/user'
import { sessionApi } from '@/api/session'
import Sidebar from '@/components/Sidebar.vue'
import ChatWindow from '@/components/ChatWindow.vue'
import InputBox from '@/components/InputBox.vue'
import Icon from '@/components/common/Icon.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

defineOptions({
  name: 'Home',
})

const store = useChatStore()
const userStore = useUserStore()
const router = useRouter()
const messages = computed(() => store.messages)
const currentChatTitle = computed(() => {
  const chat = store.chatList.find(c => c.id === store.activeId)
  return chat ? chat.title : '新对话'
})
const mainRef = ref()
const inputContainerRef = ref()
const footerRef = ref()
const isAtBottom = ref(true)
const isMobile = ref(false)
const touchStartX = ref(0)
const touchStartY = ref(0)
const shouldIgnoreGesture = ref(false)
const savedMainScrollTop = ref(0)

const handleTouchStart = e => {
  if (!isMobile.value) return

  // 检查是否在代码区域或表格区域滑动
  const target = e.target
  const isCodeOrTable = !!target.closest('pre, code, table, .code-wrapper')

  if (isCodeOrTable) {
    shouldIgnoreGesture.value = true
    return
  }

  shouldIgnoreGesture.value = false
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
}

const handleTouchEnd = e => {
  if (!isMobile.value || shouldIgnoreGesture.value) return

  const touchEndX = e.changedTouches[0].clientX
  const touchEndY = e.changedTouches[0].clientY

  const deltaX = touchEndX - touchStartX.value
  const deltaY = Math.abs(touchEndY - touchStartY.value)

  // 确保是水平滑动（垂直位移小于 300px）
  if (deltaY < 300) {
    if (!store.sidebarVisible) {
      if (deltaX > 100) {
        // 右滑打开侧边栏
        store.setSidebarVisible(true)
      } else if (deltaX < -100) {
        // 左滑进入设置
        goToSettings()
      }
    } else if (store.sidebarVisible && deltaX < -100) {
      // 侧边栏展开时左滑收回
      store.setSidebarVisible(false)
    }
  }
}

const goToSettings = () => {
  if (mainRef.value) {
    savedMainScrollTop.value = mainRef.value.scrollTop
  }
  router.push('/settings')
}

// 页面加载时刷新用户信息
const refreshUserInfo = async () => {
  const token = localStorage.getItem('token')
  if (token) {
    try {
      const userInfo = await userApi.me()
      if (userInfo) {
        userStore.setUserInfo(userInfo)
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
      ElMessage.error(error.message || '获取用户信息失败')
      // 如果token无效，清除本地存储
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      userStore.logout()
    }
  }
}
// 创建会话
const createSession = async () => {
  try {
    const sessionId = await sessionApi.create()
    if (sessionId) {
      localStorage.setItem('isNewSession', 'true')
      store.setActive(sessionId)
      store.messagesMap[sessionId] = []

      // 立即添加到侧边栏列表
      const isInList = store.chatList.some(chat => chat.id === sessionId)
      if (!isInList) {
        store.chatList.unshift({
          id: sessionId,
          title: '新对话',
          lastMessage: '',
        })
      }

      console.log('新对话创建成功，sessionId:', sessionId)
    }
  } catch (error) {
    console.error('创建新对话失败:', error)
    ElMessage.error(error.message || '创建新对话失败')
  }
}

// 响应式处理侧边栏
let lastWidth = window.innerWidth
const checkWidth = () => {
  const currentWidth = window.innerWidth
  const wasMobile = isMobile.value
  isMobile.value = currentWidth < 768

  // 只有当宽度跨越阈值时，才自动调整侧边栏可见性
  if (isMobile.value !== wasMobile) {
    if (isMobile.value) {
      store.setSidebarVisible(false)
    } else {
      store.setSidebarVisible(true)
    }
  }
  lastWidth = currentWidth
}

const toggleSidebar = () => {
  store.setSidebarVisible(!store.sidebarVisible)
}

const createChatFromCollapsed = async () => {
  // 如果有新会话且没有消息，不创建新会话
  if (
    store.newSessionId &&
    store.messagesMap[store.newSessionId].length === 0
  ) {
    store.setActive(store.newSessionId)
    return
  }

  try {
    const newSessionId = await sessionApi.create()
    if (newSessionId) {
      store.messagesMap[newSessionId] = []
      store.setActive(newSessionId)
      localStorage.setItem('isNewSession', 'true')
      sessionStorage.setItem('is_session_active', 'true')

      // 立即添加到侧边栏列表
      const isInList = store.chatList.some(chat => chat.id === newSessionId)
      if (!isInList) {
        store.chatList.unshift({
          id: newSessionId,
          title: '新对话',
          lastMessage: '',
        })
      }
      return
    }
  } catch (error) {
    console.error('创建新会话失败:', error)
  }

  store.createChat()
  localStorage.setItem('isNewSession', 'true')
  sessionStorage.setItem('is_session_active', 'true')
}

// 监听消息发送，如果是移动端则自动收起侧边栏
watch(
  () => store.isStreaming,
  newVal => {
    if (newVal && isMobile.value) {
      store.setSidebarVisible(false)
    }
  },
)

let resizeObserver
let footerResizeObserver

onMounted(() => {
  checkWidth()
  window.addEventListener('resize', checkWidth)

  refreshUserInfo()
  store.fetchModels()

  const token = localStorage.getItem('token')
  if (!token) {
    // 未登录用户：每次刷新页面都清空旧会话并创建新会话
    localStorage.removeItem('sessionId')
    localStorage.removeItem('isNewSession')
    store.activeId = null
    createSession()
  } else {
    // 已登录用户：区分刷新和重新打开（sessionStorage 在标签页关闭后会清除）
    if (!sessionStorage.getItem('is_session_active')) {
      createSession()
      sessionStorage.setItem('is_session_active', 'true')
    }
  }

  // 监听输入框高度变化
  if (inputContainerRef.value) {
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        // 使用 getBoundingClientRect 获取包含 padding 的完整高度
        const rect = entry.target.getBoundingClientRect()
        document.documentElement.style.setProperty(
          '--input-container-height',
          `${rect.height}px`,
        )
      }
    })
    resizeObserver.observe(inputContainerRef.value)
  }

  if (footerRef.value) {
    footerResizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect()
        document.documentElement.style.setProperty(
          '--footer-height',
          `${rect.height}px`,
        )
      }
    })
    footerResizeObserver.observe(footerRef.value)
  }

  if (window.visualViewport) {
    const handleViewportChange = () => {
      if (!mainRef.value) return
      const atBottomNow =
        mainRef.value.scrollHeight -
          mainRef.value.scrollTop -
          mainRef.value.clientHeight <
        80

      if (!atBottomNow) return

      requestAnimationFrame(() => {
        if (!mainRef.value) return
        mainRef.value.scrollTop = mainRef.value.scrollHeight
      })
    }

    window.visualViewport.addEventListener('resize', handleViewportChange)
    window.visualViewport.addEventListener('scroll', handleViewportChange)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', checkWidth)
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (footerResizeObserver) {
    footerResizeObserver.disconnect()
  }
})

onDeactivated(() => {
  if (mainRef.value) {
    savedMainScrollTop.value = mainRef.value.scrollTop
  }
})

onActivated(async () => {
  await nextTick()
  if (mainRef.value) {
    mainRef.value.scrollTop = savedMainScrollTop.value
  }
})

// 检测滚动位置
const handleScroll = () => {
  if (!mainRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = mainRef.value
  // 距离底部 50px 以内都视为在底部
  isAtBottom.value = scrollHeight - scrollTop - clientHeight < 50
}

watch(
  messages,
  async () => {
    await nextTick()
    if (mainRef.value && isAtBottom.value) {
      mainRef.value.scrollTop = mainRef.value.scrollHeight
    }
  },
  { deep: true },
)
</script>

<style lang="scss">
.app {
  --sidebar-width: 260px;
  display: flex;
  height: 100vh;
  height: 100dvh;
  background: var(--bg-main);
  color: var(--text-main);
  margin: 0;
  padding: 0;
  position: relative;
  transition:
    padding 0.3s ease,
    width 0.3s ease;
  overflow: hidden;
}

.app.sidebar-hidden {
  --sidebar-width: 0px;
}

/* 顶部标题样式 */
.top-title-container {
  position: fixed;
  top: calc(15px + var(--safe-area-inset-top));
  left: calc(var(--sidebar-width) + 120px);
  right: 120px;
  height: 35px;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 101;
  transition: all 0.3s ease;
}

.top-title {
  font-size: calc(var(--font-size-main) + 2px);
  font-weight: 500;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  padding: 0 6px;
}

.app.is-mobile .top-title-container {
  left: 95px;
  right: 95px;
  justify-content: center;
}

.app.is-mobile .top-title {
  font-size: calc(var(--font-size-main) - 2px);
  text-align: center;
}

/* 侧边栏收起时左上角组合按钮 */
.top-left-actions {
  position: fixed;
  top: calc(15px + var(--safe-area-inset-top));
  left: 20px;
  height: 36px;
  padding: 0 4px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  z-index: 101;
  transition: all 0.3s ease;
}

.action-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  border-radius: 15px;
  color: var(--text-sub);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn:hover {
  background: transparent;
  color: var(--text-main);
}

.action-divider {
  width: 1px;
  height: 16px;
  background: var(--border);
}

.top-right-actions {
  position: fixed;
  top: calc(15px + var(--safe-area-inset-top));
  right: 20px;
  height: 36px;
  padding: 0 3px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  z-index: 101;
  transition: all 0.3s ease;
}

/* 移动端侧边栏遮罩 */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  /* 移除模糊效果，防止某些环境下导致整个页面变白或变暗过重 */
  z-index: 9998;
  /* 紧贴侧边栏 (9999) 之下 */
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.top-mask {
  position: fixed;
  top: 0;
  left: var(--sidebar-width);
  right: 0;
  height: calc(75px + var(--safe-area-inset-top));
  background-color: var(--bg-main);
  -webkit-mask-image: linear-gradient(to bottom, black 65%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 65%, transparent 100%);
  z-index: 100;
  /* 确保在所有内容之上 */
  pointer-events: none;
  transition:
    transform 0.3s ease,
    left 0.3s ease,
    right 0.3s ease,
    width 0.3s ease;
}

/* 移动端布局适配 */
.is-mobile .sidebar {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  bottom: 0 !important;
  z-index: 9999 !important;
  /* 极高层级，确保在遮罩之上 */
  width: 280px !important;
  transform: translateX(-100%) !important;
  background: var(--bg-sidebar) !important;
  transition: transform 0.3s ease !important;
}

.is-mobile.sidebar-hidden .sidebar {
  transform: translateX(-100%) !important;
}

.is-mobile:not(.sidebar-hidden) .sidebar {
  transform: translateX(0) !important;
}

.app.is-mobile {
  .top-mask {
    left: 0;
  }

  .input-container,
  .footer-container {
    left: 0;
  }

  .main {
    padding: 0 4px 8px;
  }

  .input-container {
    padding: 12px 16px 4px;
  }

  .footer-container {
    right: 4px;
    padding: 0 4px 0;
  }
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 12px 0 20px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  transition: all 0.3s ease;
}

.input-container {
  position: fixed;
  bottom: var(--safe-area-inset-bottom);
  left: var(--sidebar-width);
  right: 0;
  display: flex;
  justify-content: center;

  background: transparent;
  padding: 16px 20px 4px;
  /* padding-right: calc(20px + 6px); */
  /* 20px 基础 padding + 6px 滚动条预留宽度 */
  z-index: 10;
  transition: all 0.3s ease;
}

.footer-container {
  position: fixed;
  bottom: var(--safe-area-inset-bottom);
  left: var(--sidebar-width);
  right: 0;
  display: flex;
  justify-content: center;
  padding: 0 20px;
  /* 同步滚动条宽度 */
  background: transparent;
  z-index: 5;
  transition: all 0.3s ease;
}

.footer {
  right: 8px;
  max-width: 800px;
  width: 100%;
  height: 100%;
  padding: 4px 0;
  text-align: center;
  display: flex;
  justify-content: center;
  padding-right: 6px;
  /* 同步滚动条宽度 */
  background: var(--bg-main);
  color: var(--text-sub);
  font-size: 10px;
  line-height: 1;
}
</style>
