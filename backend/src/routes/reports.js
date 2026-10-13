import express from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { recordAudit } from '../utils/audit.js';
import { now } from '../utils/ids.js';
import { nextDocumentNumber, getSettings } from '../utils/settings.js';
import { appStore, findOne, insert, regex, update, transaction } from '../db/app-store.js';
import { syncOrderStatus, syncReportStatus, getOrderDetail } from '../utils/orders.js';
import { assert, requireFields, toBool, paginate, REPORT_STATUSES } from '../utils/validate.js';
const router = express.Router(); router.use(authenticate);
async function enrich(report) { const { collections } = await appStore(); const [order, patient, doctor, verifier, creator, items] = await Promise.all([collections.orders.findOne({ id: report.order_id }), collections.patients.findOne({ id: report.patient_id }), report.doctor_id ? collections.doctors.findOne({ id: report.doctor_id }) : null, report.verified_by ? collections.users.findOne({ id: report.verified_by }) : null, report.created_by ? collections.users.findOne({ id: report.created_by }) : null, collections.order_items.find({ order_id: report.order_id }).toArray()]); return { ...report, order_no: order?.order_no, patient_code: patient?.patient_code, patient_name: patient?.full_name, age: patient?.age, age_unit: patient?.age_unit, gender: patient?.gender, doctor_name: doctor?.name, verified_by_name: verifier?.full_name, created_by_name: creator?.full_name, total_tests: items.length, verified_tests: items.filter((i) => i.status === 'verified').length }; }
async function enrichMany(reports) {
	if (!reports.length) return [];
	const { collections } = await appStore();
	const orderIds = [...new Set(reports.map((report) => report.order_id))];
	const patientIds = [...new Set(reports.map((report) => report.patient_id))];
	const doctorIds = [...new Set(reports.map((report) => report.doctor_id).filter(Boolean))];
	const userIds = [...new Set(reports.flatMap((report) => [report.verified_by, report.created_by]).filter(Boolean))];
	const [orders, patients, doctors, users, itemCounts] = await Promise.all([
		collections.orders.find({ id: { $in: orderIds } }, { projection: { id: 1, order_no: 1 } }).toArray(),
		collections.patients.find({ id: { $in: patientIds } }, { projection: { id: 1, patient_code: 1, full_name: 1, age: 1, age_unit: 1, gender: 1 } }).toArray(),
		doctorIds.length ? collections.doctors.find({ id: { $in: doctorIds } }, { projection: { id: 1, name: 1 } }).toArray() : [],
		userIds.length ? collections.users.find({ id: { $in: userIds } }, { projection: { id: 1, full_name: 1 } }).toArray() : [],
		collections.order_items.aggregate([
			{ $match: { order_id: { $in: orderIds } } },
			{ $group: { _id: '$order_id', total_tests: { $sum: 1 }, verified_tests: { $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] } } } },
		]).toArray(),
	]);
	const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
	const orderById = byId(orders);
	const patientById = byId(patients);
	const doctorById = byId(doctors);
	const userById = byId(users);
	const itemCountByOrder = new Map(itemCounts.map((row) => [row._id, row]));

	return reports.map((report) => {
		const order = orderById.get(report.order_id);
		const patient = patientById.get(report.patient_id);
		const counts = itemCountByOrder.get(report.order_id);
		return {
			...report,
			order_no: order?.order_no,
			patient_code: patient?.patient_code,
			patient_name: patient?.full_name,
			age: patient?.age,
			age_unit: patient?.age_unit,
			gender: patient?.gender,
			doctor_name: doctorById.get(report.doctor_id)?.name,
			verified_by_name: userById.get(report.verified_by)?.full_name,
			created_by_name: userById.get(report.created_by)?.full_name,
			total_tests: counts?.total_tests || 0,
			verified_tests: counts?.verified_tests || 0,
		};
	});
}

