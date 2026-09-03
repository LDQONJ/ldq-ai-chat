<template>
  <div :class="['msg', message.role]">
    <template v-if="message.role === 'assistant'">
      <div class="bubble assistant">
        <!-- 模型名称 -->
        <div
          v-if="message.name"
          class="model-name"
        >
          {{ message.name }}
        </div>

        <!-- 模型加载提示 -->
        <div
          v-if="message.modelLoading"
          class="model-loading-hint"
        >
          <div class="loading-spinner" />
          <span>{{ loadingText }}</span>
        </div>

        <!-- 思考部分 -->
        <div
          v-if="message.thinking"
          class="thinking-box"
        >
          <div
            class="thinking-header"
            @click="showThinking = !showThinking"
          >
            <div class="thinking-title">
              <div :class="['icon', { rotate: !showThinking }]">
                <Icon
                  :icon-class="'icon-Down'"
                  :font-size="13"
                />
              </div>

              <span>{{ isThinking ? '正在思考...' : '已完成思考' }}</span>
            </div>
          </div>
          <div
            v-show="showThinking"
            lang="en"
            class="thinking-content markdown"
            @click="handleMarkdownClick"
            v-html="renderMarkdown(message.thinking)"
          />
        </div>

        <template
          v-for="(block, i) in message.blocks"
          :key="i"
        >
          <!-- 文本 -->
          <div
            v-if="block.type === 'text'"
            lang="en"
            class="markdown"
            @click="handleMarkdownClick"
            v-html="
              renderMarkdown(block.content, i === message.blocks.length - 1)
            "
          />

          <!-- 代码块 -->
          <div
            v-else
            class="code-wrapper"
          >
            <div class="code-header">
              <span>{{ block.lang || 'code' }}</span>
              <button
                class="copy-btn"
                @click="copy(block.content, $event)"
              >
                复制
              </button>
            </div>

            <pre
              class="code-block"
            ><code ref="setCodeRef">{{ block.content }}<span
              v-if="i === message.blocks.length - 1 && isStreaming"
              class="cursor"
            /></code></pre>
          </div>
        </template>

        <!-- 原有的光标移除，改为在 Markdown/代码块内部渲染 -->
      </div>
    </template>

    <!-- 用户消息 -->
    <div
      v-else
      class="user-message-wrapper"
    >
      <div class="user-info">
        <span class="user-name">{{ userStore.displayName || '用户' }}</span>
        <img
          :src="userAvatar"
          class="user-avatar"
          alt="用户头像"
        />
      </div>
      <div class="bubble user" :class="{ 'audio-bubble': message.type === 'audio' }">
        <div v-if="message.type === 'audio'" class="audio-content" @click="togglePlay">
          <div class="play-btn">
            <Icon :icon-class="isPlaying ? 'icon-pause' : 'icon-play'" :font-size="16" />
          </div>
          <div class="audio-wave">
            <div v-for="n in 15" :key="n" class="wave-bar" :class="{ animating: isPlaying }"></div>
          </div>
          <span v-if="message.uploading" class="upload-loading">
            <Icon :icon-class="'icon-loading'" :font-size="12" class="spin" />
          </span>
          <span v-else class="audio-duration">{{ durationText }}</span>
        </div>
        <div v-if="message.type === 'audio' && (message.transcription || message.isTranscribing)" class="transcription-content">
          <div class="transcription-text">
            {{ message.transcription }}
            <span v-if="message.isTranscribing" class="transcribing-cursor"></span>
          </div>
        </div>
        <div v-else-if="message.type !== 'audio'" class="user-content">
          {{ formatUserText(message.content) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import { nextTick, computed, ref, onUnmounted, onMounted } from 'vue'
import Icon from '@/components/common/Icon.vue'
import { useUserStore } from '@/store/user'
import { useChatStore } from '@/store/chat'

const props = defineProps({
  message: Object,
})

const userStore = useUserStore()
const chatStore = useChatStore()

// 语音播放相关
const isPlaying = ref(false)
const duration = ref(0)
const audio = ref(null)

const audioUrl = computed(() => {
  if (props.message.type !== 'audio') return ''
  const content = props.message.audioPath || props.message.content
  if (!content) return ''
  if (content.startsWith('http') || content.startsWith('blob:')) return content
  // const host = import.meta.env.VITE_API_HOST || ''
  const host = `${window.location.origin}/api`
  return `${host}${content}`
})

const durationText = computed(() => {
  if (!duration.value) return '0:00'
  const mins = Math.floor(duration.value / 60)
  const secs = Math.floor(duration.value % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

const togglePlay = () => {
  if (!audio.value) {
    audio.value = new Audio(audioUrl.value)
    audio.value.addEventListener('ended', () => {
      isPlaying.value = false
    })
    audio.value.addEventListener('loadedmetadata', () => {
      duration.value = audio.value.duration
    })
  }

  if (isPlaying.value) {
    audio.value.pause()
  } else {
    audio.value.play()
  }
  isPlaying.value = !isPlaying.value
}

onMounted(() => {
  if (props.message.type === 'audio') {
    const tempAudio = new Audio(audioUrl.value)
    tempAudio.addEventListener('loadedmetadata', () => {
      duration.value = tempAudio.duration
    })
  }
})

onUnmounted(() => {
  if (audio.value) {
    audio.value.pause()
    audio.value = null
  }
})

const userAvatar = computed(() => {
  if (!userStore.avatar) return userStore.defaultAvatar
  if (
    userStore.avatar.startsWith('http') ||
    userStore.avatar.startsWith('data:')
  )
    return userStore.avatar
  // const host = import.meta.env.VITE_API_HOST
  const host = `${window.location.origin}/api`
  return `${host}${userStore.avatar}`
})

const showThinking = ref(true)

// 是否正在思考中
const isThinking = computed(() => {
  return props.message.streaming && !props.message.blocks.length
})

const loadingText = computed(() => {
  return chatStore.wsStatusMessage || '模型加载中，请稍后...'
})

const md = new MarkdownIt({
  html: true,
  breaks: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch (error) {
        console.log(error)
      }
    }
    return '' // use external default escaping
  },
})

// 自定义链接渲染，添加 target="_blank" 和 rel="noopener noreferrer"
const defaultLinkRender =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => {
    return self.renderToken(tokens, idx, options)
  })

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const targetIndex = token.attrIndex('target')
  const relIndex = token.attrIndex('rel')

  if (targetIndex < 0) {
    token.attrPush(['target', '_blank'])
  } else {
    token.attrs[targetIndex][1] = '_blank'
  }

  if (relIndex < 0) {
    token.attrPush(['rel', 'noopener noreferrer'])
  } else {
    token.attrs[relIndex][1] = 'noopener noreferrer'
  }

  return defaultLinkRender(tokens, idx, options, env, self)
}

const userLongWordRe = /[A-Za-z][A-Za-z0-9_]{4,}/g

const insertSoftHyphens = text => {
  // 匹配连续的 5 个及以上字符（包含英文字母、数字、冒号、连字符等）
  // 这样可以覆盖 IPv6 地址、超长序列号等
  const longWordRe = /[A-Za-z0-9:_-]{5,}/g
  return text.replace(longWordRe, word => word.split('').join('\u00AD'))
}

const formatUserText = text => {
  const s = String(text ?? '')
  return s.replace(userLongWordRe, word => word.split('').join('\u00AD'))
}

const wrapEnglishWithLang = text => {
  let lastIndex = 0
  let match
  let out = ''
  const escape = md.utils.escapeHtml
  // englishFragmentRe 匹配英文片段，但不包含 Markdown 标记符号
  const englishFragmentRe = /[A-Za-z][\x20-\x29\x2B-\x5E\x60-\x7E\u00A0\u2018\u2019\u201C\u201D]*/g
  englishFragmentRe.lastIndex = 0

  while ((match = englishFragmentRe.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (start > lastIndex) {
      out += escape(text.slice(lastIndex, start))
    }
    const run = text.slice(start, end)
    const trailingWhitespaceMatch = run.match(/\s+$/)
    const trailingWhitespace = trailingWhitespaceMatch
      ? trailingWhitespaceMatch[0]
      : ''
    const core = trailingWhitespace
      ? run.slice(0, -trailingWhitespace.length)
      : run
    if (core) {
      out += `<span lang="en">${escape(insertSoftHyphens(core))}</span>`
    }
    if (trailingWhitespace) {
      out += escape(trailingWhitespace)
    }
    lastIndex = end
  }

  if (!out) {
    return escape(insertSoftHyphens(text))
  }
  if (lastIndex < text.length) {
    out += escape(insertSoftHyphens(text.slice(lastIndex)))
  }
  return out
}

md.renderer.rules.text = (tokens, idx) => {
  return wrapEnglishWithLang(tokens[idx].content)
}

const defaultCodeInline = md.renderer.rules.code_inline
md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const hasEnglishLetterRe = /[A-Za-z]/
  if (token?.content && hasEnglishLetterRe.test(token.content)) {
    token.attrSet('lang', 'en')
    token.content = insertSoftHyphens(token.content)
  }
  return defaultCodeInline
    ? defaultCodeInline(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
}

// 自定义渲染规则，为 markdown 中的代码块添加头部和样式
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const info = token.info ? token.info.trim() : ''
  const langName = info.split(/\s+/g)[0]
  const highlighted =
    options.highlight(token.content, langName) || token.content

  return `
    <div class="markdown-code-wrapper">
      <div class="markdown-code-header">
        <span>${langName || 'code'}</span>
        <button class="markdown-copy-btn" data-content="${encodeURIComponent(token.content)}">复制</button>
      </div>
      <pre class="hljs"><code>${highlighted}</code></pre>
    </div>
  `
}

// Markdown 渲染
function renderMarkdown(text, isLastBlock = false) {
  const normalizedText = (text || '')
    .replace(/\\n/g, '\n')
    // 强制给列表符号前后增加换行，确保解析器能正确识别列表结构
    .replace(/(^|\n)([*-]|\d+\.)\s/g, '$1\n$2 ')
    .replace(/(^|\n)(#{1,6}\s+.+?)\n(?!\n)/g, '$1$2\n\n')

  let html = md.render(normalizedText)

  // 针对中文环境下加粗解析失败的补救处理
  // 仅在解析后的 HTML 中仍包含未处理的 ** 时进行精准替换
  if (html.includes('**')) {
    html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
  }

  if (isLastBlock && props.message.streaming) {
    const cursor = '<span class="cursor"></span>'
    // 查找最后出现的结束标签，确保光标插在最末尾的内容容器内
    const tags = [
      '</li>',
      '</p>',
      '</strong>',
      '</b>',
      '</u>',
      '</i>',
      '</s>',
      '</code>',
      '</th>',
      '</td>',
      '</h1>',
      '</h2>',
      '</h3>',
      '</h4>',
      '<h5>',
      '</h6>',
      '</blockquote>',
      '</pre>',
    ]

    let lastIdx = -1
    let insertBeforeTag = null

    for (const tag of tags) {
      const idx = html.lastIndexOf(tag)
      if (idx > lastIdx) {
        lastIdx = idx
        insertBeforeTag = tag
      }
    }

    if (insertBeforeTag) {
      html = html.slice(0, lastIdx) + cursor + html.slice(lastIdx)
    } else if (html.lastIndexOf('</') !== -1) {
      const idx = html.lastIndexOf('</')
      html = html.slice(0, idx) + cursor + html.slice(idx)
    } else {
      html += cursor
    }
  }

  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['class', 'lang', 'target', 'rel'],
    ADD_TAGS: ['div', 'span', 'pre', 'code', 'strong', 'b'],
  })
}

// 高亮
const setCodeRef = async el => {
  if (!el) return
  await nextTick()
  hljs.highlightElement(el)
}

// 是否流式中
const isStreaming = computed(() => {
  return !!props.message.streaming
})

// 复制
const copy = (text, event) => {
  navigator.clipboard.writeText(text).then(() => {
    // 简单的反馈：改变按钮文字
    const target = event?.target
    if (target && target.tagName === 'BUTTON') {
      const originalText = target.innerText
      target.innerText = '已复制'
      setTimeout(() => {
        target.innerText = originalText
      }, 2000)
    }
  })
}

// 处理 markdown 中复制按钮的点击事件（事件委托）
const handleMarkdownClick = event => {
  const target = event.target
  if (target.classList.contains('markdown-copy-btn')) {
    const content = decodeURIComponent(target.getAttribute('data-content'))
    copy(content, event)
  }
}
</script>

<style scoped>
.msg {
  display: flex;
  margin-bottom: 16px;
}

.msg.user {
  justify-content: flex-end;
}

.bubble.user {
  padding: 10px 15px;
}

.bubble.assistant {
  padding: 0 15px;
}

.bubble {
  max-width: 70%;
  background: transparent;
  border-radius: 26px;
  font-size: var(--font-size-main);
  line-height: var(--line-height-main);
  word-break: break-word;
  text-align: justify;
  text-justify: inter-ideograph;
  text-align-last: left;
}

/* 思考部分样式 */
.thinking-box {
  margin-bottom: 12px;
  border-left: 2px solid var(--bg-active);
  padding-left: 12px;
  background: rgba(255, 255, 255, 0.02);
}

.thinking-header {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  color: #94a3b8;
  font-size: var(--font-size-thinking);
  padding: 4px 0;
}

.thinking-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.thinking-title .icon {
  transition: transform 0.2s ease;
}

.thinking-title .icon.rotate {
  transform: rotate(-90deg);
}

.thinking-box .thinking-content {
  color: #64748b;
  font-size: var(--font-size-thinking);
  font-style: italic;
  padding: 8px 16px 8px 0px;
  line-height: var(--line-height-thinking);
}

.thinking-content :deep(p) {
  margin: 4px 0;
}

.thinking-content :deep(ul),
.thinking-content :deep(ol) {
  margin: 4px 0;
  padding-left: 0.7em;
}

.thinking-content > :deep(ul),
.thinking-content > :deep(ol) {
  margin-left: 0.5em;
}

.msg.assistant .bubble {
  max-width: 100%;
  width: 100%;
}

.model-name {
  font-size: 11px;
  color: var(--text-sub);
  margin-bottom: 8px;
  font-weight: 500;
  opacity: 0.8;
  letter-spacing: 0.3px;
}

.model-loading-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-sub);
  font-size: var(--font-size-thinking);
  padding: 8px 0;
  margin-bottom: 8px;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--text-sub);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 修复：精确控制用户消息的样式 */
