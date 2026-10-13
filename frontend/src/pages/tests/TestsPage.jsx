import { useState } from 'react';
import { api, apiError } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useFetch } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../components/ui/Confirm.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Can } from '../../components/RouteGuards.jsx';
import {
  Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Modal,
  Pagination, SearchInput, Select, Switch, TableShell, Tabs, Textarea,
} from '../../components/ui/index.jsx';
import { formatMoney } from '../../utils/format.js';

const EMPTY_TEST = {
  code: '', name: '', category_id: '', price: '', cost: '', sample_type: '', unit: '',
  reference_range: '', method: '', turnaround_hours: 24, is_active: true,
};
const EMPTY_CAT = { name: '', description: '', color: '#1f7a8c', sort_order: 0, is_active: true };

export default function TestsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { currency } = useSettings();
  const [tab, setTab] = useState('tests');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [testModal, setTestModal] = useState(false);
  const [catModal, setCatModal] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [testForm, setTestForm] = useState(EMPTY_TEST);
  const [catForm, setCatForm] = useState(EMPTY_CAT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const debounced = useDebounce(search);

  const { data: categories, reload: reloadCats } = useFetch(async () => {
    const { data: payload } = await api.get('/tests/categories');
    return payload.data;
  }, []);

  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get('/tests', {
      params: { search: debounced, category_id: categoryId || undefined, page, limit },
    });
    return payload;
  }, [debounced, categoryId, page, limit]);

  const rows = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit, pages: 1 };
  const cats = categories || [];

  const openTest = (test = null) => {
    setEditingTest(test);
    setTestForm(test ? {
      code: test.code, name: test.name, category_id: test.category_id || '',
      price: test.price, cost: test.cost || 0, sample_type: test.sample_type || '',
      unit: test.unit || '', reference_range: test.reference_range || '',
      method: test.method || '', turnaround_hours: test.turnaround_hours || 24,
      is_active: !!test.is_active,
    } : EMPTY_TEST);
    setFormError(null);
    setTestModal(true);
  };

  const openCat = (cat = null) => {
    setEditingCat(cat);
    setCatForm(cat ? {
      name: cat.name, description: cat.description || '', color: cat.color || '#1f7a8c',
      sort_order: cat.sort_order || 0, is_active: !!cat.is_active,
    } : EMPTY_CAT);
    setFormError(null);
    setCatModal(true);
  };

  const saveTest = async (event) => {
    event?.preventDefault();
    if (!testForm.code.trim() || !testForm.name.trim()) {
      setFormError('Code and name are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = { ...testForm, category_id: testForm.category_id || null, price: Number(testForm.price || 0), cost: Number(testForm.cost || 0) };
    try {
      if (editingTest) await api.put(`/tests/${editingTest.id}`, payload);
      else await api.post('/tests', payload);
      toast.success(editingTest ? 'Test updated' : 'Test created');
      setTestModal(false);
      reload();
    } catch (saveError) {
      setFormError(apiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const saveCat = async (event) => {
    event?.preventDefault();
    if (!catForm.name.trim()) {
      setFormError('Category name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingCat) await api.put(`/tests/categories/${editingCat.id}`, catForm);
      else await api.post('/tests/categories', catForm);
      toast.success(editingCat ? 'Category updated' : 'Category created');
      setCatModal(false);
      reloadCats();
    } catch (saveError) {
      setFormError(apiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const removeTest = async (test) => {
    const ok = await confirm({ title: `Delete ${test.name}?`, message: 'Tests used on existing orders cannot be deleted. Deactivate them instead.', tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.delete(`/tests/${test.id}`);
      toast.success('Test deleted');
      reload();
    } catch (deleteError) {
      toast.error('Unable to delete', apiError(deleteError));
    }
  };

  const removeCat = async (cat) => {
    const ok = await confirm({ title: `Delete ${cat.name}?`, message: 'Move or delete tests in this category first.', tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.delete(`/tests/categories/${cat.id}`);
      toast.success('Category deleted');
      reloadCats();
    } catch (deleteError) {
      toast.error('Unable to delete', apiError(deleteError));
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="flask"
        title="Test catalogue"
        subtitle="Prices, sample types, units and reference ranges."
        actions={
          tab === 'tests'
            ? <Can permission="tests.create"><Button variant="primary" icon="plus" onClick={() => openTest()}>Add test</Button></Can>
            : <Can permission="tests.create"><Button variant="primary" icon="plus" onClick={() => openCat()}>Add category</Button></Can>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'tests', label: 'Tests', count: meta.total },
          { value: 'categories', label: 'Categories', count: cats.length },
        ]}
      />

      {tab === 'tests' && (
        <>
          <div className="toolbar">
            <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} onClear={() => setSearch('')} placeholder="Search code, name, range…" />
            <Select
              value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
              options={[{ value: '', label: 'All categories' }, ...cats.map((cat) => ({ value: cat.id, label: cat.name }))]}
              style={{ width: 200 }}
            />
            <Button variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <TableShell
            loading={loading}
            empty={!rows.length ? <EmptyState icon="flask" title="No tests found" /> : null}
            footer={<Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} onLimitChange={(value) => { setLimit(value); setPage(1); }} />}
          >
            <thead>
              <tr>
                <th>Code</th>
                <th>Test</th>
                <th>Category</th>
                <th>Sample</th>
                <th>Unit</th>
                <th>Reference</th>
                <th>Price</th>
                <th>TAT</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((test) => (
                <tr key={test.id}>
                  <td className="mono">{test.code}</td>
                  <td className="fw-550">{test.name}</td>
                  <td>{test.category_name || '—'}</td>
                  <td>{test.sample_type || '—'}</td>
                  <td>{test.unit || '—'}</td>
                  <td className="text-xs">{test.reference_range || '—'}</td>
                  <td>{formatMoney(test.price, currency)}</td>
                  <td>{test.turnaround_hours}h</td>
                  <td>{test.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                  <td className="nowrap">
                    <Can permission="tests.edit"><Button variant="ghost" size="xs" icon="edit" onClick={() => openTest(test)}>Edit</Button></Can>
                    <Can permission="tests.delete"><Button variant="ghost" size="xs" icon="trash" onClick={() => removeTest(test)}>Delete</Button></Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </>
      )}

      {tab === 'categories' && (
        <TableShell empty={!cats.length ? <EmptyState icon="layers" title="No categories" /> : null}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Description</th>
              <th>Tests</th>
              <th>Order</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cats.map((cat) => (
              <tr key={cat.id}>
                <td>
                  <div className="d-flex align-center gap-3">
                    <span className="theme-swatch" style={{ background: cat.color || '#1f7a8c', cursor: 'default' }} />
                    <span className="fw-550">{cat.name}</span>
                  </div>
                </td>
                <td className="text-sm text-muted">{cat.description || '—'}</td>
                <td>{cat.test_count}</td>
                <td>{cat.sort_order}</td>
                <td>{cat.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                <td className="nowrap">
                  <Can permission="tests.edit"><Button variant="ghost" size="xs" icon="edit" onClick={() => openCat(cat)}>Edit</Button></Can>
                  <Can permission="tests.delete"><Button variant="ghost" size="xs" icon="trash" onClick={() => removeCat(cat)}>Delete</Button></Can>
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Modal open={testModal} onClose={() => setTestModal(false)} title={editingTest ? 'Edit test' : 'Add test'} size="lg" footer={<><Button variant="ghost" onClick={() => setTestModal(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={saveTest}>Save</Button></>}>
        {formError && <div className="mb-3"><Alert tone="danger">{formError}</Alert></div>}
        <form className="form-grid" onSubmit={saveTest}>
          <Field label="Code" required><Input value={testForm.code} onChange={(e) => setTestForm((c) => ({ ...c, code: e.target.value.toUpperCase() }))} /></Field>
          <Field label="Name" required className="span-2"><Input value={testForm.name} onChange={(e) => setTestForm((c) => ({ ...c, name: e.target.value }))} /></Field>
          <Field label="Category">
            <Select value={testForm.category_id} onChange={(e) => setTestForm((c) => ({ ...c, category_id: e.target.value }))} options={[{ value: '', label: 'Uncategorised' }, ...cats.map((cat) => ({ value: cat.id, label: cat.name }))]} />
          </Field>
          <Field label="Price"><Input type="number" min="0" step="0.01" value={testForm.price} onChange={(e) => setTestForm((c) => ({ ...c, price: e.target.value }))} /></Field>
          <Field label="Cost"><Input type="number" min="0" step="0.01" value={testForm.cost} onChange={(e) => setTestForm((c) => ({ ...c, cost: e.target.value }))} /></Field>
          <Field label="Sample type"><Input value={testForm.sample_type} onChange={(e) => setTestForm((c) => ({ ...c, sample_type: e.target.value }))} /></Field>
          <Field label="Unit"><Input value={testForm.unit} onChange={(e) => setTestForm((c) => ({ ...c, unit: e.target.value }))} /></Field>
          <Field label="Turnaround (hours)"><Input type="number" min="0" value={testForm.turnaround_hours} onChange={(e) => setTestForm((c) => ({ ...c, turnaround_hours: e.target.value }))} /></Field>
          <Field label="Method"><Input value={testForm.method} onChange={(e) => setTestForm((c) => ({ ...c, method: e.target.value }))} /></Field>
          <Field label="Reference range" className="span-full"><Input value={testForm.reference_range} onChange={(e) => setTestForm((c) => ({ ...c, reference_range: e.target.value }))} placeholder="e.g. 13.0 – 17.0" /></Field>
          <Field label="Active" className="span-full"><Switch checked={testForm.is_active} onChange={(checked) => setTestForm((c) => ({ ...c, is_active: checked }))} /></Field>
        </form>
      </Modal>

      <Modal open={catModal} onClose={() => setCatModal(false)} title={editingCat ? 'Edit category' : 'Add category'} footer={<><Button variant="ghost" onClick={() => setCatModal(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={saveCat}>Save</Button></>}>
        {formError && <div className="mb-3"><Alert tone="danger">{formError}</Alert></div>}
        <form className="form-grid" onSubmit={saveCat}>
          <Field label="Name" required className="span-full"><Input value={catForm.name} onChange={(e) => setCatForm((c) => ({ ...c, name: e.target.value }))} /></Field>
          <Field label="Description" className="span-full"><Textarea rows={2} value={catForm.description} onChange={(e) => setCatForm((c) => ({ ...c, description: e.target.value }))} /></Field>
          <Field label="Colour"><Input type="color" value={catForm.color} onChange={(e) => setCatForm((c) => ({ ...c, color: e.target.value }))} /></Field>
          <Field label="Sort order"><Input type="number" value={catForm.sort_order} onChange={(e) => setCatForm((c) => ({ ...c, sort_order: e.target.value }))} /></Field>
          <Field label="Active" className="span-full"><Switch checked={catForm.is_active} onChange={(checked) => setCatForm((c) => ({ ...c, is_active: checked }))} /></Field>
        </form>
      </Modal>
    </div>
  );
}
