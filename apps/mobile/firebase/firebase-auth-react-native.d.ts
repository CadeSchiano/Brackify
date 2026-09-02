import 'firebase/auth'

// Metro resolves the React Native condition in Firebase's package exports. TypeScript
// currently selects Firebase's generic browser declaration instead, so add the RN-only
// persistence export here for type checking.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>
    setItem(key: string, value: string): Promise<void>
    removeItem(key: string): Promise<void>
  }): import('firebase/auth').Persistence
}
