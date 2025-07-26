import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { PubSub } from '@google-cloud/pubsub';
import cors from 'cors';

const corsHandler = cors({ origin: true });
const pubsub = new PubSub();

export async function dialogflowWebhook(req: Request, res: Response): Promise<void> {
  return corsHandler(req, res, async () => {
    try {
      console.log('📨 Dialogflow webhook received:', JSON.stringify(req.body, null, 2));

      const { sessionInfo, fulfillmentInfo, messages, detectIntentResponseId } = req.body;
      const sessionId = sessionInfo?.session?.split('/').pop() || 'unknown';
      const intentName = fulfillmentInfo?.tag || 'unknown';
      
      // Processar diferentes tipos de intents
      let webhookResponse: any = {};
      
      switch (intentName) {
        case 'collect-lead-info':
          webhookResponse = await handleLeadCollection(req.body);
          break;
        
        case 'schedule-demo':
          webhookResponse = await handleDemoScheduling(req.body);
          break;
          
        case 'get-pricing':
          webhookResponse = await handlePricingRequest(req.body);
          break;
          
        case 'transfer-to-human':
          webhookResponse = await handleHumanTransfer(req.body);
          break;
          
        default:
          webhookResponse = {
            fulfillment_response: {
              messages: [
                {
                  text: {
                    text: ['Entendi. Como posso ajudar você mais?']
                  }
                }
              ]
            }
          };
      }

      // Publicar analytics no Pub/Sub
      const analyticsData = {
        sessionId,
        intentName,
        timestamp: new Date().toISOString(),
        parameters: sessionInfo?.parameters || {},
        responseId: detectIntentResponseId
      };

      await pubsub.topic('dialogflow-analytics').publish(
        Buffer.from(JSON.stringify(analyticsData))
      );

      console.log('✅ Webhook response:', JSON.stringify(webhookResponse, null, 2));
      res.status(200).json(webhookResponse);

    } catch (error) {
      console.error('❌ Dialogflow webhook error:', error);
      res.status(500).json({
        fulfillment_response: {
          messages: [
            {
              text: {
                text: ['Desculpe, ocorreu um erro. Tente novamente em alguns instantes.']
              }
            }
          ]
        }
      });
    }
  });
}