.user-message-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  max-width: 70%;
  margin-right: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.user-name {
  font-size: 11px;
  color: var(--text-sub);
  font-weight: 500;
  opacity: 0.8;
  letter-spacing: 0.3px;
}

.user-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--border);
}

.msg.user .bubble {
  background: #2563eb;
  hyphens: manual;
  max-width: 100%;
}

.msg.user .bubble .user-content {
  color: white;
  word-break: break-word;
}

/* 语音消息样式 */
.bubble.user.audio-bubble {
  background: var(--primary);
  min-width: 160px;
  cursor: pointer;
  padding: 8px 12px;
}

.audio-content {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  color: white;
}

.play-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.play-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.audio-wave {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 20px;
  flex: 1;
}

.wave-bar {
  width: 3px;
  height: 40%;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 2px;
  transition: height 0.2s;
}

.wave-bar:nth-child(even) {
  height: 60%;
}

.wave-bar:nth-child(3n) {
  height: 80%;
}

.wave-bar.animating {
  animation: wave 1s ease-in-out infinite;
}

.wave-bar.animating:nth-child(2n) {
  animation-delay: 0.1s;
}

.wave-bar.animating:nth-child(3n) {
  animation-delay: 0.2s;
}

.wave-bar.animating:nth-child(4n) {
  animation-delay: 0.3s;
}

