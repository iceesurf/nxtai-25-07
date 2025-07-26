const admin = require('firebase-admin');
const { PubSub } = require('@google-cloud/pubsub');

class FulfillmentEngine {
  constructor(config = {}) {
    this.db = admin.firestore();
    this.pubsub = new PubSub();
    this.handlers = new Map();
    this.middlewares = [];
    this.config = {
      timeout: config.timeout || 10000, // 10 segundos
      retryAttempts: config.retryAttempts || 3,
      enableAnalytics: config.enableAnalytics !== false
    };
    
    this.registerDefaultHandlers();
  }

  /**
   * Registrar handler para intent específico
   */
  registerHandler(intentName, handler, options = {}) {
    try {
      console.log(`🔧 Registrando handler para intent: ${intentName}`);
      
      const handlerConfig = {
        handler,
        options: {
          timeout: options.timeout || this.config.timeout,
          retryAttempts: options.retryAttempts || this.config.retryAttempts,
          requiresAuth: options.requiresAuth || false,
          rateLimit: options.rateLimit || null,
          cache: options.cache || false,
          priority: options.priority || 'normal'
        }
      };

      this.handlers.set(intentName, handlerConfig);
      console.log(`✅ Handler registrado: ${intentName}`);

    } catch (error) {
      console.error('❌ Erro ao registrar handler:', error);
      throw new Error(`Falha ao registrar handler para ${intentName}`);
    }
  }

  /**
   * Registrar múltiplos handlers
   */
  registerHandlers(handlersConfig) {
    for (const [intentName, config] of Object.entries(handlersConfig)) {
      this.registerHandler(intentName, config.handler, config.options);
    }
  }

  /**
   * Adicionar middleware
   */
  addMiddleware(middleware) {
    this.middlewares.push(middleware);
    console.log(`✅ Middleware adicionado: ${middleware.name || 'anonymous'}`);
  }

