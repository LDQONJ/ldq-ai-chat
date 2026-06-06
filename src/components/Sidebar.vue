<template>
  <div
    class="sidebar"
    @click.stop
  >
    <div class="sidebar-header">
      <div class="logo">LDQ's AI</div>
      <button
        class="collapse-btn"
        title="收起侧边栏"
        @click="store.setSidebarVisible(false)"
      >
        <Icon
          :icon-class="'icon-sidebar'"
          :font-size="16"
        />
      </button>
    </div>

    <div
      class="new-chat"
      style="justify-content: center"
      @click="createChat"
    >
      <div class="new-chat-icon">
        <Icon
          :icon-class="'icon-chat_add'"
          :font-size="17"
        />
      </div>
      <span class="new-chat-text">开启新对话</span>
    </div>

    <div class="chat-list">
      <div
        v-for="chat in chats"
        :key="chat.id"
        class="chat-item"
        :class="{ active: chat.id === activeId }"
        @click="select(chat.id)"
      >
        <div
          v-if="renamingId === chat.id"
          class="rename-input-wrapper"
        >
          <input
            ref="renameInput"
            v-model="renamingTitle"
            class="rename-input"
            @click.stop
            @keyup.enter="handleRename(chat.id)"
            @blur="cancelRename"
          />
        </div>
        <template v-else>
          <span class="chat-title">{{ chat.title }}</span>
          <div class="chat-item-actions">
            <button
              class="item-more-btn"
              @click.stop="toggleItemMenu(chat.id)"
            >
              <Icon
                :icon-class="'icon-more'"
                :font-size="14"
              />
            </button>

            <!-- 聊天项更多菜单 -->
            <div
              v-if="itemMenuVisibleId === chat.id"
              class="item-more-menu"
              @click.stop
            >
              <div
                class="item-menu-item"
                @click="startRename(chat)"
              >
                <Icon
                  :icon-class="'icon-edit1'"
                  :font-size="14"
                />
                <span>重命名</span>
              </div>
              <div
                class="item-menu-item"
                @click="openPromptDialog(chat)"
              >
                <Icon
                  :icon-class="'icon-prompt'"
                  :font-size="14"
                />
                <span>提示词</span>
              </div>
              <div
                class="item-menu-item delete"
                @click="handleDelete(chat.id)"
              >
                <Icon
                  :icon-class="'icon-delete'"
                  :font-size="14"
                />
                <span>删除</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 用户栏 -->
    <div class="user-section">
      <div
        class="user-info"
        @click="handleUserClick"
      >
        <div class="user-avatar">
          <img
            :src="
              userStore.isLoggedIn ? fullAvatarUrl : userStore.defaultAvatar
            "
            alt="用户头像"
          />
        </div>
        <div
          v-if="userStore.isLoggedIn"
          class="user-detail"
        >
          <div class="username">
            {{ userStore.displayName }}
          </div>
          <div class="email">
            {{ userStore.email }}
          </div>
        </div>
        <div
          v-else
          class="user-detail"
        >
          <div class="login-tip">点击登录/注册</div>
        </div>
      </div>

      <!-- 设置按钮 -->
      <div
        v-if="userStore.isLoggedIn"
        class="settings-option"
      >
        <button
          class="settings-btn"
          title="设置"
          @click.stop="goToSettings"
        >
          <Icon
            :icon-class="'icon-settings'"
            :font-size="18"
          />
        </button>
      </div>
    </div>

    <!-- 登录对话框 -->
    <LoginDialog
      v-model:visible="showLoginDialog"
      @success="handleLoginSuccess"
    />

    <!-- 会话提示词对话框 -->
    <PromptDialog
      v-model:visible="showPromptDialog"
      :session-id="promptDialogSessionId"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'

import { useChatStore } from '@/store/chat'
import { useUserStore } from '@/store/user'
import { sessionApi } from '@/api/session'
import Icon from '@/components/common/Icon.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import PromptDialog from '@/components/PromptDialog.vue'
import { ElMessage } from 'element-plus'

