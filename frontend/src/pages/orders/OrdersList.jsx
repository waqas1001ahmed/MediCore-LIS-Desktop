import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useFetch } from '../../hooks/useApi.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Can } from '../../components/RouteGuards.jsx';
import {
  Alert, Badge, Button, EmptyState, Pagination, SearchInput, Select, StatusBadge, TableShell,
} from '../../components/ui/index.jsx';
import { ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS } from '../../utils/constants.js';
import { formatDateTime, formatMoney } from '../../utils/format.js';

export default function OrdersList() {
  const navigate = useNavigate();
  const { currency } = useSettings();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const [status, setStatus] = useState(params.get('status') || '');
  const [payment, setPayment] = useState(params.get('payment_status') || '');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const debounced = useDebounce(search);

  const query = useMemo(
    () => ({ search: debounced, status, payment_status: payment, page, limit }),
    [debounced, status, payment, page, limit],
  );

  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get('/orders', { params: query });
    return payload;
  }, [query.search, query.status, query.payment_status, query.page, query.limit]);

  const rows = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit, pages: 1 };

  const applyFilter = (key, value, setter) => {
    setter(value);
    setPage(1);
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="page">
      <PageHeader
        icon="clipboard"
        title="Test orders"
        subtitle="Register samples, track workflow and collect payments."
        actions={
          <Can permission="orders.create">
            <Button variant="primary" icon="plus" onClick={() => navigate('/orders/new')}>New order</Button>
          </Can>
        }
      />

      <div className="toolbar">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} onClear={() => setSearch('')} placeholder="Search order no, patient, doctor…" />
        <Select value={status} onChange={(e) => applyFilter('status', e.target.value, setStatus)} options={[{ value: '', label: 'All statuses' }, ...ORDER_STATUS_OPTIONS]} style={{ width: 180 }} />
        <Select value={payment} onChange={(e) => applyFilter('payment_status', e.target.value, setPayment)} options={[{ value: '', label: 'All payments' }, ...PAYMENT_STATUS_OPTIONS]} style={{ width: 160 }} />
        <Button variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <TableShell
        loading={loading}
        empty={!rows.length ? <EmptyState icon="clipboard" title="No orders found" action={<Can permission="orders.create"><Button variant="primary" onClick={() => navigate('/orders/new')}>Create order</Button></Can>} /> : null}
        footer={<Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={meta.limit} onPageChange={setPage} onLimitChange={(value) => { setLimit(value); setPage(1); }} />}
      >
        <thead>
          <tr>
            <th>Order</th>
            <th>Patient</th>
            <th>Doctor</th>
            <th>Tests</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Payment</th>
            <th>Total</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id} className="is-clickable" onClick={() => navigate(`/orders/${order.id}`)}>
              <td>
                <div className="mono">{order.order_no}</div>
                {order.report_no && <div className="text-xs text-subtle">{order.report_no}</div>}
              </td>
              <td>
                <div className="fw-550">{order.patient_name}</div>
                <div className="text-xs text-subtle">{order.patient_code}</div>
              </td>
              <td>{order.doctor_name || 'Walk-in'}</td>
              <td>{order.test_count}</td>
              <td>{order.priority === 'urgent' ? <Badge tone="danger">Urgent</Badge> : <Badge>Routine</Badge>}</td>
              <td><StatusBadge status={order.status} /></td>
              <td>
                <StatusBadge status={order.payment_status} />
                {order.balance > 0 && <div className="text-xs text-subtle">Bal {formatMoney(order.balance, currency)}</div>}
              </td>
              <td className="fw-550">{formatMoney(order.total, currency)}</td>
              <td className="text-xs text-muted">{formatDateTime(order.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
