import router from '@adonisjs/core/services/router'

const AuthPagesController = () => import('#controllers/auth/auth_pages_controller')

/**
 * Inertia Auth Pages Routes
 *
 * These routes render Inertia pages for authentication flow
 * (login, register, onboarding). They should be public (no auth middleware).
 */
// Login page
router.get('/login', [AuthPagesController, 'login']).as('auth.login')

// Register page
router.get('/register', [AuthPagesController, 'register']).as('auth.register')

// Onboarding page (for new users after registration)
router.get('/onboarding', [AuthPagesController, 'onboarding']).as('auth.onboarding')
