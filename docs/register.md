## 📚 Guia Completo - Como Usar Cloud Functions no Firebase

### 1. **Instalação e Configuração Inicial**

```bash
# 1. Instalar Firebase CLI globalmente
npm install -g firebase-tools

# 2. Fazer login no Firebase
firebase login

# 3. Inicializar o projeto (se ainda não foi feito)
firebase init

# Selecione:
# - Functions: Configure a Cloud Functions directory
# - TypeScript (recomendado)
# - ESLint (sim)
# - Instalar dependências (sim)
```

### 2. **Estrutura de Arquivos das Functions**

```
packages/functions/
├── src/
│   ├── index.ts          # Arquivo principal que exporta todas as functions
│   ├── api/              # HTTP endpoints
│   │   ├── contact.ts
│   │   └── users.ts
│   ├── triggers/         # Triggers do Firestore/Auth
│   │   ├── onUserCreate.ts
│   │   └── onOrderCreate.ts
│   ├── scheduled/        # Funções agendadas (cron)
│   │   └── dailyReport.ts
│   └── utils/           # Funções auxiliares
│       └── helpers.ts
├── lib/                 # Código compilado (gerado automaticamente)
├── package.json
├── tsconfig.json
└── .eslintrc.js
```

### 3. **Tipos de Cloud Functions**

#### **3.1 HTTP Functions (APIs REST)**

**`src/api/hello.ts`**

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';

// Configurar CORS
const corsHandler = cors({ origin: true });

// Função HTTP simples
export const helloWorld = functions.https.onRequest((request, response) => {
  corsHandler(request, response, () => {
    response.json({ message: "Hello from Firebase!" });
  });
});

