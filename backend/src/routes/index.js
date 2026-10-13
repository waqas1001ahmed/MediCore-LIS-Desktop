import { Router } from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import roleRoutes from './roles.js';
import patientRoutes from './patients.js';
import doctorRoutes from './doctors.js';
import testRoutes from './tests.js';
import orderRoutes from './orders.js';
import reportRoutes from './reports.js';
import receiptRoutes from './receipts.js';
import paymentRoutes from './payments.js';
import revenueRoutes from './revenue.js';
import dashboardRoutes from './dashboard.js';
import settingsRoutes from './settings.js';
import searchRoutes from './search.js';
import auditRoutes from './audit.js';

const api = Router();

api.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'labms-api', time: new Date().toISOString() });
});

api.use('/auth', authRoutes);
api.use('/users', userRoutes);
api.use('/roles', roleRoutes);
api.use('/patients', patientRoutes);
api.use('/doctors', doctorRoutes);
api.use('/tests', testRoutes);
api.use('/orders', orderRoutes);
api.use('/reports', reportRoutes);
api.use('/receipts', receiptRoutes);
api.use('/payments', paymentRoutes);
api.use('/revenue', revenueRoutes);
api.use('/dashboard', dashboardRoutes);
api.use('/settings', settingsRoutes);
api.use('/search', searchRoutes);
api.use('/audit-logs', auditRoutes);

export default api;
