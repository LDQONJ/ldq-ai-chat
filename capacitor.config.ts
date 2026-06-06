import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'work.daqian.ai',
  appName: "LDQ's AI",
  webDir: 'D:\\00.Dev\\nginx-1.31.0\\html\\my-ai-chat',
  plugins: {
    StatusBar: {
      overlaysWebView: true,
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#ffffffff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
}

export default config;
