import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './providers/AuthProvider';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicRoute } from './components/auth/PublicRoute';

// Páginas públicas
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';

// Páginas protegidas
import Dashboard from './pages/Dashboard';
import DashboardHome from './pages/DashboardHome';
import Analytics from './pages/Analytics';
import CRM from './pages/CRM';
import Campaigns from './pages/Campaigns';
import Chat from './pages/Chat';
import Settings from './pages/Settings';

// Módulos
import Agents from './pages/modules/Agents';
import Messages from './pages/modules/Messages';
import Users from './pages/modules/Users';
import Dialogflow from './pages/modules/Dialogflow';

import './styles/globals.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Rotas públicas */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              }
            />

            {/* Rotas protegidas */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            >
              {/* Rotas aninhadas do dashboard */}
              <Route index element={<DashboardHome />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="crm" element={<CRM />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="chat" element={<Chat />} />
              <Route path="whatsapp" element={<Messages />} />
              <Route path="agents" element={<Agents />} />
              <Route path="users" element={<Users />} />
              <Route path="dialogflow" element={<Dialogflow />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Redirecionamentos */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

