const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const cors = require('cors')({ origin: true });
const rateLimit = require('express-rate-limit');

// Inicializar Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Configurar SendGrid
if (functions.config().sendgrid && functions.config().sendgrid.key) {
    sgMail.setApiKey(functions.config().sendgrid.key);
}

// Rate limiter para formulário de contato
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Muitas tentativas. Tente novamente em 15 minutos.'
});

// =====================================================
// 1. FUNÇÃO: Processar Formulário de Contato
// =====================================================
exports.processContactForm = functions
    .runWith({ invoker: 'public' })
    .https.onRequest((req, res) => {
    return cors(req, res, () => {
        contactLimiter(req, res, async () => {
            if (req.method !== 'POST') {
                return res.status(405).json({ error: 'Método não permitido' });
            }

            try {
                const { name, email, phone, company, message } = req.body;

                if (!name || !email || !phone) {
                    return res.status(400).json({ error: 'Campos nome, email e telefone são obrigatórios.' });
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    return res.status(400).json({ error: 'Formato de email inválido.' });
                }

                const leadData = {
                    name,
                    email,
                    phone,
                    company: company || '',
                    message: message || '',
                    source: 'landing_page',
                    status: 'new',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                    userAgent: req.headers['user-agent']
                };

                const leadRef = await db.collection('leads').add(leadData);

                sendTeamNotificationEmail(leadData, leadRef.id);
                sendConfirmationEmail(leadData);
                sendWhatsAppNotification(leadData.phone, leadData.name);
                addToEmailList(leadData.email, leadData.name);

                return res.status(200).json({
                    success: true,
                    message: 'Contato recebido com sucesso!',
                    leadId: leadRef.id
                });

            } catch (error) {
                console.error('Erro ao processar formulário:', error);
                return res.status(500).json({ error: 'Ocorreu um erro interno. Tente novamente.' });
            }
        });
    });
});

// =====================================================
// 2. FUNÇÃO: Webhook WhatsApp
// =====================================================
exports.whatsappWebhook = functions
    .runWith({ invoker: 'public' })
    .https.onRequest(async (req, res) => {
    const webhookToken = functions.config().whatsapp ? functions.config().whatsapp.webhook_token : null;

    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const challenge = req.query['hub.challenge'];
        const verifyToken = req.query['hub.verify_token'];

        if (mode === 'subscribe' && verifyToken === webhookToken) {
            console.log("Webhook do WhatsApp verificado com sucesso!");
            return res.status(200).send(challenge);
        } else {
            console.error("Falha na verificação do webhook do WhatsApp.");
            return res.status(403).send('Forbidden');
        }
    }

    if (req.method === 'POST') {
        try {
            const { entry } = req.body;
            if (entry && entry[0].changes && entry[0].changes[0].value.messages) {
                const message = entry[0].changes[0].value.messages[0];
                const from = message.from;
                const text = message.text.body;

                await db.collection('whatsapp_messages').add({
                    from,
                    text,
                    type: 'received',
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });

                const responseText = await processWithAI(text, from);
                await sendWhatsAppMessage(from, responseText);
            }
            return res.status(200).send('OK');
        } catch (error) {
            console.error('Erro no webhook do WhatsApp:', error);
            return res.status(500).send('Internal Server Error');
        }
    }

    return res.status(405).send('Method Not Allowed');
});

