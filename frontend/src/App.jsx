import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell.jsx';
import { RequireAuth, RequirePermission } from './components/RouteGuards.jsx';
import { LoadingBlock } from './components/ui/index.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NotFound from './pages/NotFound.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

import PatientsList from './pages/patients/PatientsList.jsx';
import PatientDetail from './pages/patients/PatientDetail.jsx';
import DoctorsList from './pages/doctors/DoctorsList.jsx';
import DoctorDetail from './pages/doctors/DoctorDetail.jsx';
import TestsPage from './pages/tests/TestsPage.jsx';
import OrdersList from './pages/orders/OrdersList.jsx';
import OrderCreate from './pages/orders/OrderCreate.jsx';
import OrderDetail from './pages/orders/OrderDetail.jsx';
import Worklist from './pages/orders/Worklist.jsx';
import ReportsList from './pages/reports/ReportsList.jsx';
import ReportView from './pages/reports/ReportView.jsx';
import ReceiptsList from './pages/receipts/ReceiptsList.jsx';
import ReceiptView from './pages/receipts/ReceiptView.jsx';
import RevenuePage from './pages/revenue/RevenuePage.jsx';
import UsersPage from './pages/admin/UsersPage.jsx';
import RolesPage from './pages/admin/RolesPage.jsx';
import AuditPage from './pages/admin/AuditPage.jsx';

const PrintReport = lazy(() => import('./pages/reports/PrintReport.jsx'));
const PrintReceipt = lazy(() => import('./pages/receipts/PrintReceipt.jsx'));

function Protected({ permissions, roles, children }) {
  return (
    <RequirePermission permissions={permissions} roles={roles}>
      {children}
    </RequirePermission>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingBlock label="Preparing document…" />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/reports/:id/print"
          element={
            <RequireAuth>
              <Protected permissions={['reports.print', 'reports.view']}>
                <PrintReport />
              </Protected>
            </RequireAuth>
          }
        />
        <Route
          path="/receipts/:id/print"
          element={
            <RequireAuth>
              <Protected permissions={['receipts.print', 'receipts.view']}>
                <PrintReceipt />
              </Protected>
            </RequireAuth>
          }
        />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route
            index
            element={
              <Protected permissions={['dashboard.view']}>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="patients"
            element={
              <Protected permissions={['patients.view']}>
                <PatientsList />
              </Protected>
            }
          />
          <Route
            path="patients/:id"
            element={
              <Protected permissions={['patients.view']}>
                <PatientDetail />
              </Protected>
            }
          />
          <Route
            path="doctors"
            element={
              <Protected permissions={['doctors.view']}>
                <DoctorsList />
              </Protected>
            }
          />
          <Route
            path="doctors/:id"
            element={
              <Protected permissions={['doctors.view']}>
                <DoctorDetail />
              </Protected>
            }
          />
          <Route
            path="tests"
            element={
              <Protected permissions={['tests.view']}>
                <TestsPage />
              </Protected>
            }
          />
          <Route
            path="orders"
            element={
              <Protected permissions={['orders.view']}>
                <OrdersList />
              </Protected>
            }
          />
          <Route
            path="orders/new"
            element={
              <Protected permissions={['orders.create']}>
                <OrderCreate />
              </Protected>
            }
          />
          <Route
            path="orders/:id"
            element={
              <Protected permissions={['orders.view']}>
                <OrderDetail />
              </Protected>
            }
          />
          <Route
            path="worklist"
            element={
              <Protected permissions={['orders.view']}>
                <Worklist />
              </Protected>
            }
          />
          <Route
            path="reports"
            element={
              <Protected permissions={['reports.view']}>
                <ReportsList />
              </Protected>
            }
          />
          <Route
            path="reports/:id"
            element={
              <Protected permissions={['reports.view']}>
                <ReportView />
              </Protected>
            }
          />
          <Route
            path="receipts"
            element={
              <Protected permissions={['receipts.view']}>
                <ReceiptsList />
              </Protected>
            }
          />
          <Route
            path="receipts/:id"
            element={
              <Protected permissions={['receipts.view']}>
                <ReceiptView />
              </Protected>
            }
          />
          <Route
            path="revenue"
            element={
              <Protected permissions={['revenue.view']}>
                <RevenuePage />
              </Protected>
            }
          />
          <Route
            path="users"
            element={
              <Protected permissions={['users.view']}>
                <UsersPage />
              </Protected>
            }
          />
          <Route
            path="roles"
            element={
              <Protected permissions={['roles.view', 'roles.manage']}>
                <RolesPage />
              </Protected>
            }
          />
          <Route
            path="audit"
            element={
              <Protected permissions={['audit.view']}>
                <AuditPage />
              </Protected>
            }
          />
          <Route
            path="settings"
            element={
              <Protected permissions={['settings.view']}>
                <SettingsPage />
              </Protected>
            }
          />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="404" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}
