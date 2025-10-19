import { useState } from 'react'
import { router } from '@inertiajs/react'
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import auth from '@/lib/firebase'

interface SignInWithEmailPasswordParams {
  email: string
  password: string
}

interface SignUpParams {
  fullName: string
  email: string
  password: string
}

export function useAuth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Sign in with Google (Firebase + Backend)
   */
  const signInWithGoogle = async () => {
    setLoading(true)
    setError(null)

    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)

      // Get Firebase ID token
      const idToken = await result.user.getIdToken()

      // Send to backend for verification and JWT generation
      const response = await fetch('/api/v1/auth/google/sign-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.errors?.[0]?.message || 'Authentication failed')
      }

      const data = await response.json()

      // Redirect to onboarding or dashboard
      // Backend already set JWT cookies, just redirect
      if (data.is_new_user) {
        router.visit('/onboarding')
      } else {
        router.visit('/dashboard')
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err)
      setError(err.message || 'Failed to sign in with Google')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Sign in with Email/Password (Traditional)
   */
  const signInWithEmailPassword = async ({ email, password }: SignInWithEmailPasswordParams) => {
    setLoading(true)
    setError(null)

    try {
      // Use backend endpoint (not Firebase directly)
      const response = await fetch('/api/v1/sessions/sign-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid: email, password }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.errors?.[0]?.message || 'Invalid credentials')
      }

      const data = await response.json()

      // Redirect to dashboard
      router.visit('/dashboard')
    } catch (err: any) {
      console.error('Email sign-in error:', err)
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Sign up with Email/Password
   */
  const signUp = async ({ fullName, email, password }: SignUpParams) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/v1/sessions/sign-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ full_name: fullName, email, password }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.errors?.[0]?.message || 'Registration failed')
      }

      const data = await response.json()

      // Redirect to onboarding
      router.visit('/onboarding')
    } catch (err: any) {
      console.error('Sign-up error:', err)
      setError(err.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Sign out
   */
  const signOut = async () => {
    setLoading(true)
    setError(null)

    try {
      // Sign out from Firebase
      await firebaseSignOut(auth)

      // Clear backend cookies and redirect to login
      router.post('/api/v1/sessions/sign-out', {}, {
        onSuccess: () => {
          router.visit('/login')
        },
        onError: (errors) => {
          console.error('Sign-out error:', errors)
          // Even if backend fails, still redirect to login
          router.visit('/login')
        }
      })
    } catch (err: any) {
      console.error('Sign-out error:', err)
      setError(err.message || 'Failed to sign out')
      // Redirect to login even on error
      router.visit('/login')
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    signInWithGoogle,
    signInWithEmailPassword,
    signUp,
    signOut,
  }
}
