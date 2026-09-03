<template>
  <div
    class="settings-page"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
  >
    <div class="settings-header">
      <button
        class="back-btn"
        @click="router.back()"
      >
        <Icon icon-class="icon-back" />
      </button>
      <div class="title">设置</div>
    </div>

    <div class="settings-content">
      <!-- 用户信息 -->
      <section class="settings-section">
        <div class="section-header">
          <div class="section-title">用户信息</div>
          <button
            v-if="!isEditing"
            class="edit-btn"
            @click="startEditing"
          >
            <Icon
              icon-class="icon-edit1"
              :font-size="14"
            />
            <span>修改资料</span>
          </button>
          <div
            v-else
            class="edit-actions"
          >
            <button
              class="save-btn"
              :loading="savingUser"
              @click="saveUserInfo"
            >
              保存
            </button>
            <button
              class="cancel-btn"
              @click="cancelEditing"
            >
              取消
            </button>
          </div>
        </div>
        <div class="user-card">
          <div
            class="user-avatar-large"
            :class="{ editing: isEditing }"
            @click="isEditing && triggerAvatarUpload()"
          >
            <img
              :src="displayAvatar"
              alt="用户头像"
            />
            <div
              v-if="isEditing"
              class="avatar-overlay"
            >
              <Icon
                icon-class="icon-camera"
                :font-size="20"
              />
            </div>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden-input"
              @change="handleFileUpload"
            />
          </div>
          <div class="user-info-fields">
            <div class="field">
              <label>用户名</label>
              <input
                v-if="isEditing"
                v-model="editForm.username"
                type="text"
              />
              <span v-else>{{ userStore.username }}</span>
            </div>
            <div class="field">
              <label>邮箱</label>
              <input
                v-if="isEditing"
                v-model="editForm.email"
                type="email"
              />
              <span v-else>{{ userStore.email }}</span>
            </div>
            <div class="field">
              <label>手机号</label>
              <input
                v-if="isEditing"
                v-model="editForm.phone"
                type="tel"
              />
              <span v-else>{{ userStore.phone || '未绑定' }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 模型设置 -->
      <section class="settings-section">
        <div class="section-header">
          <div class="section-title">模型设置</div>
        </div>
        <div class="model-selection">
          <el-select
            :model-value="loadingModels ? '' : chatStore.currentModelId"
            class="model-select"
            popper-class="model-select-popper"
            :placeholder="loadingModels ? '加载中...' : '请选择模型'"
            :loading="loadingModels"
            :disabled="loadingModels"
            @change="changeModel"
          >
            <el-option
              v-for="model in models"
              :key="model.id"
              :label="model.name"
              :value="model.id"
            >
              <div class="model-option-content">
                <div class="model-option-header">
                  <span class="model-name">{{ model.name }}</span>
                  <Icon
                    v-if="chatStore.currentModelId === model.id"
                    icon-class="icon-success"
                    :font-size="14"
                  />
                </div>
                <span class="model-desc">{{ model.description }}</span>
              </div>
            </el-option>
          </el-select>
        </div>
      </section>

      <!-- 全局提示词 -->
      <section class="settings-section">
        <div class="section-header">
          <div class="title-with-switch">
            <div class="header-title">
              <div class="section-title">全局提示词</div>
              <!-- <span class="header-subtitle">(全局默认设置)</span> -->
            </div>
            <div
              class="switch-container"
              @click="togglePromptEnabled"
            >
              <div
                class="switch"
                :class="{ active: chatStore.isPromptEnabled }"
              >
                <div class="switch-handle" />
              </div>
              <span class="switch-label">{{
                chatStore.isPromptEnabled ? '已开启' : '已关闭'
              }}</span>
            </div>
          </div>
          <button
            v-if="!isEditingPrompt"
            class="edit-btn"
            @click="startEditingPrompt"
          >
            <Icon
              icon-class="icon-edit1"
              :font-size="14"
            />
            <span>修改</span>
          </button>
          <div
            v-else
            class="edit-actions"
          >
            <button
              class="save-btn"
              :disabled="savingPrompt"
              @click="savePrompt"
            >
              {{ savingPrompt ? '保存中...' : '保存' }}
            </button>
            <button
              class="cancel-btn"
              @click="cancelEditingPrompt"
            >
              取消
            </button>
          </div>
        </div>
        <div class="prompt-card">
          <div class="field">
            <label>角色设定 (Persona)</label>
            <textarea
              v-if="isEditingPrompt"
              v-model="editPromptForm.persona"
              placeholder="例如：你是一个专业的技术顾问..."
              rows="3"
            />
            <div
              v-else
              class="prompt-text"
            >
              {{ globalPrompt.persona || '未设置' }}
            </div>
          </div>
          <div class="field">
            <label>回复规则 (Rules)</label>
            <textarea
              v-if="isEditingPrompt"
              v-model="editPromptForm.rules"
              placeholder="例如：使用简洁的语言回复..."
              rows="5"
            />
            <div
              v-else
              class="prompt-text"
            >
              {{ globalPrompt.rules || '未设置' }}
            </div>
          </div>
          <div class="field">
            <div class="field-header">
              <label>对话示例 (Examples)</label>
              <button
                v-if="isEditingPrompt"
                class="add-example-btn"
                @click="addExample"
              >
                + 新增示例
              </button>
            </div>
            <div
              v-if="isEditingPrompt"
              class="example-list-edit"
            >
              <div
                v-for="(item, index) in editPromptForm.example"
                :key="index"
                class="example-item-edit"
              >
                <div class="example-inputs">
                  <div class="input-group">
                    <span class="input-label">用户</span>
                    <textarea
                      v-model="item['用户']"
                      placeholder="用户消息示例..."
                      rows="2"
                    ></textarea>
                  </div>
                  <div class="input-group">
                    <span class="input-label">AI</span>
                    <textarea
                      v-model="item['AI']"
                      placeholder="AI 消息示例..."
                      rows="2"
                    ></textarea>
                  </div>
                </div>
                <button
                  class="remove-example-btn"
                  @click="removeExample(index)"
                >
                  删除
                </button>
              </div>
              <div
                v-if="!editPromptForm.example?.length"
                class="no-data"
              >
                暂无示例
              </div>
            </div>
            <div
              v-else
              class="example-list-view"
            >
              <div
                v-for="(item, index) in globalPrompt.example"
                :key="index"
                class="example-item-view"
              >
                <div class="view-group">
                  <span class="view-label">用户:</span>
                  <span class="view-content">{{ item['用户'] }}</span>
                </div>
                <div class="view-group">
                  <span class="view-label">AI:</span>
                  <span class="view-content">{{ item['AI'] }}</span>
                </div>
              </div>
              <div
                v-if="!globalPrompt.example?.length"
                class="prompt-text"
              >
                未设置
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 退出登录 -->
      <section class="settings-section logout-section">
        <button
          class="logout-btn"
          @click="handleLogout"
        >
          <Icon
            icon-class="icon-logout"
            :font-size="16"
          />
          <span>退出登录</span>
        </button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { useChatStore } from '@/store/chat'
import { modelApi } from '@/api/model'
import { userApi } from '@/api/user'
import { fileApi } from '@/api/file'
import { promptApi } from '@/api/prompt'
import Icon from '@/components/common/Icon.vue'
import { ElMessage, ElMessageBox, ElSelect, ElOption } from 'element-plus'

defineOptions({
  name: 'Settings',
})

const router = useRouter()
const userStore = useUserStore()
const chatStore = useChatStore()

const models = ref([])
const loadingModels = ref(false)
const fileInput = ref(null)

const touchStartX = ref(0)
const touchStartY = ref(0)

const handleTouchStart = e => {
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
}

const handleTouchEnd = e => {
  const touchEndX = e.changedTouches[0].clientX
  const touchEndY = e.changedTouches[0].clientY

  const deltaX = touchEndX - touchStartX.value
  const deltaY = Math.abs(touchEndY - touchStartY.value)

  // 确保是水平滑动（垂直位移小于 100px，且右滑位移大于 100px）
  if (deltaY < 300 && deltaX > 100) {
    router.back()
  }
}

const isEditingPrompt = ref(false)
const savingPrompt = ref(false)
const globalPrompt = reactive({
  persona: '',
  rules: '',
  example: [],
})
const editPromptForm = reactive({
  persona: '',
  rules: '',
  example: [],
})

const isEditing = ref(false)
const savingUser = ref(false)
const editForm = reactive({
  username: '',
  email: '',
  phone: '',
  avatar: '',
})

const getFullAvatarUrl = avatar => {
  if (!avatar) return userStore.defaultAvatar
  if (avatar.startsWith('http') || avatar.startsWith('data:')) return avatar
  // const host = import.meta.env.VITE_API_HOST
  const host = `${window.location.origin}`
  return `${host}${avatar}`
}

const displayAvatar = computed(() => {
  if (isEditing.value) {
    return getFullAvatarUrl(editForm.avatar)
  }
  return getFullAvatarUrl(userStore.avatar)
})

const startEditing = () => {
  editForm.username = userStore.username
  editForm.email = userStore.email
  editForm.phone = userStore.phone
  editForm.avatar = userStore.avatar
  isEditing.value = true
}

const cancelEditing = () => {
  isEditing.value = false
}

const togglePromptEnabled = () => {
  chatStore.setPromptEnabled(!chatStore.isPromptEnabled)
}

const fetchGlobalPrompt = async () => {
  try {
    const res = await promptApi.getGlobal()
    globalPrompt.persona = res.persona || ''
    globalPrompt.rules = res.rules || ''
    // 过滤掉可能的空对象，并适配后端新格式 (userMsg/aiMsg -> 用户/AI)
    globalPrompt.example = (res.example || [])
      .map(item => ({
        用户: item.userMsg || '',
        AI: item.aiMsg || '',
      }))
      .filter(item => item['用户'] || item['AI'])
  } catch (error) {
    console.error('获取全局提示词失败:', error)
    ElMessage.error(error.message || '获取全局提示词失败')
  }
}

const startEditingPrompt = () => {
  editPromptForm.persona = globalPrompt.persona
  editPromptForm.rules = globalPrompt.rules
  editPromptForm.example = JSON.parse(JSON.stringify(globalPrompt.example))
  isEditingPrompt.value = true
}

const cancelEditingPrompt = () => {
  isEditingPrompt.value = false
}

const savePrompt = async () => {
  savingPrompt.value = true
  try {
    // 过滤掉未填写的示例，并适配后端新格式 (用户/AI -> userMsg/aiMsg)
    const cleanedExample = (editPromptForm.example || [])
      .filter(item => item['用户']?.trim() || item['AI']?.trim())
      .map(item => ({
        userMsg: item['用户'] || '',
        aiMsg: item['AI'] || '',
      }))
    const dataToSave = {
      ...editPromptForm,
      example: cleanedExample,
    }
    await promptApi.setGlobal(dataToSave)
    globalPrompt.persona = editPromptForm.persona
    globalPrompt.rules = editPromptForm.rules
    // 界面展示依旧使用“用户”和“AI”
    const displayExample = (editPromptForm.example || []).filter(
      item => item['用户']?.trim() || item['AI']?.trim(),
    )
    globalPrompt.example = JSON.parse(JSON.stringify(displayExample))
    // 同步回编辑表单，移除掉被过滤的空白项
    editPromptForm.example = JSON.parse(JSON.stringify(displayExample))
    ElMessage.success('更新成功')
    isEditingPrompt.value = false
  } catch (error) {
    console.error('更新全局提示词失败:', error)
    ElMessage.error(error.message || '更新失败')
  } finally {
    savingPrompt.value = false
  }
}

const addExample = () => {
  if (!editPromptForm.example) {
    editPromptForm.example = []
  }
  editPromptForm.example.push({ 用户: '', AI: '' })
}

const removeExample = index => {
  editPromptForm.example.splice(index, 1)
}

const saveUserInfo = async () => {
  savingUser.value = true
  try {
    await userApi.update(editForm)
    // 更新 store
    userStore.setUserInfo({
      ...userStore.userInfo,
      ...editForm,
    })
    ElMessage.success('更新成功')
    isEditing.value = false
  } catch (error) {
    console.error('更新用户信息失败:', error)
    ElMessage.error(error.message || '更新失败')
  } finally {
    savingUser.value = false
  }
}

const triggerAvatarUpload = () => {
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
    editForm.avatar = res // 假设响应为文件路径字符串
    ElMessage.success('头像上传成功')
  } catch (err) {
    ElMessage.error(err.message || '头像上传失败')
  } finally {
    // 重置 input，允许上传同一张图
    if (event.target) {
      event.target.value = ''
    }
  }
}

