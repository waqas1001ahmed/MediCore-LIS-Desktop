import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiError } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useFetch } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../components/ui/Confirm.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Can } from '../../components/RouteGuards.jsx';
import {
  Alert, Avatar, Button, EmptyState, Field, Input, Modal, Pagination, SearchInput,
  Select, TableShell, Textarea,
} from '../../components/ui/index.jsx';
import { AGE_UNIT_OPTIONS, BLOOD_GROUP_OPTIONS, GENDER_OPTIONS, MARITAL_STATUS_OPTIONS } from '../../utils/constants.js';
import { ageLabel, formatDateTime, titleCase } from '../../utils/format.js';

const EMPTY = {
  full_name: '', age: '', age_unit: 'years', date_of_birth: '', gender: 'male',
  phone: '', email: '', national_id: '', address: '', blood_group: '', marital_status: '',
  referred_by: '', notes: '',
};

export default function PatientsList() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const debounced = useDebounce(search);

  const query = useMemo(() => ({ search: debounced, gender, page, limit }), [debounced, gender, page, limit]);

  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get('/patients', { params: query });
    return payload;
  }, [query.search, query.gender, query.page, query.limit]);

  const { data: doctors } = useFetch(async () => {
    const { data: payload } = await api.get('/doctors/options');
    return payload.data;
  }, []);

  const rows = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit, pages: 1 };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (patient) => {
    setEditing(patient);
    setForm({
      full_name: patient.full_name || '',
      age: patient.age ?? '',
      age_unit: patient.age_unit || 'years',
      date_of_birth: patient.date_of_birth || '',
      gender: patient.gender || 'male',
      phone: patient.phone || '',
      email: patient.email || '',
      national_id: patient.national_id || '',
      address: patient.address || '',
      blood_group: patient.blood_group || '',
      marital_status: patient.marital_status || '',
      referred_by: patient.referred_by || '',
      notes: patient.notes || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.full_name.trim()) {
      setFormError('Patient name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = { ...form, referred_by: form.referred_by || null, age: form.age === '' ? null : Number(form.age) };
    try {
      if (editing) {
        await api.put(`/patients/${editing.id}`, payload);
        toast.success('Patient updated');
      } else {
        const { data: created } = await api.post('/patients', payload);
        toast.success('Patient registered', created.warning || created.data?.patient_code);
      }
      setModalOpen(false);
      reload();
    } catch (saveError) {
      setFormError(apiError(saveError, 'Unable to save patient'));
    } finally {
      setSaving(false);
    }
  };

  const archive = async (patient) => {
    const ok = await confirm({
      title: `Archive ${patient.full_name}?`,
      message: 'The patient will be hidden from the register. Historical orders remain available.',
      tone: 'danger',
      confirmLabel: 'Archive',
    });
    if (!ok) return;
    try {
      await api.delete(`/patients/${patient.id}`);
      toast.success('Patient archived');
      reload();
    } catch (deleteError) {
      toast.error('Unable to archive', apiError(deleteError));
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="users"
        title="Patients"
        subtitle="Register patients, capture demographics and open clinical history."
        actions={
          <Can permission="patients.create">
            <Button variant="primary" icon="user-plus" onClick={openCreate}>Register patient</Button>
          </Can>
        }
      />

      <div className="toolbar">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} onClear={() => setSearch('')} placeholder="Search name, ID, phone…" />
        <Select value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }} options={[{ value: '', label: 'All genders' }, ...GENDER_OPTIONS]} style={{ width: 160 }} />
        <Button variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <TableShell
        loading={loading}
        empty={!rows.length ? <EmptyState icon="users" title="No patients found" description="Register a patient to start creating laboratory orders." action={<Can permission="patients.create"><Button variant="primary" icon="user-plus" onClick={openCreate}>Register patient</Button></Can>} /> : null}
        footer={<Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} onLimitChange={(value) => { setLimit(value); setPage(1); }} />}
      >
        <thead>
          <tr>
            <th>Patient</th>
            <th>ID</th>
            <th>Age / gender</th>
            <th>Phone</th>
            <th>Referring doctor</th>
            <th>Registered</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((patient) => (
            <tr key={patient.id} className="is-clickable" onClick={() => navigate(`/patients/${patient.id}`)}>
              <td>
                <div className="d-flex align-center gap-3">
                  <Avatar name={patient.full_name} />
                  <div>
                    <div className="fw-550">{patient.full_name}</div>
                    <div className="text-xs text-subtle">{patient.blood_group || 'Blood group not set'}</div>
                  </div>
                </div>
              </td>
              <td className="mono">{patient.patient_code}</td>
              <td>{ageLabel(patient.age, patient.age_unit)} · {titleCase(patient.gender)}</td>
              <td>{patient.phone || '—'}</td>
              <td>{patient.doctor_name || 'Walk-in'}</td>
              <td className="text-xs text-muted">{formatDateTime(patient.created_at)}</td>
              <td className="nowrap" onClick={(event) => event.stopPropagation()}>
                <Can permission="patients.edit">
                  <Button variant="ghost" size="xs" icon="edit" onClick={() => openEdit(patient)}>Edit</Button>
                </Can>
                <Can permission="patients.delete">
                  <Button variant="ghost" size="xs" icon="trash" onClick={() => archive(patient)}>Archive</Button>
                </Can>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit patient' : 'Register patient'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={save}>{editing ? 'Save changes' : 'Register'}</Button>
          </>
        }
      >
        {formError && <div className="mb-3"><Alert tone="danger">{formError}</Alert></div>}
        <form className="form-grid" onSubmit={save}>
          <Field label="Full name" required className="span-2">
            <Input value={form.full_name} onChange={(e) => setForm((c) => ({ ...c, full_name: e.target.value }))} autoFocus />
          </Field>
          <Field label="Age">
            <Input type="number" min="0" value={form.age} onChange={(e) => setForm((c) => ({ ...c, age: e.target.value }))} />
          </Field>
          <Field label="Age unit">
            <Select value={form.age_unit} options={AGE_UNIT_OPTIONS} onChange={(e) => setForm((c) => ({ ...c, age_unit: e.target.value }))} />
          </Field>
          <Field label="Date of birth">
            <Input type="date" value={form.date_of_birth} onChange={(e) => setForm((c) => ({ ...c, date_of_birth: e.target.value }))} />
          </Field>
          <Field label="Gender" required>
            <Select value={form.gender} options={GENDER_OPTIONS} onChange={(e) => setForm((c) => ({ ...c, gender: e.target.value }))} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} />
          </Field>
          <Field label="National ID">
            <Input value={form.national_id} onChange={(e) => setForm((c) => ({ ...c, national_id: e.target.value }))} />
          </Field>
          <Field label="Blood group">
            <Select value={form.blood_group} options={[{ value: '', label: 'Not specified' }, ...BLOOD_GROUP_OPTIONS]} onChange={(e) => setForm((c) => ({ ...c, blood_group: e.target.value }))} />
          </Field>
          <Field label="Marital status">
            <Select value={form.marital_status} options={[{ value: '', label: 'Not specified' }, ...MARITAL_STATUS_OPTIONS]} onChange={(e) => setForm((c) => ({ ...c, marital_status: e.target.value }))} />
          </Field>
          <Field label="Referring doctor">
            <Select
              value={form.referred_by}
              onChange={(e) => setForm((c) => ({ ...c, referred_by: e.target.value }))}
              options={[{ value: '', label: 'Walk-in / none' }, ...(doctors || []).map((doc) => ({ value: doc.id, label: doc.specialization ? `${doc.name} — ${doc.specialization}` : doc.name }))]}
            />
          </Field>
          <Field label="Address" className="span-2">
            <Input value={form.address} onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))} />
          </Field>
          <Field label="Notes" className="span-full">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
