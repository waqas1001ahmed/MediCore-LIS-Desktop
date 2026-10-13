import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useFetch } from '../../hooks/useApi.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import {
  Alert, Button, EmptyState, Pagination, SearchInput, Select, StatusBadge, TableShell, Tabs,
} from '../../components/ui/index.jsx';
import { REPORT_STATUS_OPTIONS } from '../../utils/constants.js';
import { formatDateTime } from '../../utils/format.js';

export default function ReportsList() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const debounced = useDebounce(search);

  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get('/reports', {
      params: { search: debounced, status: status || undefined, page, limit },
    });
    return payload;
  }, [debounced, status, page, limit]);

  const { data: pending } = useFetch(async () => {
    const { data: payload } = await api.get('/reports/pending');
    return payload.data;
  }, []);

  const rows = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit, pages: 1 };

  return (
    <div className="page">
      <PageHeader
        icon="file-text"
        title="Laboratory reports"
        subtitle="Generate, verify, finalise and print A4 investigation reports."
        actions={<Button variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All reports', count: meta.total },
          { value: 'pending', label: 'Ready to generate', count: (pending || []).length },
        ]}
      />

      {tab === 'pending' ? (
        <TableShell empty={!(pending || []).length ? <EmptyState icon="file-check" title="Nothing waiting" description="Orders with entered results appear here until a verified report exists." /> : null}>
          <thead>
            <tr>
              <th>Order</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Progress</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {(pending || []).map((row) => (
              <tr key={row.id} className="is-clickable" onClick={() => navigate(row.report_id ? `/reports/${row.report_id}` : `/orders/${row.id}`)}>
                <td className="mono">{row.order_no}</td>
                <td>
                  <div className="fw-550">{row.patient_name}</div>
                  <div className="text-xs text-subtle">{row.patient_code}</div>
                </td>
                <td>{row.doctor_name || '—'}</td>
                <td>{row.done_count}/{row.test_count} results</td>
                <td className="text-xs text-muted">{formatDateTime(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      ) : (
        <>
          <div className="toolbar">
            <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} onClear={() => setSearch('')} placeholder="Search report, order, patient…" />
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: '', label: 'All statuses' }, ...REPORT_STATUS_OPTIONS]} style={{ width: 180 }} />
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <TableShell
            loading={loading}
            empty={!rows.length ? <EmptyState icon="file-text" title="No reports yet" /> : null}
            footer={<Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} onLimitChange={(value) => { setLimit(value); setPage(1); }} />}
          >
            <thead>
              <tr>
                <th>Report</th>
                <th>Order</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Tests</th>
                <th>Status</th>
                <th>Verified by</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((report) => (
                <tr key={report.id} className="is-clickable" onClick={() => navigate(`/reports/${report.id}`)}>
                  <td className="mono">{report.report_no}</td>
                  <td className="mono">{report.order_no}</td>
                  <td>
                    <div className="fw-550">{report.patient_name}</div>
                    <div className="text-xs text-subtle">{report.patient_code}</div>
                  </td>
                  <td>{report.doctor_name || '—'}</td>
                  <td>{report.verified_tests}/{report.total_tests}</td>
                  <td><StatusBadge status={report.status} /></td>
                  <td>{report.verified_by_name || '—'}</td>
                  <td className="text-xs text-muted">{formatDateTime(report.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </>
      )}
    </div>
  );
}