// Função HTTP com validação
export const createUser = functions.https.onRequest(async (request, response) => {
  corsHandler(request, response, async () => {
    try {
      // Validar método
      if (request.method !== 'POST') {
        response.status(405).json({ error: 'Method not allowed' });
        return;
      }

      // Pegar dados do body
      const { name, email } = request.body;

      // Validar dados
      if (!name || !email) {
        response.status(400).json({ error: 'Name and email are required' });
        return;
      }

      // Criar usuário no Firestore
      const db = admin.firestore();
      const userRef = await db.collection('users').add({
        name,
        email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      response.status(201).json({
        success: true,
        id: userRef.id,
        message: 'User created successfully',
      });

    } catch (error) {
      console.error('Error creating user:', error);
      response.status(500).json({ error: 'Internal server error' });
    }
  });
});
```

#### **3.2 Firestore Triggers**

**`src/triggers/onUserCreate.ts`**

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Trigger quando um documento é criado
export const onUserCreate = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snapshot, context) => {
    const userData = snapshot.data();
    const userId = context.params.userId;

    console.log(`Novo usuário criado: ${userId}`, userData);

    // Enviar email de boas-vindas
    await admin.firestore().collection('mail').add({
      to: userData.email,
      template: {
        name: 'welcome',
        data: {
          name: userData.name,
        },
      },
    });

    // Criar documento de configurações do usuário
    await admin.firestore().collection('user_settings').doc(userId).set({
      notifications: true,
      theme: 'light',
      language: 'pt-BR',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

// Trigger quando um documento é atualizado
export const onUserUpdate = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    
    console.log('Usuário atualizado:', {
      before: beforeData,
      after: afterData,
    });

    // Verificar mudanças específicas
    if (beforeData.email !== afterData.email) {
      // Email mudou - enviar verificação
      console.log('Email alterado, enviando verificação...');
    }
  });

// Trigger quando um documento é deletado
export const onUserDelete = functions.firestore
  .document('users/{userId}')
  .onDelete(async (snapshot, context) => {
    const userId = context.params.userId;
    
    // Limpar dados relacionados
    const batch = admin.firestore().batch();
    
    // Deletar configurações
    batch.delete(admin.firestore().doc(`user_settings/${userId}`));
    
    // Deletar posts do usuário
    const posts = await admin.firestore()
      .collection('posts')
      .where('userId', '==', userId)
      .get();
    
    posts.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
    console.log(`Dados do usuário ${userId} removidos`);
  });
```

#### **3.3 Authentication Triggers**

**`src/triggers/onAuthCreate.ts`**

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Quando um usuário se registra
export const onAuthUserCreate = functions.auth.user().onCreate(async (user) => {
  console.log('Novo usuário autenticado:', user.email);

  // Criar perfil no Firestore
  await admin.firestore().collection('users').doc(user.uid).set({
    email: user.email,
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    role: 'user', // Definir role padrão
  });

  // Definir custom claims
  await admin.auth().setCustomUserClaims(user.uid, {
    role: 'user',
    level: 1,
  });
});

// Quando um usuário é deletado
export const onAuthUserDelete = functions.auth.user().onDelete(async (user) => {
  // Deletar todos os dados do usuário
  await admin.firestore().collection('users').doc(user.uid).delete();
});
```

#### **3.4 Scheduled Functions (Cron Jobs)**

**`src/scheduled/dailyTasks.ts`**

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Executar todos os dias às 9h
export const dailyReport = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('America/Sao_Paulo')
  .onRun(async (context) => {
    console.log('Executando relatório diário...');

    const db = admin.firestore();
    
    // Contar novos usuários nas últimas 24h
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const newUsers = await db.collection('users')
      .where('createdAt', '>', yesterday)
      .get();

    // Enviar relatório
    await db.collection('mail').add({
      to: 'admin@nxtai.com',
      subject: 'Relatório Diário',
      html: `
        <h2>Relatório Diário</h2>
        <p>Novos usuários: ${newUsers.size}</p>
        <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
      `,
    });
  });

// Limpar dados antigos - executar toda segunda às 3h
export const cleanupOldData = functions.pubsub
  .schedule('0 3 * * 1')
  .onRun(async (context) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Deletar logs antigos
    const oldLogs = await admin.firestore()
      .collection('logs')
      .where('createdAt', '<', thirtyDaysAgo)
      .get();

    const batch = admin.firestore().batch();
    oldLogs.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
    console.log(`${oldLogs.size} logs antigos deletados`);
  });
```

#### **3.5 Storage Triggers**

**`src/triggers/onStorageUpload.ts`**

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as path from 'path';

// Quando um arquivo é enviado
export const onFileUpload = functions.storage.object().onFinalize(async (object) => {
  const filePath = object.name!;
  const fileName = path.basename(filePath);
  const contentType = object.contentType;

  // Processar apenas imagens
  if (!contentType?.startsWith('image/')) {
    console.log('Não é uma imagem, ignorando...');
    return;
  }

  // Salvar metadados no Firestore
  await admin.firestore().collection('uploads').add({
    fileName,
    filePath,
    contentType,
    size: object.size,
    uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    bucket: object.bucket,
    downloadUrl: `https://storage.googleapis.com/${object.bucket}/${filePath}`,
  });

  console.log(`Arquivo ${fileName} processado`);
});
```

### 4. **Arquivo Principal index.ts**

**`src/index.ts`**

```typescript
import * as admin from 'firebase-admin';

// Inicializar admin
admin.initializeApp();

// Exportar todas as functions

// HTTP Functions
export { helloWorld, createUser } from './api/hello';
export { apiContactFormCreate } from './api/contact';

// Firestore Triggers
export { onUserCreate, onUserUpdate, onUserDelete } from './triggers/onUserCreate';

// Auth Triggers
export { onAuthUserCreate, onAuthUserDelete } from './triggers/onAuthCreate';

// Scheduled Functions
export { dailyReport, cleanupOldData } from './scheduled/dailyTasks';

// Storage Triggers
export { onFileUpload } from './triggers/onStorageUpload';
```

### 5. **Configuração e Variáveis de Ambiente**

#### **5.1 Definir variáveis de ambiente**

```bash
# Definir variáveis
firebase functions:config:set gmail.user="seu-email@gmail.com"
firebase functions:config:set gmail.password="sua-senha-app"
firebase functions:config:set app.name="NXT.AI"

# Ver todas as variáveis
firebase functions:config:get

# Usar em produção
const gmailUser = functions.config().gmail.user;
```

#### **5.2 Usar arquivo .env local**

```bash
# Criar arquivo .env.local
GMAIL_USER=seu-email@gmail.com
GMAIL_PASSWORD=sua-senha-app

# No código
const gmailUser = process.env.GMAIL_USER;
```

### 6. **Testes e Emuladores**

#### **6.1 Executar emuladores localmente**

```bash
# Iniciar todos os emuladores
firebase emulators:start

# Apenas functions e firestore
firebase emulators:start --only functions,firestore

# Com dados de exemplo
firebase emulators:start --import ./emulator-data
```

#### **6.2 Testar functions localmente**

```bash
# Shell interativo
npm run shell

# No shell
> helloWorld({method: "GET"}, {send: (data) => console.log(data)})
```

#### **6.3 Testes unitários**

```typescript
// test/index.test.ts
import * as functions from 'firebase-functions-test';
import * as admin from 'firebase-admin';

const test = functions();

describe('Cloud Functions', () => {
  it('should create user', async () => {
    const wrapped = test.wrap(myFunctions.createUser);
    const data = { name: 'Test', email: 'test@test.com' };
    await wrapped(data);
    // Verificar resultado
  });
});
```

### 7. **Deploy e Gerenciamento**

#### **7.1 Deploy**

```bash
# Deploy todas as functions
firebase deploy --only functions

# Deploy função específica
firebase deploy --only functions:helloWorld

# Deploy múltiplas funções
firebase deploy --only functions:helloWorld,functions:createUser

# Ver o que será deployado (dry run)
firebase deploy --only functions --dry-run
```

#### **7.2 Logs e Monitoramento**

```bash
# Ver logs de todas as functions
firebase functions:log

# Ver logs de uma função específica
firebase functions:log --only helloWorld

# Ver últimas 50 linhas
firebase functions:log --lines 50

# Seguir logs em tempo real
firebase functions:log --follow
```

#### **7.3 Deletar Functions**

```bash
# Deletar uma função
firebase functions:delete helloWorld

# Deletar múltiplas
firebase functions:delete helloWorld createUser
```

### 8. **Boas Práticas**

#### **8.1 Organização de Código**

```typescript
// Separar lógica de negócios
// services/userService.ts
export class UserService {
  async createUser(data: any) {
    // Lógica de criação
  }
  
  async sendWelcomeEmail(email: string) {
    // Lógica de email
  }
}

// Na function
import { UserService } from '../services/userService';

export const createUser = functions.https.onRequest(async (req, res) => {
  const userService = new UserService();
  await userService.createUser(req.body);
});
```

#### **8.2 Error Handling**

```typescript
export const safeFunction = functions.https.onRequest(async (req, res) => {
  try {
    // Seu código
    res.json({ success: true });
  } catch (error) {
    console.error('Erro:', error);
    
    // Erro conhecido
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    
    // Erro desconhecido
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### **8.3 Performance**

```typescript
// Importar apenas o necessário
import { firestore } from 'firebase-admin';
// Em vez de
import * as admin from 'firebase-admin';

// Reutilizar instâncias
let db: firestore.Firestore;

export const myFunction = functions.https.onRequest(async (req, res) => {
  if (!db) {
    db = firestore();
  }
  // Usar db
});
```

### 9. **Configuração de Região**

```typescript
// Definir região (padrão é us-central1)
export const brazilFunction = functions
  .region('southamerica-east1') // São Paulo
  .https.onRequest(async (req, res) => {
    res.json({ region: 'Brazil' });
  });
```

### 10. **Exemplo Completo: Sistema de Notificações**

```typescript
// src/notifications/index.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface Notification {
  userId: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'error';
  data?: any;
}

// API para enviar notificação
export const sendNotification = functions.https.onRequest(async (req, res) => {
  try {
    const notification: Notification = req.body;
    
    // Salvar no Firestore
    const notifRef = await admin.firestore()
      .collection('users')
      .doc(notification.userId)
      .collection('notifications')
      .add({
        ...notification,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Enviar push notification se o usuário tiver token
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(notification.userId)
      .get();

    const userData = userDoc.data();
    
    if (userData?.fcmToken) {
      await admin.messaging().send({
        token: userData.fcmToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data,
      });
    }

    res.json({ success: true, id: notifRef.id });
    
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Marcar como lida
export const markAsRead = functions.firestore
  .document('users/{userId}/notifications/{notifId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    if (!before.read && after.read) {
      // Atualizar contador de não lidas
      await admin.firestore()
        .collection('users')
        .doc(context.params.userId)
        .update({
          unreadNotifications: admin.firestore.FieldValue.increment(-1),
        });
    }
  });

// Limpar notificações antigas
export const cleanOldNotifications = functions.pubsub
  .schedule('0 2 * * *')
  .onRun(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const batch = admin.firestore().batch();
    let count = 0;
    
    // Buscar todas as notificações antigas
    const users = await admin.firestore().collection('users').get();
    
    for (const userDoc of users.docs) {
      const oldNotifs = await userDoc.ref
        .collection('notifications')
        .where('createdAt', '<', thirtyDaysAgo)
        .where('read', '==', true)
        .get();
        
      oldNotifs.forEach(doc => {
        batch.delete(doc.ref);
        count++;
      });
    }
    
    await batch.commit();
    console.log(`${count} notificações antigas deletadas`);
  });
```

### Resumo de Comandos Úteis

```bash
# Desenvolvimento
firebase emulators:start              # Iniciar emuladores
firebase functions:shell              # Shell interativo
firebase functions:log --follow       # Logs em tempo real

# Deploy
firebase deploy --only functions      # Deploy todas
firebase deploy --only functions:nome # Deploy específica

# Configuração
firebase functions:config:set key=value  # Definir variável
firebase functions:config:get            # Ver variáveis

# Gerenciamento
firebase functions:delete nome        # Deletar function
firebase functions:list               # Listar functions
```

Com este guia, você tem tudo que precisa para trabalhar com Cloud Functions no Firebase! 🚀