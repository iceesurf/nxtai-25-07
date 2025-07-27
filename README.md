# Projeto Monorepo NXT.AI

Este é o repositório principal do projeto NXT.AI, organizado como um monorepo para gerenciar de forma integrada as diferentes frentes da aplicação.

## Arquitetura

O projeto utiliza `npm workspaces` para gerenciar três componentes principais:

- **`packages/web`**: A aplicação web principal.
- **`packages/marketing`**: A página de marketing e de apresentação do produto.
- **`packages/functions`**: O backend serverless, com as Cloud Functions.

## Deployment

A infraestrutura é totalmente baseada no **Firebase**. As aplicações front-end (`web` e `marketing`) são implantadas com o **Firebase App Hosting**, enquanto o backend opera através do **Firebase Cloud Functions**.

Esta arquitetura garante um ambiente de desenvolvimento coeso, escalável e de fácil manutenção.
