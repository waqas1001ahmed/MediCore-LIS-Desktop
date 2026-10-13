import { useMemo, useState } from 'react';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../components/ui/Confirm.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { hasPermission } from '../../utils/permissions.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Can } from '../../components/RouteGuards.jsx';
import {
  Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, Field,
  Input, LoadingBlock, Modal, Textarea,
} from '../../components/ui/index.jsx';

const EMPTY = { name: '', label: '', description: '', permissions: [] };

export default function RolesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const canManage = hasPermission(user, 'roles.manage');
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [draft, setDraft] = useState([]);
  const [dirty, setDirty] = useState(false);

  const { data: groups, loading: groupsLoading } = useFetch(async () => {
    const { data: payload } = await api.get('/roles/permissions');
    return payload.data;
  }, []);

  const { data: roles, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get('/roles');
    return payload.data;
  }, []);

  const selected = useMemo(() => {
    if (!roles?.length) return null;
    return roles.find((role) => role.id === selectedId) || roles[0];
  }, [roles, selectedId]);

  const catalogue = groups || [];
  const allCodes = useMemo(() => catalogue.flatMap((group) => group.permissions.map((p) => p.code)), [catalogue]);
  const currentCodes = dirty ? draft : (selected?.permissions || []);
  const currentSet = useMemo(() => new Set(currentCodes), [currentCodes]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (role) => {
    setEditing(role);
    setForm({ name: role.name, label: role.label, description: role.description || '', permissions: role.permissions });
    setFormError(null);
    setModalOpen(true);
  };

  const saveRole = async (event) => {
    event?.preventDefault();
    if (!form.label.trim() || (!editing && !form.name.trim())) {
      setFormError('Role key and label are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await api.put(`/roles/${editing.id}`, { label: form.label, description: form.description });
        toast.success('Role updated');
      } else {
        const { data: payload } = await api.post('/roles', form);
        setSelectedId(payload.data.id);
        toast.success('Role created');
      }
      setModalOpen(false);
      reload();
    } catch (saveError) {
      setFormError(apiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const savePermissions = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/roles/${selected.id}`, {
        label: selected.label,
        description: selected.description,
        permissions: dirty ? draft : selected.permissions,
      });
      toast.success('Permissions saved');
      setDirty(false);
      reload();
    } catch (saveError) {
      toast.error('Unable to save', apiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const toggleCode = (code) => {
    const next = currentSet.has(code) ? currentCodes.filter((item) => item !== code) : [...currentCodes, code];
    setDraft(next);
    setDirty(true);
  };

  const toggleGroup = (group) => {
    const codes = group.permissions.map((p) => p.code);
    const allOn = codes.every((code) => currentSet.has(code));
    const next = allOn
      ? currentCodes.filter((code) => !codes.includes(code))
      : [...new Set([...currentCodes, ...codes])];
    setDraft(next);
    setDirty(true);
  };

  const setAll = (on) => {
    setDraft(on ? [...allCodes] : []);
    setDirty(true);
  };

  const remove = async (role) => {
    const ok = await confirm({
      title: `Delete ${role.label}?`,
      message: role.user_count
        ? `This role still has ${role.user_count} user(s). Reassign them first.`
        : 'Built-in roles cannot be deleted. Custom roles with no users can be removed.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.delete(`/roles/${role.id}`);
      toast.success('Role deleted');
      setSelectedId(null);
      setDirty(false);
      reload();
    } catch (deleteError) {
      toast.error('Unable to delete', apiError(deleteError));
    }
  };

  const selectRole = (role) => {
    if (dirty && selected && role.id !== selected.id) {
      setDirty(false);
      setDraft([]);
    }
    setSelectedId(role.id);
  };

  if ((loading || groupsLoading) && !roles) return <LoadingBlock label="Loading roles…" />;

  return (
    <div className="page">
      <PageHeader
        icon="shield"
        title="Roles & permissions"
        subtitle="Control what each staff role can view and change."
        actions={
          <Can permission="roles.manage">
            <Button variant="primary" icon="plus" onClick={openCreate}>New role</Button>
          </Can>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid grid-2" style={{ alignItems: 'start', gridTemplateColumns: 'minmax(240px, 320px) 1fr' }}>
        <Card className="card-flush">
          <CardHeader title="Roles" subtitle={`${roles?.length || 0} defined`} />
          <div className="catalog-list" style={{ padding: 12, maxHeight: 'none' }}>
            {(roles || []).map((role) => (
              <button
                type="button"
                key={role.id}
                className={`catalog-item ${selected?.id === role.id ? 'is-added' : ''}`}
                onClick={() => selectRole(role)}
                style={selected?.id === role.id ? { opacity: 1, borderColor: 'var(--brand-500)', cursor: 'pointer' } : undefined}
              >
                <div className="flex-1">
                  <div className="fw-550">{role.label}</div>
                  <div className="text-xs text-subtle">{role.name} · {role.user_count} user{role.user_count === 1 ? '' : 's'}</div>
                </div>
                {role.is_system ? <Badge>System</Badge> : <Badge tone="info">Custom</Badge>}
              </button>
            ))}
            {!roles?.length && <EmptyState icon="shield" title="No roles" />}
          </div>
        </Card>

        <Card>
          {selected ? (
            <>
              <CardHeader
                title={selected.label}
                subtitle={selected.description || selected.name}
                actions={
                  <Can permission="roles.manage">
                    <Button variant="ghost" size="sm" icon="edit" onClick={() => openEdit(selected)}>Rename</Button>
                    {!selected.is_system && (
                      <Button variant="ghost" size="sm" icon="trash" onClick={() => remove(selected)}>Delete</Button>
                    )}
                  </Can>
                }
              />
              <CardBody>
                <div className="d-flex align-center justify-between flex-wrap gap-3 mb-4">
                  <div className="text-sm text-muted">
                    {currentCodes.length} of {allCodes.length} permissions
                    {dirty ? ' · unsaved' : ''}
                  </div>
                  <Can permission="roles.manage">
                    <div className="d-flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setAll(true)}>Grant all</Button>
                      <Button variant="ghost" size="sm" onClick={() => setAll(false)}>Clear</Button>
                      <Button variant="primary" size="sm" icon="save" loading={saving} disabled={!dirty} onClick={savePermissions}>Save</Button>
                    </div>
                  </Can>
                </div>

                <div className="permission-grid">
                  {catalogue.map((group) => {
                    const codes = group.permissions.map((p) => p.code);
                    const granted = codes.filter((code) => currentSet.has(code)).length;
                    return (
                      <div className="permission-group" key={group.module}>
                        <div className="permission-group-head">
                          <span>{group.label}</span>
                          <Can permission="roles.manage" fallback={<span className="text-xs text-subtle">{granted}/{codes.length}</span>}>
                            <button type="button" className="btn btn-ghost btn-xs" onClick={() => toggleGroup(group)}>
                              {granted === codes.length ? 'Clear module' : `Select all (${granted}/${codes.length})`}
                            </button>
                          </Can>
                        </div>
                        <div className="permission-group-body">
                          {group.permissions.map((permission) => (
                            <div className="permission-item" key={permission.code}>
                              <Checkbox
                                checked={currentSet.has(permission.code)}
                                disabled={saving || !canManage}
                                onChange={() => toggleCode(permission.code)}
                              />
                              <span>
                                <span className="pid">{permission.label}</span>
                                <div className="pcode">{permission.code}</div>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </>
          ) : (
            <EmptyState icon="shield" title="Select a role" />
          )}
        </Card>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit role' : 'New role'}
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={saveRole}>Save</Button></>}
      >
        {formError && <div className="mb-3"><Alert tone="danger">{formError}</Alert></div>}
        <form className="form-grid" onSubmit={saveRole}>
          {!editing && (
            <Field label="Role key" required hint="Lowercase, 3–32 characters (a-z, 0-9, _).">
              <Input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="lab_supervisor" />
            </Field>
          )}
          <Field label="Display name" required className={editing ? 'span-full' : ''}>
            <Input value={form.label} onChange={(e) => setForm((c) => ({ ...c, label: e.target.value }))} />
          </Field>
          <Field label="Description" className="span-full">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