const fetchModels = async () => {
  loadingModels.value = true
  try {
    models.value = await chatStore.fetchModels()
  } catch (error) {
    ElMessage.error(error.message || '获取模型列表失败')
  } finally {
    loadingModels.value = false
  }
}

const changeModel = async modelId => {
  if (chatStore.currentModelId === modelId) return
  try {
    const model = models.value.find(m => m.id === modelId)
    await modelApi.change(modelId)
    chatStore.setCurrentModel(modelId, model?.name || '')
    chatStore.setModelSwitched(true)
    ElMessage.success('模型切换成功')
  } catch (error) {
    console.error('切换模型失败:', error)
    ElMessage.error(error.message || '切换模型失败')
  }
}

const handleLogout = () => {
  ElMessageBox.confirm('确定要退出登录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      userStore.logout()
      chatStore.reset()
      ElMessage.success('已退出登录')
      router.push('/home')
    })
    .catch(() => {})
}

onMounted(() => {
  if (!userStore.isLoggedIn) {
    router.push('/home')
    return
  }
  fetchModels()
  fetchGlobalPrompt()
})
</script>

<style scoped lang="scss">
.settings-page {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-main);
  color: var(--text-main);
  /* 确保整个页面容器也支持安全区域 */
  padding-top: var(--safe-area-inset-top);
}

