import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

let AsyncStorage = null;
if (Platform.OS !== 'web') {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
}

function getFirebaseConfigFromEnv() {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
  const measurementId = process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID;

  const missing = [];
  if (!apiKey) missing.push('EXPO_PUBLIC_FIREBASE_API_KEY');
  if (!authDomain) missing.push('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (!projectId) missing.push('EXPO_PUBLIC_FIREBASE_PROJECT_ID');
  if (!storageBucket) missing.push('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET');
  if (!messagingSenderId) missing.push('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  if (!appId) missing.push('EXPO_PUBLIC_FIREBASE_APP_ID');

  if (missing.length > 0) {
    throw new Error(
      `Firebase ortam değişkenleri eksik: ${missing.join(', ')}. ` +
        'Proje kökünde .env dosyası oluşturun (.env.example dosyasını kopyalayıp doldurun). ' +
        'Değişiklikten sonra Metro’yu yeniden başlatın (npm run start).'
    );
  }

  const config = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
  if (measurementId) {
    config.measurementId = measurementId;
  }
  return config;
}

const firebaseConfig = getFirebaseConfigFromEnv();
const app = initializeApp(firebaseConfig);

let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
