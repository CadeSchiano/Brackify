import { getAuth } from 'firebase/auth'
import { firebaseApp, db } from '@brackify/firebase'

// Shared Firebase project used by the organizer dashboard.
export { db }
export const auth = getAuth(firebaseApp)