.settings-header {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid var(--border);
  background-color: var(--bg-main);
  flex-shrink: 0;

  .icon-back {
    font-size: 20px;
  }

  .title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-main);
    margin-left: 8px;
  }
}

.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  color: var(--text-sub);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.back-btn:hover {
  background-color: var(--bg-hover);
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px calc(24px + var(--safe-area-inset-bottom));
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.settings-section {
  width: 100%;
  max-width: 800px;
  margin-bottom: 6px;

  .section-title {
    font-size: 17px;
    font-weight: 600;
    color: var(--text-main);
  }
}

.settings-section h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-main);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 35px;
  margin-bottom: 12px;
}

.title-with-switch {
  display: flex;
  align-items: center;
  gap: 16px;
}

.switch-container {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.switch {
  width: 40px;
  height: 20px;
  background-color: var(--border);
  border-radius: 10px;
  position: relative;
  transition: all 0.3s;
}

.switch.active {
  background-color: var(--primary);
}

.switch-handle {
  width: 16px;
  height: 16px;
  background-color: white;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: all 0.3s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.switch.active .switch-handle {
  left: 22px;
}

.switch-label {
  font-size: 13px;
  color: var(--text-sub);
}

.edit-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-sub);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.edit-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-main);
}

.edit-actions {
  display: flex;
  gap: 8px;
}

