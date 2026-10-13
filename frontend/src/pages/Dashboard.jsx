import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFetch } from '../hooks/useApi.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Can } from '../components/RouteGuards.jsx';
import {
  Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, LoadingBlock,
  StatCard, StatusBadge, TableShell,
} from '../components/ui/index.jsx';
import { formatDateTime, formatMoney, formatNumber, relativeTime, titleCase } from '../utils/format.js';

function MiniBars({ rows, valueKey, labelKey }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));
  return (
    <div className="mini-chart">
      {rows.map((row) => {
        const value = Number(row[valueKey] || 0);
        const height = Math.max(4, Math.round((value / max) * 72));
        const label = String(row[labelKey] || '').slice(5);
        return (
          <div className="bar-col" key={row[labelKey]} title={`${row[labelKey]}: ${value}`}>
            <div className="bar" style={{ height }} />
            <span className="bar-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function StackList({ rows, labelKey, valueKey, format }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));
  if (!rows.length) return <p className="text-sm text-muted">No data for this period.</p>;
  return (
    <div className="stack-bars">
      {rows.map((row) => {
        const value = Number(row[valueKey] || 0);
        return (
          <div className="stack-row" key={row[labelKey]}>
            <span className="stack-label" title={row[labelKey]}>{row[labelKey]}</span>
            <div className="stack-track"><div className="stack-fill" style={{ width: `${(value / max) * 100}%` }} /></div>
            <span className="stack-value">{format ? format(value) : value}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { currency } = useSettings();
  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get('/dashboard');
    return payload.data;
  }, []);

  if (loading && !data) return <LoadingBlock label="Loading dashboard…" />;
  if (error) return <Alert tone="danger" title="Unable to load dashboard">{error}</Alert>;
  if (!data) return null;

  const money = (value) => formatMoney(value, currency);

  return (
    <div className="page">
      <PageHeader
        icon="dashboard"
        title="Dashboard"
        subtitle="Live laboratory operations, collections and outstanding work."
        actions={
          <>
            <Button variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>
            <Can permission="orders.create">
              <Button variant="primary" icon="plus" onClick={() => navigate('/orders/new')}>New order</Button>
            </Can>
          </>
        }
      />

      <div className="grid grid-4">
        <StatCard label="Patients today" value={formatNumber(data.patients.today)} meta={`${formatNumber(data.patients.total)} registered`} icon="users" tone="brand" onClick={() => navigate('/patients')} />
        <StatCard label="Orders today" value={formatNumber(data.orders.today)} meta={`${formatNumber(data.orders.pending)} in progress`} icon="clipboard" tone="info" onClick={() => navigate('/orders')} />
        <StatCard label="Collected today" value={money(data.revenue.today)} meta={`${money(data.revenue.this_month)} this month`} icon="dollar-sign" tone="success" onClick={() => navigate('/revenue')} />
        <StatCard label="Outstanding" value={money(data.orders.outstanding)} meta={`${formatNumber(data.orders.unpaid)} unpaid · ${formatNumber(data.orders.partial)} partial`} icon="alert-triangle" tone="warning" onClick={() => navigate('/orders?payment_status=unpaid')} />
      </div>

      <div className="grid grid-4">
        <StatCard label="Tests processed" value={formatNumber(data.tests.total)} meta={`${formatNumber(data.tests.today)} today`} icon="flask" />
        <StatCard label="Reports" value={formatNumber(data.reports.total)} meta={`${formatNumber(data.reports.pending)} draft · ${formatNumber(data.reports.completed)} signed`} icon="file-text" onClick={() => navigate('/reports')} />
        <StatCard label="This month" value={money(data.revenue.this_month)} meta={`${formatNumber(data.orders.this_month)} orders`} icon="trending-up" />
        <StatCard label="Year to date" value={money(data.revenue.this_year)} icon="bar-chart" />
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHeader title="Collections (14 days)" subtitle="Payments received" />
          <CardBody>
            <MiniBars rows={data.revenue_trend} valueKey="collected" labelKey="day" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Orders (14 days)" />
          <CardBody>
            <MiniBars rows={data.order_trend} valueKey="orders" labelKey="day" />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHeader title="Top tests this month" />
          <CardBody>
            <StackList rows={data.top_tests} labelKey="test_name" valueKey="count" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Payment mix" />
          <CardBody>
            <StackList
              rows={data.payment_breakdown.map((row) => ({ label: titleCase(row.status), amount: row.balance, count: row.count }))}
              labelKey="label"
              valueKey="count"
            />
            <div className="legend-inline mt-3">
              {data.status_breakdown.map((row) => (
                <span key={row.status}><Badge tone="neutral">{titleCase(row.status)}</Badge> {row.count}</span>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card className="card-flush">
          <CardHeader title="Recent orders" actions={<Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>View all</Button>} />
          <TableShell
            empty={!data.recent_orders.length ? <EmptyState icon="clipboard" title="No orders yet" /> : null}
            colSpan={5}
          >
            <thead>
              <tr>
                <th>Order</th>
                <th>Patient</th>
                <th>Status</th>
                <th>Total</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_orders.map((order) => (
                <tr key={order.id} className="is-clickable" onClick={() => navigate(`/orders/${order.id}`)}>
                  <td>
                    <div className="mono">{order.order_no}</div>
                    <div className="text-xs text-subtle">{order.test_count} tests</div>
                  </td>
                  <td>
                    <div className="fw-550">{order.patient_name}</div>
                    <div className="text-xs text-subtle">{order.patient_code}</div>
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                    {order.priority === 'urgent' && <Badge tone="danger" className="ml-2">Urgent</Badge>}
                  </td>
                  <td>
                    <div>{money(order.total)}</div>
                    <StatusBadge status={order.payment_status} />
                  </td>
                  <td className="text-xs text-muted">{relativeTime(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>

        <Card className="card-flush">
          <CardHeader title="Recent activity" />
          <TableShell
            empty={!data.recent_activity.length ? <EmptyState icon="activity" title="No activity yet" /> : null}
            colSpan={3}
          >
            <thead>
              <tr>
                <th>Event</th>
                <th>User</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_activity.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="fw-550">{item.description || `${item.action} ${item.module}`}</div>
                    <div className="text-xs text-subtle">{item.module} · {item.action}</div>
                  </td>
                  <td className="text-sm">{item.username || '—'}</td>
                  <td className="text-xs text-muted nowrap" title={formatDateTime(item.created_at)}>{relativeTime(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>
      </div>
    </div>
  );
}