const store = useChatStore()
const userStore = useUserStore()
const router = useRouter()

const chats = computed(() => store.chatList)
const activeId = computed(() => store.activeId)
const showLoginDialog = ref(false)
const itemMenuVisibleId = ref(null)
const renamingId = ref(null)
const renamingTitle = ref('')
const renameInput = ref(null)
const showPromptDialog = ref(false)
const promptDialogSessionId = ref(null)

const goToSettings = () => {
  router.push('/settings')
}

const fullAvatarUrl = computed(() => {
  if (!userStore.avatar) return userStore.defaultAvatar
  if (
    userStore.avatar.startsWith('http') ||
    userStore.avatar.startsWith('data:')
  )
    return userStore.avatar
  const host = import.meta.env.VITE_API_HOST
  return `${host}${userStore.avatar}`
})

// 获取会话列表
const fetchSessionList = async () => {
  try {
    const sessionList = await sessionApi.list()
    if (sessionList && Array.isArray(sessionList)) {
      // 将session列表转换为chatList格式
      const chatList = sessionList.map(session => ({
        id: session.id,
        title: session.title || '新对话',
        lastMessage: session.lastMessage || '',
      }))

      // 更新store中的chatList
      store.chatList = chatList

      // 保存到本地存储
      localStorage.setItem('sessionList', JSON.stringify(sessionList))

      // 如果有会话且没有设置过活跃会话，设置第一个为活跃会话
      // 如果已经有活跃会话（刷新页面），加载该会话的消息
      if (store.activeId) {
        select(store.activeId, true)
      } else if (chatList.length > 0) {
        select(chatList[0].id, true)
      }
    }
  } catch (error) {
    console.error('获取对话列表失败:', error) 
    ElMessage.error(error.message || '获取对话列表失败')
  }
}

// 页面加载时获取会话列表
onMounted(() => {
  if (userStore.isLoggedIn) {
    fetchSessionList()
  }
})

const handleUserClick = () => {
  if (!userStore.isLoggedIn) {
    showLoginDialog.value = true
  }
}

