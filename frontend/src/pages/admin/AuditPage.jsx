import { useState } from 'react';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useFetch } from '../../hooks/useApi.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import {
  Alert, Badge, Button, EmptyState, Input, Pagination, SearchInput, Select, TableShell,
} from '../../components/ui/index.jsx';
import { formatDateTime, titleCase } from '../../utils/format.js';

const ACTION_TONE = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  login: 'brand',
  logout: 'neutral',
  reset_password: 'warning',
  print: 'info',
  verify: 'success',
  finalize: 'brand',
  void: 'danger',
};

export default function AuditPage() {
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const debounced = useDebounce(search);

  const { data: facets } = useFetch(async () => {
    const { data: payload } = await api.get('/audit-logs/facets');
    return payload.data;
  }, []);

  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get('/audit-logs', {
      params: { search: debounced, module, action, user_id: userId, from, to, page, limit },
    });
    return payload;
  }, [debounced, module, action, userId, from, to, page, limit]);

  const rows = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit, pages: 1 };

  const resetFilters = () => {
    setSearch('');
    setModule('');
    setAction('');
    setUserId('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <div className="page">
      <PageHeader
        icon="activity"
        title="Audit log"
        subtitle={facets?.total ? `${facets.total} recorded events${facets.since ? ` since ${formatDateTime(facets.since)}` : ''}` : 'Staff actions across the laboratory.'}
        actions={<Button variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="toolbar">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} onClear={() => setSearch('')} placeholder="Search description, user, entity…" />
        <Select
          value={module}
          onChange={(e) => { setModule(e.target.value); setPage(1); }}
          placeholder="All modules"
          options={(facets?.modules || []).map((item) => ({ value: item, label: titleCase(item) }))}
        />
        <Select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          placeholder="All actions"
          options={(facets?.actions || []).map((item) => ({ value: item, label: titleCase(item) }))}
        />
        <Select
          value={userId}
          onChange={(e) => { setUserId(e.target.value); setPage(1); }}
          placeholder="All users"
          options={(facets?.users || []).map((user) => ({ value: user.id, label: user.username }))}
        />
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From date" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To date" />
        <Button variant="ghost" onClick={resetFilters}>Reset</Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <TableShell
        loading={loading}
        empty={!rows.length ? <EmptyState icon="activity" title="No audit events" description="Try a different date range or clear filters." /> : null}
        footer={<Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} onLimitChange={(value) => { setLimit(value); setPage(1); }} />}
      >
        <thead>
          <tr>
            <th>When</th>
            <th>User</th>
            <th>Action</th>
            <th>Module</th>
            <th>Entity</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="nowrap text-xs text-muted">{formatDateTime(row.created_at)}</td>
              <td>
                <div className="fw-550">{row.user_full_name || row.username || 'System'}</div>
                <div className="text-xs text-subtle">{row.username || ''}</div>
              </td>
              <td><Badge tone={ACTION_TONE[row.action] || 'neutral'}>{titleCase(row.action)}</Badge></td>
              <td>{titleCase(row.module)}</td>
              <td className="mono">{row.entity}{row.entity_id ? ` #${row.entity_id}` : ''}</td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
