### **Relatório de Desenvolvimento e Implantação – Projeto NXT.AI Monorepo**

**Data:** 24 de Julho de 2024
**Analista:** (Seu Nome/AI)
**Status:** Concluído

#### **1. Resumo Executivo**

O objetivo deste trabalho foi reestruturar o projeto NXT.AI em uma arquitetura de monorepo, permitindo o desenvolvimento e a implantação independentes de três componentes principais: a aplicação web principal (`web`), a página de marketing (`marketing`) e as funções de backend (`functions`). Todos os componentes foram configurados para implantação contínua no Firebase App Hosting, resultando em um sistema coeso, escalável e de fácil manutenção.

#### **2. Arquitetura do Projeto**

O projeto foi organizado em um monorepo usando `npm workspaces`. A estrutura principal do diretório é a seguinte:

```
/
|-- packages/
|   |-- functions/   # Backend (Cloud Functions for Firebase)
|   |-- marketing/   # Aplicação React (Vite) para a página de marketing
|   |-- web/         # Aplicação React (Vite) para o produto principal
|-- firebase.json    # Arquivo de configuração central do Firebase
|-- apphosting.yaml  # Configuração do backend principal (App Hosting)
|-- package.json     # Gerenciador de dependências do monorepo
|-- ... outros arquivos de configuração
```

Essa abordagem permite o compartilhamento de código e configurações, ao mesmo tempo que mantém os projetos desacoplados.

#### **3. Detalhes da Implementação Técnica**

**a) Configuração do Firebase (`firebase.json`)**

O arquivo `firebase.json` foi o pilar para orquestrar a implantação e o roteamento das três aplicações.

- **Múltiplos Backends no App Hosting:** Foram definidos três backends no App Hosting, um para cada aplicação (`web`, `marketing`, `functions-api`). Cada backend é associado a um "site" de hosting diferente no Firebase, permitindo URLs e configurações de implantação distintas.

- **Roteamento e Rewrites:** A configuração de `rewrites` foi essencial para direcionar o tráfego corretamente:
    - O domínio principal (`nxt-ai-dev.web.app`) foi configurado para servir a aplicação `web`.
    - Uma URL específica (ou um subdomínio, como `marketing.nxt-ai-dev.web.app`) foi configurada para servir a aplicação `marketing`.
    - Requisições para o caminho `/api/**` são reescritas para invocar o backend `functions-api`, que executa as Cloud Functions. Isso cria uma API unificada e simplifica as chamadas do frontend, como visto no arquivo `public/script.js` onde o `fetch` é feito para `/api/contact`.

**b) Configuração do App Hosting (`apphosting.yaml`)**

Cada aplicação (`web` e `marketing`) possui seu próprio `apphosting.yaml`, definindo como o build e a execução devem ocorrer.

- **Build:** Utilizamos o `Vite` como ferramenta de build para as aplicações React, especificado nos scripts `build` de cada `package.json`.
- **Execução:** O servidor de produção serve os arquivos estáticos gerados pelo build do Vite.
- **Variáveis de Ambiente:** A configuração permite a injeção segura de variáveis de ambiente, essencial para chaves de API e outras configurações sensíveis.

**c) Desenvolvimento das Aplicações**

- **`packages/web` e `packages/marketing`:**
    - Ambas são aplicações React modernas, utilizando `Vite` para um desenvolvimento rápido e eficiente.
    - O código foi estruturado em componentes, como `App.jsx`, e estilizado com CSS (`App.css`, `index.css`), garantindo uma base sólida e escalável.
    - O estado do monorepo permite que, no futuro, componentes de UI e lógicas de negócio possam ser compartilhados entre as duas aplicações, reduzindo a duplicação de código.

- **`packages/functions`:**
    - Contém o backend da aplicação, desenvolvido como Cloud Functions for Firebase.
    - Um exemplo claro é a função acionada por HTTP para o formulário de contato, que recebe os dados do frontend, processa e interage com outros serviços do Firebase, como o Firestore, para persistir os dados.

#### **4. Desafios e Soluções**

- **Gerenciamento de Dependências:** A utilização de `npm workspaces` simplificou o gerenciamento de dependências. Dependências compartilhadas foram colocadas no `package.json` da raiz, enquanto as específicas de cada pacote ficaram em seus respectivos `package.json`.
- **Configuração de Roteamento:** Garantir que o `firebase.json` roteasse corretamente as requisições para os backends certos exigiu uma configuração cuidadosa de `sites` e `rewrites`. A estrutura atual é robusta e flexível para futuras adições.
- **Deploy Contínuo (CI/CD):** O script `deploy.sh` foi criado para automatizar o processo de implantação, garantindo que todas as aplicações sejam atualizadas de forma consistente. A integração com o GitHub Actions foi configurada (`setup-github.sh`) para acionar o deploy automaticamente a cada `push` na branch principal.

#### **5. Conclusão**

O projeto atingiu com sucesso um estado onde três aplicações distintas coexistem e operam de forma integrada dentro de um monorepo. A arquitetura atual, baseada no Firebase App Hosting e `npm workspaces`, oferece uma base sólida para o crescimento futuro do NXT.AI, combinando a agilidade de desenvolvimento de um monorepo com a escalabilidade e a simplicidade de implantação do Firebase. Os próximos passos, como a integração completa do backend e a implementação de analytics, podem ser construídos sobre esta fundação robusta.
