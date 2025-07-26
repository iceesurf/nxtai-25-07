# Documentação do Fluxo de Configuração do Projeto

Este documento detalha os passos de configuração, os problemas encontrados e as soluções aplicadas no projeto NXT.AI até o momento.

## 1. Configuração Inicial do Firebase

**Problema:** Ao iniciar, o projeto não era reconhecido como um aplicativo Firebase, resultando no erro: `Error: Not in a Firebase app directory (could not locate firebase.json)`.

**Solução:**
Criei um arquivo `firebase.json` na raiz do projeto para definir a estrutura básica do aplicativo, especificando os diretórios para `hosting` (front-end) e `functions` (back-end).

```json
{
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  },
  "functions": {
    "source": "functions"
  }
}
```

## 2. Deploy e Atualização do Site

**Dúvida:** O usuário questionou por que as alterações no código (via `git push`) não eram refletidas na URL do site.

**Esclarecimento:**
Expliquei que o `git push` apenas atualiza o repositório de código. Para que as alterações se tornem públicas, é necessário realizar o **deploy**, que envia os arquivos para o servidor de hospedagem.

**Ação:**
Executei o comando de deploy para o hosting:
```bash
firebase deploy --only hosting
```
Isso atualizou o site com o conteúdo do diretório `public`.

## 3. Gerenciamento de Dependências (npm)

**Problema:** Ao tentar executar o ambiente de desenvolvimento com `npm run dev`, o processo falhou durante a instalação das dependências (`npm install`).

**Causa Raiz:** O arquivo `packages/functions/package.json` continha referências a versões de pacotes que não existem ou estão incorretas.

### Tentativas de Solução:

1.  **Erro Inicial (`anthropic`):** O primeiro erro foi `No matching version found for anthropic@^0.9.1`.
2.  **Erro Subsequente (`dialogflow`):** Após uma tentativa de correção, o erro mudou para `No matching version found for dialogflow@^6.0.0`.

### Passos de Troubleshooting:

1.  **Modificação do `package.json`:** Tentei remover a versão específica do pacote `anthropic`, esperando que o npm buscasse a mais recente.
2.  **Remoção do `package-lock.json`:** Para forçar o npm a resolver as dependências do zero, deletei o arquivo `package-lock.json`.
3.  **Instalação Limpa:** Como o erro persistiu, deletei o `package-lock.json` e o diretório `node_modules` para garantir uma instalação completamente limpa.

Nenhuma dessas ações resolveu o problema, confirmando que a questão está nas versões declaradas nos arquivos `package.json`.

## 4. Controle de Versão (Git)

Durante o processo de troubleshooting, realizei commits para salvar o progresso:

- Adicionei os arquivos modificados (`firebase.json`, `packages/functions/package.json`) e o recém-criado `apphosting.yaml`.
- Removi o `package-lock.json` do versionamento.
- Enviei as alterações para o repositório remoto (`git push`).

## Status Atual e Próximos Passos

**O projeto ainda não consegue instalar suas dependências com sucesso.**

O próximo passo crucial é **corrigir as versões dos pacotes problemáticos** (`dialogflow` e `anthropic`) no arquivo `packages/functions/package.json`. Isso será feito pesquisando as versões válidas no registro do npm e atualizando o arquivo para refletir essas versões.