.save-btn {
  padding: 6px 16px;
  background-color: var(--primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn {
  padding: 6px 16px;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-sub);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.user-card {
  display: flex;
  gap: 24px;
  padding: 24px;
  background-color: var(--bg-card);
  border-radius: 12px;
  align-items: center;
}

@media (max-width: 600px) {
  .user-card {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }
}

.user-avatar-large {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--border);
  position: relative;
  cursor: default;
}

.user-avatar-large.editing {
  cursor: pointer;
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.user-avatar-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hidden-input {
  display: none;
}

.user-info-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 4px;

  &:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    font-size: 13px;
    color: var(--text-sub);
    margin-bottom: 0;
  }

  .field-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;

    label {
      margin-bottom: 0;
    }
  }

  .add-example-btn {
    font-size: 12px;
    color: var(--primary);
    background: none;
    border: 1px solid var(--primary);
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background-color: var(--primary);
      color: white;
    }
  }

  .example-list-edit {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .example-item-edit {
      background: var(--bg-main);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      position: relative;

      .example-inputs {
        display: flex;
        flex-direction: column;
        gap: 12px;

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;

          .input-label {
            font-size: 11px;
            color: var(--text-sub);
            font-weight: 500;
          }

          textarea {
            width: 100%;
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--text-main);
            padding: 10px;
            border-radius: 6px;
            font-size: 14px;
            font-family: inherit;
            line-height: 1.5;
            resize: vertical;
            outline: none;

            &:focus {
              border-color: var(--primary);
            }
          }
        }
      }

      .remove-example-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        font-size: 11px;
        color: #ff4d4f;
        background: none;
        border: 1px solid #ff4d4f;
        padding: 2px 8px;
        border-radius: 4px;
        cursor: pointer;
        opacity: 0.6;
        transition: all 0.2s;

        &:hover {
          opacity: 1;
          background-color: #ff4d4f;
          color: white;
        }
      }
    }
  }

  .example-list-view {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .example-item-view {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 4px;

      &:last-child {
        margin-bottom: 0;
      }

      .view-group {
        margin-bottom: 8px;
        display: flex;
        gap: 8px;

        &:last-child {
          margin-bottom: 0;
        }

        .view-label {
          font-size: 12px;
          color: var(--text-sub);
          font-weight: 600;
          white-space: nowrap;
          width: 40px;
          line-height: 1.5;
        }

        .view-content {
          font-size: 14px;
          color: var(--text-main);
          line-height: 1.5;
          white-space: pre-wrap;
        }
      }
    }
  }

  .no-data {
    text-align: center;
    padding: 20px;
    color: var(--text-sub);
    font-size: 13px;
    background: var(--bg-main);
    border: 1px dashed var(--border);
    border-radius: 8px;
  }

  span {
    font-size: 15px;
    color: var(--text-main);
  }
}

