import axios from 'axios'
import { wsManager } from '../utils/websocket'

export async function streamChat(
  messages,
  onChunk,
  think = false,
  prompt = false,
  signal,
  modelId,
  search = false,
  audio = null,
  sessionId = null,
) {
  console.log(messages)
  const userMessage = messages.filter(msg => msg.role === 'user')
  if (!userMessage.length) return
  const host = `${window.location.origin}/api`
  const token = localStorage.getItem('token')
  const headers = {}
  if (token) {
    headers['Authorization'] = `${token}`
  }

  const res = await fetch(`${host}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      sessionId: sessionId || localStorage.getItem('sessionId'),
      text: userMessage[userMessage.length - 1].content,
      think,
      prompt,
      modelId,
      search,
      audio,
      wsId: wsManager.getWsId(),
    }),
    signal,
  })

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('访问频繁，稍后再试')
    }
    throw new Error(`HTTP error! status: ${res.status}`)
  }

  const contentType = res.headers.get('Content-Type')
  if (contentType && contentType.includes('application/json')) {
    const json = await res.json()
    throw new Error(json.msg || '请求失败')
  }

  const reader = res.body.getReader()

  const decoder = new TextDecoder('utf-8')

  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop()

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const jsonLine = line.startsWith('data:')
          ? line.substring(5).trim()
          : line.trim()
        if (!jsonLine) continue

        const json = JSON.parse(jsonLine)

        if (json.content) {
          onChunk(json)
        }
      } catch (e) {
        console.warn('parse error', e)
      }
    }
  }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export async function generateTitle(id, onChunk) {
  const host = `${window.location.origin}/api`
  const token = localStorage.getItem('token')
  const headers = {}
  if (token) {
    headers['Authorization'] = `${token}`
  }
  const res = await fetch(`${host}/session/title/${id}`, {
    headers: {
      ...headers,
    },
  })

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('访问频繁，稍后再试')
    }
    throw new Error(`HTTP error! status: ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')

  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop()

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const jsonLine = line.startsWith('data:')
          ? line.substring(5).trim()
          : line.trim()
        if (!jsonLine) continue

        const json = JSON.parse(jsonLine)

        if (json.content) {
          await delay(100)
          onChunk(json)
        }
      } catch (e) {
        console.warn('parse error', e)
      }
    }
  }
}

export async function streamASR(fileName, onChunk) {
  const host = `${window.location.origin}/api`
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'text/plain',
  }
  if (token) {
    headers['Authorization'] = `${token}`
  }

  const res = await fetch(`${host}/audio/streamASR`, {
    method: 'POST',
    headers: headers,
    body: fileName, // 直接发送字符串作为请求体
  })

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('访问频繁，稍后再试')
    }
    throw new Error(`ASR error! status: ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')

  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop()

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        // 兼容 "data: " 前缀
        const jsonLine = line.startsWith('data:')
          ? line.substring(5).trim()
          : line.trim()
        if (!jsonLine) continue

        const json = JSON.parse(jsonLine)

        if (json.content) {
          await delay(50)
          onChunk(json)
        }
      } catch (e) {
        console.warn('parse error', e, 'on line:', line)
      }
    }
  }
}

export async function streamTTS(messageId) {
  const host = `${window.location.origin}/api`
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'text/plain',
  }
  if (token) {
    headers['Authorization'] = `${token}`
  }

  const res = await fetch(`${host}/audio/streamTTS`, {
    method: 'POST',
    headers: headers,
    body: messageId,
  })

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('访问频繁，稍后再试')
    }
    throw new Error(`TTS error! status: ${res.status}`)
  }

  // 使用 Web Audio API 处理 PCM 流
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  let nextStartTime = 0
  let isFirstChunk = true
  let sampleRate = 24000 // 默认采样率，将从 header 中解析更新

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const jsonLine = line.startsWith('data:') ? line.substring(5).trim() : line.trim()
        if (!jsonLine) continue
        const json = JSON.parse(jsonLine)

        if (json.type === 'streamTTS' && json.content) {
          const binaryStr = atob(json.content)
          const len = binaryStr.length
          const bytes = new Uint8Array(len)
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i)
          }

          let pcmData = bytes
          if (isFirstChunk) {
            // 从 WAV 头 (44字节) 中解析采样率
            // 采样率位于第 24-27 字节
            const view = new DataView(bytes.buffer)
            sampleRate = view.getUint32(24, true)
            console.log(`[TTS] 解析到采样率: ${sampleRate}Hz`)
            
            // 跳过 44 字节的 WAV 头，获取纯 PCM 数据
            pcmData = bytes.slice(44)
            isFirstChunk = false
            nextStartTime = audioCtx.currentTime + 0.1 // 预留一点缓冲时间
          }

          // 将 PCM16 转换为 Float32
          // 注意：PCM16 每个采样点占 2 字节
          const int16Array = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2)
          const float32Array = new Float32Array(int16Array.length)
          for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0 // 归一化到 [-1, 1]
          }

          // 创建音频缓冲并调度播放
          const audioBuffer = audioCtx.createBuffer(1, float32Array.length, sampleRate)
          audioBuffer.getChannelData(0).set(float32Array)

          const source = audioCtx.createBufferSource()
          source.buffer = audioBuffer
          source.connect(audioCtx.destination)

          // 计算播放时间，确保无缝衔接
          const startTime = Math.max(nextStartTime, audioCtx.currentTime)
          source.start(startTime)
          nextStartTime = startTime + audioBuffer.duration
        }
      } catch (e) {
        console.warn('TTS parse error', e)
      }
    }
  }
}
