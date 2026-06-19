// ga-frontend/src/App.tsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import WorkOrders from './pages/WorkOrders';
import Users from './pages/Users';
import MapPage from './pages/MapPage';
import Teams from './pages/Teams';
import Surveys from './pages/Surveys';
import Timesheet from './pages/Timesheet';
import Planning from './pages/Planning';
import Reports from './pages/Reports';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Giriş Ekranı (Layout'tan bağımsız, tam ekran) */}
        <Route path="/login" element={<Login />} />
        
        {/* Güvenli Alan (MainLayout içine gömülü sayfalar) */}
        <Route 
          path="/" 
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          {/* Outlet içine dolacak olan alt sayfalar */}
          // App.tsx içinde ilgili kısım
          <Route index element={<Dashboard />} />          
          <Route path="work-orders" element={<WorkOrders />} />
          <Route path="map" element={<MapPage />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<div>Sistem Ayarları</div>} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/surveys" element={<Surveys />} />
          <Route path="/timesheet" element={<Timesheet />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;