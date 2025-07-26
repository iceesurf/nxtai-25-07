// Dados iniciais para desenvolvimento
export const seedData = {
  // Admin user data
  adminUser: {
    email: 'admin@nxtai.com',
    password: 'admin123',
    displayName: 'Administrador NXT.AI',
    role: 'admin'
  },

  // Sample campaigns
  campaigns: [
    {
      id: '1',
      name: 'Campanha de Vendas Q4',
      description: 'Campanha para aumentar vendas no último trimestre',
      status: 'active',
      createdAt: new Date().toISOString(),
      metrics: {
        leads: 156,
        conversions: 23,
        revenue: 45000
      }
    },
    {
      id: '2',
      name: 'Suporte Técnico',
      description: 'Atendimento automatizado para suporte técnico',
      status: 'active',
      createdAt: new Date().toISOString(),
      metrics: {
        leads: 89,
        conversions: 67,
        revenue: 0
      }
    }
  ],

  // Sample leads
  leads: [
    {
      id: '1',
      name: 'Maria Silva',
      email: 'maria@example.com',
      phone: '+5511999999999',
      source: 'WhatsApp',
      status: 'new',
      campaignId: '1',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'João Santos',
      email: 'joao@example.com',
      phone: '+5511888888888',
      source: 'Website',
      status: 'contacted',
      campaignId: '1',
      createdAt: new Date().toISOString()
    }
  ],

  // Sample conversations
  conversations: [
    {
      id: '1',
      leadId: '1',
      channel: 'whatsapp',
      status: 'active',
      messages: [
        {
          id: '1',
          content: 'Olá! Gostaria de saber mais sobre seus produtos.',
          sender: 'user',
          timestamp: new Date().toISOString()
        },
        {
          id: '2',
          content: 'Olá Maria! Fico feliz em ajudar. Qual produto específico te interessa?',
          sender: 'agent',
          timestamp: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],

  // Sample agents
  agents: [
    {
      id: '1',
      name: 'Agente de Vendas',
      description: 'Especializado em vendas e conversão de leads',
      status: 'active',
      model: 'gpt-4',
      personality: 'Amigável e persuasivo',
      instructions: 'Você é um vendedor experiente que ajuda clientes a encontrar o produto ideal.',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Suporte Técnico',
      description: 'Atendimento para questões técnicas e problemas',
      status: 'active',
      model: 'gpt-4',
      personality: 'Técnico e prestativo',
      instructions: 'Você é um especialista técnico que resolve problemas de forma clara e objetiva.',
      createdAt: new Date().toISOString()
    }
  ]
};

// Function to initialize Firestore with seed data
export const initializeFirestoreData = async () => {
  try {
    const { db } = await import('../config/firebase');
    const { collection, doc, setDoc, getDoc } = await import('firebase/firestore');

    // Check if data already exists
    const adminDoc = await getDoc(doc(db, 'admin', 'initialized'));
    if (adminDoc.exists()) {
      console.log('Seed data already exists');
      return;
    }

    // Add campaigns
    for (const campaign of seedData.campaigns) {
      await setDoc(doc(db, 'campaigns', campaign.id), {
        ...campaign,
        createdBy: 'admin',
        updatedAt: new Date().toISOString()
      });
    }

    // Add leads
    for (const lead of seedData.leads) {
      await setDoc(doc(db, 'leads', lead.id), {
        ...lead,
        updatedAt: new Date().toISOString()
      });
    }

    // Add conversations
    for (const conversation of seedData.conversations) {
      await setDoc(doc(db, 'conversations', conversation.id), {
        ...conversation,
        participantIds: ['admin']
      });
    }

    // Add agents
    for (const agent of seedData.agents) {
      await setDoc(doc(db, 'dialogflow/agents', agent.id), {
        ...agent,
        createdBy: 'admin',
        updatedAt: new Date().toISOString()
      });
    }

    // Mark as initialized
    await setDoc(doc(db, 'admin', 'initialized'), {
      timestamp: new Date().toISOString(),
      version: '1.0'
    });

    console.log('Seed data initialized successfully');
  } catch (error) {
    console.error('Error initializing seed data:', error);
  }
};