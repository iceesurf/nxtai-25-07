import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { auth } from '../config/firebase';

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/nxtai-production/us-central1/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle token expiration
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const token = await currentUser.getIdToken(true); // Force refresh
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        // Redirect to login or handle logout
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Generic API methods
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.get(url, config),

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.post(url, data, config),

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.put(url, data, config),

  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.patch(url, data, config),

  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
    apiClient.delete(url, config),
};

// Organization API
export const organizationApi = {
  getAll: () => api.get('/organizations'),
  getById: (id: string) => api.get(`/organizations/${id}`),
  create: (data: any) => api.post('/organizations', data),
  update: (id: string, data: any) => api.put(`/organizations/${id}`, data),
  delete: (id: string) => api.delete(`/organizations/${id}`),
  getUsers: (id: string) => api.get(`/organizations/${id}/users`),
  getSettings: (id: string) => api.get(`/organizations/${id}/settings`),
  updateSettings: (id: string, data: any) => api.put(`/organizations/${id}/settings`, data),
};

// Lead API
export const leadApi = {
  getAll: (params?: any) => api.get('/leads', { params }),
  getById: (id: string) => api.get(`/leads/${id}`),
  create: (data: any) => api.post('/leads', data),
  update: (id: string, data: any) => api.put(`/leads/${id}`, data),
  delete: (id: string) => api.delete(`/leads/${id}`),
  bulkUpdate: (data: any) => api.post('/leads/bulk-update', data),
  bulkDelete: (ids: string[]) => api.post('/leads/bulk-delete', { ids }),
  assign: (id: string, userId: string) => api.post(`/leads/${id}/assign`, { userId }),
  addInteraction: (id: string, data: any) => api.post(`/leads/${id}/interactions`, data),
  getInteractions: (id: string) => api.get(`/leads/${id}/interactions`),
  addNote: (id: string, data: any) => api.post(`/leads/${id}/notes`, data),
  getNotes: (id: string) => api.get(`/leads/${id}/notes`),
  uploadFile: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/leads/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getFiles: (id: string) => api.get(`/leads/${id}/files`),
  deleteFile: (id: string, fileId: string) => api.delete(`/leads/${id}/files/${fileId}`),
};

