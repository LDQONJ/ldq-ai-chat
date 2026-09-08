import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/user'
import router from '@/router'

const host = import.meta.env.VITE_API_HOST

// 创建 axios 实例
const service = axios.create({
  baseURL: 'api',
  timeout: 60000, // SSE 聊天可能需要较长时间，设置较长的超时
})

// 单例锁防抖：防止页面初始化等并发请求同时弹出多条“登录已失效”提示
let isAuthExpiredNotifying = false

/**
 * 统一处理认证失效（401）
 */
const handleAuthExpired = (message = '登录已失效，请重新登录') => {
  // 1. 立即清除 Pinia 内存及 LocalStorage 中的用户信息，使左下角等响应式 UI 瞬间刷新为未登录态
  try {
    const userStore = useUserStore()
    userStore.logout()
  } catch (e) {
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
  }

  // 2. 消息防抖限流：短时间内多次触发 401 只弹出一次提示，杜绝多条错误框堆叠
  if (!isAuthExpiredNotifying) {
    isAuthExpiredNotifying = true
    ElMessage.error(message)
    setTimeout(() => {
      isAuthExpiredNotifying = false
    }, 2500)
  }

  // 3. 若当前处于需要鉴权的页面（例如 /settings），平滑回退到首页
  if (router.currentRoute.value?.path === '/settings') {
    router.replace('/home')
  }
}

// 请求拦截器：携带 JWT Token
service.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  },
)

// 响应拦截器
service.interceptors.response.use(
  response => {
    const res = response.data
    // 如果返回的是流式数据，直接返回
    if (response.headers['content-type'] === 'text/event-stream') {
      return response
    }
    // 处理统一响应体 R
    if (res.code === 200) {
      return res.data
    } else if (res.code === 401) {
      handleAuthExpired(res.msg || '登录已失效，请重新登录')
      return Promise.reject(new Error(res.msg || '登录已失效'))
    } else {
      // 处理业务错误
      return Promise.reject(new Error(res.msg || 'Error'))
    }
  },
  error => {
    if (error.response) {
      if (error.response.status === 401) {
        handleAuthExpired(error.response.data?.msg || '登录已失效，请重新登录')
        return Promise.reject(error)
      }
      if (error.response.status === 429) {
        ElMessage.error('访问频繁，稍后再试')
        return Promise.reject(new Error('访问频繁，稍后再试'))
      }
    }
    return Promise.reject(error)
  },
)

export { handleAuthExpired }
export default service
