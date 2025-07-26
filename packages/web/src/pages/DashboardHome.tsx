import React, { useState, useEffect } from 'react';
import {
  UsersIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  EyeIcon,
  PhoneIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../providers/AuthProvider';

interface MetricCard {
  title: string;
  value: string;
  change: string;
  changeType: 'increase' | 'decrease';
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
}

interface RecentLead {
  id: string;
  name: string;
  email: string;
  source: string;
  status: string;
  createdAt: string;
  score: number;
}

interface RecentActivity {
  id: string;
  type: 'lead_created' | 'email_sent' | 'whatsapp_message' | 'call_made';
  description: string;
  time: string;
  user: string;
}

const DashboardHome: React.FC = () => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  useEffect(() => {
    // Simular carregamento de dados
    setTimeout(() => {
      setMetrics([
        {
          title: 'Total de Leads',
          value: '1,247',
          change: '+12%',
          changeType: 'increase',
          icon: UsersIcon,
          color: 'bg-blue-500'
        },
        {
          title: 'Leads Convertidos',
          value: '89',
          change: '+8%',
          changeType: 'increase',
          icon: TrendingUpIcon,
          color: 'bg-green-500'
        },
        {
          title: 'Emails Enviados',
          value: '2,341',
          change: '+23%',
          changeType: 'increase',
          icon: EnvelopeIcon,
          color: 'bg-purple-500'
        },
        {
          title: 'Mensagens WhatsApp',
          value: '567',
          change: '-5%',
          changeType: 'decrease',
          icon: ChatBubbleLeftRightIcon,
          color: 'bg-green-600'
        }
      ]);

      setRecentLeads([
        {
          id: '1',
          name: 'João Silva',
          email: 'joao@empresa.com',
          source: 'website',
          status: 'new',
          createdAt: '2024-01-25T10:30:00Z',
          score: 85
        },
        {
          id: '2',
          name: 'Maria Santos',
          email: 'maria@startup.com',
          source: 'whatsapp',
          status: 'contacted',
          createdAt: '2024-01-25T09:15:00Z',
          score: 72
        },
        {
          id: '3',
          name: 'Pedro Costa',
          email: 'pedro@tech.com',
          source: 'facebook',
          status: 'qualified',
          createdAt: '2024-01-25T08:45:00Z',
          score: 91
        },
        {
          id: '4',
          name: 'Ana Oliveira',
          email: 'ana@digital.com',
          source: 'google',
          status: 'proposal',
          createdAt: '2024-01-24T16:20:00Z',
          score: 78
        },
        {
          id: '5',
          name: 'Carlos Ferreira',
          email: 'carlos@inovacao.com',
          source: 'linkedin',
          status: 'negotiation',
          createdAt: '2024-01-24T14:10:00Z',
          score: 88
        }
      ]);

      setRecentActivities([
        {
          id: '1',
          type: 'lead_created',
          description: 'Novo lead criado: João Silva',
          time: '10:30',
          user: 'Sistema'
        },
        {
          id: '2',
          type: 'email_sent',
          description: 'Email enviado para Maria Santos',
          time: '10:15',
          user: 'Ana Costa'
        },
        {
          id: '3',
          type: 'whatsapp_message',
          description: 'Mensagem WhatsApp recebida de Pedro Costa',
          time: '09:45',
          user: 'Sistema'
        },
        {
          id: '4',
          type: 'call_made',
          description: 'Ligação realizada para Ana Oliveira',
          time: '09:30',
          user: 'João Mendes'
        }
      ]);

      setLoading(false);
    }, 1000);
  }, []);

  const getStatusColor = (status: string) => {
    const colors = {
      new: 'bg-blue-100 text-blue-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      qualified: 'bg-green-100 text-green-800',
      proposal: 'bg-purple-100 text-purple-800',
      negotiation: 'bg-orange-100 text-orange-800',
      won: 'bg-green-100 text-green-800',
      lost: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSourceIcon = (source: string) => {
    const icons = {
      website: '🌐',
      whatsapp: '💬',
      facebook: '📘',
      instagram: '📷',
      google: '🔍',
      linkedin: '💼',
      email: '📧',
      phone: '📞'
    };
    return icons[source] || '📄';
  };

  const getActivityIcon = (type: string) => {
    const icons = {
      lead_created: UsersIcon,
      email_sent: EnvelopeIcon,
      whatsapp_message: ChatBubbleLeftRightIcon,
      call_made: PhoneIcon
    };
    return icons[type] || CalendarIcon;
  };

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Bem-vindo de volta, {userData?.displayName || 'Usuário'}!
        </h1>
        <p className="text-blue-100">
          Aqui está um resumo das suas atividades de hoje.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`${metric.color} rounded-lg p-3`}>
                <metric.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {metric.changeType === 'increase' ? (
                <TrendingUpIcon className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDownIcon className="h-4 w-4 text-red-500" />
              )}
              <span className={`ml-1 text-sm font-medium ${
                metric.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
              }`}>
                {metric.change}
              </span>
              <span className="ml-1 text-sm text-gray-500">vs. mês anterior</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Leads Recentes</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {lead.name.charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                      <p className="text-sm text-gray-500">{lead.email}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs">{getSourceIcon(lead.source)}</span>
                        <span className="text-xs text-gray-500 capitalize">{lead.source}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{formatDate(lead.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Score: {lead.score}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <button className="w-full text-center text-sm text-blue-600 hover:text-blue-500 font-medium">
                Ver todos os leads
              </button>
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Atividades Recentes</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const IconComponent = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <IconComponent className="h-4 w-4 text-gray-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-gray-500">{activity.user}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{activity.time}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <button className="w-full text-center text-sm text-blue-600 hover:text-blue-500 font-medium">
                Ver todas as atividades
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
            <UsersIcon className="h-5 w-5 mr-2 text-gray-400" />
            Adicionar Lead
          </button>
          <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
            <EnvelopeIcon className="h-5 w-5 mr-2 text-gray-400" />
            Criar Campanha
          </button>
          <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
            <EyeIcon className="h-5 w-5 mr-2 text-gray-400" />
            Ver Relatórios
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;

