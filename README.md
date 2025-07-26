# NXT.AI - Plataforma CRM Multi-Tenant

## 🚀 Visão Geral

NXT.AI é uma plataforma completa de CRM e automação de marketing multi-tenant, desenvolvida com tecnologias modernas para oferecer uma solução escalável e robusta para empresas de todos os tamanhos.

### ✨ Principais Funcionalidades

- **CRM Completo**: Gestão avançada de leads, empresas e oportunidades
- **Multi-Tenancy**: Isolamento completo de dados entre organizações
- **WhatsApp Business**: Integração nativa com API oficial do WhatsApp
- **Email Marketing**: Campanhas automatizadas e templates personalizáveis
- **Automações**: Fluxos inteligentes baseados em triggers e condições
- **Analytics**: Dashboards e relatórios em tempo real
- **Whitelabel**: Personalização completa da marca para cada organização
- **Integrações**: APIs para conectar com sistemas externos
- **Segurança**: Autenticação robusta e controle de permissões granular

## 🏗️ Arquitetura

### Stack Tecnológico

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS para estilização
- Vite como bundler
- React Router para navegação
- Axios para requisições HTTP
- React Hook Form para formulários
- Recharts para gráficos

**Backend:**
- Firebase Cloud Functions (Node.js 20)
- Express.js para APIs REST
- Firebase Firestore como banco de dados
- Firebase Storage para arquivos
- Firebase Auth para autenticação

**Infraestrutura:**
- Firebase Hosting para frontend
- Google Cloud Platform
- CDN global
- SSL automático

### Estrutura do Projeto

```
nxtai-production/
├── packages/
│   ├── web/                    # Frontend React
│   │   ├── src/
│   │   │   ├── components/     # Componentes reutilizáveis
│   │   │   ├── pages/          # Páginas da aplicação
│   │   │   ├── services/       # Serviços de API
│   │   │   ├── hooks/          # Hooks personalizados
│   │   │   ├── providers/      # Context providers
│   │   │   ├── types/          # Definições TypeScript
│   │   │   └── styles/         # Estilos globais
│   │   ├── public/             # Arquivos estáticos
│   │   └── dist/               # Build de produção
│   │
│   ├── functions/              # Backend Cloud Functions
│   │   ├── src/
│   │   │   ├── core/           # Serviços principais
│   │   │   ├── routes/         # Rotas da API
│   │   │   ├── middleware/     # Middlewares
│   │   │   ├── triggers/       # Triggers do Firestore
│   │   │   ├── scheduled/      # Funções agendadas
│   │   │   └── utils/          # Utilitários
│   │   └── lib/                # Build de produção
│   │
│   └── shared/                 # Código compartilhado
│       └── src/
│           └── types/          # Tipos TypeScript compartilhados
│
├── firestore.rules             # Regras de segurança do Firestore
├── firestore.indexes.json     # Índices do Firestore
├── storage.rules               # Regras de segurança do Storage
├── firebase.json               # Configuração do Firebase
└── README.md                   # Esta documentação
```

## 🚀 Início Rápido

### Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Firebase CLI
- Conta no Firebase/Google Cloud

### Instalação

1. **Clone o repositório:**
```bash
git clone https://github.com/iceesurf/nxtai-production.git
cd nxtai-production
```

2. **Instale as dependências:**
```bash
# Frontend
cd packages/web
npm install

# Backend
cd ../functions
npm install
```

3. **Configure o Firebase:**
```bash
# Instale o Firebase CLI globalmente
npm install -g firebase-tools

# Faça login no Firebase
firebase login

# Inicialize o projeto (se necessário)
firebase init
```

4. **Configure as variáveis de ambiente:**

Crie um arquivo `.env` na pasta `packages/web/`:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
VITE_API_BASE_URL=http://localhost:5001/your_project/us-central1/api
```

### Desenvolvimento

1. **Inicie os emuladores do Firebase:**
```bash
firebase emulators:start
```

2. **Inicie o frontend (em outro terminal):**
```bash
cd packages/web
npm run dev
```

3. **Inicie o backend (em outro terminal):**
```bash
cd packages/functions
npm run build:watch
```

A aplicação estará disponível em:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001
- Emulator UI: http://localhost:4000

## 📊 Funcionalidades Detalhadas

### CRM e Gestão de Leads

- **Captura de Leads**: Múltiplas fontes (website, WhatsApp, redes sociais)
- **Scoring Automático**: Algoritmo de pontuação baseado em comportamento
- **Pipeline Customizável**: Estágios personalizáveis do funil de vendas
- **Atribuição Inteligente**: Distribuição automática para vendedores
- **Histórico Completo**: Timeline de todas as interações
- **Anexos e Notas**: Documentos e anotações por lead
- **Filtros Avançados**: Busca e segmentação poderosa

### Campanhas Multi-Canal

- **Email Marketing**: Templates responsivos e automações
- **WhatsApp Business**: Mensagens em massa e chatbots
- **SMS**: Campanhas de texto para urgência
- **Campanhas Mistas**: Combinação de canais para máximo alcance
- **A/B Testing**: Testes para otimização de conversão
- **Métricas Detalhadas**: Acompanhamento em tempo real

### Automações Inteligentes

- **Triggers Flexíveis**: Baseados em ações, tempo ou dados
- **Fluxos Visuais**: Editor drag-and-drop para criar automações
- **Condições Avançadas**: Lógica complexa com AND/OR
- **Ações Múltiplas**: Email, WhatsApp, atribuição, tags, etc.
- **Teste e Debug**: Simulação antes da ativação

### Analytics e Relatórios

- **Dashboard Executivo**: Visão geral dos KPIs principais
- **Funil de Conversão**: Análise detalhada do pipeline
- **Performance de Campanhas**: ROI e métricas de engajamento
- **Relatórios Customizados**: Criação de relatórios personalizados
- **Exportação**: PDF, Excel e CSV
- **Alertas**: Notificações baseadas em métricas

### Multi-Tenancy e Whitelabel

- **Isolamento Completo**: Dados segregados por organização
- **Personalização Visual**: Logo, cores e domínio próprio
- **Configurações Independentes**: Cada org tem suas configurações
- **Billing Separado**: Controle de uso e cobrança por tenant
- **Permissões Granulares**: Controle fino de acesso

## 🔐 Segurança

### Autenticação e Autorização

- **Firebase Auth**: Autenticação robusta e escalável
- **JWT Tokens**: Tokens seguros com expiração
- **Roles e Permissions**: Sistema hierárquico de permissões
- **Multi-Factor Auth**: 2FA opcional para maior segurança
- **Session Management**: Controle de sessões ativas

### Proteção de Dados

- **Firestore Rules**: Regras de segurança no banco de dados
- **Storage Rules**: Controle de acesso a arquivos
- **Rate Limiting**: Proteção contra ataques DDoS
- **Input Validation**: Validação rigorosa de dados
- **HTTPS Only**: Comunicação sempre criptografada

### Compliance

- **LGPD/GDPR Ready**: Estrutura preparada para conformidade
- **Audit Logs**: Registro de todas as ações importantes
- **Data Retention**: Políticas de retenção de dados
- **Backup Automático**: Backups regulares e seguros

## 🚀 Deploy

### Ambiente de Produção

1. **Configure o projeto Firebase:**
```bash
firebase use --add production
```

2. **Configure as variáveis de ambiente de produção:**
```bash
firebase functions:config:set \
  app.environment=production \
  whatsapp.api_key="your_whatsapp_api_key" \
  email.api_key="your_email_api_key"