// Campaign API
export const campaignApi = {
  getAll: (params?: any) => api.get('/campaigns', { params }),
  getById: (id: string) => api.get(`/campaigns/${id}`),
  create: (data: any) => api.post('/campaigns', data),
  update: (id: string, data: any) => api.put(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
  start: (id: string) => api.post(`/campaigns/${id}/start`),
  pause: (id: string) => api.post(`/campaigns/${id}/pause`),
  resume: (id: string) => api.post(`/campaigns/${id}/resume`),
  stop: (id: string) => api.post(`/campaigns/${id}/stop`),
  getMetrics: (id: string) => api.get(`/campaigns/${id}/metrics`),
  getRecipients: (id: string) => api.get(`/campaigns/${id}/recipients`),
  addRecipients: (id: string, data: any) => api.post(`/campaigns/${id}/recipients`, data),
  removeRecipients: (id: string, data: any) => api.delete(`/campaigns/${id}/recipients`, { data }),
  duplicate: (id: string) => api.post(`/campaigns/${id}/duplicate`),
  preview: (id: string) => api.get(`/campaigns/${id}/preview`),
  test: (id: string, data: any) => api.post(`/campaigns/${id}/test`, data),
};

// WhatsApp API
export const whatsappApi = {
  getConversations: (params?: any) => api.get('/whatsapp/conversations', { params }),
  getConversation: (id: string) => api.get(`/whatsapp/conversations/${id}`),
  getMessages: (conversationId: string, params?: any) => 
    api.get(`/whatsapp/conversations/${conversationId}/messages`, { params }),
  sendMessage: (conversationId: string, data: any) => 
    api.post(`/whatsapp/conversations/${conversationId}/messages`, data),
  markAsRead: (conversationId: string) => 
    api.post(`/whatsapp/conversations/${conversationId}/mark-read`),
  assignAgent: (conversationId: string, agentId: string) => 
    api.post(`/whatsapp/conversations/${conversationId}/assign`, { agentId }),
  getTemplates: () => api.get('/whatsapp/templates'),
  createTemplate: (data: any) => api.post('/whatsapp/templates', data),
  updateTemplate: (id: string, data: any) => api.put(`/whatsapp/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/whatsapp/templates/${id}`),
  getQRCode: () => api.get('/whatsapp/qr-code'),
  getStatus: () => api.get('/whatsapp/status'),
  disconnect: () => api.post('/whatsapp/disconnect'),
  reconnect: () => api.post('/whatsapp/reconnect'),
};

// Email API
export const emailApi = {
  getTemplates: (params?: any) => api.get('/email/templates', { params }),
  getTemplate: (id: string) => api.get(`/email/templates/${id}`),
  createTemplate: (data: any) => api.post('/email/templates', data),
  updateTemplate: (id: string, data: any) => api.put(`/email/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/email/templates/${id}`),
  duplicateTemplate: (id: string) => api.post(`/email/templates/${id}/duplicate`),
  previewTemplate: (id: string, data?: any) => api.post(`/email/templates/${id}/preview`, data),
  testTemplate: (id: string, data: any) => api.post(`/email/templates/${id}/test`, data),
  sendEmail: (data: any) => api.post('/email/send', data),
  sendBulkEmail: (data: any) => api.post('/email/send-bulk', data),
  getDeliveryStatus: (messageId: string) => api.get(`/email/delivery-status/${messageId}`),
  getEmailMetrics: (params?: any) => api.get('/email/metrics', { params }),
};

// User API
export const userApi = {
  getAll: (params?: any) => api.get('/users', { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  updateProfile: (data: any) => api.put('/users/profile', data),
  changePassword: (data: any) => api.post('/users/change-password', data),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getPermissions: (id: string) => api.get(`/users/${id}/permissions`),
  updatePermissions: (id: string, data: any) => api.put(`/users/${id}/permissions`, data),
  getActivity: (id: string, params?: any) => api.get(`/users/${id}/activity`, { params }),
  inviteUser: (data: any) => api.post('/users/invite', data),
  resendInvite: (id: string) => api.post(`/users/${id}/resend-invite`),
  deactivate: (id: string) => api.post(`/users/${id}/deactivate`),
  activate: (id: string) => api.post(`/users/${id}/activate`),
};

// Analytics API
export const analyticsApi = {
  getDashboard: (params?: any) => api.get('/analytics/dashboard', { params }),
  getLeadMetrics: (params?: any) => api.get('/analytics/leads', { params }),
  getCampaignMetrics: (params?: any) => api.get('/analytics/campaigns', { params }),
  getWhatsAppMetrics: (params?: any) => api.get('/analytics/whatsapp', { params }),
  getEmailMetrics: (params?: any) => api.get('/analytics/email', { params }),
  getUserMetrics: (params?: any) => api.get('/analytics/users', { params }),
  getRevenueMetrics: (params?: any) => api.get('/analytics/revenue', { params }),
  getConversionFunnel: (params?: any) => api.get('/analytics/conversion-funnel', { params }),
  getCustomReport: (data: any) => api.post('/analytics/custom-report', data),
  exportReport: (data: any) => api.post('/analytics/export', data, {
    responseType: 'blob',
  }),
};

// Automation API
export const automationApi = {
  getAll: (params?: any) => api.get('/automations', { params }),
  getById: (id: string) => api.get(`/automations/${id}`),
  create: (data: any) => api.post('/automations', data),
  update: (id: string, data: any) => api.put(`/automations/${id}`, data),
  delete: (id: string) => api.delete(`/automations/${id}`),
  activate: (id: string) => api.post(`/automations/${id}/activate`),
  deactivate: (id: string) => api.post(`/automations/${id}/deactivate`),
  test: (id: string, data?: any) => api.post(`/automations/${id}/test`, data),
  getExecutions: (id: string, params?: any) => api.get(`/automations/${id}/executions`, { params }),
  getMetrics: (id: string) => api.get(`/automations/${id}/metrics`),
  duplicate: (id: string) => api.post(`/automations/${id}/duplicate`),
};

// Integration API
export const integrationApi = {
  getAll: () => api.get('/integrations'),
  getById: (id: string) => api.get(`/integrations/${id}`),
  create: (data: any) => api.post('/integrations', data),
  update: (id: string, data: any) => api.put(`/integrations/${id}`, data),
  delete: (id: string) => api.delete(`/integrations/${id}`),
  test: (id: string) => api.post(`/integrations/${id}/test`),
  sync: (id: string) => api.post(`/integrations/${id}/sync`),
  getStatus: (id: string) => api.get(`/integrations/${id}/status`),
  getLogs: (id: string, params?: any) => api.get(`/integrations/${id}/logs`, { params }),
  getAvailable: () => api.get('/integrations/available'),
  connect: (type: string, data: any) => api.post(`/integrations/connect/${type}`, data),
  disconnect: (id: string) => api.post(`/integrations/${id}/disconnect`),
};

// File upload utility
export const uploadFile = async (file: File, path: string = 'uploads'): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', path);

  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data.url;
};

// Error handling utility
export const handleApiError = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.response?.status === 401) {
    return 'Sessão expirada. Faça login novamente.';
  }
  
  if (error.response?.status === 403) {
    return 'Você não tem permissão para realizar esta ação.';
  }
  
  if (error.response?.status === 404) {
    return 'Recurso não encontrado.';
  }
  
  if (error.response?.status >= 500) {
    return 'Erro interno do servidor. Tente novamente mais tarde.';
  }
  
  if (error.code === 'NETWORK_ERROR') {
    return 'Erro de conexão. Verifique sua internet.';
  }
  
  return 'Ocorreu um erro inesperado. Tente novamente.';
};

export default api;

