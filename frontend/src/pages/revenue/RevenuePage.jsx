import { useState } from 'react';
import { api, TOKEN_KEY, API_BASE_URL } from '../../api/client.js';
import { useFetch } from '../../hooks/useApi.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Can } from '../../components/RouteGuards.jsx';
import {
  Alert, Button, Card, CardBody, CardHeader, EmptyState, LoadingBlock, Segmented, StatCard, TableShell,
} from '../../components/ui/index.jsx';
import { RANGE_PRESETS } from '../../utils/constants.js';
import { formatMoney, formatNumber, titleCase } from '../../utils/format.js';

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

export default function RevenuePage() {
  const { currency } = useSettings();
  const [range, setRange] = useState('month');
  const money = (value) => formatMoney(value, currency);

  const { data: overview } = useFetch(async () => {
    const { data: payload } = await api.get('/revenue/overview');
    return payload.data;
  }, []);

  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get('/revenue/summary', { params: { range } });
    return payload.data;
  }, [range]);

  const exportCsv = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const response = await fetch(`${API_BASE_URL}/revenue/export?range=${range}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `revenue_${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) return <LoadingBlock label="Loading revenue…" />;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return null;

  const totals = data.totals;

  return (
    <div className="page">
      <PageHeader
        icon="bar-chart"
        title="Revenue"
        subtitle={`${data.range.from} to ${data.range.to}`}
        actions={
          <>
            <Button variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>
            <Can permission="revenue.export">
              <Button icon="download" onClick={exportCsv}>Export CSV</Button>
            </Can>
          </>
        }
      />

      {overview && (
        <div className="grid grid-4">
          {['today', 'week', 'month', 'year'].map((preset) => (
            <StatCard
              key={preset}
              label={titleCase(preset)}
              value={money(overview[preset].collected)}
              meta={`${formatNumber(overview[preset].orders)} orders · billed ${money(overview[preset].billed)}`}
              onClick={() => setRange(preset)}
            />
          ))}
        </div>
      )}

      <Segmented options={RANGE_PRESETS} value={range} onChange={setRange} />

      <div className="grid grid-4">
        <StatCard label="Collected" value={money(totals.collected)} icon="dollar-sign" tone="success" />
        <StatCard label="Billed" value={money(totals.billed)} icon="clipboard" />
        <StatCard label="Outstanding" value={money(totals.outstanding)} icon="alert-triangle" tone="warning" />
        <StatCard label="Avg order" value={money(totals.average_order_value)} meta={`${formatNumber(totals.orders)} orders · ${formatNumber(totals.tests)} tests`} />
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHeader title="By payment method" />
          <CardBody>
            <StackList rows={data.by_method.map((row) => ({ ...row, label: titleCase(row.method) }))} labelKey="label" valueKey="amount" format={money} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="By category" />
          <CardBody>
            <StackList rows={data.by_category} labelKey="category" valueKey="amount" format={money} />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card className="card-flush">
          <CardHeader title="Top tests" />
          <TableShell empty={!data.top_tests.length ? <EmptyState icon="flask" title="No tests in this period" /> : null}>
            <thead>
              <tr>
                <th>Test</th>
                <th>Count</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.top_tests.map((row) => (
                <tr key={row.test_name}>
                  <td>{row.test_name}</td>
                  <td>{row.count}</td>
                  <td>{money(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>
        <Card className="card-flush">
          <CardHeader title="By referring doctor" />
          <TableShell empty={!data.by_doctor.length ? <EmptyState icon="stethoscope" title="No referrals" /> : null}>
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Orders</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.by_doctor.map((row) => (
                <tr key={row.doctor}>
                  <td>{row.doctor}</td>
                  <td>{row.orders}</td>
                  <td>{money(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>
      </div>

      <Card className="card-flush">
        <CardHeader title="Daily collections" />
        <TableShell empty={!data.by_day.length ? <EmptyState icon="calendar" title="No collections" /> : null}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Receipts</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.by_day.map((row) => (
              <tr key={row.day}>
                <td>{row.day}</td>
                <td>{row.count}</td>
                <td className="fw-550">{money(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Card>
    </div>
  );
}
