import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiError } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useFetch } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../components/ui/Confirm.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Can } from '../../components/RouteGuards.jsx';
import {
  Alert, Avatar, Badge, Button, EmptyState, Field, Input, Modal, Pagination,
  SearchInput, Switch, TableShell, Textarea,
} from '../../components/ui/index.jsx';
import { formatMoney } from '../../utils/format.js';

const EMPTY = {
  name: '', qualification: '', specialization: '', hospital: '', phone: '', email: '',
  address: '', commission_percent: 0, notes: '', is_active: true,
};

export default function DoctorsList() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { currency } = useSettings();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const debounced = useDebounce(search);

  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get('/doctors', { params: { search: debounced, page, limit } });
    return payload;
  }, [debounced, page, limit]);

  const rows = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit, pages: 1 };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (doctor) => {
    setEditing(doctor);
    setForm({
      name: doctor.name || '',
      qualification: doctor.qualification || '',
      specialization: doctor.specialization || '',
      hospital: doctor.hospital || '',
      phone: doctor.phone || '',
      email: doctor.email || '',
      address: doctor.address || '',
      commission_percent: doctor.commission_percent ?? 0,
      notes: doctor.notes || '',
      is_active: !!doctor.is_active,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const save = async (event) => {
    event?.preventDefault();
    if (!form.name.trim()) {
      setFormError('Doctor name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) await api.put(`/doctors/${editing.id}`, form);
      else await api.post('/doctors', form);
      toast.success(editing ? 'Doctor updated' : 'Doctor added');
      setModalOpen(false);
      reload();
    } catch (saveError) {
      setFormError(apiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (doctor) => {
    const ok = await confirm({
      title: `Delete ${doctor.name}?`,
      message: 'Doctors linked to patients cannot be deleted. Deactivate them instead.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/doctors/${doctor.id}`);
      toast.success('Doctor deleted');
      reload();
    } catch (deleteError) {
      toast.error('Unable to delete', apiError(deleteError));
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="stethoscope"
        title="Referring doctors"
        subtitle="Clinicians who send patients to this laboratory."
        actions={<Can permission="doctors.create"><Button variant="primary" icon="plus" onClick={openCreate}>Add doctor</Button></Can>}
      />

      <div className="toolbar">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} onClear={() => setSearch('')} placeholder="Search name, specialty, hospital…" />
        <Button variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <TableShell
        loading={loading}
        empty={!rows.length ? <EmptyState icon="stethoscope" title="No doctors yet" action={<Can permission="doctors.create"><Button variant="primary" onClick={openCreate}>Add doctor</Button></Can>} /> : null}
        footer={<Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} onLimitChange={(value) => { setLimit(value); setPage(1); }} />}
      >
        <thead>
          <tr>
            <th>Doctor</th>
            <th>Specialty</th>
            <th>Hospital</th>
            <th>Phone</th>
            <th>Patients</th>
            <th>Referred</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((doctor) => (
            <tr key={doctor.id} className="is-clickable" onClick={() => navigate(`/doctors/${doctor.id}`)}>
              <td>
                <div className="d-flex align-center gap-3">
                  <Avatar name={doctor.name} />
                  <div>
                    <div className="fw-550">{doctor.name}</div>
                    <div className="text-xs text-subtle">{doctor.qualification || '—'}</div>
                  </div>
                </div>
              </td>
              <td>{doctor.specialization || '—'}</td>
              <td>{doctor.hospital || '—'}</td>
              <td>{doctor.phone || '—'}</td>
              <td>{doctor.patient_count}</td>
              <td>{formatMoney(doctor.referred_revenue, currency)}</td>
              <td>{doctor.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</td>
              <td className="nowrap" onClick={(event) => event.stopPropagation()}>
                <Can permission="doctors.edit"><Button variant="ghost" size="xs" icon="edit" onClick={() => openEdit(doctor)}>Edit</Button></Can>
                <Can permission="doctors.delete"><Button variant="ghost" size="xs" icon="trash" onClick={() => remove(doctor)}>Delete</Button></Can>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit doctor' : 'Add referring doctor'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={save}>{editing ? 'Save' : 'Add doctor'}</Button>
          </>
        }
      >
        {formError && <div className="mb-3"><Alert tone="danger">{formError}</Alert></div>}
        <form className="form-grid" onSubmit={save}>
          <Field label="Name" required className="span-2">
            <Input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} autoFocus />
          </Field>
          <Field label="Qualification">
            <Input value={form.qualification} onChange={(e) => setForm((c) => ({ ...c, qualification: e.target.value }))} />
          </Field>
          <Field label="Specialization">
            <Input value={form.specialization} onChange={(e) => setForm((c) => ({ ...c, specialization: e.target.value }))} />
          </Field>
          <Field label="Hospital">
            <Input value={form.hospital} onChange={(e) => setForm((c) => ({ ...c, hospital: e.target.value }))} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} />
          </Field>
          <Field label="Commission %">
            <Input type="number" min="0" max="100" value={form.commission_percent} onChange={(e) => setForm((c) => ({ ...c, commission_percent: e.target.value }))} />
          </Field>
          <Field label="Address" className="span-2">
            <Input value={form.address} onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))} />
          </Field>
          <Field label="Notes" className="span-full">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} />
          </Field>
          <Field label="Active" className="span-full">
            <Switch checked={form.is_active} onChange={(checked) => setForm((c) => ({ ...c, is_active: checked }))} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
