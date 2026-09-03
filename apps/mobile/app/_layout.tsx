import { Redirect, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { onAuthStateChanged } from 'firebase/auth'
import { useEffect, useState } from 'react'
import '../firebase/client'
import { auth } from '../firebase/client'
import { ensureUserProfile } from '@brackify/firebase'

export default function RootLayout() {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => onAuthStateChanged(auth, user => { if (user) void ensureUserProfile(user); setSignedIn(Boolean(user)); setReady(true) }), [])
  if (!ready) return <><StatusBar style="dark"/><Stack screenOptions={{ headerShown: false }} /></>
  return <><StatusBar style="dark"/><Stack screenOptions={{ headerShown: false, animation: 'fade' }}><Stack.Screen name="(auth)" /><Stack.Screen name="(tabs)" /></Stack><Redirect href={signedIn ? '/(tabs)' : '/'} /></>
}
