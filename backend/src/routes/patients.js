import express from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { recordAudit } from '../utils/audit.js';
import { now } from '../utils/ids.js';
import { nextDocumentNumber } from '../utils/settings.js';
import { appStore, count, findOne, insert, regex, update } from '../db/app-store.js';
import { assert, requireFields, toInt, paginate, GENDERS, AGE_UNITS } from '../utils/validate.js';

const router = express.Router(); router.use(authenticate);
async function enrich(patient) { if (!patient) return null; const { collections } = await appStore(); const doctor = patient.referred_by ? await collections.doctors.findOne({ id: Number(patient.referred_by) }) : null; const creator = patient.created_by ? await collections.users.findOne({ id: Number(patient.created_by) }) : null; return { ...patient, doctor_name: doctor?.name ?? null, doctor_specialization: doctor?.specialization ?? null, created_by_name: creator?.full_name ?? null }; }
async function stats(id) { const { collections } = await appStore(); const [rows, total_reports] = await Promise.all([collections.orders.aggregate([{ $match: { patient_id: id, is_deleted: 0 } }, { $group: { _id: null, total_orders: { $sum: 1 }, total_billed: { $sum: { $ifNull: ['$total', 0] } }, total_paid: { $sum: { $ifNull: ['$paid_amount', 0] } }, outstanding: { $sum: { $ifNull: ['$balance', 0] } }, last_visit: { $max: '$created_at' } } }]).toArray(), collections.reports.countDocuments({ patient_id: id })]); const summary = rows[0] || {}; return { total_orders: summary.total_orders || 0, total_billed: summary.total_billed || 0, total_paid: summary.total_paid || 0, outstanding: summary.outstanding || 0, last_visit: summary.last_visit ?? null, total_reports }; }
function validate(body, partial = false) { if (!partial) requireFields(body, ['full_name']); if (body.gender !== undefined) assert(GENDERS.includes(body.gender), `Gender must be one of: ${GENDERS.join(', ')}`); if (body.age_unit !== undefined) assert(AGE_UNITS.includes(body.age_unit), `Age unit must be one of: ${AGE_UNITS.join(', ')}`); if (body.date_of_birth) assert(!Number.isNaN(Date.parse(body.date_of_birth)), 'Date of birth is not a valid date'); }

