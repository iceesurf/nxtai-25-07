#!/bin/bash
# NXT.AI - Script de Deploy Automatizado

echo "🚀 Iniciando deploy da NXT.AI..."

# Verificar se está na branch correta
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Erro: Você deve estar na branch 'main' para fazer deploy"
    exit 1
fi

# Verificar se há mudanças não commitadas
if ! git diff-index --quiet HEAD --; then
    echo "❌ Erro: Existem mudanças não commitadas"
    exit 1
fi

# Build do projeto
echo "📦 Fazendo build do projeto..."
npm run build

# Testar build
echo "🧪 Executando testes..."
npm test

# Verificar variáveis de ambiente
if [ ! -f .env.production ]; then
    echo "❌ Erro: Arquivo .env.production não encontrado"
    exit 1
fi

# Fazer backup do site atual
echo "💾 Fazendo backup..."
ssh user@dnxtai.com "cd /var/www && tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz dnxtai.com"

# Deploy via rsync
echo "📤 Enviando arquivos..."
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env*' \
    --exclude 'backup-*' \
    ./public/ user@dnxtai.com:/var/www/dnxtai.com/public/

# Limpar cache do CloudFlare
echo "🧹 Limpando cache CDN..."
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}'

# Verificar se o site está online
echo "✅ Verificando site..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://dnxtai.com)
if [ $HTTP_STATUS -eq 200 ]; then
    echo "✅ Deploy concluído com sucesso! Site está online."
else
    echo "❌ Erro: Site retornou status HTTP $HTTP_STATUS"
    exit 1
fi

# Notificar equipe
echo "📧 Notificando equipe..."
curl -X POST https://api.dnxtai.com/webhook/deploy-notification \
    -H "Content-Type: application/json" \
    -d '{"status":"success","timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}'

echo "🎉 Deploy finalizado!"
