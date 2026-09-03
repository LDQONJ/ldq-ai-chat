<template>
  <div class="input-wrap">
    <div class="input-bg">
      <div class="input-inner">
        <textarea
          ref="textareaRef"
          v-model="text"
          placeholder="给 LDQ's AI 发送消息"
          rows="2"
          @focus="focus = true"
          @blur="focus = false"
          @keydown.enter="handleEnter"
        />

        <!-- 深度思考 & 联网搜索按钮 -->
        <div class="input-footer">
          <div class="footer-left">
            <button
              class="think-btn"
              :class="{ active: store.isThink }"
              @click="store.toggleThink"
            >
              <div class="think-icon">
                <Icon
                  :icon-class="'icon-deepseek'"
                  :font-size="13"
                />
              </div>
              <span>深度思考</span>
            </button>

            <button
              class="think-btn"
              :class="{ active: store.isSearch }"
              @click="store.toggleSearch"
            >
              <div class="think-icon">
                <Icon
                  :icon-class="'icon-web'"
                  :font-size="13"
                />
              </div>
              <span>联网搜索</span>
            </button>
          </div>

          <div class="footer-right">
            <button
              class="record-btn"
              :class="{ recording: isRecording }"
              title="发送语音"
              @click="toggleRecording"
            >
              <div class="send-icon">
                <Icon
                  :icon-class="!isRecording ? 'icon-audio' : 'icon-stop'"
                  :font-size="!isRecording ? 17 : 14"
                />
              </div>
            </button>

            <button
              class="send-btn"
              :class="{
                'stop-btn': store.isStreaming,
                disabled: isInputEmpty && !store.isStreaming,
              }"
              :disabled="isInputEmpty && !store.isStreaming"
              :title="isInputEmpty && !store.isStreaming ? '请输入内容' : ''"
              @click="send"
            >
              <div class="send-icon">
                <!-- 停止图标 -->
                <Icon
                  v-if="store.isStreaming"
                  :icon-class="'icon-stop'"
                  :font-size="14"
                />
                <!-- 发送图标 -->
                <Icon
                  v-else
                  :icon-class="'icon-up-arrow'"
                  :font-size="17"
                />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted } from 'vue'
import { useChatStore } from '../store/chat'
import Icon from '@/components/common/Icon.vue'
import { fileApi } from '@/api/file'
import { streamTTS } from '@/api/stream'

const text = ref('')
const focus = ref(false)
const store = useChatStore()
const textareaRef = ref()

const isRecording = ref(false)
let mediaRecorder = null
let audioChunks = []

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream)
    audioChunks = []

    mediaRecorder.ondataavailable = event => {
      audioChunks.push(event.data)
    }

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
      
      // 1. 先生成本地 URL 并立即显示气泡
      const localUrl = URL.createObjectURL(audioBlob)
      const messageId = await store.sendAudio(localUrl, true)

      // 2. 异步上传
      const formData = new FormData()
      formData.append('file', audioBlob, 'voice.wav')

      try {
        const res = await fileApi.upload(formData)
        // console.log('[录音上传响应]', res)
        
        // 更加鲁棒的路径获取逻辑
        const filePath = typeof res === 'string' ? res : (res.path || res.url || (res.data && (res.data.path || res.data.url)) || res.data)
        
        if (filePath) {
          // console.log('[录音上传成功] 准备转文字, 路径:', filePath)
          // 3. 上传成功后更新消息内容为服务器路径，并移除上传状态
          store.updateMessage(messageId, {
            audioPath: filePath,
            uploading: false
          })

          // 4. 调用语音转文字
          const transcription = await store.transcribeAudio(messageId, filePath)
          
          // 5. 转写完成后，更新 content 并触发 AI 回复
          if (transcription) {
            store.updateMessage(messageId, { content: transcription })
            await store.sendStream(transcription, filePath, true)
          }
        } else {
          console.warn('[录音上传成功] 但未解析到文件路径，响应内容:', res)
          store.updateMessage(messageId, { uploading: false })
        }
      } catch (error) {
        console.error('上传录音失败:', error)
        // 如果上传失败，可以给用户一个提示或者标记失败状态
        store.updateMessage(messageId, {
          uploading: false,
          error: true
        })
      }

      // 关闭流
      stream.getTracks().forEach(track => track.stop())
    }

    mediaRecorder.start()
    isRecording.value = true
  } catch (err) {
    console.error('无法启动录音:', err)
    alert('无法启动录音，请确保已授予麦克风权限')
  }
}

const stopRecording = () => {
  if (mediaRecorder && isRecording.value) {
    mediaRecorder.stop()
    isRecording.value = false
  }
}

const toggleRecording = () => {
  if (isRecording.value) {
    stopRecording()
  } else {
    startRecording()
  }
}

onUnmounted(() => {
  if (isRecording.value) {
    stopRecording()
  }
})

const isInputEmpty = computed(() => !text.value.trim())