  /**
   * Processar requisição de fulfillment
   */
  async processRequest(request) {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Processando fulfillment para intent: ${request.intentName}`);
      
      // Executar middlewares
      const processedRequest = await this.executeMiddlewares(request);
      
      // Buscar handler
      const handlerConfig = this.handlers.get(processedRequest.intentName);
      
      if (!handlerConfig) {
        console.warn(`⚠️ Nenhum handler encontrado para intent: ${processedRequest.intentName}`);
        return this.getDefaultResponse(processedRequest);
      }

      // Validar autenticação se necessário
      if (handlerConfig.options.requiresAuth && !processedRequest.authenticated) {
        return this.getAuthRequiredResponse(processedRequest);
      }

      // Verificar rate limit
      if (handlerConfig.options.rateLimit) {
        const rateLimitOk = await this.checkRateLimit(processedRequest.sessionId, handlerConfig.options.rateLimit);
        if (!rateLimitOk) {
          return this.getRateLimitResponse(processedRequest);
        }
      }

      // Executar handler com retry
      const response = await this.executeHandlerWithRetry(
        handlerConfig.handler,
        processedRequest,
        handlerConfig.options
      );

      // Registrar analytics
      if (this.config.enableAnalytics) {
        await this.logFulfillmentEvent(processedRequest, response, Date.now() - startTime);
      }

      return response;

    } catch (error) {
      console.error('❌ Erro no processamento de fulfillment:', error);
      
      // Registrar erro
      if (this.config.enableAnalytics) {
        await this.logFulfillmentError(request, error, Date.now() - startTime);
      }
      
      return this.getErrorResponse(request, error);
    }
  }

  /**
   * Executar middlewares em sequência
   */
  async executeMiddlewares(request) {
    let processedRequest = { ...request };
    
    for (const middleware of this.middlewares) {
      try {
        processedRequest = await middleware(processedRequest);
      } catch (error) {
        console.error('❌ Erro em middleware:', error);
        // Continuar processamento mesmo com erro em middleware
      }
    }
    
    return processedRequest;
  }

  /**
   * Executar handler com retry
   */
  async executeHandlerWithRetry(handler, request, options) {
    let lastError;
    
    for (let attempt = 1; attempt <= options.retryAttempts; attempt++) {
      try {
        // Executar com timeout
        const response = await this.executeWithTimeout(handler(request), options.timeout);
        
        if (attempt > 1) {
          console.log(`✅ Handler executado com sucesso na tentativa ${attempt}`);
        }
        
        return response;

      } catch (error) {
        lastError = error;
        console.error(`❌ Tentativa ${attempt} falhou:`, error);
        
        if (attempt < options.retryAttempts) {
          // Aguardar antes de tentar novamente (backoff exponencial)
          const delay = Math.pow(2, attempt - 1) * 1000;
          await this.wait(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Executar função com timeout
   */
  async executeWithTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ]);
  }

  /**
   * Verificar rate limit
   */
  async checkRateLimit(sessionId, rateLimit) {
    try {
      const { maxRequests, windowMs } = rateLimit;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Buscar requisições recentes
      const snapshot = await this.db
        .collection('rate_limits')
        .doc(sessionId)
        .collection('requests')
        .where('timestamp', '>', new Date(windowStart))
        .get();

      if (snapshot.size >= maxRequests) {
        return false;
      }

      // Registrar nova requisição
      await this.db
        .collection('rate_limits')
        .doc(sessionId)
        .collection('requests')
        .add({
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

      return true;

    } catch (error) {
      console.error('❌ Erro ao verificar rate limit:', error);
      return true; // Permitir em caso de erro
    }
  }

  /**
   * Registrar evento de fulfillment
   */
  async logFulfillmentEvent(request, response, duration) {
    try {
      const eventData = {
        sessionId: request.sessionId,
        intentName: request.intentName,
        parameters: request.parameters,
        queryText: request.queryText,
        languageCode: request.languageCode,
        responseMessageCount: response.fulfillmentMessages?.length || 0,
        duration,
        success: true,
        timestamp: new Date().toISOString()
      };

      // Salvar no Firestore
      await this.db.collection('fulfillment_analytics').add({
        ...eventData,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Publicar no Pub/Sub para processamento em tempo real
      await this.pubsub.topic('fulfillment-analytics').publish(
        Buffer.from(JSON.stringify(eventData))
      );

    } catch (error) {
      console.error('❌ Erro ao registrar evento de fulfillment:', error);
    }
  }

  /**
   * Registrar erro de fulfillment
   */
  async logFulfillmentError(request, error, duration) {
    try {
      const errorData = {
        sessionId: request.sessionId,
        intentName: request.intentName,
        error: error.message,
        stack: error.stack,
        duration,
        success: false,
        timestamp: new Date().toISOString()
      };

      await this.db.collection('fulfillment_errors').add({
        ...errorData,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (logError) {
      console.error('❌ Erro ao registrar erro de fulfillment:', logError);
    }
  }

  /**
   * Registrar handlers padrão
   */
  registerDefaultHandlers() {
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

    // Handler para feedback
    this.registerHandler('user-feedback', async (request) => {
      return this.handleUserFeedback(request);
    });
  }

  /**
   * Handler para coleta de leads
   */
  async handleLeadCollection(request) {
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
        
        // Publicar evento de novo lead
        await this.pubsub.topic('new-lead').publish(
          Buffer.from(JSON.stringify({ leadId: leadRef.id, ...leadData }))
        );
        
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
        console.error('❌ Erro ao salvar lead:', error);
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

  /**
   * Handler para agendamento de demo
   */
  async handleDemoScheduling(request) {
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
                postback: 'SCHEDULE_DEMO'
              },
              {
                text: 'Falar com Especialista',
                postback: 'TALK_TO_EXPERT'
              }
            ]
          }
        }
      ]
    };
  }

  /**
   * Handler para informações de preços
   */
  async handlePricingRequest(request) {
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
          quickReplies: {
            title: 'Quer saber qual plano é ideal para você?',
            quickReplies: ['Falar com Vendas', 'Agendar Demo', 'Mais Informações']
          }
        }
      ]
    };
  }

  /**
   * Handler para transferência humana
   */
  async handleHumanTransfer(request) {
    try {
      // Marcar sessão para transferência
      await this.db.collection('conversations').doc(request.sessionId).update({
        status: 'escalated',
        escalatedAt: admin.firestore.FieldValue.serverTimestamp(),
        escalationReason: 'user_request'
      });

      // Notificar agentes disponíveis
      await this.pubsub.topic('human-transfer-request').publish(
        Buffer.from(JSON.stringify({
          sessionId: request.sessionId,
          reason: 'user_request',
          timestamp: new Date().toISOString()
        }))
      );

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

  /**
   * Handler para informações da empresa
   */
  async handleCompanyInfo(request) {
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
                postback: 'LEARN_MORE'
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

  /**
   * Handler para FAQ
   */
  async handleFAQ(request) {
    const { parameters } = request;
    const faqTopic = parameters.faq_topic || 'general';

    const faqResponses = {
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

  /**
   * Handler para feedback do usuário
   */
  async handleUserFeedback(request) {
    const { parameters, sessionId } = request;
    const { rating, feedback_text, category } = parameters;

    try {
      // Salvar feedback
      const feedbackData = {
        sessionId,
        rating: rating ? parseInt(rating) : null,
        feedbackText: feedback_text || '',
        category: category || 'general',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('user_feedback').add(feedbackData);

      return {
        fulfillmentMessages: [
          {
            text: {
              text: [
                'Obrigado pelo seu feedback! Suas opiniões são muito importantes ' +
                'para melhorarmos nosso atendimento.'
              ]
            }
          }
        ]
      };

    } catch (error) {
      console.error('❌ Erro ao salvar feedback:', error);
      return {
        fulfillmentMessages: [
          {
            text: {
              text: ['Obrigado pelo feedback!']
            }
          }
        ]
      };
    }
  }

  /**
   * Resposta padrão
   */
  getDefaultResponse(request) {
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

  /**
   * Resposta de erro
   */
  getErrorResponse(request, error) {
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

  /**
   * Resposta de autenticação necessária
   */
  getAuthRequiredResponse(request) {
    return {
      fulfillmentMessages: [
        {
          text: {
            text: ['Esta ação requer autenticação. Por favor, faça login primeiro.']
          }
        }
      ]
    };
  }

  /**
   * Resposta de rate limit excedido
   */
  getRateLimitResponse(request) {
    return {
      fulfillmentMessages: [
        {
          text: {
            text: ['Muitas requisições. Aguarde um momento antes de tentar novamente.']
          }
        }
      ]
    };
  }

  /**
   * Utilitário para aguardar
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Utilitários para criar responses
   */
  createTextResponse(texts) {
    return {
      fulfillmentMessages: [
        {
          text: { text: Array.isArray(texts) ? texts : [texts] }
        }
      ]
    };
  }

  createQuickRepliesResponse(title, quickReplies) {
    return {
      fulfillmentMessages: [
        {
          quickReplies: { title, quickReplies }
        }
      ]
    };
  }

  createCardResponse(card) {
    return {
      fulfillmentMessages: [
        { card }
      ]
    };
  }

  createImageResponse(imageUri, accessibilityText) {
    return {
      fulfillmentMessages: [
        {
          image: { imageUri, accessibilityText }
        }
      ]
    };
  }

  /**
   * Obter estatísticas do engine
   */
  async getEngineStatistics() {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [analyticsSnapshot, errorsSnapshot] = await Promise.all([
        this.db.collection('fulfillment_analytics')
          .where('timestamp', '>=', oneDayAgo)
          .get(),
        this.db.collection('fulfillment_errors')
          .where('timestamp', '>=', oneDayAgo)
          .get()
      ]);

      const totalRequests = analyticsSnapshot.size + errorsSnapshot.size;
      const successfulRequests = analyticsSnapshot.size;
      const failedRequests = errorsSnapshot.size;

      const avgDuration = analyticsSnapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().duration || 0);
      }, 0) / (analyticsSnapshot.size || 1);

      return {
        registeredHandlers: this.handlers.size,
        activeMiddlewares: this.middlewares.length,
        last24Hours: {
          totalRequests,
          successfulRequests,
          failedRequests,
          successRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
          avgDuration: Math.round(avgDuration)
        }
      };

    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return {
        registeredHandlers: this.handlers.size,
        activeMiddlewares: this.middlewares.length,
        last24Hours: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          successRate: 0,
          avgDuration: 0
        }
      };
    }
  }
}

module.exports = FulfillmentEngine;