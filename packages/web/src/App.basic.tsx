import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';

// Pages
import Home from './pages/Home';
import LoginBasic from './pages/Login.basic';
import Dashboard from './pages/Dashboard';
import DashboardHome from './pages/DashboardHome';

// Modules
import Users from './pages/modules/Users';
import Analytics from './pages/modules/Analytics';
import Dialogflow from './pages/modules/Dialogflow';
import Messages from './pages/modules/Messages';
import Agents from './pages/modules/Agents';
import Settings from './pages/modules/Settings';

// Components
import LoadingSpinner from './components/shared/LoadingSpinner';

// Styles
import './styles/globals.css';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Carregando..." />
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/" 
            element={user ? <Navigate to="/dashboard" replace /> : <Home />} 
          />
          <Route 
            path="/login" 
            element={user ? <Navigate to="/dashboard" replace /> : <LoginBasic />} 
          />

          {/* Protected Dashboard Routes */}
          <Route 
            path="/dashboard" 
            element={user ? <Dashboard /> : <Navigate to="/login" replace />}
          >
            <Route index element={<DashboardHome />} />
            <Route path="agents" element={<Agents />} />
            <Route path="messages" element={<Messages />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="dialogflow" element={<Dialogflow />} />
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;