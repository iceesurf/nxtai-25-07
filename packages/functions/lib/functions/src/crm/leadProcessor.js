"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadProcessor = leadProcessor;
const admin = __importStar(require("firebase-admin"));
const secret_manager_1 = require("@google-cloud/secret-manager");
const sgMail = __importStar(require("@sendgrid/mail"));
const secretClient = new secret_manager_1.SecretManagerServiceClient();
async function leadProcessor(snapshot) {
    try {
        const leadData = snapshot.data();
        if (!leadData)
            return;
        console.log('👤 Processando novo lead:', leadData.name);
        // Configurar SendGrid
        await configureSendGrid();
        // Enviar notificação para equipe de vendas
        await notifySalesTeam(leadData);
        // Enviar email de boas-vindas para o lead
        await sendWelcomeEmail(leadData);
        // Adicionar ao Firestore algumas análises básicas
        await enrichLeadData(snapshot.ref, leadData);
        console.log('✅ Lead processado com sucesso');
    }
    catch (error) {
        console.error('❌ Erro ao processar lead:', error);
    }
}
async function configureSendGrid() {
    var _a, _b;
    try {
        const projectId = process.env.GCLOUD_PROJECT;
        const [response] = await secretClient.accessSecretVersion({
            name: `projects/${projectId}/secrets/sendgrid-api-key/versions/latest`
        });
        const apiKey = (_b = (_a = response.payload) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.toString();
        if (apiKey) {
            sgMail.setApiKey(apiKey);
        }
    }
    catch (error) {
        console.warn('⚠️ SendGrid não configurado:', error);
    }
}
async function notifySalesTeam(leadData) {
    const db = admin.firestore();
    try {
        // Buscar configurações da empresa
        const settingsDoc = await db.collection('settings').doc('email').get();
        const emailSettings = settingsDoc.data();
        if (!(emailSettings === null || emailSettings === void 0 ? void 0 : emailSettings.salesNotificationEmail)) {
            console.warn('⚠️ Email de notificação não configurado');
            return;
        }
        const msg = {
            to: emailSettings.salesNotificationEmail,
            from: emailSettings.fromEmail || 'noreply@nxt.ai',
            subject: `🚀 Novo Lead: ${leadData.name}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Novo Lead Capturado!</h2>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Informações do Lead:</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Nome:</strong> ${leadData.name}</li>
              ${leadData.email ? `<li><strong>Email:</strong> ${leadData.email}</li>` : ''}
              ${leadData.phone ? `<li><strong>Telefone:</strong> ${leadData.phone}</li>` : ''}
              ${leadData.company ? `<li><strong>Empresa:</strong> ${leadData.company}</li>` : ''}
              <li><strong>Fonte:</strong> ${leadData.source}</li>
              <li><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</li>
            </ul>
          </div>
          
          <div style="background: #dbeafe; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Próximos passos:</strong></p>
            <ol>
              <li>Entrar em contato nas próximas 2 horas</li>
              <li>Qualificar interesse e necessidades</li>
              <li>Agendar demonstração se aplicável</li>
            </ol>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Este lead foi capturado automaticamente pelo NXT.AI
          </p>
        </div>
      `
        };
        await sgMail.send(msg);
        console.log('📧 Notificação enviada para equipe de vendas');
    }
    catch (error) {
        console.error('❌ Erro ao notificar equipe:', error);
    }
}
async function sendWelcomeEmail(leadData) {
    if (!leadData.email) {
        console.log('⚠️ Lead sem email, pulando email de boas-vindas');
        return;
    }
    try {
        const msg = {
            to: leadData.email,
            from: 'contato@nxt.ai',
            subject: 'Bem-vindo à NXT.AI! 🚀',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Bem-vindo à NXT.AI!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
              Obrigado por seu interesse em nossa plataforma
            </p>
          </div>
          
          <div style="padding: 30px 20px; background: white; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p>Olá <strong>${leadData.name}</strong>,</p>
            
            <p>Ficamos muito felizes com seu interesse na NXT.AI! Nossa plataforma oferece:</p>
            
            <ul style="color: #374151; line-height: 1.6;">
              <li>🤖 <strong>Chatbots Inteligentes</strong> - Automatize até 80% do atendimento</li>
              <li>📊 <strong>CRM Integrado</strong> - Gerencie todos os leads em um só lugar</li>
              <li>📱 <strong>Multi-canal</strong> - WhatsApp, Site, Email e mais</li>
              <li>📈 <strong>Analytics Avançado</strong> - Métricas detalhadas em tempo real</li>
            </ul>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 6px; margin: 25px 0; text-align: center;">
              <h3 style="margin-top: 0; color: #1f2937;">Próximos Passos</h3>
              <p style="margin-bottom: 20px;">Nossa equipe entrará em contato nas próximas horas para:</p>
              <ul style="list-style: none; padding: 0; color: #4b5563;">
                <li>✓ Entender suas necessidades específicas</li>
                <li>✓ Apresentar uma demonstração personalizada</li>
                <li>✓ Propor a melhor solução para sua empresa</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://calendly.com/nxtai-demo" 
                 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Agendar Demonstração
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              Dúvidas? Responda este email ou entre em contato:<br>
              📞 (11) 9999-9999<br>
              📧 contato@nxt.ai<br>
              🌐 <a href="https://nxt.ai">nxt.ai</a>
            </p>
          </div>
        </div>
      `
        };
        await sgMail.send(msg);
        console.log('📧 Email de boas-vindas enviado para:', leadData.email);
    }
    catch (error) {
        console.error('❌ Erro ao enviar email de boas-vindas:', error);
    }
}
async function enrichLeadData(leadRef, leadData) {
    try {
        const enrichedData = {
            score: calculateLeadScore(leadData),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        // Adicionar tags automáticas baseadas nos dados
        const autoTags = [];
        if (leadData.company) {
            autoTags.push('empresa');
        }
        if (leadData.email && leadData.phone) {
            autoTags.push('contato-completo');
        }
        if (leadData.source === 'chat') {
            autoTags.push('chatbot');
        }
        enrichedData.tags = [...(leadData.tags || []), ...autoTags];
        await leadRef.update(enrichedData);
        console.log('✅ Dados do lead enriquecidos');
    }
    catch (error) {
        console.error('❌ Erro ao enriquecer dados:', error);
    }
}
function calculateLeadScore(leadData) {
    let score = 0;
    // Pontuação base
    score += 10;
    // Email válido
    if (leadData.email) {
        score += 20;
    }
    // Telefone válido  
    if (leadData.phone) {
        score += 15;
    }
    // Tem empresa
    if (leadData.company) {
        score += 25;
    }
    // Fonte de alta qualidade
    if (leadData.source === 'form' || leadData.source === 'demo') {
        score += 20;
    }
    // Ambos email e telefone
    if (leadData.email && leadData.phone) {
        score += 10;
    }
    return Math.min(score, 100); // Máximo 100 pontos
}
//# sourceMappingURL=leadProcessor.js.map