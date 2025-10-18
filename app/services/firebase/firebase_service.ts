import admin from 'firebase-admin'

/**
 * Firebase Service - Singleton wrapper for Firebase Admin SDK
 *
 * Provides centralized access to Firebase Auth and Firestore
 */
class FirebaseService {
  /**
   * Get Firebase Auth instance
   */
  get auth() {
    return admin.auth()
  }

  /**
   * Get Firestore instance
   */
  get firestore() {
    return admin.firestore()
  }

  /**
   * Verify a Firebase ID token
   * @param idToken - The Firebase ID token to verify
   * @returns Decoded token with user information
   */
  async verifyIdToken(idToken: string) {
    return this.auth.verifyIdToken(idToken)
  }

  /**
   * Get user by UID from Firebase
   * @param uid - Firebase user UID
   */
  async getUserByUid(uid: string) {
    return this.auth.getUser(uid)
  }

  /**
   * Get user by email from Firebase
   * @param email - User email
   */
  async getUserByEmail(email: string) {
    return this.auth.getUserByEmail(email)
  }
}

// Export singleton instance
export default new FirebaseService()
