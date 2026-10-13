import { useState } from 'react';
import { api, apiError } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useFetch } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../components/ui/Confirm.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Can } from '../../components/RouteGuards.jsx';
import {
  Alert, Avatar, Badge, Button, Checkbox, EmptyState, Field, Input, Modal, Pagination,
  SearchInput, Select, Switch, TableShell,
} from '../../components/ui/index.jsx';
import { formatDateTime } from '../../utils/format.js';

const EMPTY = {
  username: '', password: '', full_name: '', email: '', phone: '', designation: '',
  signature_title: '', role_id: '', is_active: true, must_change_password: false,
};

export default function UsersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const debounced = useDebounce(search);

  const { data: roles } = useFetch(async () => {
    const { data: payload } = await api.get('/roles');
    return payload.data;
  }, []);

  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get('/users', { params: { search: debounced, page, limit } });
    return payload;
  }, [debounced, page, limit]);

  const rows = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit, pages: 1 };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, role_id: roles?.[0]?.id || '' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      username: user.username,
      password: '',
      full_name: user.full_name,
      email: user.email || '',
      phone: user.phone || '',
      designation: user.designation || '',
      signature_title: user.signature_title || '',
      role_id: user.role_id,
      is_active: !!user.is_active,
      must_change_password: false,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const save = async (event) => {
    event?.preventDefault();
    if (!form.full_name.trim() || !form.role_id || (!editing && (!form.username || !form.password))) {
      setFormError('Username, password, name and role are required for new users.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, form);
        toast.success('User updated');
      } else {
        await api.post('/users', form);
        toast.success('User created');
      }
      setModalOpen(false);
      reload();
    } catch (saveError) {
      setFormError(apiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (newPassword.length < 6) return;
    setSaving(true);
    try {
      await api.post(`/users/${editing.id}/reset-password`, { password: newPassword, must_change_password: true });
      toast.success('Password reset');
      setResetOpen(false);
      setNewPassword('');
    } catch (saveError) {
      toast.error('Unable to reset', apiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (user) => {
    const ok = await confirm({
      title: `Delete ${user.username}?`,
      message: 'This permanently removes the account. You cannot delete your own user.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/users/${user.id}`);
      toast.success('User deleted');
      reload();
    } catch (deleteError) {
      toast.error('Unable to delete', apiError(deleteError));
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="user-check"
        title="Users"
        subtitle="Staff accounts, roles and password resets."
        actions={<Can permission="users.create"><Button variant="primary" icon="user-plus" onClick={openCreate}>Add user</Button></Can>}
      />

      <div className="toolbar">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} onClear={() => setSearch('')} placeholder="Search username, name, email…" />
        <Button variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <TableShell
        loading={loading}
        empty={!rows.length ? <EmptyState icon="users" title="No users" /> : null}
        footer={<Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} onLimitChange={(value) => { setLimit(value); setPage(1); }} />}
      >
        <thead>
          <tr>
            <th>User</th>
            <th>Username</th>
            <th>Role</th>
            <th>Contact</th>
            <th>Last sign-in</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((user) => (
            <tr key={user.id}>
              <td>
                <div className="d-flex align-center gap-3">
                  <Avatar name={user.full_name} />
                  <div>
                    <div className="fw-550">{user.full_name}</div>
                    <div className="text-xs text-subtle">{user.designation || user.signature_title || '—'}</div>
                  </div>
                </div>
              </td>
              <td className="mono">{user.username}</td>
              <td>{user.role_label}</td>
              <td>
                <div>{user.email || '—'}</div>
                <div className="text-xs text-subtle">{user.phone || ''}</div>
              </td>
              <td className="text-xs text-muted">{formatDateTime(user.last_login_at)}</td>
              <td>{user.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
              <td className="nowrap">
                <Can permission="users.edit">
                  <Button variant="ghost" size="xs" icon="edit" onClick={() => openEdit(user)}>Edit</Button>
                  <Button variant="ghost" size="xs" icon="key" onClick={() => { setEditing(user); setNewPassword(''); setResetOpen(true); }}>Reset</Button>
                </Can>
                <Can permission="users.delete">
                  {user.id !== me?.id && (
                    <Button variant="ghost" size="xs" icon="trash" onClick={() => remove(user)}>Delete</Button>
                  )}
                </Can>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit user' : 'Add user'}
        size="lg"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Save</Button></>}
      >
        {formError && <div className="mb-3"><Alert tone="danger">{formError}</Alert></div>}
        <form className="form-grid" onSubmit={save}>
          <Field label="Username" required={!editing}>
            <Input value={form.username} disabled={!!editing} onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))} />
          </Field>
          {!editing && (
            <Field label="Password" required>
              <Input type="password" value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} />
            </Field>
          )}
          <Field label="Full name" required className="span-2">
            <Input value={form.full_name} onChange={(e) => setForm((c) => ({ ...c, full_name: e.target.value }))} />
          </Field>
          <Field label="Role" required>
            <Select value={form.role_id} onChange={(e) => setForm((c) => ({ ...c, role_id: e.target.value }))} options={(roles || []).map((role) => ({ value: role.id, label: role.label }))} />
          </Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} /></Field>
          <Field label="Designation"><Input value={form.designation} onChange={(e) => setForm((c) => ({ ...c, designation: e.target.value }))} /></Field>
          <Field label="Signature title"><Input value={form.signature_title} onChange={(e) => setForm((c) => ({ ...c, signature_title: e.target.value }))} /></Field>
          <Field label="Active" className="span-full"><Switch checked={form.is_active} onChange={(checked) => setForm((c) => ({ ...c, is_active: checked }))} /></Field>
          {!editing && (
            <Field className="span-full">
              <Checkbox label="Must change password on first sign-in" checked={form.must_change_password} onChange={(e) => setForm((c) => ({ ...c, must_change_password: e.target.checked }))} />
            </Field>
          )}
        </form>
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={`Reset password for ${editing?.username || ''}`}
        footer={<><Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={resetPassword} disabled={newPassword.length < 6}>Reset</Button></>}
      >
        <Field label="New password" required hint="At least 6 characters. The user will be asked to change it.">
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
