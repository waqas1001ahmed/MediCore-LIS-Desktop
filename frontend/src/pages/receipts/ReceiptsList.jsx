import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useFetch } from '../../hooks/useApi.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import {
  Alert, Button, EmptyState, Pagination, SearchInput, Select, StatusBadge, TableShell,
} from '../../components/ui/index.jsx';
import { PAYMENT_METHOD_OPTIONS } from '../../utils/constants.js';
import { formatDateTime, formatMoney, titleCase } from '../../utils/format.js';

export default function ReceiptsList() {
  const navigate = useNavigate();
  const { currency } = useSettings();
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const debounced = useDebounce(search);

  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get('/receipts', {
      params: { search: debounced, method: method || undefined, status: status || undefined, page, limit },
    });
    return payload;
  }, [debounced, method, status, page, limit]);

  const rows = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit, pages: 1 };

  return (
    <div className="page">
      <PageHeader
        icon="receipt"
        title="Receipts"
        subtitle="Payment receipts for thermal printing and audit."
        actions={<Button variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>}
      />

      <div className="toolbar">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} onClear={() => setSearch('')} placeholder="Search receipt, order, patient…" />
        <Select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} options={[{ value: '', label: 'All methods' }, ...PAYMENT_METHOD_OPTIONS]} style={{ width: 180 }} />
        <Select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          options={[{ value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'void', label: 'Void' }]}
          style={{ width: 150 }}
        />
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <TableShell
        loading={loading}
        empty={!rows.length ? <EmptyState icon="receipt" title="No receipts yet" /> : null}
        footer={<Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} onLimitChange={(value) => { setLimit(value); setPage(1); }} />}
      >
        <thead>
          <tr>
            <th>Receipt</th>
            <th>Order</th>
            <th>Patient</th>
            <th>Method</th>
            <th>Paid</th>
            <th>Balance</th>
            <th>Received by</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((receipt) => (
            <tr key={receipt.id} className="is-clickable" onClick={() => navigate(`/receipts/${receipt.id}`)}>
              <td className="mono">{receipt.receipt_no}</td>
              <td className="mono">{receipt.order_no}</td>
              <td>
                <div className="fw-550">{receipt.patient_name}</div>
                <div className="text-xs text-subtle">{receipt.patient_code}</div>
              </td>
              <td>{titleCase(receipt.payment_method)}</td>
              <td className="fw-550">{formatMoney(receipt.amount_paid, currency)}</td>
              <td>{formatMoney(receipt.balance, currency)}</td>
              <td>{receipt.received_by_name || '—'}</td>
              <td><StatusBadge status={receipt.status} /></td>
              <td className="text-xs text-muted">{formatDateTime(receipt.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