```

3. **Deploy completo:**
```bash
# Build do frontend
cd packages/web
npm run build

# Deploy de tudo
firebase deploy
```

4. **Deploy seletivo:**
```bash
# Apenas functions
firebase deploy --only functions

# Apenas hosting
firebase deploy --only hosting

# Apenas regras do Firestore
firebase deploy --only firestore:rules
```

### CI/CD com GitHub Actions

O projeto inclui workflows para deploy automático:

- **Staging**: Deploy automático na branch `develop`
- **Production**: Deploy automático na branch `main`
- **Preview**: Deploy de preview para Pull Requests

## 📈 Monitoramento

### Métricas de Performance

- **Firebase Performance**: Monitoramento de performance do app
- **Cloud Monitoring**: Métricas de infraestrutura
- **Error Reporting**: Captura e análise de erros
- **Cloud Logging**: Logs centralizados e pesquisáveis

### Alertas

- **Uptime Monitoring**: Alertas de disponibilidade
- **Error Rate**: Alertas de taxa de erro elevada
- **Performance**: Alertas de degradação de performance
- **Usage Limits**: Alertas de limites de uso

## 🧪 Testes

### Frontend

```bash
cd packages/web
npm run test              # Testes unitários
npm run test:coverage     # Cobertura de testes
npm run test:e2e          # Testes end-to-end
```

### Backend

```bash
cd packages/functions
npm run test              # Testes unitários
npm run test:integration  # Testes de integração
```

### Emuladores

```bash
firebase emulators:exec --only firestore,auth "npm test"
```

## 📚 API Documentation

### Autenticação

Todas as requisições para a API devem incluir o token de autenticação:

```javascript
headers: {
  'Authorization': 'Bearer <firebase_id_token>'
}
```

### Endpoints Principais

#### Leads
- `GET /api/leads` - Listar leads
- `POST /api/leads` - Criar lead
- `GET /api/leads/:id` - Obter lead
- `PUT /api/leads/:id` - Atualizar lead
- `DELETE /api/leads/:id` - Deletar lead

#### Campanhas
- `GET /api/campaigns` - Listar campanhas
- `POST /api/campaigns` - Criar campanha
- `POST /api/campaigns/:id/start` - Iniciar campanha
- `POST /api/campaigns/:id/pause` - Pausar campanha

#### WhatsApp
- `GET /api/whatsapp/conversations` - Listar conversas
- `POST /api/whatsapp/conversations/:id/messages` - Enviar mensagem
- `GET /api/whatsapp/templates` - Listar templates

### Rate Limits

- **Autenticado**: 1000 req/min por usuário
- **Não autenticado**: 100 req/min por IP
- **Webhooks**: 10000 req/min

## 🤝 Contribuição

### Workflow de Desenvolvimento

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

### Padrões de Código

- **ESLint**: Linting automático
- **Prettier**: Formatação de código
- **TypeScript**: Tipagem estática
- **Conventional Commits**: Padrão de commits

### Testes Obrigatórios

- Todos os PRs devem incluir testes
- Cobertura mínima de 80%
- Testes E2E para funcionalidades críticas

## 📄 Licença

Este projeto está licenciado sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

### Documentação

- [Wiki do Projeto](https://github.com/iceesurf/nxtai-production/wiki)
- [API Reference](https://api-docs.nxtai.com)
- [Guias de Integração](https://docs.nxtai.com)

### Comunidade

- [Discord](https://discord.gg/nxtai)
- [Fórum](https://forum.nxtai.com)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/nxtai)

### Contato

- **Email**: suporte@nxtai.com
- **Website**: https://nxtai.com
- **Status**: https://status.nxtai.com

---

**Desenvolvido com ❤️ pela equipe NXT.AI**