// =====================================================
// 4. FUNÇÃO: Gerar Sitemap Dinâmico
// =====================================================
exports.generateSitemap = functions
    .runWith({ invoker: 'public' })
    .https.onRequest(async (req, res) => {
    try {
        const pages = [
            { url: '/', priority: 1.0, changefreq: 'weekly' },
            { url: '/solucoes', priority: 0.9, changefreq: 'monthly' },
            { url: '/planos', priority: 0.9, changefreq: 'monthly' },
        ];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

        pages.forEach(page => {
            xml += `
  <url>
    <loc>https://dnxtai.com${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
        });

        xml += `
</urlset>`;

        res.set('Content-Type', 'application/xml');
        return res.status(200).send(xml);
    } catch (error) {
        console.error('Erro ao gerar sitemap:', error);
        return res.status(500).send('Erro ao gerar sitemap');
    }
});

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================
async function sendTeamNotificationEmail(lead, leadId) {
    if (!sgMail.apiKey) {
        console.warn("Chave do SendGrid não configurada. Pulando envio de email para equipe.");
        return;
    }
    const teamEmail = {
        to: ['samuel@dnxtai.com', 'leo@dnxtai.com'],
        from: { name: 'NXT.AI Notificações', email: 'notificacoes@dnxtai.com' },
        subject: `🚀 Novo Lead - ${lead.name}`,
        html: `<p>Novo lead de <strong>${lead.name}</strong> (${lead.email}). ID: ${leadId}</p>`
    };
    try {
        await sgMail.send(teamEmail);
    } catch (error) {
        console.error("Erro ao enviar email para equipe via SendGrid:", error);
    }
}

async function sendConfirmationEmail(lead) {
    if (!sgMail.apiKey) {
        console.warn("Chave do SendGrid não configurada. Pulando email de confirmação.");
        return;
    }
    const leadEmail = {
        to: lead.email,
        from: { name: 'Equipe NXT.AI', email: 'contato@dnxtai.com' },
        subject: 'Recebemos seu contato - NXT.AI',
        html: `<p>Olá ${lead.name}, recebemos seu contato e em breve nossa equipe retornará.</p>`
    };
    try {
        await sgMail.send(leadEmail);
    } catch (error) {
        console.error("Erro ao enviar email de confirmação via SendGrid:", error);
    }
}


async function sendWhatsAppMessage(to, message) {
    const apiUrl = functions.config().whatsapp ? functions.config().whatsapp.api_url : null;
    const token = functions.config().whatsapp ? functions.config().whatsapp.api_token : null;

    if (!apiUrl || !token) {
        console.warn("Configurações do WhatsApp não encontradas. Pulando envio de mensagem.");
        return;
    }

    try {
        await fetch(`${apiUrl}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, type: 'text', text: { body: message } })
        });
    } catch (error) {
        console.error('Erro ao enviar mensagem via WhatsApp:', error);
    }
}

async function sendWhatsAppNotification(phone, name) {
    const message = `Olá ${name}! 👋 Recebemos seu contato em nosso site. Em breve um de nossos especialistas entrará em contato. Equipe NXT.AI 🚀`;
    await sendWhatsAppMessage(phone, message);
}


async function addToEmailList(email, name) {
    console.log(`Adicionando ${email} (${name}) à lista de email marketing.`);
}


async function processWithAI(message, from) {
    const openAIKey = functions.config().openai ? functions.config().openai.key : null;
    if (!openAIKey) {
        console.warn("Chave da OpenAI não configurada. Retornando resposta padrão.");
        return 'Obrigado por sua mensagem! Nossa equipe responderá em breve.';
    }

    try {
        const { OpenAI } = require('openai');
        const openai = new OpenAI({ apiKey: openAIKey });
        
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'system', content: 'Você é um assistente da NXT.AI.' }, { role: 'user', content: message }],
            max_tokens: 150
        });
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Erro ao processar com IA:', error);
        return 'Desculpe, nosso assistente de IA está indisponível no momento. Um atendente humano responderá em breve.';
    }
}


// =====================================================
// CRONJOBS
// =====================================================
exports.dailyBackup = functions.pubsub
    .schedule('every day 03:00')
    .timeZone('America/Sao_Paulo')
    .onRun(async () => {
        const { Firestore } = require('@google-cloud/firestore');
        const firestore = new Firestore();
        const projectId = functions.config().app.project_id || process.env.GCP_PROJECT;
        const bucket = `gs://${projectId}-backups`;
        const date = new Date().toISOString().split('T')[0];
        const prefix = `firestore-backup-${date}`;
        
        try {
            await firestore.export({
                name: firestore.databasePath(projectId, '(default)'),
                outputUriPrefix: `${bucket}/${prefix}`,
                collectionIds: []
            });
            console.log(`Backup do Firestore concluído: ${prefix}`);
        } catch(error) {
            console.error("Erro no job de backup diário:", error);
        }
    });
