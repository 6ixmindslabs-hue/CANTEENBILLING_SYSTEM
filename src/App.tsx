import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import BillingScreen from './pages/BillingScreen.tsx';
import ItemsManagement from './pages/ItemsManagement.tsx';
import CategoriesManagement from './pages/CategoriesManagement.tsx';
import SalesDashboard from './pages/SalesDashboard.tsx';
import Settings from './pages/Settings.tsx';
import Layout from './components/Layout.tsx';
import './i18n/config';

// Dummy Auth for Admin users
const RequireAdmin = ({ children, isAdmin }: { children: React.ReactElement, isAdmin: boolean }) => {
  return isAdmin ? children : <Navigate to="/" />;
};

function App() {
  const [isAdmin, setIsAdmin] = useState(false);

  return (
    <Router>
      <Layout isAdmin={isAdmin} setIsAdmin={setIsAdmin}>
        <Routes>
          <Route path="/" element={<BillingScreen />} />
          <Route path="/items" element={
            <RequireAdmin isAdmin={isAdmin}>
              <ItemsManagement />
            </RequireAdmin>
          } />
          <Route path="/categories" element={
            <RequireAdmin isAdmin={isAdmin}>
              <CategoriesManagement />
            </RequireAdmin>
          } />
          <Route path="/dashboard" element={
            <RequireAdmin isAdmin={isAdmin}>
              <SalesDashboard />
            </RequireAdmin>
          } />
          <Route path="/settings" element={
            <RequireAdmin isAdmin={isAdmin}>
              <Settings />
            </RequireAdmin>
          } />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
