# 🚀 Guia de Deployment - NXT.AI

Este documento fornece instruções detalhadas para fazer o deploy da plataforma NXT.AI em produção.

## 📋 Pré-requisitos

### Contas e Serviços Necessários

1. **Google Cloud Platform / Firebase**
   - Conta Google Cloud com billing habilitado
   - Projeto Firebase criado
   - APIs necessárias habilitadas

2. **Domínio Personalizado (Opcional)**
   - Domínio registrado
   - Acesso ao DNS do domínio

3. **Serviços Externos**
   - Conta Twilio (para WhatsApp Business API)
   - Conta SendGrid ou similar (para email)
   - Conta OpenAI (para IA)

### Ferramentas Locais

```bash
# Node.js 18+
node --version

# Firebase CLI
npm install -g firebase-tools
firebase --version

# Git
git --version
```

## 🔧 Configuração Inicial

### 1. Configuração do Firebase

```bash
# Login no Firebase
firebase login

# Selecione o projeto
firebase use --add your-project-id

# Verifique a configuração
firebase projects:list
```

### 2. Configuração das APIs do Google Cloud

Habilite as seguintes APIs no [Google Cloud Console](https://console.cloud.google.com/):

```bash
# Via gcloud CLI (opcional)
gcloud services enable firestore.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable firebase.googleapis.com
gcloud services enable storage-api.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable pubsub.googleapis.com
```

### 3. Configuração do Firestore

```bash
# Criar banco de dados Firestore
firebase firestore:databases:create --location=us-central1

# Deploy das regras de segurança
firebase deploy --only firestore:rules

# Deploy dos índices
firebase deploy --only firestore:indexes
```

### 4. Configuração do Storage

```bash
# Deploy das regras do Storage
firebase deploy --only storage
```

## 🌍 Variáveis de Ambiente

### Frontend (.env)

Crie o arquivo `packages/web/.env`:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# API Configuration
VITE_API_BASE_URL=https://us-central1-your-project.cloudfunctions.net/api

# Environment
VITE_ENVIRONMENT=production
```

### Backend (Firebase Functions Config)

```bash
# Configurações de produção
firebase functions:config:set \
  app.environment=production \
  app.cors_origins="https://your-domain.com,https://app.your-domain.com" \
  whatsapp.api_url="https://graph.facebook.com/v18.0" \
  whatsapp.webhook_verify_token="your_webhook_verify_token" \
  email.provider="sendgrid" \
  email.api_key="your_sendgrid_api_key" \
  email.from_email="noreply@your-domain.com" \
  email.from_name="NXT.AI" \
  openai.api_key="your_openai_api_key" \
  openai.model="gpt-4" \
  storage.bucket="your-project.appspot.com" \
  analytics.ga_measurement_id="G-XXXXXXXXXX"

# Verificar configurações
firebase functions:config:get
```

## 🏗️ Build e Deploy

### Deploy Completo (Primeira vez)

```bash
# 1. Build do frontend
cd packages/web
npm install
npm run build

# 2. Build do backend
cd ../functions
npm install
npm run build

# 3. Deploy completo
cd ../..
firebase deploy
```

### Deploy Seletivo

```bash
# Apenas Functions
firebase deploy --only functions

# Apenas Hosting
firebase deploy --only hosting

# Apenas Firestore rules
firebase deploy --only firestore:rules

# Apenas Storage rules
firebase deploy --only storage

# Múltiplos serviços
firebase deploy --only functions,hosting
```

### Deploy com Targets (Múltiplos Ambientes)

```bash
# Configurar targets
firebase target:apply hosting production your-project
firebase target:apply hosting staging your-project-staging

# Deploy para staging
firebase use staging
firebase deploy --only hosting:staging

# Deploy para produção
firebase use production
firebase deploy --only hosting:production
```

## 🌐 Configuração de Domínio Personalizado

### 1. Adicionar Domínio no Firebase

```bash
# Via Firebase Console ou CLI
firebase hosting:sites:create your-custom-domain
```

### 2. Configurar DNS

Adicione os seguintes registros DNS:

```
# Para domínio principal (example.com)
A     @     151.101.1.195
A     @     151.101.65.195

# Para subdomínio (app.example.com)
CNAME app   your-project.web.app
```

### 3. Verificar Domínio

```bash
# Verificar status do domínio
firebase hosting:sites:list
```

## 🔒 Configuração de Segurança

### 1. Firestore Security Rules

As regras já estão configuradas no arquivo `firestore.rules`. Para aplicar:

```bash
firebase deploy --only firestore:rules
```

### 2. Storage Security Rules

As regras já estão configuradas no arquivo `storage.rules`. Para aplicar:

```bash
firebase deploy --only storage
```

### 3. CORS Configuration

Configure CORS para as Cloud Functions:

```bash
# Já configurado no código, mas pode ser ajustado via:
firebase functions:config:set app.cors_origins="https://your-domain.com"
```

## 📊 Monitoramento e Logs

### 1. Configurar Alertas

```bash
# Instalar gcloud CLI
curl https://sdk.cloud.google.com | bash

# Configurar alertas de erro
gcloud alpha monitoring policies create --policy-from-file=monitoring-policy.yaml
```

### 2. Visualizar Logs

```bash
# Logs das Functions
firebase functions:log

# Logs específicos
firebase functions:log --only functionName

# Logs em tempo real
firebase functions:log --follow
```

### 3. Métricas de Performance

Acesse o [Firebase Console](https://console.firebase.google.com) para:
- Performance Monitoring
- Crashlytics
- Analytics
- Usage and Billing

## 🔄 CI/CD com GitHub Actions

### 1. Configurar Secrets

No GitHub, vá em Settings > Secrets e adicione:

```
FIREBASE_TOKEN=your_firebase_ci_token
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef123456
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
SLACK_WEBHOOK=your_slack_webhook_url
```

### 2. Obter Firebase Token

```bash
firebase login:ci
# Copie o token gerado e adicione como FIREBASE_TOKEN no GitHub
```

### 3. Configurar Ambientes

No GitHub, configure os ambientes:
- `staging` - para branch `develop`
- `production` - para branch `main`

## 🧪 Testes em Produção

### 1. Smoke Tests

```bash
# Teste básico de saúde
curl -f https://your-domain.com/health

# Teste de autenticação
curl -f https://your-domain.com/api/health
```

### 2. Testes de Carga

```bash
# Instalar Artillery
npm install -g artillery

# Executar teste de carga
artillery run load-test.yml
```

### 3. Monitoramento Contínuo

Configure monitoramento com:
- [Uptime Robot](https://uptimerobot.com/)
- [Pingdom](https://www.pingdom.com/)
- [New Relic](https://newrelic.com/)

## 🔧 Troubleshooting

### Problemas Comuns

#### 1. Erro de Permissões

```bash
# Verificar permissões do projeto
gcloud projects get-iam-policy your-project-id

# Adicionar permissões necessárias
gcloud projects add-iam-policy-binding your-project-id \
  --member="user:your-email@gmail.com" \
  --role="roles/firebase.admin"
```

#### 2. Erro de Quota

```bash
# Verificar quotas
gcloud compute project-info describe --project=your-project-id

# Solicitar aumento de quota no Console
```

#### 3. Erro de Build

```bash
# Limpar cache
npm cache clean --force

# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

#### 4. Erro de Deploy

```bash
# Verificar status do Firebase
firebase status

# Forçar redeploy
firebase deploy --force
```

### Logs de Debug

```bash
# Habilitar logs detalhados
export DEBUG=*
firebase deploy --debug

# Logs das Functions
firebase functions:log --limit 100
```

## 📈 Otimização de Performance

### 1. Frontend

```bash
# Análise do bundle
cd packages/web
npm run build
npx webpack-bundle-analyzer dist/static/js/*.js
```

### 2. Backend

```bash
# Otimizar Functions
# - Usar memory adequada
# - Configurar timeout apropriado
# - Implementar connection pooling
```

### 3. Database

```bash
# Verificar índices
firebase firestore:indexes

# Monitorar performance
# Via Firebase Console > Firestore > Usage
```

## 🔄 Backup e Recuperação

### 1. Backup Automático

```bash
# Configurar backup do Firestore
gcloud firestore export gs://your-backup-bucket/firestore-backup
```

### 2. Backup Manual

```bash
# Export de dados
firebase firestore:export backup-$(date +%Y%m%d)
```

### 3. Recuperação

```bash
# Import de dados
firebase firestore:import backup-20240125
```

## 📋 Checklist de Deploy

### Pré-Deploy

- [ ] Testes passando
- [ ] Build sem erros
- [ ] Variáveis de ambiente configuradas
- [ ] Backup realizado
- [ ] Equipe notificada

### Deploy

- [ ] Deploy realizado com sucesso
- [ ] Smoke tests passando
- [ ] Logs sem erros críticos
- [ ] Métricas normais

### Pós-Deploy

- [ ] Funcionalidades testadas
- [ ] Performance verificada
- [ ] Usuários notificados (se necessário)
- [ ] Documentação atualizada

## 🆘 Rollback

### Rollback Rápido

```bash
# Rollback do Hosting
firebase hosting:clone source-site-id:source-version-id target-site-id

# Rollback das Functions
firebase functions:delete functionName
firebase deploy --only functions
```

### Rollback Completo

```bash
# Voltar para versão anterior
git revert HEAD
firebase deploy
```

## 📞 Suporte

### Contatos de Emergência

- **DevOps**: devops@nxtai.com
- **Backend**: backend@nxtai.com
- **Frontend**: frontend@nxtai.com

### Recursos Úteis

- [Firebase Documentation](https://firebase.google.com/docs)
- [Google Cloud Status](https://status.cloud.google.com/)
- [Firebase Status](https://status.firebase.google.com/)

---

**⚠️ Importante**: Sempre teste em ambiente de staging antes de fazer deploy em produção!

