import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/pages/Home.vue'
import Settings from '@/pages/Settings.vue'

const routes = [
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
  },
  {
    path: '/:sessionId?',
    name: 'Home',
    component: Home,
  },
  // 404 重定向到首页
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
