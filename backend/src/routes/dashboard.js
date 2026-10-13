import express from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { appStore } from '../db/app-store.js';
import { getSettings } from '../utils/settings.js';
import { formatDate } from '../utils/ids.js';

const router = express.Router();
router.use(authenticate);

const round = (value) => Math.round(Number(value || 0) * 100) / 100;
const datePart = (field) => ({ $substrBytes: [{ $ifNull: [field, ''] }, 0, 10] });
const sameDay = (field, day) => ({ $eq: [datePart(field), day] });

router.get('/', requirePermission('dashboard.view'), asyncHandler(async (req, res) => {
  const { collections } = await appStore();
  const now = new Date();
  const today = formatDate(now);
  const month = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const year = formatDate(new Date(now.getFullYear(), 0, 1));
  const trendDays = Array.from({ length: 14 }, (_, index) => formatDate(new Date(Date.now() - (13 - index) * 86400000)));
  const trendStart = trendDays[0];

  const [patientResult, orderResult, itemResult, reportResult, paymentResult, audit, settings] = await Promise.all([
    collections.patients.aggregate([
      { $match: { is_deleted: 0 } },
      {
        $facet: {
          summary: [{
            $group: {
              _id: null,
              total: { $sum: 1 },
              today: { $sum: { $cond: [sameDay('$created_at', today), 1, 0] } },
              this_month: { $sum: { $cond: [{ $gte: [datePart('$created_at'), month] }, 1, 0] } },
            },
          }],
          trend: [
            { $match: { created_at: { $gte: trendStart } } },
            { $group: { _id: datePart('$created_at'), patients: { $sum: 1 } } },
          ],
        },
      },
    ]).toArray(),
    collections.orders.aggregate([
      { $match: { is_deleted: 0 } },
      {
        $facet: {
          summary: [{
            $group: {
              _id: null,
              total: { $sum: 1 },
              today: { $sum: { $cond: [sameDay('$created_at', today), 1, 0] } },
              this_month: { $sum: { $cond: [{ $gte: [datePart('$created_at'), month] }, 1, 0] } },
              pending: { $sum: { $cond: [{ $in: ['$status', ['pending', 'collected', 'in_progress']] }, 1, 0] } },
              unpaid: { $sum: { $cond: [{ $eq: ['$payment_status', 'unpaid'] }, 1, 0] } },
              partial: { $sum: { $cond: [{ $eq: ['$payment_status', 'partial'] }, 1, 0] } },
              outstanding: { $sum: { $ifNull: ['$balance', 0] } },
            },
          }],
          trend: [
            { $match: { created_at: { $gte: trendStart } } },
            { $group: { _id: datePart('$created_at'), orders: { $sum: 1 }, billed: { $sum: { $ifNull: ['$total', 0] } } } },
          ],
          statusBreakdown: [
            { $sort: { _id: 1 } },
            { $group: { _id: '$status', count: { $sum: 1 }, firstId: { $min: '$_id' } } },
            { $sort: { firstId: 1 } },
            { $project: { _id: 0, status: { $cond: [{ $eq: ['$_id', null] }, '$$REMOVE', '$_id'] }, count: 1 } },
          ],
          paymentBreakdown: [
            { $sort: { _id: 1 } },
            { $group: { _id: '$payment_status', count: { $sum: 1 }, balance: { $sum: { $ifNull: ['$balance', 0] } }, firstId: { $min: '$_id' } } },
            { $sort: { firstId: 1 } },
            { $project: { _id: 0, status: { $cond: [{ $eq: ['$_id', null] }, '$$REMOVE', '$_id'] }, count: 1, balance: 1 } },
          ],
          recent: [
            { $sort: { created_at: -1, _id: 1 } },
            { $limit: 8 },
            {
              $lookup: {
                from: 'patients',
                localField: 'patient_id',
                foreignField: 'id',
                pipeline: [
                  { $match: { is_deleted: 0 } },
                  { $project: { patient_code: 1, full_name: 1 } },
                  { $limit: 1 },
                ],
                as: 'dashboardPatient',
              },
            },
            { $lookup: { from: 'doctors', localField: 'doctor_id', foreignField: 'id', pipeline: [{ $project: { name: 1 } }, { $limit: 1 }], as: 'dashboardDoctor' } },
            { $lookup: { from: 'order_items', localField: 'id', foreignField: 'order_id', pipeline: [{ $count: 'count' }], as: 'dashboardItemCount' } },
            {
              $set: {
                patient_code: { $arrayElemAt: ['$dashboardPatient.patient_code', 0] },
                patient_name: { $arrayElemAt: ['$dashboardPatient.full_name', 0] },
                doctor_name: { $arrayElemAt: ['$dashboardDoctor.name', 0] },
                test_count: { $ifNull: [{ $arrayElemAt: ['$dashboardItemCount.count', 0] }, 0] },
              },
            },
            { $project: { dashboardPatient: 0, dashboardDoctor: 0, dashboardItemCount: 0 } },
          ],
        },
      },
    ]).toArray(),
    collections.order_items.aggregate([
      {
        $facet: {
          summary: [{
            $group: {
              _id: null,
              total: { $sum: 1 },
              today: { $sum: { $cond: [sameDay('$created_at', today), 1, 0] } },
            },
          }],
          topTests: [
            {
              $group: {
                _id: '$test_name',
                count: { $sum: 1 },
                revenue: { $sum: { $subtract: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$discount', 0] }] } },
                firstId: { $min: '$_id' },
              },
            },
            { $sort: { count: -1, firstId: 1 } },
            { $limit: 6 },
            { $project: { _id: 0, test_name: '$_id', count: 1, revenue: 1 } },
          ],
        },
      },
    ]).toArray(),
    collections.reports.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $in: ['$status', ['verified', 'final']] }, 1, 0] } },
          today: { $sum: { $cond: [sameDay('$created_at', today), 1, 0] } },
        },
      },
    ]).toArray(),
    collections.payments.aggregate([
      { $match: { is_void: 0, paid_at: { $gte: trendStart < year ? trendStart : year } } },
      {
        $facet: {
          summary: [{
            $group: {
              _id: null,
              today: { $sum: { $cond: [sameDay('$paid_at', today), { $ifNull: ['$amount', 0] }, 0] } },
              this_month: { $sum: { $cond: [{ $gte: [datePart('$paid_at'), month] }, { $ifNull: ['$amount', 0] }, 0] } },
              this_year: { $sum: { $cond: [{ $gte: [datePart('$paid_at'), year] }, { $ifNull: ['$amount', 0] }, 0] } },
            },
          }],
          trend: [
            { $match: { paid_at: { $gte: trendStart } } },
            { $group: { _id: datePart('$paid_at'), collected: { $sum: { $ifNull: ['$amount', 0] } } } },
          ],
        },
      },
    ]).toArray(),
    collections.audit_logs.find({}).sort({ id: -1 }).limit(12).toArray(),
    getSettings(['currency_symbol', 'currency_code', 'currency_position']),
  ]);

  const patientStats = patientResult[0]?.summary[0] || { total: 0, today: 0, this_month: 0 };
  const orderData = orderResult[0] || {};
  const orderStats = orderData.summary?.[0] || { total: 0, today: 0, this_month: 0, pending: 0, unpaid: 0, partial: 0, outstanding: 0 };
  const itemData = itemResult[0] || {};
  const itemStats = itemData.summary?.[0] || { total: 0, today: 0 };
  const reportStats = reportResult[0] || { total: 0, pending: 0, completed: 0, today: 0 };
  const paymentData = paymentResult[0] || {};
  const revenueStats = paymentData.summary?.[0] || { today: 0, this_month: 0, this_year: 0 };
  const orderTrend = new Map((orderData.trend || []).map((row) => [row._id, row]));
  const patientTrend = new Map((patientResult[0]?.trend || []).map((row) => [row._id, row.patients]));
  const revenueTrend = new Map((paymentData.trend || []).map((row) => [row._id, row.collected]));

  res.json({
    data: {
      generated_at: new Date().toISOString(),
      currency: { symbol: settings.currency_symbol, code: settings.currency_code, position: settings.currency_position },
      patients: { total: patientStats.total, today: patientStats.today, this_month: patientStats.this_month },
      orders: {
        total: orderStats.total,
        today: orderStats.today,
        this_month: orderStats.this_month,
        pending: orderStats.pending,
        unpaid: orderStats.unpaid,
        partial: orderStats.partial,
        outstanding: round(orderStats.outstanding),
      },
      tests: { total: itemStats.total, today: itemStats.today },
      reports: { total: reportStats.total, pending: reportStats.pending, completed: reportStats.completed, today: reportStats.today },
      revenue: { today: round(revenueStats.today), this_month: round(revenueStats.this_month), this_year: round(revenueStats.this_year) },
      recent_orders: orderData.recent || [],
      recent_activity: audit,
      revenue_trend: trendDays.map((day) => ({ day, collected: round(revenueTrend.get(day)), billed: round(orderTrend.get(day)?.billed) })),
      order_trend: trendDays.map((day) => ({ day, orders: orderTrend.get(day)?.orders || 0, patients: patientTrend.get(day) || 0 })),
      status_breakdown: orderData.statusBreakdown || [],
      payment_breakdown: (orderData.paymentBreakdown || []).map((row) => ({ ...row, balance: round(row.balance) })),
      top_tests: (itemData.topTests || []).map((row) => ({ ...row, revenue: round(row.revenue) })),
    },
  });
}));

export default router;