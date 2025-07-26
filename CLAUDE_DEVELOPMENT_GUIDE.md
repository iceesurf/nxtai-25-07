# 🤖 Guia Completo para Desenvolvimento com Claude - NXT.AI

## 📋 Visão Geral do Sistema

O **NXT.AI** é uma plataforma de automação inteligente construída com:
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Firebase Functions + Node.js 20
- **Database**: Firestore + BigQuery
- **AI/ML**: Dialogflow CX + Anthropic Claude
- **Infraestrutura**: Google Cloud Platform + Firebase

---

## 🎯 Como Criar Prompts Eficazes para o Claude

### 1. **Estrutura Base do Prompt**

```
CONTEXTO DO PROJETO:
- Plataforma: NXT.AI (automação inteligente)
- Arquitetura: React/TypeScript + Firebase Functions
- Estado: Sistema em produção ativo
- Objetivo: [descreva o que precisa ser feito]

ARQUIVOS RELEVANTES:
- /packages/web/ - Frontend React
- /packages/functions/ - Cloud Functions
- /packages/shared/ - Código compartilhado
- /dialogflow/ - Configurações de IA

TAREFA ESPECÍFICA:
[Descreva detalhadamente o que precisa ser implementado]
```

### 2. **Templates de Prompts por Categoria**

#### 🔧 **Para Desenvolvimento de Features**
```
Preciso implementar uma nova funcionalidade no NXT.AI:

FEATURE: [Nome da funcionalidade]
DESCRIÇÃO: [O que a feature deve fazer]

REQUISITOS TÉCNICOS:
- Frontend: React + TypeScript
- Backend: Firebase Functions
- Database: Firestore
- Autenticação: Firebase Auth
- Estado: Zustand

ARQUIVOS A MODIFICAR:
- Frontend: /packages/web/src/[componente]
- Backend: /packages/functions/src/[função]
- Shared: /packages/shared/[tipos]

CRITÉRIOS DE ACEITAÇÃO:
1. [Critério 1]
2. [Critério 2]
3. [Critério 3]

CONSIDERAÇÕES DE PRODUÇÃO:
- Testes unitários obrigatórios
- Validação de tipos TypeScript
- Error handling robusto
- Logs para monitoramento
```

#### 🐛 **Para Correção de Bugs**
```
URGENTE - Bug em produção no NXT.AI:

PROBLEMA: [Descrição do bug]
IMPACTO: [Quantos usuários afetados / severidade]
REPRODUÇÃO: [Passos para reproduzir]

LOGS DE ERROR:
```
[Cole os logs aqui]
```

ARQUIVOS SUSPEITOS:
- [Lista de arquivos onde o bug pode estar]

AMBIENTE:
- Produção: [URL/ambiente afetado]
- Versão: [commit hash ou versão]

PRIORIDADE: ALTA - Sistema em produção ativo
```

#### 🔄 **Para Refatoração e Otimização**
```
Refatoração necessária no NXT.AI:

MÓDULO: [Nome do módulo/componente]
PROBLEMA ATUAL: [O que está problemático]

OBJETIVOS:
- Performance: [métricas atuais vs desejadas]
- Manutenibilidade: [problemas de código]
- Escalabilidade: [limitações atuais]

RESTRIÇÕES:
- Sistema em produção - deploy incremental
- Backward compatibility obrigatória
- Testes existentes devem continuar passando

ARQUIVOS ENVOLVIDOS:
[Lista de arquivos a serem refatorados]
```

#### 🚀 **Para Deploy e Produção**
```
Preparação para deploy em produção - NXT.AI:

MUDANÇAS: [Lista de alterações]

CHECKLIST PRÉ-DEPLOY:
- [ ] Testes unitários passando
- [ ] Testes de integração ok
- [ ] Build sem erros
- [ ] Migração de database (se necessário)
- [ ] Variáveis de ambiente configuradas
- [ ] Monitoramento configurado

AMBIENTE ALVO:
- [ ] Dev (firebase use dev)
- [ ] Staging (firebase use stg)  
- [ ] Produção (firebase use prod)

ROLLBACK PLAN:
[Como reverter se algo der errado]
```

---

## 🔧 Configurações Essenciais

### **Variáveis de Ambiente Necessárias**

```bash
# Firebase
REACT_APP_FIREBASE_API_KEY=xxx
REACT_APP_FIREBASE_AUTH_DOMAIN=xxx
REACT_APP_FIREBASE_DATABASE_URL=xxx
REACT_APP_FIREBASE_PROJECT_ID=xxx
REACT_APP_FIREBASE_STORAGE_BUCKET=xxx
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=xxx
REACT_APP_FIREBASE_APP_ID=xxx

# Anthropic Claude
ANTHROPIC_API_KEY=xxx

# SendGrid
SENDGRID_API_KEY=xxx

# Google Cloud
GOOGLE_CLOUD_PROJECT=xxx
GOOGLE_APPLICATION_CREDENTIALS=xxx
```

### **Comandos Essenciais**

```bash
# Instalação
npm install

# Desenvolvimento
npm run dev              # Frontend
npm run dev:functions    # Backend
npm run dev:mobile      # Mobile (se aplicável)

# Build
npm run build:all       # Tudo
npm run build:web       # Apenas frontend
npm run build:functions # Apenas backend

# Deploy
npm run deploy:dev      # Ambiente dev
npm run deploy:stg      # Ambiente staging  
npm run deploy:prod     # Ambiente produção

# Testes
npm test               # Todos os testes
npm run lint          # Linting
```

---

## 📁 Estrutura de Arquivos Críticos

