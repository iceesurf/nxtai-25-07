import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  UserIcon,
  BellIcon,
  ShieldCheckIcon,
  CogIcon,
  CreditCardIcon,
  BuildingOfficeIcon,
  KeyIcon,
  GlobeAltIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store/authStore';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const profileSchema = z.object({
  displayName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  timezone: z.string(),
  language: z.string()
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(8, 'Nova senha deve ter no mínimo 8 caracteres'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword']
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

const Settings: React.FC = () => {
  const { user } = useAuthStore();
  const { updateProfile, deleteAccount } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.displayName || '',
      email: user?.email || '',
      phone: '',
      timezone: 'America/Sao_Paulo',
      language: 'pt-BR'
    }
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema)
  });

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: UserIcon },
    { id: 'notifications', label: 'Notificações', icon: BellIcon },
    { id: 'security', label: 'Segurança', icon: ShieldCheckIcon },
    { id: 'integrations', label: 'Integrações', icon: CogIcon },
    { id: 'billing', label: 'Cobrança', icon: CreditCardIcon },
    { id: 'organization', label: 'Organização', icon: BuildingOfficeIcon }
  ];

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      await updateProfile(data);
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
    } finally {
      setIsLoading(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setIsLoading(true);
    try {
      // Implement password change logic
      toast.success('Senha alterada com sucesso!');
      passwordForm.reset();
    } catch (error) {
      toast.error('Erro ao alterar senha');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      toast.success('Conta excluída com sucesso');
    } catch (error) {
      toast.error('Erro ao excluir conta');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Configurações</h2>
        <p className="text-gray-400 mt-1">
          Gerencie suas preferências e configurações da conta
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <tab.icon className="h-5 w-5 mr-3" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-gray-800 rounded-lg p-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Informações do Perfil</h3>
                  
                  {/* Avatar Section */}
                  <div className="flex items-center space-x-6 mb-6">
                    <img
                      src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}`}
                      alt="Avatar"
                      className="h-20 w-20 rounded-full"
                    />
                    <div>
                      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition">
                        Alterar Foto
                      </button>
                      <button className="ml-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">
                        Remover
                      </button>
                    </div>
                  </div>

                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                    {/* Display Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Nome completo
                      </label>
                      <input
                        {...profileForm.register('displayName')}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      />
                      {profileForm.formState.errors.displayName && (
                        <p className="mt-1 text-sm text-red-500">
                          {profileForm.formState.errors.displayName.message}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Email
                      </label>
                      <input
                        {...profileForm.register('email')}
                        type="email"
                        disabled
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Entre em contato com o suporte para alterar o email
                      </p>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Telefone
                      </label>
                      <input
                        {...profileForm.register('phone')}
                        type="tel"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="+55 (11) 99999-9999"
                      />
                    </div>

                    {/* Timezone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Fuso horário
                      </label>
                      <select
                        {...profileForm.register('timezone')}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                        <option value="America/New_York">Nova York (GMT-4)</option>
                        <option value="Europe/London">Londres (GMT+0)</option>
                      </select>
                    </div>

                    {/* Language */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Idioma
                      </label>
                      <select
                        {...profileForm.register('language')}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="pt-BR">Português (Brasil)</option>
                        <option value="en-US">English (US)</option>
                        <option value="es-ES">Español</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
                    >
                      {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Segurança</h3>
                  
                  {/* Change Password */}
                  <div className="bg-gray-750 p-4 rounded-lg mb-6">
                    <h4 className="font-medium text-white mb-4">Alterar Senha</h4>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Senha atual
                        </label>
                        <input
                          {...passwordForm.register('currentPassword')}
                          type="password"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Nova senha
                        </label>
                        <input
                          {...passwordForm.register('newPassword')}
                          type="password"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Confirmar nova senha
                        </label>
                        <input
                          {...passwordForm.register('confirmPassword')}
                          type="password"
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
                      >
                        Alterar Senha
                      </button>
                    </form>
                  </div>

                  {/* Two Factor Authentication */}
                  <div className="bg-gray-750 p-4 rounded-lg mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">Autenticação de Dois Fatores</h4>
                        <p className="text-sm text-gray-400">Adicione uma camada extra de segurança</p>
                      </div>
                      <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition">
                        Ativar 2FA
                      </button>
                    </div>
                  </div>

                  {/* API Keys */}
                  <div className="bg-gray-750 p-4 rounded-lg">
                    <h4 className="font-medium text-white mb-4">Chaves de API</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                        <div>
                          <p className="text-white font-medium">Chave Principal</p>
                          <p className="text-sm text-gray-400">sk-...****2Lw3</p>
                        </div>
                        <div className="flex space-x-2">
                          <button className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm transition">
                            Copiar
                          </button>
                          <button className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition">
                            Revogar
                          </button>
                        </div>
                      </div>
                    </div>
                    <button className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition">
                      Gerar Nova Chave
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Preferências de Notificação</h3>
                  
                  <div className="space-y-4">
                    {[
                      { id: 'email', label: 'Notificações por Email', description: 'Receber atualizações importantes por email' },
                      { id: 'push', label: 'Notificações Push', description: 'Notificações no navegador' },
                      { id: 'sms', label: 'SMS', description: 'Alertas críticos por SMS' },
                      { id: 'newConversation', label: 'Novas Conversas', description: 'Notificar sobre novas conversas' },
                      { id: 'agentErrors', label: 'Erros de Agente', description: 'Alertas quando agentes apresentam problemas' },
                      { id: 'weeklyReport', label: 'Relatório Semanal', description: 'Resumo semanal de performance' }
                    ].map((setting) => (
                      <div key={setting.id} className="flex items-center justify-between p-4 bg-gray-750 rounded-lg">
                        <div>
                          <h4 className="font-medium text-white">{setting.label}</h4>
                          <p className="text-sm text-gray-400">{setting.description}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Danger Zone */}
            {activeTab === 'security' && (
              <div className="mt-8 pt-6 border-t border-gray-700">
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                  <div className="flex items-start">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mr-3 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-red-400">Zona de Perigo</h4>
                      <p className="text-sm text-red-300 mt-2">
                        Excluir sua conta é uma ação irreversível. Todos os seus dados serão perdidos permanentemente.
                      </p>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
                      >
                        Excluir Conta
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mr-3" />
              <h3 className="text-lg font-semibold text-white">Confirmar Exclusão</h3>
            </div>
            <p className="text-gray-400 mb-6">
              Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={handleDeleteAccount}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
              >
                Sim, Excluir
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;