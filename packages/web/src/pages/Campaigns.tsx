import React, { useState, useEffect } from 'react';
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  DevicePhoneMobileIcon
} from '@heroicons/react/24/outline';

interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'whatsapp' | 'sms' | 'mixed';
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  description: string;
  targetAudience: string;
  startDate: string;
  endDate: string;
  createdBy: string;
  createdAt: string;
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    revenue: number;
  };
  budget: number;
  tags: string[];
}

const Campaigns: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    createdBy: '',
    dateRange: ''
  });

  // Mock data
  useEffect(() => {
    setTimeout(() => {
      const mockCampaigns: Campaign[] = [
        {
          id: '1',
          name: 'Black Friday 2024',
          type: 'mixed',
          status: 'running',
          description: 'Campanha promocional para Black Friday com descontos especiais',
          targetAudience: 'Leads qualificados',
          startDate: '2024-01-20T00:00:00Z',
          endDate: '2024-01-30T23:59:59Z',
          createdBy: 'Ana Costa',
          createdAt: '2024-01-15T10:30:00Z',
          metrics: {
            sent: 5420,
            delivered: 5180,
            opened: 2590,
            clicked: 518,
            converted: 156,
            revenue: 78000
          },
          budget: 15000,
          tags: ['promocional', 'black-friday', 'desconto']
        },
        {
          id: '2',
          name: 'Nutrição de Leads - Q1',
          type: 'email',
          status: 'scheduled',
          description: 'Sequência de emails educativos para nutrição de leads',
          targetAudience: 'Novos leads',
          startDate: '2024-02-01T09:00:00Z',
          endDate: '2024-04-30T18:00:00Z',
          createdBy: 'João Mendes',
          createdAt: '2024-01-22T14:20:00Z',
          metrics: {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            converted: 0,
            revenue: 0
          },
          budget: 8000,
          tags: ['nutrição', 'educativo', 'leads']
        },
        {
          id: '3',
          name: 'WhatsApp Reativação',
          type: 'whatsapp',
          status: 'completed',
          description: 'Campanha de reativação via WhatsApp para leads inativos',
          targetAudience: 'Leads inativos',
          startDate: '2024-01-01T08:00:00Z',
          endDate: '2024-01-15T20:00:00Z',
          createdBy: 'Carlos Silva',
          createdAt: '2023-12-28T16:45:00Z',
          metrics: {
            sent: 2340,
            delivered: 2280,
            opened: 1824,
            clicked: 456,
            converted: 89,
            revenue: 35600
          },
          budget: 5000,
          tags: ['reativação', 'whatsapp', 'inativos']
        },
        {
          id: '4',
          name: 'SMS Urgência',
          type: 'sms',
          status: 'paused',
          description: 'Campanha SMS para ofertas com urgência',
          targetAudience: 'Leads quentes',
          startDate: '2024-01-25T12:00:00Z',
          endDate: '2024-01-27T23:59:59Z',
          createdBy: 'Ana Costa',
          createdAt: '2024-01-24T11:15:00Z',
          metrics: {
            sent: 890,
            delivered: 867,
            opened: 693,
            clicked: 173,
            converted: 34,
            revenue: 12800
          },
          budget: 3000,
          tags: ['urgência', 'sms', 'oferta']
        },
        {
          id: '5',
          name: 'Webinar Tech Trends',
          type: 'email',
          status: 'draft',
          description: 'Convite para webinar sobre tendências tecnológicas',
          targetAudience: 'Leads tech',
          startDate: '2024-02-15T19:00:00Z',
          endDate: '2024-02-15T21:00:00Z',
          createdBy: 'João Mendes',
          createdAt: '2024-01-25T09:30:00Z',
          metrics: {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            converted: 0,
            revenue: 0
          },
          budget: 2000,
          tags: ['webinar', 'tech', 'educativo']
        }
      ];
      
      setCampaigns(mockCampaigns);
      setFilteredCampaigns(mockCampaigns);
      setLoading(false);
    }, 1000);
  }, []);

  // Filter and search logic
  useEffect(() => {
    let filtered = campaigns;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(campaign =>
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.targetAudience.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Type filter
    if (filters.type) {
      filtered = filtered.filter(campaign => campaign.type === filters.type);
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(campaign => campaign.status === filters.status);
    }

    // Created by filter
    if (filters.createdBy) {
      filtered = filtered.filter(campaign => campaign.createdBy === filters.createdBy);
    }

    setFilteredCampaigns(filtered);
  }, [campaigns, searchQuery, filters]);

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      running: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      email: EnvelopeIcon,
      whatsapp: ChatBubbleLeftRightIcon,
      sms: DevicePhoneMobileIcon,
      mixed: ChartBarIcon
    };
    return icons[type] || ChartBarIcon;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      email: 'bg-blue-500',
      whatsapp: 'bg-green-500',
      sms: 'bg-purple-500',
      mixed: 'bg-orange-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  const handleCampaignAction = (campaignId: string, action: string) => {
    console.log(`Action: ${action} for campaign: ${campaignId}`);
    // Implementar ações da campanha
  };

  const handleSelectCampaign = (campaignId: string) => {
    setSelectedCampaigns(prev =>
      prev.includes(campaignId)
        ? prev.filter(id => id !== campaignId)
        : [...prev, campaignId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCampaigns.length === filteredCampaigns.length) {
      setSelectedCampaigns([]);
    } else {
      setSelectedCampaigns(filteredCampaigns.map(campaign => campaign.id));
    }
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie suas campanhas de marketing multicanal
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={() => setShowNewCampaignModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Nova Campanha
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-semibold">
                  {filteredCampaigns.length}
                </span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total de Campanhas</p>
              <p className="text-xs text-gray-500">
                {campaigns.filter(c => c.status === 'running').length} ativas
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 font-semibold">
                  {campaigns.reduce((sum, c) => sum + c.metrics.sent, 0).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Mensagens Enviadas</p>
              <p className="text-xs text-gray-500">
                {formatPercentage(
                  campaigns.reduce((sum, c) => sum + c.metrics.delivered, 0),
                  campaigns.reduce((sum, c) => sum + c.metrics.sent, 0)
                )} entregues
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 font-semibold">
                  {formatPercentage(
                    campaigns.reduce((sum, c) => sum + c.metrics.opened, 0),
                    campaigns.reduce((sum, c) => sum + c.metrics.delivered, 0)
                  )}
                </span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Taxa de Abertura</p>
              <p className="text-xs text-gray-500">
                {campaigns.reduce((sum, c) => sum + c.metrics.opened, 0).toLocaleString()} aberturas
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-yellow-600 font-semibold">
                  {formatCurrency(campaigns.reduce((sum, c) => sum + c.metrics.revenue, 0))}
                </span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Receita Gerada</p>
              <p className="text-xs text-gray-500">
                {campaigns.reduce((sum, c) => sum + c.metrics.converted, 0)} conversões
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            {/* Search */}
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Buscar campanhas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <FunnelIcon className="h-4 w-4 mr-2" />
                Filtros
              </button>

              <div className="flex rounded-md shadow-sm">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 text-sm font-medium rounded-l-md border ${
                    viewMode === 'grid'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Grade
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                    viewMode === 'list'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Lista
                </button>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Todos</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="mixed">Misto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Todos</option>
                    <option value="draft">Rascunho</option>
                    <option value="scheduled">Agendada</option>
                    <option value="running">Executando</option>
                    <option value="paused">Pausada</option>
                    <option value="completed">Concluída</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Criado por
                  </label>
                  <select
                    value={filters.createdBy}
                    onChange={(e) => setFilters(prev => ({ ...prev, createdBy: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Todos</option>
                    <option value="Ana Costa">Ana Costa</option>
                    <option value="João Mendes">João Mendes</option>
                    <option value="Carlos Silva">Carlos Silva</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Período
                  </label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Todos</option>
                    <option value="today">Hoje</option>
                    <option value="week">Esta semana</option>
                    <option value="month">Este mês</option>
                    <option value="quarter">Este trimestre</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedCampaigns.length > 0 && (
          <div className="px-6 py-3 bg-blue-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">
                {selectedCampaigns.length} campanha(s) selecionada(s)
              </span>
              <div className="flex space-x-2">
                <button className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200">
                  <PlayIcon className="h-3 w-3 mr-1" />
                  Iniciar
                </button>
                <button className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200">
                  <PauseIcon className="h-3 w-3 mr-1" />
                  Pausar
                </button>
                <button className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200">
                  <TrashIcon className="h-3 w-3 mr-1" />
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCampaigns.map((campaign) => {
                const TypeIcon = getTypeIcon(campaign.type);
                return (
                  <div key={campaign.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`${getTypeColor(campaign.type)} rounded-lg p-2`}>
                            <TypeIcon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">{campaign.name}</h3>
                            <p className="text-sm text-gray-500">{campaign.targetAudience}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={selectedCampaigns.includes(campaign.id)}
                            onChange={() => handleSelectCampaign(campaign.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <button className="text-gray-400 hover:text-gray-600">
                            <EllipsisVerticalIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      {/* Status and Type */}
                      <div className="flex items-center justify-between mb-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">{campaign.type}</span>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{campaign.description}</p>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500">Enviadas</p>
                          <p className="text-sm font-medium text-gray-900">{campaign.metrics.sent.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Taxa Abertura</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatPercentage(campaign.metrics.opened, campaign.metrics.delivered)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Conversões</p>
                          <p className="text-sm font-medium text-gray-900">{campaign.metrics.converted}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Receita</p>
                          <p className="text-sm font-medium text-gray-900">{formatCurrency(campaign.metrics.revenue)}</p>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {campaign.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {tag}
                          </span>
                        ))}
                        {campaign.tags.length > 3 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            +{campaign.tags.length - 3}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <div className="flex space-x-2">
                          {campaign.status === 'draft' && (
                            <button
                              onClick={() => handleCampaignAction(campaign.id, 'start')}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200"
                            >
                              <PlayIcon className="h-3 w-3 mr-1" />
                              Iniciar
                            </button>
                          )}
                          {campaign.status === 'running' && (
                            <button
                              onClick={() => handleCampaignAction(campaign.id, 'pause')}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-yellow-700 bg-yellow-100 hover:bg-yellow-200"
                            >
                              <PauseIcon className="h-3 w-3 mr-1" />
                              Pausar
                            </button>
                          )}
                          {campaign.status === 'paused' && (
                            <button
                              onClick={() => handleCampaignAction(campaign.id, 'resume')}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200"
                            >
                              <PlayIcon className="h-3 w-3 mr-1" />
                              Retomar
                            </button>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          <button className="text-blue-600 hover:text-blue-900">
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button className="text-blue-600 hover:text-blue-900">
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button className="text-blue-600 hover:text-blue-900">
                            <ChartBarIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                        <div className="flex justify-between">
                          <span>Por {campaign.createdBy}</span>
                          <span>{formatDate(campaign.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCampaigns.length === filteredCampaigns.length && filteredCampaigns.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Campanha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Métricas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receita
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Criado
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCampaigns.map((campaign) => {
                  const TypeIcon = getTypeIcon(campaign.type);
                  return (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedCampaigns.includes(campaign.id)}
                          onChange={() => handleSelectCampaign(campaign.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`${getTypeColor(campaign.type)} rounded-lg p-2 mr-3`}>
                            <TypeIcon className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                            <div className="text-sm text-gray-500">{campaign.targetAudience}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 capitalize">{campaign.type}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {campaign.metrics.sent.toLocaleString()} enviadas
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatPercentage(campaign.metrics.opened, campaign.metrics.delivered)} abertura
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatCurrency(campaign.metrics.revenue)}</div>
                        <div className="text-sm text-gray-500">{campaign.metrics.converted} conversões</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(campaign.createdAt)}</div>
                        <div className="text-sm text-gray-500">{campaign.createdBy}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          {campaign.status === 'draft' && (
                            <button
                              onClick={() => handleCampaignAction(campaign.id, 'start')}
                              className="text-green-600 hover:text-green-900"
                            >
                              <PlayIcon className="h-4 w-4" />
                            </button>
                          )}
                          {campaign.status === 'running' && (
                            <button
                              onClick={() => handleCampaignAction(campaign.id, 'pause')}
                              className="text-yellow-600 hover:text-yellow-900"
                            >
                              <PauseIcon className="h-4 w-4" />
                            </button>
                          )}
                          <button className="text-blue-600 hover:text-blue-900">
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button className="text-blue-600 hover:text-blue-900">
                            <ChartBarIcon className="h-4 w-4" />
                          </button>
                          <button className="text-gray-400 hover:text-gray-600">
                            <EllipsisVerticalIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {filteredCampaigns.length === 0 && (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <ChartBarIcon className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Nenhuma campanha encontrada</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchQuery || Object.values(filters).some(f => f)
                ? 'Tente ajustar os filtros ou termo de busca'
                : 'Comece criando sua primeira campanha'
              }
            </p>
            {!searchQuery && !Object.values(filters).some(f => f) && (
              <button
                onClick={() => setShowNewCampaignModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Criar Campanha
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Campaigns;