async function handleLeadCollection(body: any) {
  const { sessionInfo } = body;
  const parameters = sessionInfo?.parameters || {};
  
  console.log('👤 Coletando informações do lead:', parameters);
  
  // Validar se temos as informações necessárias
  const { name, email, phone, company } = parameters;
  
  if (name && (email || phone)) {
    // Salvar lead no Firestore
    const db = admin.firestore();
    const leadData = {
      name: name.stringValue || name,
      email: email?.stringValue || email || null,
      phone: phone?.stringValue || phone || null,
      company: company?.stringValue || company || null,
      source: 'chat',
      status: 'new',
      sessionId: sessionInfo?.session?.split('/').pop() || 'unknown',
      tags: ['chatbot'],
      customFields: {},
      notes: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    try {
      const leadRef = await db.collection('leads').add(leadData);
      console.log('✅ Lead salvo:', leadRef.id);
      
      return {
        fulfillment_response: {
          messages: [
            {
              text: {
                text: [
                  `Obrigado, ${name}! Suas informações foram registradas. ` +
                  'Nossa equipe entrará em contato em breve. ' +
                  'Há mais alguma coisa em que posso ajudar?'
                ]
              }
            }
          ]
        },
        session_info: {
          parameters: {
            lead_collected: { stringValue: 'true' },
            lead_id: { stringValue: leadRef.id }
          }
        }
      };
      
    } catch (error) {
      console.error('❌ Erro ao salvar lead:', error);
      return {
        fulfillment_response: {
          messages: [
            {
              text: {
                text: [
                  'Houve um problema ao registrar suas informações. ' +
                  'Pode tentar novamente ou entrar em contato diretamente conosco?'
                ]
              }
            }
          ]
        }
      };
    }
  }
  
  // Se não temos informações suficientes, continuar coletando
  if (!name) {
    return {
      fulfillment_response: {
        messages: [
          {
            text: {
              text: ['Qual é o seu nome?']
            }
          }
        ]
      }
    };
  }
  
  if (!email && !phone) {
    return {
      fulfillment_response: {
        messages: [
          {
            text: {
              text: [
                'Para entrarmos em contato, preciso do seu email ou telefone. ' +
                'Qual você prefere compartilhar?'
              ]
            }
          }
        ]
      }
    };
  }
  
  return {
    fulfillment_response: {
      messages: [
        {
          text: {
            text: ['Obrigado pelas informações! Nossa equipe entrará em contato.']
          }
        }
      ]
    }
  };
}

async function handleDemoScheduling(body: any) {
  const { sessionInfo } = body;
  const parameters = sessionInfo?.parameters || {};
  
  return {
    fulfillment_response: {
      messages: [
        {
          text: {
            text: [
              'Ótimo! Para agendar uma demonstração personalizada, ' +
              'vou conectar você com um dos nossos especialistas. ' +
              'Eles entrarão em contato nas próximas horas para definir ' +
              'o melhor horário para você.'
            ]
          }
        },
        {
          payload: {
            richContent: [[
              {
                type: 'button',
                text: 'Falar com especialista agora',
                link: 'https://calendly.com/nxtai-demo'
              }
            ]]
          }
        }
      ]
    }
  };
}

async function handlePricingRequest(body: any) {
  return {
    fulfillment_response: {
      messages: [
        {
          text: {
            text: [
              'Nossos planos são flexíveis e se adaptam ao tamanho da sua empresa:'
            ]
          }
        },
        {
          payload: {
            richContent: [[
              {
                type: 'info',
                title: 'Plano Starter',
                subtitle: 'R$ 297/mês\n• Até 1.000 conversas/mês\n• 1 agente virtual\n• CRM básico',
                image: {
                  src: {
                    rawUrl: 'https://storage.googleapis.com/nxt-ai-assets/pricing-starter.png'
                  }
                }
              },
              {
                type: 'info',
                title: 'Plano Professional',
                subtitle: 'R$ 897/mês\n• Até 5.000 conversas/mês\n• 3 agentes virtuais\n• CRM avançado + Campanhas',
                image: {
                  src: {
                    rawUrl: 'https://storage.googleapis.com/nxt-ai-assets/pricing-pro.png'
                  }
                }
              },
              {
                type: 'info',
                title: 'Plano Enterprise',
                subtitle: 'Sob consulta\n• Conversas ilimitadas\n• Múltiplos agentes\n• Integrações customizadas',
                image: {
                  src: {
                    rawUrl: 'https://storage.googleapis.com/nxt-ai-assets/pricing-enterprise.png'
                  }
                }
              }
            ]]
          }
        },
        {
          text: {
            text: [
              'Quer saber qual plano é ideal para sua empresa? ' +
              'Posso conectar você com nossa equipe comercial para uma análise personalizada.'
            ]
          }
        }
      ]
    }
  };
}

async function handleHumanTransfer(body: any) {
  const { sessionInfo } = body;
  const sessionId = sessionInfo?.session?.split('/').pop() || 'unknown';
  
  try {
    // Marcar conversa para transferência humana
    const db = admin.firestore();
    await db.collection('conversations').doc(sessionId).update({
      status: 'escalated',
      escalatedAt: admin.firestore.FieldValue.serverTimestamp(),
      escalationReason: 'user_request'
    });
    
    return {
      fulfillment_response: {
        messages: [
          {
            text: {
              text: [
                'Perfeito! Estou transferindo você para um dos nossos atendentes humanos. ' +
                'Aguarde um momento que alguém da equipe estará com você em breve.'
              ]
            }
          }
        ]
      }
    };
    
  } catch (error) {
    console.error('❌ Erro ao transferir para humano:', error);
    return {
      fulfillment_response: {
        messages: [
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
      }
    };
  }
}