router.get('/', requirePermission('patients.view'), asyncHandler(async (req, res) => {
	const { page, limit, offset } = paginate(req.query);
	let filter = { is_deleted: 0 };
	if (req.query.gender) filter.gender = req.query.gender;
	if (req.query.doctor_id) filter.referred_by = Number(req.query.doctor_id);
	if (req.query.search) {
		const r = regex(req.query.search);
		filter.$or = [{ full_name: r }, { patient_code: r }, { phone: r }, { email: r }];
	}
	// Date range filter: default to today and yesterday in Asia/Karachi timezone
	// unless explicit start_date/end_date are provided.
	// created_at is stored as a string, so $expr with $dateFromString is used
	// for type-safe comparison against Date boundaries.
	let dateExpr = null;
	if (req.query.start_date && req.query.end_date) {
		dateExpr = {
			$expr: {
				$and: [
					{ $gte: [{ $dateFromString: { dateString: '$created_at', onError: null } }, new Date(req.query.start_date)] },
					{ $lt: [{ $dateFromString: { dateString: '$created_at', onError: null } }, new Date(req.query.end_date)] },
				],
			},
		};
	} else {
		// Default: patients registered today and yesterday in Asia/Karachi timezone
		const now = new Date();
		const karachiOffset = 5 * 60 * 60 * 1000; // 5 hours in ms
		const karachiNow = new Date(now.getTime() + karachiOffset);
		const karachiTodayMidnight = new Date(karachiNow.getFullYear(), karachiNow.getMonth(), karachiNow.getDate());
		const karachiYesterdayMidnight = new Date(karachiTodayMidnight.getTime() - 24 * 60 * 60 * 1000);
		const karachiTomorrowMidnight = new Date(karachiTodayMidnight.getTime() + 24 * 60 * 60 * 1000);
		// Convert Karachi day boundaries to UTC instants for MongoDB comparison
		const startDateUTC = new Date(karachiYesterdayMidnight.getTime() - karachiOffset);
		const endDateUTC = new Date(karachiTomorrowMidnight.getTime() - karachiOffset);
		dateExpr = {
			$expr: {
				$and: [
					{ $gte: [{ $dateFromString: { dateString: '$created_at', onError: null } }, startDateUTC] },
					{ $lt: [{ $dateFromString: { dateString: '$created_at', onError: null } }, endDateUTC] },
				],
			},
		};
	}
	if (dateExpr) {
		filter = { ...filter, ...dateExpr };
	}
	const { collections } = await appStore();
	const total = await collections.patients.countDocuments(filter);
	const rows = await collections.patients.find(filter).sort({ created_at: -1, id: -1 }).skip(offset).limit(limit).toArray();
	const doctorIds = [...new Set(rows.map((patient) => patient.referred_by).filter(Boolean))];
	const creatorIds = [...new Set(rows.map((patient) => patient.created_by).filter(Boolean))];
	const [doctors, creators] = await Promise.all([
		doctorIds.length ? collections.doctors.find({ id: { $in: doctorIds } }, { projection: { id: 1, name: 1, specialization: 1 } }).toArray() : [],
		creatorIds.length ? collections.users.find({ id: { $in: creatorIds } }, { projection: { id: 1, full_name: 1 } }).toArray() : [],
	]);
	const doctorById = new Map(doctors.map((doctor) => [doctor.id, doctor]));
	const creatorById = new Map(creators.map((creator) => [creator.id, creator]));
	const data = rows.map((patient) => ({
		...patient,
		doctor_name: doctorById.get(Number(patient.referred_by))?.name ?? null,
		doctor_specialization: doctorById.get(Number(patient.referred_by))?.specialization ?? null,
		created_by_name: creatorById.get(Number(patient.created_by))?.full_name ?? null,
	}));

	res.json({ data, meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
}));
router.get('/:id', requirePermission('patients.view'), asyncHandler(async (req, res) => { const patient = await enrich(await findOne('patients', { id: Number(req.params.id), is_deleted: 0 })); if (!patient) throw ApiError.notFound('Patient not found'); res.json({ data: { ...patient, stats: await stats(patient.id) } }); }));
router.get('/:id/history', requirePermission('patients.view'), asyncHandler(async (req, res) => { const id = Number(req.params.id); const patient = await findOne('patients', { id, is_deleted: 0 }, undefined); if (!patient) throw ApiError.notFound('Patient not found'); const { collections } = await appStore(); const orders = await collections.orders.find({ patient_id: id, is_deleted: 0 }).sort({ created_at: -1 }).toArray(); const doctorIds = [...new Set(orders.map((order) => order.doctor_id).filter(Boolean))]; const doctors = new Map((doctorIds.length ? await collections.doctors.find({ id: { $in: doctorIds } }, { projection: { id: 1, name: 1 } }).toArray() : []).map((doctor) => [doctor.id, doctor])); const items = await collections.order_items.find({ order_id: { $in: orders.map((o) => o.id) } }).sort({ resulted_at: -1, id: -1 }).toArray(); const reports = await collections.reports.find({ patient_id: id }).sort({ created_at: -1 }).toArray(); const payments = await collections.payments.find({ patient_id: id, is_void: 0 }).sort({ paid_at: -1 }).toArray(); const receipts = new Map((await collections.receipts.find({ id: { $in: payments.map((p) => p.receipt_id).filter(Boolean) } }).toArray()).map((r) => [r.id, r])); const users = new Map((await collections.users.find({ id: { $in: payments.map((p) => p.received_by).filter(Boolean) } }).toArray()).map((u) => [u.id, u])); res.json({ data: { patient: { id: patient.id, patient_code: patient.patient_code, full_name: patient.full_name }, stats: await stats(id), orders: orders.map((o) => ({ ...o, doctor_name: doctors.get(o.doctor_id)?.name ?? null, test_count: items.filter((i) => i.order_id === o.id).length })), tests: items.filter((i) => orders.some((o) => o.id === i.order_id)).map((i) => ({ ...i, order_no: orders.find((o) => o.id === i.order_id)?.order_no, order_date: orders.find((o) => o.id === i.order_id)?.created_at })), reports: reports.map((r) => ({ ...r, order_no: orders.find((o) => o.id === r.order_id)?.order_no, doctor_name: doctors.get(r.doctor_id)?.name ?? null })), payments: payments.map((p) => ({ ...p, order_no: orders.find((o) => o.id === p.order_id)?.order_no, receipt_no: receipts.get(p.receipt_id)?.receipt_no ?? null, received_by_name: users.get(p.received_by)?.full_name ?? null })) } }); }));
router.post('/', requirePermission('patients.create'), asyncHandler(async (req, res) => { validate(req.body); const patientCode = await nextDocumentNumber('patient'); const duplicate = await findOne('patients', { full_name: String(req.body.full_name).trim(), phone: req.body.phone || null, is_deleted: 0 }); const timestamp = now(); const patient = await insert('patients', { patient_code: patientCode, full_name: String(req.body.full_name).trim(), age: req.body.age === undefined || req.body.age === '' ? null : toInt(req.body.age), age_unit: req.body.age_unit || 'years', date_of_birth: req.body.date_of_birth || null, gender: req.body.gender || 'male', phone: req.body.phone || null, email: req.body.email || null, national_id: req.body.national_id || null, address: req.body.address || null, blood_group: req.body.blood_group || null, marital_status: req.body.marital_status || null, referred_by: req.body.referred_by ? Number(req.body.referred_by) : null, notes: req.body.notes || null, created_by: req.user.id, created_at: timestamp, updated_at: timestamp, is_deleted: 0 }); await recordAudit({ req, action: 'create', module: 'patients', entity: 'patient', entityId: patient.id, description: `Registered patient "${patientCode}" (${req.body.full_name})` }); res.status(201).json({ data: await enrich(patient), warning: duplicate ? 'A patient with the same name and phone already exists.' : null }); }));
router.put('/:id', requirePermission('patients.edit'), asyncHandler(async (req, res) => { const id = Number(req.params.id); const existing = await findOne('patients', { id, is_deleted: 0 }); if (!existing) throw ApiError.notFound('Patient not found'); validate(req.body, true); const merged = { ...existing, ...req.body, id, age: req.body.age === '' || req.body.age === null ? null : req.body.age === undefined ? existing.age : toInt(req.body.age), updated_at: now() }; delete merged._id; await update('patients', { id }, { $set: merged }); await recordAudit({ req, action: 'update', module: 'patients', entity: 'patient', entityId: id, description: `Updated patient "${existing.patient_code}"` }); res.json({ data: await enrich(await findOne('patients', { id })) }); }));
router.delete('/:id', requirePermission('patients.delete'), asyncHandler(async (req, res) => { const id = Number(req.params.id); const patient = await findOne('patients', { id, is_deleted: 0 }); if (!patient) throw ApiError.notFound('Patient not found'); const open = await count('orders', { patient_id: id, is_deleted: 0, status: { $nin: ['reported', 'cancelled'] } }); if (open) throw ApiError.conflict('This patient has active orders. Complete or cancel them before archiving.'); await update('patients', { id }, { $set: { is_deleted: 1, updated_at: now() } }); await recordAudit({ req, action: 'delete', module: 'patients', entity: 'patient', entityId: id, description: `Archived patient "${patient.patient_code}"` }); res.json({ message: 'Patient archived' }); }));
export default router;
