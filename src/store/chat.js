import { defineStore } from 'pinia'
import { streamChat, generateTitle, streamASR } from '../api/stream'
import { createMarkdownStreamParser } from '../utils/markdownStreamParser'
import { modelApi } from '../api/model'
import { ElMessage } from 'element-plus'
import { wsManager } from '../utils/websocket'

export const useChatStore = defineStore('chat', {
  state: () => ({
    chatList: [],
    activeId: localStorage.getItem('sessionId') || null,
    messagesMap: {},
    isStreaming: false,
    sidebarVisible: true,
    isThink: false,
    isSearch: false,
    currentModelId: localStorage.getItem('currentModelId') || '',
    currentModelName: localStorage.getItem('currentModelName') || '',
    isPromptEnabled: localStorage.getItem('isPromptEnabled') === 'true',
    isModelSwitched: localStorage.getItem('isModelSwitched') === 'true',
    abortController: null,
    newSessionId: null,
    wsStatusMessage: '', // 存储 WebSocket 推送的状态消息
  }),

  getters: {
    messages(state) {
      return state.messagesMap[state.activeId] || []
    },
  },

  actions: {
    async fetchModels() {
      try {
        const listRes = await modelApi.list()
        // 如果当前没有选择模型，默认选择通义千问3.5 9B
        if (!this.currentModelId && listRes.length > 0) {
          this.setCurrentModel(5, '通义千问 3.5 (本地、90亿参数)')
        }
        return listRes
      } catch (error) {
        console.error('获取模型列表失败:', error)
        throw error
      }
    },

    // 设置新会话ID
    setNewSessionId(id) {
      this.newSessionId = id
    },

    setPromptEnabled(val) {
      this.isPromptEnabled = val
      localStorage.setItem('isPromptEnabled', val ? 'true' : 'false')
    },

    setModelSwitched(val) {
      this.isModelSwitched = val
      localStorage.setItem('isModelSwitched', val ? 'true' : 'false')
    },

    setCurrentModel(modelId, modelName) {
      this.currentModelId = modelId || ''
      this.currentModelName = modelName || ''
      localStorage.setItem('currentModelId', this.currentModelId)
      localStorage.setItem('currentModelName', this.currentModelName)

      // 如果是 deepseek 模型，自动开启思考模式
      if (this.currentModelName.toLowerCase().includes('deepseek')) {
        this.isThink = true
      }
    },

    async sendAudio(fileUrl, isUploading = false) {
      if (this.isStreaming) return

      const list = this.messagesMap[this.activeId] || []
      const id = Date.now()
      
      // 用户语音消息
      const msg = {
        id,
        role: 'user',
        type: 'audio',
        content: '', // 初始内容为空，后续填入转写文字
        audioPath: fileUrl,
        uploading: isUploading,
      }
      list.push(msg)

      return id
    },

    updateMessage(messageId, updates) {
      const list = this.messagesMap[this.activeId] || []
      const index = list.findIndex(m => m.id === messageId)
      if (index !== -1) {
        list[index] = { ...list[index], ...updates }
      }
    },

    async transcribeAudio(messageId, fileName) {
      // 在所有会话中查找该消息，确保在切换会话或异步延迟时依然能找到
      let message = null
      for (const id in this.messagesMap) {
        message = this.messagesMap[id].find(m => m.id === messageId)
        if (message) break
      }
      
      if (!message) {
        console.error('[ASR] 未找到对应消息ID:', messageId)
        return ''
      }

      message.transcription = ''
      message.isTranscribing = true

      let fullText = ''
      try {
        await streamASR(fileName, chunk => {
          if (chunk.content) {
            message.transcription += chunk.content
            fullText += chunk.content
          }
        })
        return fullText
      } catch (error) {
        console.error('语音转文字失败:', error)
        return ''
      } finally {
        message.isTranscribing = false
      }
    },

    async sendStream(text, audioFile = null, skipUserMsg = false) {
      if (this.isStreaming) return

      const list = this.messagesMap[this.activeId] || []
      this.isStreaming = true
      this.abortController = new AbortController()
      this.wsStatusMessage = '' // 发送前重置状态消息

      // 订阅 WebSocket 状态消息
      const unsubscribe = wsManager.onMessage(data => {
        if (typeof data === 'string') {
          this.wsStatusMessage = data
        } else if (data && data.content && data.type === 'status') {
          this.wsStatusMessage = data.content
        } else if (data && typeof data === 'object' && !data.wsId) {
          // 兜底处理：如果不是 wsId 消息，尝试展示 content
          this.wsStatusMessage = data.content || data.message || this.wsStatusMessage
        }
      })

      const think = this.isThink
      const prompt = this.isPromptEnabled
      const search = this.isSearch

      // 检查是否需要生成标题（对于新会话的第一条消息）
      const chat = this.chatList.find(c => c.id === this.activeId)
      const isNewSession = !chat || chat.title === '新对话'
      // 如果是语音消息，list.length 已经是 1 了，所以需要兼容处理
      const shouldGenerateTitle = isNewSession && (list.length === 0 || (skipUserMsg && list.length === 1))

      // 如果会话不在列表中（正常情况下应该在），将其添加
      const isInChatList = !!chat
      if (shouldGenerateTitle && !isInChatList) {
        this.chatList.unshift({ id: this.activeId, title: '新对话' })
      }

      // 如果不是新会话，将其移动到列表最上方
      if (!shouldGenerateTitle && isInChatList) {
        const index = this.chatList.findIndex(c => c.id === this.activeId)
        if (index > 0) {
          const item = this.chatList.splice(index, 1)[0]
          this.chatList.unshift(item)
        }
      }

      // 1️⃣ 用户消息
      if (!skipUserMsg) {
        list.push({
          id: Date.now(),
          role: 'user',
          content: text,
        })
      }

      // 2️⃣ AI 消息（分块结构）
      const aiMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        name: this.currentModelName,
        blocks: [],
        thinking: '', // 存储思考内容
        streaming: true,
        modelLoading: true, // 默认显示加载提示
      }

      // 重置标志
      if (this.isModelSwitched) {
        this.setModelSwitched(false)
      }

      list.push(aiMsg)
      // 确保获取到的是响应式引用
      const currentMsg = list[list.length - 1]
      currentMsg.streaming = true

      // 3️⃣ 创建解析器
      let pending = false

      const parser = createMarkdownStreamParser(res => {
        if (pending) return

        pending = true

        requestAnimationFrame(() => {
          // 收到第一个回复块后，提示消失
          if (currentMsg.modelLoading) {
            currentMsg.modelLoading = false
          }
          currentMsg.blocks = res.blocks
          currentMsg.thinking = res.thinking
          pending = false
        })
      })

      // 4️⃣ 调用流式接口
      try {
        await streamChat(
          list,
          chunk => {
            parser.parse(chunk)
          },
          think,
          prompt,
          this.abortController.signal,
          this.currentModelId,
          search,
          audioFile,
          this.activeId,
        )
      } catch (error) {
        list.splice(list.length - 2, 2)
        ElMessage.error(error.message || '发送消息失败')
        throw error
      } finally {
        unsubscribe() // 取消订阅
        parser.end()
        currentMsg.streaming = false
        currentMsg.modelLoading = false // 确保结束时提示消失
        this.isStreaming = false
        this.abortController = null
        this.wsStatusMessage = '' // 结束时清空
      }

      // 5️⃣ 如果是新对话，流式更新标题
      if (shouldGenerateTitle) {
        const currentChat = this.chatList.find(
          chat => chat.id === this.activeId,
        )
        if (currentChat) {
          let firstChunk = true
          await generateTitle(this.activeId, chunk => {
            if (chunk.content) {
              if (firstChunk) {
                currentChat.title = '' // 仅在收到首个有效内容时清空原标题，防止 UI 塌陷
                firstChunk = false
              }
              currentChat.title += chunk.content
            }
          })
        }
      }
    },

    createChat() {
      const id = Date.now()
      this.chatList.unshift({ id, title: '新对话' })
      this.messagesMap[id] = []
      this.setActive(id)
    },

    stopStream() {
      if (this.abortController) {
        this.abortController.abort()
        this.isStreaming = false
        this.abortController = null
      }
    },

    setActive(id) {
      this.activeId = id
      localStorage.setItem('sessionId', id)
    },

    setSidebarVisible(visible) {
      this.sidebarVisible = visible
    },

    toggleThink() {
      // 如果当前是 DeepSeek-R1 模型，不允许关闭思考模式
      if (
        this.isThink &&
        (this.currentModelId.toLowerCase().includes('r1') ||
          this.currentModelName.toLowerCase().includes('r1'))
      ) {
        ElMessage.warning('DeepSeek-R1模型只支持思考模式')
        return
      }
      this.isThink = !this.isThink
    },

    toggleSearch() {
      this.isSearch = !this.isSearch
    },

    reset() {
      this.chatList = []
      this.activeId = null
      this.messagesMap = {}
      this.isStreaming = false
      this.isThink = false
      if (this.abortController) {
        this.abortController.abort()
      }
      this.abortController = null
      localStorage.removeItem('sessionId')
      localStorage.removeItem('sessionList')
      localStorage.removeItem('isNewSession')
      sessionStorage.removeItem('is_session_active')
    },
  },
})
