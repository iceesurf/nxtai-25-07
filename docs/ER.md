erDiagram
%% Coleções principais do Firestore

```
USERS ||--o{ USER_SETTINGS : has
USERS ||--o{ NOTIFICATIONS : receives
USERS ||--o{ PROJECTS : owns
USERS ||--o{ API_KEYS : has

PROJECTS ||--o{ CHATBOTS : contains
PROJECTS ||--o{ PROJECT_MEMBERS : has
PROJECTS ||--o{ PROJECT_LOGS : generates

CHATBOTS ||--o{ CONVERSATIONS : handles
CHATBOTS ||--o{ INTENTS : defines
CHATBOTS ||--o{ ENTITIES : uses
CHATBOTS ||--o{ TRAINING_DATA : has
CHATBOTS ||--o{ CHATBOT_ANALYTICS : tracks

CONVERSATIONS ||--o{ MESSAGES : contains
CONVERSATIONS ||--o{ CONVERSATION_ANALYTICS : generates

ORGANIZATIONS ||--o{ USERS : employs
ORGANIZATIONS ||--o{ PROJECTS : owns
ORGANIZATIONS ||--o{ BILLING : manages

%% 1. GESTÃO DE USUÁRIOS
USERS {
    string uid PK "Firebase Auth UID"
    string email "Email único"
    string displayName "Nome de exibição"
    string photoURL "URL da foto"
    string role "admin|manager|user"
    string organizationId FK "Referência à organização"
    timestamp createdAt "Data de criação"
    timestamp lastLogin "Último login"
    boolean isActive "Status ativo"
    string phone "Telefone"
    string plan "basic|professional|enterprise|custom"
    map customClaims "Claims personalizadas"
}

USER_SETTINGS {
    string userId PK "Referência ao usuário"
    boolean emailNotifications "Notificações por email"
    boolean pushNotifications "Notificações push"
    string language "pt-BR|en|es"
    string theme "light|dark|auto"
    string timezone "America/Sao_Paulo"
    map preferences "Preferências customizadas"
}

NOTIFICATIONS {
    string notificationId PK "ID único"
    string userId FK "Destinatário"
    string title "Título"
    string body "Corpo da mensagem"
    string type "info|warning|error|success"
    boolean read "Lida ou não"
    timestamp createdAt "Data de criação"
    map data "Dados adicionais"
    string actionUrl "URL de ação"
}

%% 2. PROJETOS E PROPOSTAS
PROJECTS {
    string projectId PK "ID único"
    string name "Nome do projeto"
    string description "Descrição"
    string ownerId FK "Proprietário"
    string organizationId FK "Organização"
    string status "draft|active|paused|completed"
    string type "automation_sales|chatbot_ai|data_analysis|etc"
    timestamp createdAt "Data de criação"
    timestamp updatedAt "Última atualização"
    map settings "Configurações do projeto"
    array tags "Tags/categorias"
    number monthlyBudget "Orçamento mensal"
}

PROJECT_MEMBERS {
    string memberId PK "ID único"
    string projectId FK "Projeto"
    string userId FK "Usuário"
    string role "owner|admin|editor|viewer"
    timestamp joinedAt "Data de entrada"
    map permissions "Permissões específicas"
}

PROJECT_LOGS {
    string logId PK "ID único"
    string projectId FK "Projeto"
    string userId FK "Usuário que fez a ação"
    string action "created|updated|deleted|deployed"
    string resource "Recurso afetado"
    map changes "Mudanças realizadas"
    timestamp createdAt "Data da ação"
    string ipAddress "IP do usuário"
}

%% 3. CHATBOTS E AGENTES IA
CHATBOTS {
    string chatbotId PK "ID único"
    string projectId FK "Projeto pai"
    string name "Nome do chatbot"
    string description "Descrição"
    string status "training|active|paused"
    string model "dialogflow|claude|gpt"
    string language "pt-BR|en|es|multi"
    timestamp createdAt "Data de criação"
    timestamp lastTraining "Último treinamento"
    map configuration "Configurações"
    array integrations "WhatsApp|Telegram|Web|etc"
    string webhookUrl "URL do webhook"
    map personality "Configurações de personalidade"
}

INTENTS {
    string intentId PK "ID único"
    string chatbotId FK "Chatbot"
    string name "Nome da intent"
    array trainingPhrases "Frases de treino"
    array responses "Respostas possíveis"
    string action "Ação a executar"
    boolean enabled "Ativa ou não"
    number priority "Prioridade"
    array entities "Entidades relacionadas"
}

ENTITIES {
    string entityId PK "ID único"
    string chatbotId FK "Chatbot"
    string name "Nome da entidade"
    string type "system|custom"
    array values "Valores possíveis"
    array synonyms "Sinônimos"
    boolean fuzzyMatch "Match aproximado"
}

TRAINING_DATA {
    string dataId PK "ID único"
    string chatbotId FK "Chatbot"
    string input "Entrada do usuário"
    string expectedIntent "Intent esperada"
    map entities "Entidades identificadas"
    string output "Resposta esperada"
    boolean reviewed "Revisado por humano"
    timestamp createdAt "Data de criação"
}

%% 4. CONVERSAS E MENSAGENS
CONVERSATIONS {
    string conversationId PK "ID único"
    string chatbotId FK "Chatbot"
    string userId FK "Usuário (opcional)"
    string sessionId "ID da sessão"
    string channel "whatsapp|telegram|web|api"
    string status "active|ended|transferred"
    timestamp startedAt "Início"
    timestamp endedAt "Fim"
    map metadata "Metadados da conversa"
    string contactPhone "Telefone do contato"
    string contactName "Nome do contato"
    number satisfaction "Nota de satisfação"
}

MESSAGES {
    string messageId PK "ID único"
    string conversationId FK "Conversa"
    string sender "user|bot|agent"
    string content "Conteúdo da mensagem"
    string type "text|image|audio|video|file"
    timestamp createdAt "Data de envio"
    map metadata "Metadados"
    string intent "Intent detectada"
    number confidence "Confiança da IA"
    array entities "Entidades detectadas"
    boolean fallback "É fallback"
}

%% 5. ANALYTICS E MÉTRICAS
CHATBOT_ANALYTICS {
    string analyticsId PK "ID único"
    string chatbotId FK "Chatbot"
    date date "Data"
    number totalConversations "Total de conversas"
    number activeUsers "Usuários ativos"
    number messages "Total de mensagens"
    number successRate "Taxa de sucesso %"
    number avgSessionDuration "Duração média (seg)"
    map intentsUsage "Uso por intent"
    map channelsUsage "Uso por canal"
    array peakHours "Horários de pico"
    number fallbackRate "Taxa de fallback %"
}

CONVERSATION_ANALYTICS {
    string analyticsId PK "ID único"
    string conversationId FK "Conversa"
    number duration "Duração em segundos"
    number messageCount "Quantidade de mensagens"
    boolean resolved "Foi resolvida"
    string resolution "Tipo de resolução"
    number satisfaction "Satisfação 1-5"
    array intentsUsed "Intents utilizadas"
    boolean humanHandoff "Transferido para humano"
    map sentiment "Análise de sentimento"
}

%% COLEÇÕES AUXILIARES
ORGANIZATIONS {
    string organizationId PK "ID único"
    string name "Nome da empresa"
    string cnpj "CNPJ"
    string email "Email corporativo"
    string phone "Telefone"
    string plan "basic|professional|enterprise"
    timestamp createdAt "Data de criação"
    boolean isActive "Status ativo"
    map billingInfo "Informações de cobrança"
    number creditBalance "Créditos disponíveis"
}

BILLING {
    string billingId PK "ID único"
    string organizationId FK "Organização"
    string type "subscription|usage|credit"
    number amount "Valor"
    string currency "BRL"
    string status "pending|paid|failed"
    timestamp dueDate "Vencimento"
    timestamp paidAt "Data de pagamento"
    string invoiceUrl "URL da fatura"
    map items "Itens cobrados"
}

API_KEYS {
    string keyId PK "ID único"
    string userId FK "Usuário"
    string projectId FK "Projeto (opcional)"
    string keyHash "Hash da chave"
    string name "Nome da chave"
    array scopes "Escopos permitidos"
    timestamp createdAt "Data de criação"
    timestamp lastUsed "Último uso"
    boolean isActive "Status ativo"
    number usageCount "Contador de uso"
}

%% COLEÇÕES DE SISTEMA
CONTACTS {
    string contactId PK "ID único"
    string type "project_proposal|user_registration"
    string name "Nome"
    string email "Email"
    string company "Empresa"
    string phone "Telefone"
    string projectType "Tipo do projeto"
    string projectDescription "Descrição"
    string plan "Plano escolhido"
    string status "pending|contacted|converted"
    timestamp createdAt "Data de criação"
    map metadata "Metadados"
}

SYSTEM_LOGS {
    string logId PK "ID único"
    string level "info|warning|error|critical"
    string service "auth|functions|hosting|firestore"
    string message "Mensagem do log"
    map context "Contexto do erro"
    timestamp createdAt "Data"
    string userId FK "Usuário relacionado"
    string requestId "ID da requisição"
}

EMAIL_QUEUE {
    string emailId PK "ID único"
    string to "Destinatário"
    string from "Remetente"
    string subject "Assunto"
    string html "Conteúdo HTML"
    string template "Template usado"
    map data "Dados do template"
    string status "pending|sent|failed"
    timestamp createdAt "Data de criação"
    timestamp sentAt "Data de envio"
    string error "Erro (se houver)"
}
```
