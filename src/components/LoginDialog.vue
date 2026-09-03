<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="dialog-overlay"
      @click="close"
    >
      <div
        class="dialog-content"
        @click.stop
      >
        <div class="dialog-header">
          <h2>{{ isLoginMode ? '登录' : '注册' }}</h2>
          <button
            class="close-btn"
            @click="close"
          >
            ×
          </button>
        </div>

        <form
          class="dialog-body"
          @submit.prevent="handleSubmit"
        >
          <!-- 头像上传 -->
          <div
            v-if="!isLoginMode"
            class="form-item avatar-upload"
          >
            <label>头像</label>
            <div
              class="avatar-container"
              @click="triggerFileInput"
            >
              <img
                v-if="form.avatar"
                :src="fullAvatarUrl"
                alt="头像"
              />
              <div
                class="upload-mask"
                :class="{ 'always-show': !form.avatar }"
              >
                <span class="plus-icon">+</span>
                <span>{{ form.avatar ? '更换头像' : '上传头像' }}</span>
              </div>
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                class="hidden-input"
                @change="handleFileUpload"
              />
            </div>
          </div>

          <div class="form-item">
            <label>用户名</label>
            <input
              v-model="form.username"
              type="text"
              placeholder="请输入用户名"
              required
            />
          </div>

          <div
            v-if="!isLoginMode"
            class="form-item"
          >
            <label>邮箱</label>
            <div class="input-with-btn">
              <input
                v-model="form.email"
                type="email"
                placeholder="请输入邮箱"
                required
              />
              <button
                type="button"
                :disabled="sendingCode"
                @click="handleSendCode"
              >
                {{ sendingCode ? `${countdown}s` : '获取验证码' }}
              </button>
            </div>
          </div>

          <div
            v-if="!isLoginMode"
            class="form-item"
          >
            <label>验证码</label>
            <input
              v-model="form.code"
              type="text"
              placeholder="请输入验证码"
              required
            />
          </div>

          <div class="form-item">
            <label>密码</label>
            <input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              required
            />
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class="submit-btn"
              :disabled="loading"
            >
              {{ loading ? '处理中...' : isLoginMode ? '登录' : '注册' }}
            </button>
            <div class="mode-switch">
              {{ isLoginMode ? '没有账号?' : '已有账号?' }}
              <a
                href="javascript:void(0)"
                @click="isLoginMode = !isLoginMode"
              >
                {{ isLoginMode ? '立即注册' : '立即登录' }}
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { userApi } from '@/api/user'
import { codeApi } from '@/api/code'
import { fileApi } from '@/api/file'
import { useUserStore } from '@/store/user'
import { ElMessage } from 'element-plus'

const props = defineProps({
  visible: Boolean,
})

const emit = defineEmits(['update:visible', 'success'])

const userStore = useUserStore()
const isLoginMode = ref(true)
const loading = ref(false)
const sendingCode = ref(false)
const countdown = ref(60)
const fileInput = ref(null)

const form = reactive({
  username: '',
  password: '',
  email: '',
  code: '',
  avatar: '',
})

const fullAvatarUrl = computed(() => {
  if (!form.avatar) return userStore.defaultAvatar
  // const host = import.meta.env.VITE_API_HOST
  const host = `${window.location.origin}/api`
  return form.avatar.startsWith('http') ? form.avatar : `${host}${form.avatar}`
})

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileUpload = async event => {
  const file = event.target.files[0]
  if (!file) return

  // 校验文件类型和大小
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('图片大小不能超过 2MB')
    return
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fileApi.upload(formData)
    form.avatar = res // 假设响应 data 为文件路径字符串
    ElMessage.success('头像上传成功')
  } catch (error) {
    ElMessage.error(error.message || '头像上传失败')
  }
}

const close = () => {
  emit('update:visible', false)
  // 重置表单
  form.username = ''
  form.password = ''
  form.email = ''
  form.code = ''
  form.avatar = ''
}

const handleSendCode = async () => {
  if (!form.email) {
    ElMessage.warning('请先输入邮箱')
    return
  }

  try {
    sendingCode.value = true
    await codeApi.sendCode(form.email)
    ElMessage.success('验证码已发送')

    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
        sendingCode.value = false
        countdown.value = 60
      }
    }, 1000)
  } catch (error) {
    ElMessage.error(error.message || '发送失败')
    sendingCode.value = false
  }
}

