import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface DashboardStats {
  totalAgents: number;
  activeAgents: number;
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  totalLeads: number;
  newLeads: number;
  avgResponseTime: number;
  satisfactionRate: number;
  resolutionRate: number;
}

export const useDashboardData = (timeRange: string = '7d') => {
  return useQuery({
    queryKey: ['dashboard', timeRange],
    queryFn: async (): Promise<DashboardStats> => {
      try {
        // Calculate date range
        const now = new Date();
        const startDate = new Date();
        
        switch (timeRange) {
          case '24h':
            startDate.setHours(startDate.getHours() - 24);
            break;
          case '7d':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(startDate.getDate() - 30);
            break;
          default:
            startDate.setDate(startDate.getDate() - 7);
        }

        // Fetch agents data
        const agentsRef = collection(db, 'dialogflow', 'agents');
        const agentsSnapshot = await getDocs(agentsRef);
        const totalAgents = agentsSnapshot.size;
        const activeAgents = agentsSnapshot.docs.filter(doc => 
          doc.data().status === 'active'
        ).length;

        // Fetch conversations data
        const conversationsRef = collection(db, 'conversations');
        const conversationsSnapshot = await getDocs(conversationsRef);
        const totalConversations = conversationsSnapshot.size;
        const activeConversations = conversationsSnapshot.docs.filter(doc => 
          doc.data().status === 'active'
        ).length;

        // Fetch recent conversations for time range
        const recentConversationsQuery = query(
          conversationsRef,
          where('createdAt', '>=', startDate.toISOString()),
          orderBy('createdAt', 'desc')
        );
        const recentConversationsSnapshot = await getDocs(recentConversationsQuery);

        // Calculate total messages from recent conversations
        let totalMessages = 0;
        recentConversationsSnapshot.docs.forEach(doc => {
          const conversation = doc.data();
          if (conversation.messages) {
            totalMessages += conversation.messages.length;
          }
        });

        // Fetch leads data
        const leadsRef = collection(db, 'leads');
        const leadsSnapshot = await getDocs(leadsRef);
        const totalLeads = leadsSnapshot.size;

        // Fetch new leads in time range
        const newLeadsQuery = query(
          leadsRef,
          where('createdAt', '>=', startDate.toISOString()),
          orderBy('createdAt', 'desc')
        );
        const newLeadsSnapshot = await getDocs(newLeadsQuery);
        const newLeads = newLeadsSnapshot.size;

        // Mock calculated values (replace with real analytics later)
        const avgResponseTime = 2.3;
        const satisfactionRate = 94.2;
        const resolutionRate = 87.5;

        return {
          totalAgents,
          activeAgents,
          totalConversations,
          activeConversations,
          totalMessages,
          totalLeads,
          newLeads,
          avgResponseTime,
          satisfactionRate,
          resolutionRate
        };

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        
        // Return mock data on error
        return {
          totalAgents: 0,
          activeAgents: 0,
          totalConversations: 0,
          activeConversations: 0,
          totalMessages: 0,
          totalLeads: 0,
          newLeads: 0,
          avgResponseTime: 0,
          satisfactionRate: 0,
          resolutionRate: 0
        };
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
};

export const useRecentActivity = () => {
  return useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      try {
        // Fetch recent conversations
        const conversationsRef = collection(db, 'conversations');
        const recentConversationsQuery = query(
          conversationsRef,
          orderBy('updatedAt', 'desc'),
          limit(5)
        );
        const conversationsSnapshot = await getDocs(recentConversationsQuery);

        // Fetch recent leads
        const leadsRef = collection(db, 'leads');
        const recentLeadsQuery = query(
          leadsRef,
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const leadsSnapshot = await getDocs(recentLeadsQuery);

        const activities = [];

        // Add conversation activities
        conversationsSnapshot.docs.forEach(doc => {
          const conversation = doc.data();
          activities.push({
            id: `conv-${doc.id}`,
            type: 'conversation_started',
            title: 'Nova conversa iniciada',
            description: `Conversa no canal ${conversation.channel}`,
            time: getRelativeTime(conversation.createdAt),
            timestamp: conversation.createdAt
          });
        });

        // Add lead activities
        leadsSnapshot.docs.forEach(doc => {
          const lead = doc.data();
          activities.push({
            id: `lead-${doc.id}`,
            type: 'lead_created',
            title: 'Novo lead capturado',
            description: `${lead.name} via ${lead.source}`,
            time: getRelativeTime(lead.createdAt),
            timestamp: lead.createdAt
          });
        });

        // Sort by timestamp and return latest 10
        return activities
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10);

      } catch (error) {
        console.error('Error fetching recent activity:', error);
        return [];
      }
    },
    refetchInterval: 60000, // Refetch every minute
  });
};

// Helper function to get relative time
function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Agora mesmo';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} min atrás`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h atrás`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} dias atrás`;
  }
}