@keyframes wave {
  0%, 100% {
    height: 30%;
  }
  50% {
    height: 100%;
  }
}

.audio-duration {
  font-size: 12px;
  opacity: 0.8;
  white-space: nowrap;
}

.transcription-content {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
}

.transcription-text {
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-word;
  text-align: left;
}

.transcribing-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: white;
  margin-left: 2px;
  vertical-align: middle;
  animation: blink 1s infinite;
}

.upload-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* markdown */
.markdown {
  font-size: var(--font-size-main);
  line-height: var(--line-height-main);
  word-break: break-word;
  font-family: var(--font-family-text);
}

.markdown :deep(span[lang='en']) {
  hyphens: manual;
  overflow-wrap: normal;
  word-break: normal;
}

.markdown :deep(a) {
  color: var(--primary);
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease;
  padding: 0 2px;
  margin: 0 -2px;
  border-radius: 4px;
  display: inline;
  word-break: break-word;
}

.markdown :deep(a::after) {
  content: '↗';
  font-size: 0.7em;
  font-weight: normal;
  display: inline-block;
  margin-left: 1px;
  transition: transform 0.2s ease;
  opacity: 0.7;
  vertical-align: top;
  position: relative;
  top: 2px;
}

.markdown :deep(a:hover) {
  background-color: var(--bg-hover);
  border-bottom-color: var(--primary);
}

