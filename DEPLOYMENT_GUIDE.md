# 🚀 Guia de Deploy - NXT.AI

## 📋 Pré-requisitos

- Node.js 20+
- Firebase CLI
- Conta no Firebase
- Conta no Google Cloud Platform
- Conta na Anthropic (para Claude)

## 🔧 Configuração Inicial

### 1. Clonar e Instalar Dependências

```bash
git clone https://github.com/seu-usuario/nxtai-production.git
cd nxtai-production
npm install
```

### 2. Configurar Firebase

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login no Firebase
firebase login

# Inicializar projeto (se necessário)
firebase init

# Selecionar:
# - Functions
# - Firestore
# - Hosting
# - Storage
```

### 3. Configurar Variáveis de Ambiente

Copie os arquivos `.env.example` e configure:

```bash
# Frontend
cd packages/web
cp .env.example .env.local
# Edite .env.local com suas configurações

# Functions
cd ../functions
cp .env.example .env
# Edite .env com suas configurações
```

### 4. Configurar Firebase

```bash
# Definir configurações do Firebase Functions
firebase functions:config:set \
  anthropic.api_key="your_anthropic_key" \
  sendgrid.api_key="your_sendgrid_key" \
  app.environment="production"
```

## 🏗️ Build e Deploy

### 1. Build do Frontend

```bash
cd packages/web
npm run build
```

### 2. Build das Functions

```bash
cd packages/functions
npm run build
```

### 3. Deploy Completo

```bash
# Deploy tudo
firebase deploy

# Ou deploy específico
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore
```

## 🔒 Configuração de Segurança

### 1. Firestore Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && 
        resource.data.organizationId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationId;
    }
    
    // Agents
    match /agents/{agentId} {
      allow read, write: if request.auth != null && 
        resource.data.organizationId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationId;
    }
    
    // Conversations
    match /conversations/{conversationId} {
      allow read, write: if request.auth != null;
    }
    
    // Messages
    match /messages/{messageId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 2. Storage Rules

```javascript
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /attachments/{organizationId}/{allPaths=**} {
      allow read, write: if request.auth != null && 
        request.auth.token.organizationId == organizationId;
    }
  }
}
```

## 📊 Monitoramento

### 1. Firebase Performance

```typescript
// packages/web/src/config/performance.ts
import { getPerformance } from 'firebase/performance';
import { app } from './firebase';

export const performance = getPerformance(app);
```

### 2. Error Monitoring

```typescript
// packages/functions/src/utils/monitoring.ts
import { logger } from 'firebase-functions/v2';

export function logError(error: Error, context?: any) {
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    context
  });
}
```

## 🔄 CI/CD com GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Firebase

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Build
      run: npm run build:all
    
    - name: Deploy to Firebase
      uses: FirebaseExtended/action-hosting-deploy@v0
      with:
        repoToken: '${{ secrets.GITHUB_TOKEN }}'
        firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
        channelId: live
        projectId: your-project-id
```

## 🧪 Testes

### 1. Testes Unitários

```bash
# Frontend
cd packages/web
npm run test

# Functions
cd packages/functions
npm run test
```

### 2. Testes de Integração

```bash
# Com emuladores
firebase emulators:start
npm run test:integration
```

## 📈 Otimização

### 1. Bundle Analysis

```bash
cd packages/web
npm run analyze
```

### 2. Performance Monitoring

```bash
# Lighthouse CI
npm install -g @lhci/cli
lhci autorun
```

## 🔧 Troubleshooting

### Problemas Comuns

1. **Erro de Permissão do Firebase**
   ```bash
   firebase logout
   firebase login
   ```

2. **Build Failing**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Functions Deploy Error**
   ```bash
   cd packages/functions
   npm run build
   firebase deploy --only functions
   ```

## 📱 Deploy Mobile (Futuro)

```bash
# React Native / Expo
cd packages/mobile
expo build:android
expo build:ios
```

## 🌍 Ambientes

### Development
- Firebase Project: `nxtai-dev`
- URL: `https://nxtai-dev.web.app`

### Staging
- Firebase Project: `nxtai-stg`
- URL: `https://nxtai-stg.web.app`

### Production
- Firebase Project: `nxtai-prod`
- URL: `https://nxtai.com`

## 📋 Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Firebase configurado
- [ ] Testes passando
- [ ] Build sem erros
- [ ] Firestore rules atualizadas
- [ ] Storage rules atualizadas
- [ ] Monitoramento configurado
- [ ] Backup da produção atual
- [ ] Deploy realizado
- [ ] Testes de fumaça
- [ ] Monitoramento ativo

## 🆘 Rollback

Em caso de problemas:

```bash
# Rollback hosting
firebase hosting:releases:list
firebase hosting:releases:rollback <RELEASE_ID>

# Rollback functions
firebase functions:log
# Deploy versão anterior manualmente
```

## 📞 Suporte

- **Documentação**: /docs
- **Issues**: GitHub Issues
- **Email**: devops@nxtai.com