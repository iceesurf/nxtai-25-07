#!/bin/bash
# Script para configurar GitHub

echo "🔧 Configuração do GitHub para NXT.AI"
echo ""

# Solicitar informações
read -p "Digite seu username do GitHub: " GITHUB_USER
read -p "Digite o nome do repositório (nxtai-production): " REPO_NAME
REPO_NAME=${REPO_NAME:-nxtai-production}

echo ""
echo "📝 Instruções para criar o repositório:"
echo ""
echo "1. Acesse: https://github.com/new"
echo "2. Nome do repositório: $REPO_NAME"
echo "3. Descrição: NXT.AI - Plataforma de Automação Inteligente"
echo "4. Privado: Sim (recomendado)"
echo "5. NÃO inicialize com README"
echo ""
read -p "Pressione ENTER após criar o repositório..."

# Adicionar remote
git remote add origin https://github.com/$GITHUB_USER/$REPO_NAME.git

# Push inicial
echo ""
echo "📤 Enviando código para GitHub..."
git branch -M main
git push -u origin main

echo ""
echo "✅ Código enviado com sucesso!"
echo ""
echo "🔐 Agora configure os Secrets no GitHub:"
echo ""
echo "1. Acesse: https://github.com/iceesurf/nxtai-production/settings/secrets/actions"
echo ""
echo "2. Adicione os seguintes secrets:"
echo "   - FIREBASE_TOKEN (execute: firebase login:ci)"
echo "   - FIREBASE_API_KEY"
echo "   - FIREBASE_AUTH_DOMAIN"
echo "   - FIREBASE_PROJECT_ID"
echo "   - FIREBASE_STORAGE_BUCKET"
echo "   - FIREBASE_MESSAGING_SENDER_ID"
echo "   - FIREBASE_APP_ID"
echo "   - CLOUDFLARE_ZONE_ID"
echo "   - CLOUDFLARE_API_TOKEN"
echo "   - SLACK_WEBHOOK (opcional)"
echo "   - CODECOV_TOKEN (opcional)"
echo ""
echo "3. Configure os ambientes:"
echo "   - Settings > Environments"
echo "   - Criar 'staging' e 'production'"
echo "   - Adicionar regras de proteção"
echo ""
echo "🎉 Setup concluído!"
echo ""
echo "📋 Próximos comandos úteis:"
echo "   git push                    # Enviar alterações"
echo "   git pull origin main        # Baixar alterações"
echo "   npm run deploy              # Deploy manual"
echo ""
echo "🔗 Links importantes:"
echo "   Repositório: https://github.com/iceesurf/nxtai-production"
echo "   Actions: https://github.com/iceesurf/nxtai-production/actions"
echo "   Issues: https://github.com/iceesurf/nxtai-production/issues"