.markdown :deep(a:hover::after) {
  transform: translate(1px, -1px);
  opacity: 1;
}

.markdown :deep(.cursor) {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: var(--primary);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 1s infinite;
}

.markdown :deep(ul),
.markdown :deep(ol) {
  padding-left: 0.7em;
  margin: 8px 0;
}

.markdown > :deep(ul),
.markdown > :deep(ol) {
  margin-left: 0.9em;
}

.markdown :deep(li) {
  margin-bottom: 4px;
}

.markdown :deep(p) {
  margin: 8px 0;
}

.markdown :deep(p:first-child) {
  margin-top: 0;
}

.markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown :deep(h1),
.markdown :deep(h2),
.markdown :deep(h3),
.markdown :deep(h4),
.markdown :deep(h5),
.markdown :deep(h6) {
  font-size: 1em;
  font-weight: 600;
  margin: 10px 0 6px;
  line-height: var(--line-height-main);
}

.markdown :deep(h1:first-child),
.markdown :deep(h2:first-child),
.markdown :deep(h3:first-child),
.markdown :deep(h4:first-child),
.markdown :deep(h5:first-child),
.markdown :deep(h6:first-child) {
  margin-top: 0;
}

.markdown :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  width: max-content;
  min-width: 100%;
  table-layout: auto;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: var(--font-size-thinking);
  line-height: 0.9;
}