const select = async (id, isAuto = false) => {
  // 点击聊天项时，关闭更多菜单
  itemMenuVisibleId.value = null
  try {
    // 调用接口获取会话详情
    const sessionDetail = await sessionApi.queryById(id)

    if (sessionDetail && sessionDetail.messages) {
      // 将sessionVO中的messages转换为store中的格式
      const formattedMessages = sessionDetail.messages.map(msg => ({
        id: msg.id || (Date.now() + Math.random()), // 优先使用后端ID
        role: msg.role,
        name: msg.name,
        thinking: msg.thinking || '',
        content: msg.content || '',
        type: msg.audio ? 'audio' : 'text',
        audioPath: msg.audio || '',
        transcription: msg.audio ? msg.content : '', // 如果是语音消息，content 就是转写内容
        blocks: msg.content ? [{ type: 'text', content: msg.content }] : [],
      }))

      // 更新store中的消息
      store.messagesMap[id] = formattedMessages
      store.setActive(id)
    } else {
      // 如果没有消息数据，设置空消息列表
      store.messagesMap[id] = []
      store.setActive(id)
    }

    // 选择已有会话时清除新会话标志
    // 如果是自动选择（如刷新页面），或者选择的是空会话（新对话），不清除标志，保留新会话生成标题的能力
    const chat = store.chatList.find(c => c.id === id)
    const isNewChat = chat && chat.title === '新对话'
    if (!isAuto && !isNewChat) {
      localStorage.removeItem('isNewSession')
    }

    // 如果是窄屏模式，选择聊天后自动收起
    if (window.innerWidth < 768 && !isAuto) {
      store.setSidebarVisible(false)
    }
  } catch (error) {
    console.error('获取会话详情失败:', error)
    // 核心修复：如果查询失败（例如会话已被后端清理），重新创建新会话
    if (isAuto) {
      console.log('自动恢复失败，尝试创建新会话...')
      createChat()
    } else {
      // 用户点击导致的失败，尝试从列表中移除该项（可选，目前至少保证不崩溃）
      store.setActive(id)
    }

    // 如果是窄屏模式，选择聊天后自动收起
    if (window.innerWidth < 768 && !isAuto) {
      store.setSidebarVisible(false)
    }
  }
}
const createChat = async () => {
  // 如果有新会话且没有消息，不创建新会话
  if (
    store.newSessionId &&
    store.messagesMap[store.newSessionId].length === 0
  ) {
    store.setActive(store.newSessionId)
    return
  }

  try {
    // 调用session/create接口创建新会话
    const newSessionId = await sessionApi.create()

    if (newSessionId) {
      // 设置空消息列表
      store.messagesMap[newSessionId] = []

      // 立即添加到侧边栏列表
      const isInList = store.chatList.some(chat => chat.id === newSessionId)
      if (!isInList) {
        store.chatList.unshift({
          id: newSessionId,
          title: '新对话',
          lastMessage: '',
        })
      }

      // 设置为活跃会话
      store.setActive(newSessionId)
      store.setNewSessionId(newSessionId)

      // 设置标志位，表示这是新创建的会话，尚未发送消息
      localStorage.setItem('isNewSession', 'true')
      // 标志当前会话已激活，防止刷新后再次自动创建
      sessionStorage.setItem('is_session_active', 'true')
    } else {
      // 如果接口调用失败，使用原来的createChat逻辑
      store.createChat()
      localStorage.setItem('isNewSession', 'true')
    }
  } catch (error) {
    console.error('创建新对话失败:', error)
    ElMessage.error(error.message || '创建新对话失败')
    // 出错时使用原来的createChat逻辑
    store.createChat()
    localStorage.setItem('isNewSession', 'true')
  }

  // 如果是窄屏模式，创建聊天后自动收起侧边栏
  if (window.innerWidth < 768) {
    store.setSidebarVisible(false)
  }
}

const handleLoginSuccess = () => {
  // 登录成功后刷新用户信息
  // userStore会自动从localStorage读取最新的用户信息
  // 这里可以触发一些额外的数据刷新逻辑
  fetchSessionList()
  console.log('登录成功，用户信息已更新')
}

const toggleItemMenu = id => {
  if (itemMenuVisibleId.value === id) {
    itemMenuVisibleId.value = null
  } else {
    itemMenuVisibleId.value = id
  }
}

const startRename = async chat => {
  renamingId.value = chat.id
  renamingTitle.value = chat.title
  itemMenuVisibleId.value = null
  await nextTick()
  if (renameInput.value && renameInput.value[0]) {
    renameInput.value[0].focus()
  }
}

const handleRename = async id => {
  if (!renamingTitle.value.trim()) {
    ElMessage.warning('标题不能为空')
    return
  }

  try {
    await sessionApi.rename(id, renamingTitle.value.trim())
    const chat = store.chatList.find(c => c.id === id)
    if (chat) {
      chat.title = renamingTitle.value.trim()
    }
    ElMessage.success('重命名成功')
    renamingId.value = null
  } catch (error) {
    ElMessage.error(error.message || '重命名失败')
    console.error(error)
  }
}

const cancelRename = () => {
  renamingId.value = null
}

const handleDelete = async id => {
  try {
    await sessionApi.delete(id)
    const index = store.chatList.findIndex(c => c.id === id)
    if (index !== -1) {
      store.chatList.splice(index, 1)
    }
    if (store.activeId === id) {
      if (store.chatList.length > 0) {
        select(store.chatList[0].id)
      } else {
        createChat()
      }
    }
    ElMessage.success('删除成功')
    itemMenuVisibleId.value = null
  } catch (error) {
    ElMessage.error(error.message || '删除失败')
    console.error(error)
  }
}

