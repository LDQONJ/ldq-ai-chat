<template>
  <div class="chat-window">
    <template v-if="messages.length > 0">
      <MessageItem
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />
    </template>
    <template v-else>
      <SplitText
        text="你好，想聊点什么？"
        class-name="hello-text"
        :delay="50"
        :duration="0.6"
        ease="power3.out"
        split-type="chars"
        :from="{ opacity: 0, y: 40 }"
        :to="{ opacity: 1, y: 0 }"
        :threshold="0.1"
        root-margin="-100px"
        text-align="center"
      />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChatStore } from '@/store/chat'
import MessageItem from '@/components/MessageItem.vue'
import SplitText from '@/components/common/SplitText.vue'
const store = useChatStore()
const messages = computed(() => store.messages)
</script>

<style scoped lang="scss">
.chat-window {
  flex: 1;
  padding: calc(70px + var(--safe-area-inset-top)) 0px
    calc(var(--input-container-height) + var(--footer-height) - 55px) 0px;
  scroll-padding-bottom: calc(
    var(--input-container-height) + var(--footer-height) - 65px
  );
  max-width: 800px;
  width: 100%;
}

.hello-text {
  font-size: 24px;
  font-weight: 600;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
  -webkit-user-select: none;
}

.is-mobile .hello-text {
  font-size: 20px;
}
</style>