const send = async () => {

  // 测试 TTS 指令
  if (text.value.startsWith('/test-tts ')) {
    const messageId = text.value.replace('/test-tts ', '').trim()
    text.value = ''
    try {
      await streamTTS(messageId)
    } catch (error) {
      console.error('TTS 测试失败:', error)
      alert('TTS 测试失败: ' + error.message)
    }
    return
  }

  // 临时添加的测试指令逻辑
  if (text.value.startsWith('/test-asr ')) {
    const filePath = text.value.replace('/test-asr ', '').trim();
    text.value = '';
    
    // 1. 创建一个语音消息气泡（假设没有正在上传）
    const messageId = await store.sendAudio('', false);
    
    // 2. 模拟设置音频路径（可以是服务器已存在的路径，如 'uploads/test.wav'）
    store.updateMessage(messageId, { 
      audioPath: filePath,
      uploading: false 
    });

    // 3. 触发流式转写
    const transcription = await store.transcribeAudio(messageId, filePath);
    
    // 4. 转写完后触发 AI 回复（如果需要）
    if (transcription) {
      store.updateMessage(messageId, { content: transcription });
      await store.sendStream(transcription, filePath, true);
    }
    return;
  }

  if (store.isStreaming) {
    store.stopStream()
    return
  }

  if (isInputEmpty.value) {
    return
  }

  const originalText = text.value
  text.value = ''
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }

  try {
    await store.sendStream(originalText)
  } catch (error) {
    text.value = originalText
    nextTick(() => {
      autoResize()
    })
  }
}

const handleEnter = event => {
  if (event.ctrlKey) {
    // Ctrl + Enter 换行
    event.preventDefault() // 阻止默认行为（如表单提交）
    const textarea = textareaRef.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const value = textarea.value
    text.value = value.substring(0, start) + '\n' + value.substring(end)
    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 1
      autoResize()
    })
  } else {
    // Enter 发送
    event.preventDefault()
    send()
  }
}

const handleShiftEnter = () => {
  // Shift+Enter 换行现在由浏览器默认行为处理，这里只需要确保高度调整
  nextTick(() => {
    autoResize()
  })
}

const autoResize = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px'
  }
}

// 监听文本变化自动调整高度
const watchText = () => {
  if (textareaRef.value) {
    autoResize(textareaRef.value)
  }
}
</script>

<style scoped>
.input-wrap {
  padding: 14px 0;
  /* 只留上下 padding，左右对齐由父容器控制 */
  background: transparent;
  max-width: 800px;
  width: 100%;
}

/* 输入框背景 */
.input-bg {
  display: flex;
  flex-direction: column;
  /* 改为纵向布局以容纳 footer */
  align-items: flex-start;
  background: var(--bg-main);
  border-radius: 16px;
  max-width: 800px;
  position: relative;
  /* 为按钮定位提供参考 */
}

.input-inner {
  display: flex;
  flex-direction: column;
  /* 改为纵向布局以容纳 footer */
  background: var(--bg-card);
  border-radius: 16px;
  padding: 4px;
  border: 1px solid var(--border);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  width: 100%;
  height: 100%;
  position: relative;
  /* 为按钮定位提供参考 */
}

.input-inner:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.input-footer {
  width: 100%;
  padding: 4px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.footer-left,
.footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.think-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-sub);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.think-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
}

.think-btn.active {
  background: rgba(37, 99, 235, 0.1);
  border-color: var(--primary);
  color: var(--primary);
}

.think-icon {
  display: flex;
  align-items: center;
}

textarea {
  width: 100%;
  /* 宽度占满 */
  background: transparent;
  border: none;
  color: var(--text-main);
  outline: none;
  resize: none;
  /* 禁用手动调整大小 */
  min-height: 60px;
  /* 最小高度 */
  max-height: 200px;
  /* 最大高度限制 */
  line-height: 1.5;
  font-family: inherit;
  font-size: 15px;
  overflow-y: auto;
  padding: 12px;
  /* 增加 padding 使其更美观 */
  word-break: break-all;
  overflow-wrap: break-word;
  text-align: left;
  /* 内容超出时显示滚动条 */
}

.send-btn {
  background: var(--primary);
  border: none;
  color: white;
  border-radius: 25px;
  width: 34px;
  height: 34px;
  cursor: pointer;
  transition: transform 0.1s;
  flex-shrink: 0;
}

.record-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-sub);
  border-radius: 25px;
  width: 34px;
  height: 34px;
  cursor: pointer;
  transition: all 0.3s;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.record-btn:hover {
  background: var(--bg-hover);
  color: var(--text-main);
  border-color: var(--primary);
}

.record-btn.recording {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.send-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-btn:active {
  transform: scale(0.9);
}

.send-btn.disabled {
  background: rgba(37, 99, 235, 0.4);
  /* 变浅的背景色 */
  /* cursor: not-allowed; */
  transform: none;
}

.stop-btn {
  background: #ef4444;
  /* 红色停止按钮 */
}
</style>