const openPromptDialog = chat => {
  promptDialogSessionId.value = chat.id
  showPromptDialog.value = true
  itemMenuVisibleId.value = null
}

// 点击外部关闭更多菜单
onMounted(() => {
  window.addEventListener('click', () => {
    itemMenuVisibleId.value = null
  })
})
</script>

<style scoped lang="scss">
.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-sidebar);
  padding: calc(16px + var(--safe-area-inset-top)) 16px 0 16px;
  border-right: 1px solid var(--border);
  transition:
    width 0.3s ease,
    padding 0.3s ease,
    transform 0.3s ease;
  overflow: hidden;
  flex-shrink: 0;
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
}

.sidebar-hidden .sidebar {
  padding: calc(16px + var(--safe-area-inset-top)) 0;
  border-right: none;
}

.logo {
  font-size: 20px;
  margin: 0;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.collapse-btn {
  background: transparent;
  border: none;
  color: var(--text-sub);
  cursor: pointer;
  padding: 4px;
  width: 35px;
  height: 35px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.collapse-btn:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}

.new-chat {
  width: 100%;
  padding: 13px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--add-chat-bg);
  /* 添加长方形背景 */
  border-radius: 25px;
  /* 左右两边半圆效果 */
  transition: all 0.3s ease;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.new-chat:hover {
  /* background: var(--bg-active); */
  /* 悬停时背景色变化 */
  /* transform: scale(1.02); */
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
}

.new-chat-icon {
  font-size: var(--font-size-main);
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.new-chat-text {
  font-size: 15px;
  height: 16px;
  line-height: 16px;
  display: flex;
  align-items: center;
  user-select: none;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 16px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.chat-list::-webkit-scrollbar {
  display: none;
}

.chat-item {
  padding: 10px;
  border-radius: 8px;
  transition: all 0.3s ease;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  margin-bottom: 2px;
  font-size: var(--font-size-main);
}

.chat-item:hover {
  background: var(--bg-active);
}

.chat-item.active {
  background: var(--bg-active);
}

.chat-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item-actions {
  display: flex;
  align-items: center;

  // 更多操作按钮
  .item-more-btn {
    background: none;
    border: none;
    color: var(--text-sub);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
  }

  .item-more-btn:hover {
    color: var(--text-main);
  }
}

.chat-item:hover .item-more-btn {
  opacity: 1;
}

.item-more-menu {
  position: absolute;
  top: 100%;
  right: 5px;
  background: var(--add-chat-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  min-width: 100px;
  z-index: 100;
}

.item-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-main);
}

.item-menu-item:hover {
  background: var(--bg-hover);
}

.item-menu-item.delete {
  color: #ff4d4f;
}

.rename-input-wrapper {
  width: 100%;
}

.rename-input {
  width: 100%;
  background: var(--bg-active);
  border: 1px solid var(--primary);
  border-radius: 4px;
  color: var(--text-main);
  padding: 6px 12px;
  outline: none;
  font-size: inherit;
}

.user-section {
  padding: 12px;
  border-top: 1px solid var(--border);
  margin: 0 -16px;
  padding-left: 16px;
  padding-right: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
  flex-shrink: 0;
  position: relative;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  flex: 1;
  overflow: hidden;
}

.user-section:hover {
  background: var(--bg-hover);
}

.settings-option {
  position: relative;
}

.settings-btn {
  background: none;
  border: none;
  color: var(--text-sub);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.settings-btn:hover {
  background: var(--bg-active);
  color: var(--text-main);
}

.menu-item.logout {
  color: #ff4d4f;
}

.user-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--bg-active);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-sub);
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.user-detail {
  overflow: hidden;
}

.username {
  font-size: var(--font-size-main);
  font-weight: 500;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.email {
  font-size: var(--font-size-thinking);
  color: var(--text-sub);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.login-tip {
  font-size: var(--font-size-thinking);
  color: var(--text-sub);
}
</style>
