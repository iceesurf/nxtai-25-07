import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  orderBy,
  where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Agent } from '../types/agent';

export class AgentService {
  async getAgents(): Promise<Agent[]> {
    try {
      const q = query(collection(db, 'agents'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Agent[];
    } catch (error) {
      console.error('Error getting agents:', error);
      throw new Error('Erro ao buscar agentes');
    }
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    try {
      const docRef = doc(db, 'agents', agentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Agent;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting agent:', error);
      throw new Error('Erro ao buscar agente');
    }
  }

  async createAgent(agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = doc(collection(db, 'agents'));
      
      const agent: Agent = {
        ...agentData,
        id: docRef.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: false,
        status: 'offline',
        stats: {
          totalConversations: 0,
          dailyConversations: 0,
          resolutionRate: 0,
          avgResponseTime: 0,
          satisfaction: 0
        }
      };

      await setDoc(docRef, agent);
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating agent:', error);
      throw new Error('Erro ao criar agente');
    }
  }

  async updateAgent(agentId: string, data: Partial<Agent>): Promise<void> {
    try {
      await updateDoc(doc(db, 'agents', agentId), {
        ...data,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating agent:', error);
      throw new Error('Erro ao atualizar agente');
    }
  }

  async deleteAgent(agentId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'agents', agentId));
    } catch (error) {
      console.error('Error deleting agent:', error);
      throw new Error('Erro ao excluir agente');
    }
  }

  async updateAgentStatus(agentId: string, isActive: boolean): Promise<void> {
    try {
      const status = isActive ? 'online' : 'offline';
      
      await updateDoc(doc(db, 'agents', agentId), {
        isActive,
        status,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating agent status:', error);
      throw new Error('Erro ao atualizar status do agente');
    }
  }

  async cloneAgent(agentId: string): Promise<string> {
    try {
      const originalAgent = await this.getAgent(agentId);
      
      if (!originalAgent) {
        throw new Error('Agente não encontrado');
      }

      const { id, createdAt, updatedAt, stats, ...agentData } = originalAgent;
      
      const clonedData = {
        ...agentData,
        name: `${originalAgent.name} (Cópia)`,
        isActive: false,
        status: 'offline' as const
      };

      return await this.createAgent(clonedData);
    } catch (error) {
      console.error('Error cloning agent:', error);
      throw new Error('Erro ao clonar agente');
    }
  }

  async getAgentStats(agentId: string, days: number = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

      // TODO: Implement actual stats collection from conversations
      
      return {
        conversationsOverTime: [],
        responseTimeOverTime: [],
        resolutionRateOverTime: [],
        satisfactionOverTime: [],
        topIntents: [],
        channelDistribution: []
      };
    } catch (error) {
      console.error('Error getting agent stats:', error);
      return null;
    }
  }

  async trainAgent(agentId: string): Promise<void> {
    try {
      // Update agent status to training
      await updateDoc(doc(db, 'agents', agentId), {
        status: 'training',
        trainingStartedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // TODO: Implement actual training logic with Dialogflow/Claude
      
      // Simulate training completion after some time
      setTimeout(async () => {
        await updateDoc(doc(db, 'agents', agentId), {
          status: 'online',
          trainingCompletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }, 5000);
      
    } catch (error) {
      console.error('Error training agent:', error);
      throw new Error('Erro ao treinar agente');
    }
  }

  async testAgent(agentId: string, message: string): Promise<string> {
    try {
      // TODO: Implement actual testing with Dialogflow/Claude
      
      // Simulate response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return `Resposta simulada do agente para: "${message}"`;
    } catch (error) {
      console.error('Error testing agent:', error);
      throw new Error('Erro ao testar agente');
    }
  }

  async exportAgent(agentId: string): Promise<any> {
    try {
      const agent = await this.getAgent(agentId);
      
      if (!agent) {
        throw new Error('Agente não encontrado');
      }

      // Return agent configuration for export
      const exportData = {
        name: agent.name,
        description: agent.description,
        type: agent.type,
        configuration: agent.configuration,
        flows: agent.flows,
        integrations: agent.integrations,
        exportedAt: new Date().toISOString()
      };

      return exportData;
    } catch (error) {
      console.error('Error exporting agent:', error);
      throw new Error('Erro ao exportar agente');
    }
  }

  async importAgent(agentData: any): Promise<string> {
    try {
      const { exportedAt, ...importData } = agentData;
      
      return await this.createAgent({
        ...importData,
        name: `${importData.name} (Importado)`,
        channels: importData.channels || ['web'],
        integrations: importData.integrations || []
      });
    } catch (error) {
      console.error('Error importing agent:', error);
      throw new Error('Erro ao importar agente');
    }
  }
}

export const agentService = new AgentService();