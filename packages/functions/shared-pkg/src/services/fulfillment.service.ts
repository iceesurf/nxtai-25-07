import * as admin from 'firebase-admin';
import { PubSub } from '@google-cloud/pubsub';

export interface FulfillmentRequest {
  sessionId: string;
  intentName: string;
  parameters: { [key: string]: any };
  queryText: string;
  languageCode: string;
  sessionInfo?: { [key: string]: any };
}

export interface FulfillmentResponse {
  fulfillmentMessages: FulfillmentMessage[];
  sessionInfo?: { [key: string]: any };
  payload?: { [key: string]: any };
}

export interface FulfillmentMessage {
  text?: TextMessage;
  image?: ImageMessage;
  quickReplies?: QuickRepliesMessage;
  card?: CardMessage;
  payload?: { [key: string]: any };
  platform?: 'PLATFORM_UNSPECIFIED' | 'FACEBOOK' | 'SLACK' | 'TELEGRAM' | 'KIK' | 'SKYPE' | 'LINE' | 'VIBER' | 'ACTIONS_ON_GOOGLE' | 'GOOGLE_HANGOUTS';
}

export interface TextMessage {
  text: string[];
}

export interface ImageMessage {
  imageUri: string;
  accessibilityText?: string;
}

export interface QuickRepliesMessage {
  title: string;
  quickReplies: string[];
}

export interface CardMessage {
  title: string;
  subtitle?: string;
  imageUri?: string;
  buttons?: CardButton[];
}

export interface CardButton {
  text: string;
  postback?: string;
  url?: string;
}

export interface FulfillmentHandler {
  intentName: string;
  handler: (request: FulfillmentRequest) => Promise<FulfillmentResponse>;
}

export class FulfillmentService {
  private handlers: Map<string, (request: FulfillmentRequest) => Promise<FulfillmentResponse>>;
  private db: admin.firestore.Firestore;
  private pubsub: PubSub;

  constructor() {
    this.handlers = new Map();
    this.db = admin.firestore();
    this.pubsub = new PubSub();
    this.registerDefaultHandlers();
  }

  registerHandler(intentName: string, handler: (request: FulfillmentRequest) => Promise<FulfillmentResponse>): void {
    this.handlers.set(intentName, handler);
    console.log(`✅ Handler registered for intent: ${intentName}`);
  }

  registerHandlers(handlers: FulfillmentHandler[]): void {
    handlers.forEach(({ intentName, handler }) => {
      this.registerHandler(intentName, handler);
    });
  }

  async processRequest(request: FulfillmentRequest): Promise<FulfillmentResponse> {
    try {
      console.log(`🔄 Processing fulfillment for intent: ${request.intentName}`);
      
      const handler = this.handlers.get(request.intentName);
      
      if (!handler) {
        console.warn(`⚠️ No handler found for intent: ${request.intentName}`);
        return this.getDefaultResponse(request);
      }

      // Executar handler
      const response = await handler(request);
      
      // Log para analytics
      await this.logFulfillmentEvent(request, response);
      
      return response;

    } catch (error) {
      console.error('❌ Error processing fulfillment:', error);
      return this.getErrorResponse(request);
    }
  }

  private async logFulfillmentEvent(request: FulfillmentRequest, response: FulfillmentResponse): Promise<void> {
    try {
      const eventData = {
        sessionId: request.sessionId,
        intentName: request.intentName,
        parameters: request.parameters,
        queryText: request.queryText,
        responseMessageCount: response.fulfillmentMessages.length,
        timestamp: new Date().toISOString(),
        success: true
      };

      // Publicar no Pub/Sub para analytics
      await this.pubsub.topic('fulfillment-analytics').publish(
        Buffer.from(JSON.stringify(eventData))
      );

    } catch (error) {
      console.error('❌ Error logging fulfillment event:', error);
    }
  }

  private getDefaultResponse(request: FulfillmentRequest): FulfillmentResponse {
    return {
      fulfillmentMessages: [
        {
          text: {
            text: ['Entendi. Como posso ajudar você mais?']
          }
        }
      ]
    };
  }

  private getErrorResponse(request: FulfillmentRequest): FulfillmentResponse {
    return {
      fulfillmentMessages: [
        {
          text: {
            text: ['Desculpe, ocorreu um erro interno. Tente novamente em alguns instantes.']
          }
        }
      ]
    };
  }

