import env from '#start/env'

const firebaseConfig = {
  projectId: env.get('FIREBASE_PROJECT_ID'),
  clientEmail: env.get('FIREBASE_CLIENT_EMAIL'),
  privateKey: env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
}

export default firebaseConfig
