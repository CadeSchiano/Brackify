import AsyncStorage from '@react-native-async-storage/async-storage'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth'
import { firebaseConfig } from '@brackify/firebase'

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

// Expo needs AsyncStorage-backed persistence so sessions survive an app restart.
export const auth = (() => {
  try { return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }) }
  catch { return getAuth(app) }
})()
export const db = getFirestore(app)