.field input,
.field textarea {
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-main);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.field input:focus,
.field textarea:focus {
  border-color: var(--primary);
}

.field textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  line-height: 1.5;
}

.prompt-card {
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-text {
  font-size: 14px;
  color: var(--text-sub);
  white-space: pre-wrap;
  padding: 11px;
  border-radius: 8px;
  border: 1px solid var(--border);
  line-height: 1.5;
  min-height: 44px;
  background-color: var(--bg-card);
}

.model-select {
  width: 100%;
}

:deep(.el-select__wrapper) {
  background-color: var(--bg-card) !important;
  box-shadow: 0 0 0 1px var(--border) inset !important;
  border-radius: 10px;
  padding: 8px 14px;
  min-height: 44px;
  transition: all 0.2s ease;
}

:deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--primary) inset !important;
}

:deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1.5px var(--primary) inset, 0 0 0 3px rgba(37, 99, 235, 0.2) !important;
}

:deep(.el-select__placeholder) {
  color: var(--text-sub) !important;
}

:deep(.el-select__selection) {
  color: var(--text-main) !important;
  font-size: 14px;
  font-weight: 500;
}

.model-option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
  width: 100%;
}

.model-option-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.model-name {
  font-weight: 600;
  font-size: 14px;
  line-height: 1.4;
  color: var(--text-main);
}

.model-desc {
  font-size: 12px;
  color: var(--text-sub);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-section {
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background-color: #ff4d4f1a;
  color: #ff4d4f;
  border: 1px solid #ff4d4f4d;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.logout-btn:hover {
  background-color: #ff4d4f33;
}

// 移动端适配
@media screen and (max-width: 768px) {
  .settings-header {
    height: 50px;
    padding: 0 12px;

    .title {
      font-size: 16px;
      color: var(--text-main);
    }
    .icon-back {
      font-size: 16px;
    }
  }

  .settings-section {
    .header-title {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .header-subtitle {
      font-size: 11px;
      color: var(--text-sub);
    }

    .section-title {
      font-size: 15px;
    }
  }
}
</style>