```
nxtai-production/
├── packages/
│   ├── web/                 # Frontend React
│   │   ├── src/
│   │   │   ├── components/  # Componentes React
│   │   │   ├── pages/      # Páginas da aplicação
│   │   │   ├── hooks/      # Custom hooks
│   │   │   ├── services/   # Serviços e APIs
│   │   │   ├── store/      # Estado global (Zustand)
│   │   │   └── types/      # Tipos TypeScript
│   │   └── package.json
│   │
│   ├── functions/          # Cloud Functions
│   │   ├── src/
│   │   │   ├── api/       # Endpoints da API
│   │   │   ├── triggers/  # Triggers do Firestore
│   │   │   ├── cron/      # Tarefas agendadas
│   │   │   └── utils/     # Utilitários
│   │   └── package.json
│   │
│   └── shared/            # Código compartilhado
│       ├── types/         # Tipos compartilhados
│       ├── utils/         # Funções utilitárias
│       └── constants/     # Constantes
│
├── dialogflow/            # Configurações de IA
│   ├── agents/           # Agentes por ambiente
│   └── modules/          # Módulos de funcionalidade
│
├── config/               # Configurações
├── scripts/              # Scripts de deploy/backup
└── tests/               # Testes
```

---

## 🎯 Prompts Específicos por Situação

### **1. Implementar Nova API**
```
Implementar nova API endpoint no NXT.AI:

ENDPOINT: POST /api/[nome]
FUNCIONALIDADE: [O que a API deve fazer]

INTEGRAÇÃO:
- Firestore: [tabelas envolvidas]
- Dialogflow: [intents relacionadas]
- Frontend: [componentes que vão usar]

SEGURANÇA:
- Autenticação: Firebase Auth obrigatória
- Autorização: [roles necessárias]
- Validação: Zod schema

ARQUIVO: /packages/functions/src/api/[nome].ts
```

### **2. Criar Novo Componente React**
```
Criar componente React para NXT.AI:

COMPONENTE: [Nome]
LOCALIZAÇÃO: /packages/web/src/components/[pasta]/

PROPS:
```typescript
interface [Nome]Props {
  // definir props aqui
}
```

FUNCIONALIDADES:
- [Lista de funcionalidades]

DEPENDÊNCIAS:
- Estado: Zustand store
- Styling: TailwindCSS
- Icons: Heroicons
- Forms: React Hook Form + Zod

INTEGRAÇÃO:
- API calls: React Query
- Routing: React Router
```

### **3. Corrigir Performance**
```
Otimização de performance - NXT.AI:

PROBLEMA: [Descrição da lentidão]
MÉTRICAS ATUAIS: [tempo de carregamento, etc]
OBJETIVO: [melhoria desejada]

SUSPEITOS:
- [ ] Consultas Firestore lentas
- [ ] Componentes React re-renderizando
- [ ] Bundle size muito grande
- [ ] Memory leaks

FERRAMENTAS DE ANÁLISE:
- Chrome DevTools
- Firebase Performance
- React DevTools Profiler

ÁREA AFETADA: [frontend/backend/database]
```

### **4. Migração de Database**
```
Migração de dados no Firestore - NXT.AI:

TIPO: [Schema change / Data migration]
IMPACT: [quantos documentos afetados]

MUDANÇAS:
- DE: [estrutura atual]  
- PARA: [nova estrutura]

ESTRATÉGIA:
- [ ] Backup completo antes
- [ ] Migração incremental
- [ ] Rollback plan definido
- [ ] Validação pós-migração

DOWNTIME: [zero/planejado]
AMBIENTE: [dev/stg/prod]
```

---

## ⚠️ Considerações Críticas para Produção

### **1. Segurança**
- Sempre validar inputs com Zod
- Sanitizar dados do usuário
- Implementar rate limiting
- Logs não devem expor dados sensíveis
- HTTPS obrigatório

### **2. Error Handling**
- Try/catch em todas as funções async
- Errors estruturados com códigos
- Logs detalhados para debugging
- Graceful degradation

### **3. Performance**
- Lazy loading de componentes
- Paginação em listas grandes
- Cache estratégico
- Otimização de consultas Firestore

### **4. Monitoramento**
- Health checks em endpoints
- Métricas de performance
- Alertas automáticos
- Dashboard de monitoramento

---

## 🚀 Checklist Final

### **Antes de Solicitar Desenvolvimento:**
- [ ] Objetivo claro definido
- [ ] Arquivos específicos identificados  
- [ ] Critérios de aceitação listados
- [ ] Impacto em produção avaliado
- [ ] Estratégia de deploy definida

### **Antes do Deploy:**
- [ ] Testes passando (npm test)
- [ ] Build sem errors (npm run build)
- [ ] Code review completo
- [ ] Backup da produção atual
- [ ] Rollback plan documentado

### **Pós Deploy:**
- [ ] Monitoramento ativo por 24h
- [ ] Métricas de performance Ok
- [ ] Logs sem errors críticos
- [ ] Feedback dos usuários
- [ ] Documentação atualizada

---

## 📞 Comandos de Emergência

```bash
# Rollback rápido
git checkout [commit-anterior]
npm run deploy:prod

# Logs em tempo real
firebase functions:log --only [função]

# Status dos serviços
firebase projects:list
firebase use [projeto]

# Backup manual
npm run backup:prod
```

---

## 🔗 Links Úteis

- **Firebase Console**: https://console.firebase.google.com/
- **Google Cloud Console**: https://console.cloud.google.com/
- **Dialogflow Console**: https://dialogflow.cloud.google.com/
- **Anthropic Console**: https://console.anthropic.com/

---

**⚡ LEMBRE-SE**: Este é um sistema em produção ativo. Sempre teste em dev/staging primeiro e tenha um plano de rollback!