const handleSubmit = async () => {
  loading.value = true
  try {
    let token
    if (isLoginMode.value) {
      token = await userApi.login({
        username: form.username,
        password: form.password,
      })
    } else {
      token = await userApi.register({
        username: form.username,
        password: form.password,
        email: form.email,
        code: form.code,
        avatar: form.avatar,
      })
    }

    if (token) {
      userStore.setToken(token) // 使用 store 方法设置 token，确保响应式
      const userInfo = await userApi.me()
      if (userInfo) {
        userStore.setUserInfo(
          userInfo || { username: form.username, email: form.email },
        )
      }
      emit('success')
      close()
    } else {
      throw new Error('响应数据异常')
    }
  } catch (error) {
    ElMessage.error(error.message || (isLoginMode.value ? '登录失败' : '注册失败'))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000; /* 确保高于侧边栏 (9999) */
  /* 防止移动端输入法弹出时位移 */
  padding-top: constant(safe-area-inset-top);
  padding-top: env(safe-area-inset-top);
}

@media (max-width: 768px) {
  .dialog-overlay {
    align-items: flex-start; /* 移动端改为顶部对齐，防止输入法弹出导致的垂直居中重算 */
    padding-top: 80px; /* 使用固定高度，防止 vh 单位随输入法弹出而变化 */
  }
}

.dialog-content {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  width: 90%;
  max-width: 400px;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
  color: var(--text-main);
  backdrop-filter: blur(8px);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.dialog-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-main);
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-sub);
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}

.form-item {
  margin-bottom: 18px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-sub);
}

.form-item input {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 14px;
  border-radius: 8px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--text-main);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.form-item input::placeholder {
  color: var(--text-sub);
  opacity: 0.65;
}

.form-item input:hover {
  border-color: var(--input-border-hover);
}

.form-item input:focus {
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
}

/* 彻底解决浏览器记住密码 Autofill 导致的丑陋黄灰底色 */
.form-item input:-webkit-autofill,
.form-item input:-webkit-autofill:hover,
.form-item input:-webkit-autofill:focus,
.form-item input:-webkit-autofill:active {
  -webkit-text-fill-color: var(--text-main) !important;
  transition: background-color 5000s ease-in-out 0s;
}

[data-theme='dark'] .form-item input:-webkit-autofill,
[data-theme='dark'] .form-item input:-webkit-autofill:hover,
[data-theme='dark'] .form-item input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px #131b2c inset !important;
  -webkit-text-fill-color: #f1f5f9 !important;
}

:root:not([data-theme='dark']) .form-item input:-webkit-autofill,
:root:not([data-theme='dark']) .form-item input:-webkit-autofill:hover,
:root:not([data-theme='dark']) .form-item input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
  -webkit-text-fill-color: #1e293b !important;
}

.input-with-btn {
  display: flex;
  gap: 10px;
}

.input-with-btn button {
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--text-main);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.input-with-btn button:hover:not(:disabled) {
  border-color: #3b82f6;
  color: #3b82f6;
}

.input-with-btn button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-btn {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 18px;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
  transition: all 0.2s ease;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.95;
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.4);
  transform: translateY(-1px);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

/* 头像上传样式 */
.avatar-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.avatar-container {
  position: relative;
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border: 2px dashed var(--input-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s ease;
  background: var(--input-bg);
}

.avatar-container:hover {
  border-color: #3b82f6;
  background: var(--bg-hover);
}

.avatar-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  color: white;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
}

.upload-mask.always-show {
  background: transparent;
  color: var(--text-sub);
  opacity: 1;
}

.avatar-container:hover .upload-mask {
  opacity: 1;
  background: rgba(0, 0, 0, 0.4);
  color: white;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--text-sub);
  font-size: 12px;
}

.plus-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.hidden-input {
  display: none;
}

.mode-switch {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
  color: var(--text-sub);
}

.mode-switch a {
  color: #3b82f6;
  text-decoration: none;
  margin-left: 4px;
  font-weight: 500;
  transition: color 0.2s;
}

.mode-switch a:hover {
  text-decoration: underline;
  color: #60a5fa;
}
</style>
