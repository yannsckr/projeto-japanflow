import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.japanflow.mobile',
  appName: 'JapanFlow COSMOS',
  webDir: 'dist-android',
  server: { androidScheme: 'https' },
};

export default config;
