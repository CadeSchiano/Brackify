import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { onAuthStateChanged } from 'firebase/auth'
import { useEffect, useState } from 'react'
import '../firebase/client'
import { auth } from '../firebase/client'
import { ensureUserProfile } from '@brackify/firebase'

export default function RootLayout() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => onAuthStateChanged(auth, user => { if (user) void ensureUserProfile(user).catch(error => console.warn('Could not create the user profile.', error)); setSignedIn(Boolean(user)); setReady(true) }), [])
  useEffect(() => {
    if (ready) router.replace(signedIn ? '/(tabs)' : '/(auth)')
  }, [ready, signedIn, router])
  if (!ready) return <><StatusBar style="dark"/><Stack screenOptions={{ headerShown: false }} /></>
  return <><StatusBar style="dark"/><Stack screenOptions={{ headerShown: false, animation: 'fade' }}><Stack.Screen name="(auth)" /><Stack.Screen name="(tabs)" /></Stack></>
}
