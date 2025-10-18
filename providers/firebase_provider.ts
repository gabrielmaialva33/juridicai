import type { ApplicationService } from '@adonisjs/core/types'
import admin from 'firebase-admin'
import firebaseConfig from '#config/firebase'

export default class FirebaseProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register bindings to the container
   */
  register() {}

  /**
   * The container bindings have booted
   */
  async boot() {
    // Only initialize if Firebase credentials are configured
    if (!firebaseConfig.projectId || !firebaseConfig.clientEmail || !firebaseConfig.privateKey) {
      console.warn('Firebase credentials not configured. Skipping Firebase Admin SDK initialization.')
      return
    }

    // Initialize Firebase Admin SDK only if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: firebaseConfig.projectId,
          clientEmail: firebaseConfig.clientEmail,
          privateKey: firebaseConfig.privateKey,
        }),
      })
    }
  }

  /**
   * The application has been booted
   */
  async start() {}

  /**
   * Preparing to shutdown the app
   */
  async shutdown() {
    // Clean up Firebase Admin SDK
    await Promise.all(admin.apps.map((app) => app?.delete()))
  }
}