.markdown :deep(th),
.markdown :deep(td) {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
  white-space: nowrap;
  overflow-wrap: normal;
  word-break: normal;
}

.markdown :deep(th) {
  text-align: left;
  color: var(--text-sub);
  font-weight: 600;
  background: rgba(255, 255, 255, 0.03);
}

.markdown :deep(tr:last-child td) {
  border-bottom: none;
}

/* 统一 Markdown 中的代码块样式 */
.markdown :deep(.markdown-code-wrapper) {
  margin: 10px 0;
  border-radius: 10px;
  overflow: hidden;
  background: var(--code-bg);
  font-family: var(--font-family-mono);
}

.markdown :deep(.markdown-code-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-md);
  padding: 6px 10px;
  background: var(--code-header-bg);
  color: var(--text-sub);
}

.markdown :deep(.markdown-copy-btn) {
  background: transparent;
  border: none;
  color: var(--text-sub);
  cursor: pointer;
  font-size: var(--font-size-md);
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
}

.markdown :deep(.markdown-copy-btn:hover) {
  background: var(--bg-hover);
  color: var(--text-main);
}

.markdown :deep(.hljs) {
  background: transparent !important;
  padding: 12px;
  margin: 0;
  overflow-x: auto;
  font-size: var(--font-size-thinking);
  line-height: 1.6;
}

.markdown :deep(code) {
  font-family: var(--font-family-mono);
  font-size: 0.9em;
  background: var(--code-inline-bg);
  padding: 2px 4px;
  border-radius: 4px;
}

.markdown :deep(p code),
.markdown :deep(li code) {
  hyphens: manual;
  white-space: normal;
  overflow-wrap: normal;
  word-break: normal;
}

.markdown :deep(.hljs code) {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: var(--font-size-thinking);
}

/* code */
.code-wrapper {
  margin-top: 10px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--code-bg);
  font-family: var(--font-family-mono);
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-md);
  padding: 6px 10px;
  background: var(--code-header-bg);
  color: var(--text-sub);
}

.copy-btn {
  background: transparent;
  border: none;
  color: var(--text-sub);
  cursor: pointer;
  font-size: var(--font-size-md);
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}

.code-block {
  margin: 0;
  padding: 12px;
  overflow-x: auto;
  font-size: var(--font-size-thinking);
}

/* cursor */
.cursor {
  display: inline-block;
  width: 2px;
  height: 1.1em;
  background: var(--primary);
  margin-left: 2px;
  vertical-align: middle;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}
</style>