  private registerDefaultHandlers(): void {
    // Handler para coleta de leads
    this.registerHandler('collect-lead-info', async (request) => {
      return this.handleLeadCollection(request);
    });

    // Handler para agendamento de demo
    this.registerHandler('schedule-demo', async (request) => {
      return this.handleDemoScheduling(request);
    });

    // Handler para informações de preços
    this.registerHandler('get-pricing', async (request) => {
      return this.handlePricingRequest(request);
    });

    // Handler para transferência humana
    this.registerHandler('transfer-to-human', async (request) => {
      return this.handleHumanTransfer(request);
    });

    // Handler para informações da empresa
    this.registerHandler('company-info', async (request) => {
      return this.handleCompanyInfo(request);
    });

    // Handler para FAQ
    this.registerHandler('faq', async (request) => {
      return this.handleFAQ(request);
    });
  }

  private async handleLeadCollection(request: FulfillmentRequest): Promise<FulfillmentResponse> {
    const { parameters, sessionId } = request;
    const { name, email, phone, company } = parameters;

    if (name && (email || phone)) {
      try {
        // Salvar lead no Firestore
        const leadData = {
          name,
          email: email || null,
          phone: phone || null,
          company: company || null,
          source: 'chatbot',
          status: 'new',
          sessionId,
          tags: ['chatbot'],
          customFields: {},
          notes: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const leadRef = await this.db.collection('leads').add(leadData);
        
        return {
          fulfillmentMessages: [
            {
              text: {
                text: [
                  `Obrigado, ${name}! Suas informações foram registradas. ` +
                  'Nossa equipe entrará em contato em breve. ' +
                  'Há mais alguma coisa em que posso ajudar?'
                ]
              }
            }
          ],
          sessionInfo: {
            parameters: {
              lead_collected: true,
              lead_id: leadRef.id
            }
          }
        };

      } catch (error) {
        console.error('❌ Error saving lead:', error);
        return {
          fulfillmentMessages: [
            {
              text: {
                text: [
                  'Houve um problema ao registrar suas informações. ' +
                  'Pode tentar novamente ou entrar em contato diretamente conosco?'
                ]
              }
            }
          ]
        };
      }
    }

    // Continuar coletando informações
    if (!name) {
      return {
        fulfillmentMessages: [
          {
            text: { text: ['Qual é o seu nome?'] }
          }
        ]
      };
    }

    if (!email && !phone) {
      return {
        fulfillmentMessages: [
          {
            quickReplies: {
              title: 'Para entrarmos em contato, preciso do seu email ou telefone:',
              quickReplies: ['Informar Email', 'Informar Telefone']
            }
          }
        ]
      };
    }

    return this.getDefaultResponse(request);
  }

  private async handleDemoScheduling(request: FulfillmentRequest): Promise<FulfillmentResponse> {
    return {
      fulfillmentMessages: [
        {
          text: {
            text: [
              'Ótimo! Para agendar uma demonstração personalizada, ' +
              'vou conectar você com um dos nossos especialistas.'
            ]
          }
        },
        {
          card: {
            title: 'Agendar Demonstração',
            subtitle: 'Clique para escolher o melhor horário',
            imageUri: 'https://storage.googleapis.com/nxt-ai-assets/demo-calendar.png',
            buttons: [
              {
                text: 'Agendar Agora',
                url: 'https://calendly.com/nxtai-demo'
              }
            ]
          }
        }
      ]
    };
  }

  private async handlePricingRequest(request: FulfillmentRequest): Promise<FulfillmentResponse> {
    return {
      fulfillmentMessages: [
        {
          text: {
            text: ['Nossos planos são flexíveis e se adaptam ao tamanho da sua empresa:']
          }
        },
        {
          payload: {
            richContent: [[
              {
                type: 'info',
                title: 'Plano Starter',
                subtitle: 'R$ 297/mês\n• Até 1.000 conversas/mês\n• 1 agente virtual\n• CRM básico'
              },
              {
                type: 'info',
                title: 'Plano Professional',
                subtitle: 'R$ 897/mês\n• Até 5.000 conversas/mês\n• 3 agentes virtuais\n• CRM avançado + Campanhas'
              },
              {
                type: 'info',
                title: 'Plano Enterprise',
                subtitle: 'Sob consulta\n• Conversas ilimitadas\n• Múltiplos agentes\n• Integrações customizadas'
              }
            ]]
          }
        },
        {
          quickReplies: {
            title: 'Quer saber qual plano é ideal para você?',
            quickReplies: ['Falar com Vendas', 'Agendar Demo', 'Mais Informações']
          }
        }
      ]
    };
  }

  private async handleHumanTransfer(request: FulfillmentRequest): Promise<FulfillmentResponse> {
    try {
      // Marcar sessão para transferência
      await this.db.collection('conversations').doc(request.sessionId).update({
        status: 'escalated',
        escalatedAt: admin.firestore.FieldValue.serverTimestamp(),
        escalationReason: 'user_request'
      });

      return {
        fulfillmentMessages: [
          {
            text: {
              text: [
                'Perfeito! Estou transferindo você para um dos nossos atendentes humanos. ' +
                'Aguarde um momento que alguém da equipe estará com você em breve.'
              ]
            }
          }
        ]
      };

    } catch (error) {
      return {
        fulfillmentMessages: [
          {
            text: {
              text: [
                'Vou conectar você com nossa equipe de atendimento. ' +
                'Você pode entrar em contato diretamente pelo email contato@nxt.ai ' +
                'ou telefone (11) 9999-9999.'
              ]
            }
          }
        ]
      };
    }
  }

  private async handleCompanyInfo(request: FulfillmentRequest): Promise<FulfillmentResponse> {
    return {
      fulfillmentMessages: [
        {
          text: {
            text: [
              'A NXT.AI é uma plataforma de automação inteligente que ajuda empresas ' +
              'a criar chatbots e assistentes virtuais avançados.'
            ]
          }
        },
        {
          card: {
            title: 'NXT.AI',
            subtitle: 'Automatização Inteligente para sua Empresa',
            imageUri: 'https://storage.googleapis.com/nxt-ai-assets/company-logo.png',
            buttons: [
              {
                text: 'Saiba Mais',
                url: 'https://nxt.ai/sobre'
              },
              {
                text: 'Fale Conosco',
                postback: 'CONTACT_SALES'
              }
            ]
          }
        }
      ]
    };
  }

  private async handleFAQ(request: FulfillmentRequest): Promise<FulfillmentResponse> {
    const { parameters } = request;
    const faqTopic = parameters.faq_topic || 'general';

    const faqResponses: { [key: string]: FulfillmentResponse } = {
      'pricing': {
        fulfillmentMessages: [
          {
            text: {
              text: [
                'Nossos preços variam de acordo com o plano escolhido. ' +
                'Temos opções desde R$ 297/mês até planos enterprise customizados.'
              ]
            }
          },
          {
            quickReplies: {
              title: 'Quer ver os detalhes dos planos?',
              quickReplies: ['Ver Planos', 'Falar com Vendas']
            }
          }
        ]
      },
      'features': {
        fulfillmentMessages: [
          {
            text: {
              text: [
                'Nossa plataforma oferece: chatbots inteligentes, CRM integrado, ' +
                'campanhas automatizadas, analytics avançado e muito mais!'
              ]
            }
          }
        ]
      },
      'support': {
        fulfillmentMessages: [
          {
            text: {
              text: [
                'Oferecemos suporte 24/7 via chat, email e telefone. ' +
                'Também temos uma base de conhecimento completa e tutoriais em vídeo.'
              ]
            }
          }
        ]
      }
    };

    return faqResponses[faqTopic] || this.getDefaultResponse(request);
  }

  // Utilitários para criar responses
  createTextResponse(texts: string[]): FulfillmentResponse {
    return {
      fulfillmentMessages: [
        {
          text: { text: texts }
        }
      ]
    };
  }

  createQuickRepliesResponse(title: string, quickReplies: string[]): FulfillmentResponse {
    return {
      fulfillmentMessages: [
        {
          quickReplies: { title, quickReplies }
        }
      ]
    };
  }

  createCardResponse(card: CardMessage): FulfillmentResponse {
    return {
      fulfillmentMessages: [
        { card }
      ]
    };
  }

  createImageResponse(imageUri: string, accessibilityText?: string): FulfillmentResponse {
    return {
      fulfillmentMessages: [
        {
          image: { imageUri, accessibilityText }
        }
      ]
    };
  }
}