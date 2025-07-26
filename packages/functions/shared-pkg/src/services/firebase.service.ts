import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export class FirebaseService {
  private static instances: Map<string, FirebaseService> = new Map();
  
  private app: FirebaseApp;
  public auth: Auth;
  public db: Firestore;
  public storage: FirebaseStorage;

  private constructor(config: FirebaseConfig, name?: string) {
    this.app = initializeApp(config, name);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.storage = getStorage(this.app);
  }

  static getInstance(env: 'dev' | 'stg' | 'prod'): FirebaseService {
    if (!this.instances.has(env)) {
      const config = this.getConfig(env);
      this.instances.set(env, new FirebaseService(config, env));
    }
    return this.instances.get(env)!;
  }

  private static getConfig(env: string): FirebaseConfig {
    const configs = {
      dev: {
        apiKey: process.env.FIREBASE_API_KEY_DEV || '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN_DEV || '',
        projectId: process.env.FIREBASE_PROJECT_ID_DEV || 'nxt-ai-dev',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET_DEV || '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID_DEV || '',
        appId: process.env.FIREBASE_APP_ID_DEV || '',
      },
      stg: {
        apiKey: process.env.FIREBASE_API_KEY_STG || '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN_STG || '',
        projectId: process.env.FIREBASE_PROJECT_ID_STG || 'nxt-ai-stg',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET_STG || '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID_STG || '',
        appId: process.env.FIREBASE_APP_ID_STG || '',
      },
      prod: {
        apiKey: process.env.FIREBASE_API_KEY_PROD || '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN_PROD || '',
        projectId: process.env.FIREBASE_PROJECT_ID_PROD || 'nxt-ai-prod',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET_PROD || '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID_PROD || '',
        appId: process.env.FIREBASE_APP_ID_PROD || '',
      }
    };

    return configs[env as keyof typeof configs];
  }

  getProjectId(): string {
    return this.app.options.projectId!;
  }
}