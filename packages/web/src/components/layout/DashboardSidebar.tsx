import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  HomeIcon,
  ChartBarIcon,
  UsersIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  CogIcon,
  BuildingOfficeIcon,
  MegaphoneIcon,
  BoltIcon,
  PuzzlePieceIcon,
  DocumentTextIcon,
  ShoppingBagIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../providers/AuthProvider';

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  roles?: string[];
  badge?: string;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon },
  { name: 'CRM & Leads', href: '/dashboard/crm', icon: UsersIcon },
  { name: 'Empresas', href: '/dashboard/companies', icon: BuildingOfficeIcon },
  { name: 'Campanhas', href: '/dashboard/campaigns', icon: MegaphoneIcon },
  { name: 'WhatsApp', href: '/dashboard/whatsapp', icon: ChatBubbleLeftRightIcon, badge: '3' },
  { name: 'Email', href: '/dashboard/email', icon: EnvelopeIcon },
  { name: 'Automações', href: '/dashboard/automations', icon: BoltIcon },
  { name: 'Integrações', href: '/dashboard/integrations', icon: PuzzlePieceIcon },
  { name: 'Propostas', href: '/dashboard/proposals', icon: DocumentTextIcon },
  { name: 'Produtos', href: '/dashboard/products', icon: ShoppingBagIcon },
  { name: 'Dialogflow', href: '/dashboard/dialogflow', icon: ChatBubbleLeftRightIcon, roles: ['admin', 'manager'] },
  { name: 'Usuários', href: '/dashboard/users', icon: UsersIcon, roles: ['admin', 'manager'] },
  { name: 'Configurações', href: '/dashboard/settings', icon: CogIcon },
];

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { userData } = useAuth();

  const filteredNavigation = navigation.filter(item => {
    if (!item.roles) return true;
    return userData?.role && item.roles.includes(userData.role);
  });

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col flex-grow bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0 px-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">N</span>
                </div>
                <span className="ml-2 text-xl font-bold text-gray-900">NXT.AI</span>
              </div>
            </div>

            {/* Organization info */}
            {userData?.organizationId && (
              <div className="mt-5 px-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900">Organização</p>
                  <p className="text-xs text-gray-500 truncate">
                    {userData.organizationId}
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {filteredNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive: linkIsActive }) =>
                    `group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                      isActive(item.href) || linkIsActive
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon
                    className={`mr-3 flex-shrink-0 h-6 w-6 ${
                      isActive(item.href)
                        ? 'text-blue-500'
                        : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{item.name}</span>
                  {item.badge && (
                    <span className="ml-3 inline-block py-0.5 px-2 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* User info */}
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-700">
                      {userData?.displayName?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700">
                    {userData?.displayName || 'Usuário'}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {userData?.role || 'viewer'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className={`lg:hidden fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={onClose} />
        
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={onClose}
            >
              <span className="sr-only">Fechar sidebar</span>
              <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center px-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">N</span>
                </div>
                <span className="ml-2 text-xl font-bold text-gray-900">NXT.AI</span>
              </div>
            </div>

            {/* Organization info */}
            {userData?.organizationId && (
              <div className="mt-5 px-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900">Organização</p>
                  <p className="text-xs text-gray-500 truncate">
                    {userData.organizationId}
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <nav className="mt-5 px-2 space-y-1">
              {filteredNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={onClose}
                  className={({ isActive: linkIsActive }) =>
                    `group flex items-center px-2 py-2 text-base font-medium rounded-md transition-colors duration-150 ${
                      isActive(item.href) || linkIsActive
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon
                    className={`mr-4 flex-shrink-0 h-6 w-6 ${
                      isActive(item.href)
                        ? 'text-blue-500'
                        : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{item.name}</span>
                  {item.badge && (
                    <span className="ml-3 inline-block py-0.5 px-2 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* User info */}
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">
                    {userData?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-base font-medium text-gray-700">
                  {userData?.displayName || 'Usuário'}
                </p>
                <p className="text-sm text-gray-500 capitalize">
                  {userData?.role || 'viewer'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