router.get('/', requirePermission('reports.view'), asyncHandler(async (req, res) => { const { page, limit, offset } = paginate(req.query); const filter = {}; if (req.query.status) { assert(REPORT_STATUSES.includes(req.query.status), 'Invalid report status filter'); filter.status = req.query.status; } if (req.query.patient_id) filter.patient_id = Number(req.query.patient_id); if (req.query.search) { const r = regex(req.query.search); filter.$or = [{ report_no: r }]; const { collections } = await appStore(); const patients = await collections.patients.find({ $or: [{ full_name: r }, { patient_code: r }] }, { projection: { id: 1 } }).toArray(); filter.$or.push({ patient_id: { $in: patients.map((p) => p.id) } }); } const { collections } = await appStore(); const total = await collections.reports.countDocuments(filter); const rows = await collections.reports.find(filter).sort({ created_at: -1, id: -1 }).skip(offset).limit(limit).toArray(); res.json({ data: await enrichMany(rows), meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } }); }));
router.get('/pending', requirePermission('reports.view', 'reports.generate'), asyncHandler(async (req, res) => {
	const { collections } = await appStore();
	const rows = await collections.orders.aggregate([
		{ $match: { is_deleted: 0, status: { $ne: 'cancelled' } } },
		{
			$lookup: {
				from: 'order_items',
				let: { orderId: '$id' },
				pipeline: [
					{ $match: { $expr: { $eq: ['$order_id', '$$orderId'] } } },
					{
						$group: {
							_id: null,
							test_count: { $sum: 1 },
							done_count: { $sum: { $cond: [{ $in: ['$status', ['completed', 'verified']] }, 1, 0] } },
						},
					},
				],
				as: 'testStats',
			},
		},
		{
			$set: {
				test_count: { $ifNull: [{ $arrayElemAt: ['$testStats.test_count', 0] }, 0] },
				done_count: { $ifNull: [{ $arrayElemAt: ['$testStats.done_count', 0] }, 0] },
			},
		},
		{ $match: { done_count: { $gt: 0 } } },
		{
			$lookup: {
				from: 'reports',
				let: { orderId: '$id' },
				pipeline: [
					{ $match: { $expr: { $and: [{ $eq: ['$order_id', '$$orderId'] }, { $in: ['$status', ['verified', 'final']] }] } } },
					{ $limit: 1 },
					{ $project: { _id: 1 } },
				],
				as: 'completedReport',
			},
		},
		{ $match: { completedReport: { $eq: [] } } },
		{ $sort: { created_at: 1, _id: 1 } },
		{ $limit: 100 },
		{
			$lookup: {
				from: 'patients',
				localField: 'patient_id',
				foreignField: 'id',
				pipeline: [{ $project: { patient_code: 1, full_name: 1 } }, { $limit: 1 }],
				as: 'pendingPatient',
			},
		},
		{ $lookup: { from: 'doctors', localField: 'doctor_id', foreignField: 'id', pipeline: [{ $project: { name: 1 } }, { $limit: 1 }], as: 'pendingDoctor' } },
		{
			$set: {
				patient_code: { $arrayElemAt: ['$pendingPatient.patient_code', 0] },
				patient_name: { $arrayElemAt: ['$pendingPatient.full_name', 0] },
				doctor_name: { $arrayElemAt: ['$pendingDoctor.name', 0] },
				report_id: null,
			},
		},
		{ $project: { testStats: 0, completedReport: 0, pendingPatient: 0, pendingDoctor: 0 } },
	]).toArray();
	res.json({ data: rows });
}));
router.get('/:id', requirePermission('reports.view'), asyncHandler(async (req, res) => { const report = await enrich(await findOne('reports', { id: Number(req.params.id) })); if (!report) throw ApiError.notFound('Report not found'); const detail = await getOrderDetail(report.order_id); const settings = await getSettings(); res.json({ data: { report, order: detail.order, patient: { patient_code: detail.order.patient_code, full_name: detail.order.patient_name, age: detail.order.age, age_unit: detail.order.age_unit, gender: detail.order.gender, phone: detail.order.patient_phone, address: detail.order.patient_address, blood_group: detail.order.blood_group }, doctor: detail.order.doctor_name ? { name: detail.order.doctor_name, qualification: detail.order.doctor_qualification, specialization: detail.order.doctor_specialization, hospital: detail.order.doctor_hospital } : null, items: detail.items, settings } }); }));
router.post('/', requirePermission('reports.generate'), asyncHandler(async (req, res) => { requireFields(req.body, ['order_id']); const order = await findOne('orders', { id: Number(req.body.order_id), is_deleted: 0 }); assert(order, 'Order not found'); const { collections } = await appStore(); const items = await collections.order_items.find({ order_id: order.id }).toArray(); assert(items.length > 0, 'This order has no tests to report'); assert(items.some((i) => i.result_value !== null && i.result_value !== ''), 'Enter at least one result before generating a report'); const existing = await collections.reports.find({ order_id: order.id, status: { $in: ['draft', 'verified'] } }).sort({ created_at: -1 }).limit(1).next(); if (existing) return res.json({ data: await enrich(existing), meta: { reused: true } }); const reportId = await transaction(async (session) => { const report = await insert('reports', { report_no: await nextDocumentNumber('report'), order_id: order.id, patient_id: order.patient_id, doctor_id: order.doctor_id, status: 'draft', sample_collected_at: order.sample_collected_at || order.created_at, reported_at: now(), conclusion: req.body.conclusion || null, remarks: req.body.remarks || null, created_by: req.user.id, created_at: now(), updated_at: now(), print_count: 0, last_printed_at: null }, session); if (toBool(req.body.verify, false)) { assert(req.user.permissions.includes('reports.verify'), 'You do not have permission to verify reports'); await collections.reports.updateOne({ id: report.id }, { $set: { status: 'verified', verified_by: req.user.id, verified_at: now() } }, { session }); await collections.order_items.updateMany({ order_id: order.id, status: 'completed' }, { $set: { status: 'verified', verified_by: req.user.id, verified_at: now(), updated_at: now() } }, { session }); } return report.id; }); await syncOrderStatus(order.id); await syncReportStatus(reportId); await recordAudit({ req, action: 'generate', module: 'reports', entity: 'report', entityId: reportId, description: `Generated report for order ${order.order_no}` }); res.status(201).json({ data: await enrich(await findOne('reports', { id: reportId })) }); }));
router.patch('/:id', requirePermission('reports.generate', 'reports.verify'), asyncHandler(async (req, res) => { const id = Number(req.params.id); const report = await findOne('reports', { id }); if (!report) throw ApiError.notFound('Report not found'); assert(report.status !== 'final', 'A finalised report cannot be edited'); await update('reports', { id }, { $set: { conclusion: req.body.conclusion ?? report.conclusion, remarks: req.body.remarks ?? report.remarks, updated_at: now() } }); await recordAudit({ req, action: 'update', module: 'reports', entity: 'report', entityId: id, description: `Updated report ${report.report_no}` }); res.json({ data: await enrich(await findOne('reports', { id })) }); }));
router.post('/:id/verify', requirePermission('reports.verify'), asyncHandler(async (req, res) => { const id = Number(req.params.id); const report = await findOne('reports', { id }); if (!report) throw ApiError.notFound('Report not found'); const { collections } = await appStore(); const pending = await collections.order_items.countDocuments({ order_id: report.order_id, $or: [{ result_value: null }, { result_value: '' }] }); assert(pending === 0, 'All results must be entered before the report can be verified'); await transaction(async (session) => { await collections.order_items.updateMany({ order_id: report.order_id, status: { $ne: 'verified' } }, { $set: { status: 'verified', verified_by: req.user.id, verified_at: now(), updated_at: now() } }, { session }); await collections.reports.updateOne({ id }, { $set: { status: 'verified', verified_by: req.user.id, verified_at: now(), updated_at: now() } }, { session }); await collections.orders.updateOne({ id: report.order_id }, { $set: { status: 'reported', updated_at: now() } }, { session }); }); await syncReportStatus(id); await recordAudit({ req, action: 'verify', module: 'reports', entity: 'report', entityId: id, description: `Verified report ${report.report_no}` }); res.json({ data: await enrich(await findOne('reports', { id })) }); }));
router.post('/:id/finalize', requirePermission('reports.verify'), asyncHandler(async (req, res) => { const id = Number(req.params.id); const report = await findOne('reports', { id }); if (!report) throw ApiError.notFound('Report not found'); assert(report.verified_by, 'Verify the report before finalising it'); await update('reports', { id }, { $set: { status: 'final', updated_at: now() } }); await recordAudit({ req, action: 'finalize', module: 'reports', entity: 'report', entityId: id, description: `Finalised report ${report.report_no}` }); res.json({ data: await enrich(await findOne('reports', { id })) }); }));
router.post('/:id/print', requirePermission('reports.print'), asyncHandler(async (req, res) => { const id = Number(req.params.id); const report = await findOne('reports', { id }); if (!report) throw ApiError.notFound('Report not found'); const print_count = Number(report.print_count || 0) + 1; await update('reports', { id }, { $set: { print_count, last_printed_at: now() } }); await recordAudit({ req, action: 'print', module: 'reports', entity: 'report', entityId: id, description: `Printed report ${report.report_no}` }); res.json({ message: 'Print recorded', print_count }); }));
router.delete('/:id', requirePermission('reports.delete'), asyncHandler(async (req, res) => { const id = Number(req.params.id); const report = await findOne('reports', { id }); if (!report) throw ApiError.notFound('Report not found'); assert(report.status !== 'final', 'Finalised reports cannot be deleted'); const { collections } = await appStore(); await collections.reports.deleteOne({ id }); await recordAudit({ req, action: 'delete', module: 'reports', entity: 'report', entityId: id, description: `Deleted report ${report.report_no}` }); res.json({ message: 'Report deleted' }); }));
export default router;
