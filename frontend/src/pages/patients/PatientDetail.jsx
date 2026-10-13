import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useApi.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Can } from '../../components/RouteGuards.jsx';
import {
  Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, DataList, EmptyState,
  FlagBadge, LoadingBlock, StatusBadge, TableShell, Tabs,
} from '../../components/ui/index.jsx';
import { ageLabel, formatDateTime, formatMoney, titleCase } from '../../utils/format.js';

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency } = useSettings();
  const [tab, setTab] = useState('orders');
  const requestedPatientId = Number(id);

  const { data, loading, error } = useFetch(async () => {
    const [{ data: patient }, { data: history }] = await Promise.all([
      api.get(`/patients/${id}`),
      api.get(`/patients/${id}/history`),
    ]);
    if (
      Number(patient.data?.id) !== requestedPatientId
      || Number(history.data?.patient?.id) !== requestedPatientId
    ) {
      throw new Error('Patient detail response did not match the requested patient.');
    }
    return { patient: patient.data, history: history.data };
  }, [id]);

  const dataMatchesRoute = Number(data?.patient?.id) === requestedPatientId
    && Number(data?.history?.patient?.id) === requestedPatientId;

  if (loading && !dataMatchesRoute) return <LoadingBlock label="Loading patient…" />;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!dataMatchesRoute) return <LoadingBlock label="Loading patient…" />;

  const { patient, history } = data;
  const stats = patient.stats || history.stats || {};

  return (
    <div className="page">
      <PageHeader
        icon="users"
        title={patient.full_name}
        subtitle={`${patient.patient_code} · ${titleCase(patient.gender)} · ${ageLabel(patient.age, patient.age_unit)}`}
        actions={
          <>
            <Button variant="ghost" icon="arrow-left" onClick={() => navigate('/patients')}>Back</Button>
            <Can permission="orders.create">
              <Button variant="primary" icon="plus" onClick={() => navigate(`/orders/new?patient_id=${patient.id}`)}>New order</Button>
            </Can>
          </>
        }
      />

      <div className="grid grid-2">
        <Card>
          <CardHeader
            title={
              <div className="patient-banner">
                <Avatar name={patient.full_name} />
                <div>
                  <div>{patient.full_name}</div>
                  <div className="card-subtitle">{patient.patient_code}</div>
                </div>
              </div>
            }
          />
          <CardBody>
            <DataList
              items={[
                { label: 'Phone', value: patient.phone || '—' },
                { label: 'Email', value: patient.email || '—' },
                { label: 'Blood group', value: patient.blood_group || '—' },
                { label: 'National ID', value: patient.national_id || '—' },
                { label: 'Address', value: patient.address || '—' },
                { label: 'Referring doctor', value: patient.doctor_name || 'Walk-in' },
                { label: 'Registered', value: formatDateTime(patient.created_at) },
                { label: 'Notes', value: patient.notes || '—' },
              ]}
            />
          </CardBody>
        </Card>
        <div className="grid grid-2">
          <Card>
            <CardBody>
              <div className="stat-label">Orders</div>
              <div className="stat-value">{stats.total_orders || 0}</div>
              <div className="stat-meta">Last visit {stats.last_visit ? formatDateTime(stats.last_visit) : '—'}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="stat-label">Reports</div>
              <div className="stat-value">{stats.total_reports || 0}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="stat-label">Billed</div>
              <div className="stat-value">{formatMoney(stats.total_billed, currency)}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="stat-label">Outstanding</div>
              <div className="stat-value">{formatMoney(stats.outstanding, currency)}</div>
              <div className="stat-meta">Paid {formatMoney(stats.total_paid, currency)}</div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'orders', label: 'Orders', count: history.orders.length },
          { value: 'tests', label: 'Results', count: history.tests.length },
          { value: 'reports', label: 'Reports', count: history.reports.length },
          { value: 'payments', label: 'Payments', count: history.payments.length },
        ]}
      />

      {tab === 'orders' && (
        <TableShell empty={!history.orders.length ? <EmptyState icon="clipboard" title="No orders yet" /> : null}>
          <thead>
            <tr>
              <th>Order</th>
              <th>Doctor</th>
              <th>Tests</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Total</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {history.orders.map((order) => (
              <tr key={order.id} className="is-clickable" onClick={() => navigate(`/orders/${order.id}`)}>
                <td className="mono">{order.order_no}</td>
                <td>{order.doctor_name || '—'}</td>
                <td>{order.test_count}</td>
                <td><StatusBadge status={order.status} /></td>
                <td><StatusBadge status={order.payment_status} /></td>
                <td>{formatMoney(order.total, currency)}</td>
                <td className="text-xs text-muted">{formatDateTime(order.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      {tab === 'tests' && (
        <TableShell empty={!history.tests.length ? <EmptyState icon="flask" title="No results recorded" /> : null}>
          <thead>
            <tr>
              <th>Test</th>
              <th>Order</th>
              <th>Result</th>
              <th>Reference</th>
              <th>Flag</th>
              <th>Status</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {history.tests.map((item) => (
              <tr key={item.id} className="is-clickable" onClick={() => navigate(`/orders/${item.order_id}`)}>
                <td>
                  <div className="fw-550">{item.test_name}</div>
                  <div className="text-xs text-subtle">{item.test_code}</div>
                </td>
                <td className="mono">{item.order_no}</td>
                <td className="mono">{item.result_value ? `${item.result_value} ${item.result_unit || ''}` : '—'}</td>
                <td className="text-xs">{item.reference_range || '—'}</td>
                <td><FlagBadge flag={item.flag} /></td>
                <td><StatusBadge status={item.status} /></td>
                <td className="text-xs text-muted">{formatDateTime(item.resulted_at || item.order_date)}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      {tab === 'reports' && (
        <TableShell empty={!history.reports.length ? <EmptyState icon="file-text" title="No reports yet" /> : null}>
          <thead>
            <tr>
              <th>Report</th>
              <th>Order</th>
              <th>Doctor</th>
              <th>Status</th>
              <th>Reported</th>
            </tr>
          </thead>
          <tbody>
            {history.reports.map((report) => (
              <tr key={report.id} className="is-clickable" onClick={() => navigate(`/reports/${report.id}`)}>
                <td className="mono">{report.report_no}</td>
                <td className="mono">{report.order_no}</td>
                <td>{report.doctor_name || '—'}</td>
                <td><StatusBadge status={report.status} /></td>
                <td className="text-xs text-muted">{formatDateTime(report.reported_at || report.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      {tab === 'payments' && (
        <TableShell empty={!history.payments.length ? <EmptyState icon="credit-card" title="No payments recorded" /> : null}>
          <thead>
            <tr>
              <th>Amount</th>
              <th>Method</th>
              <th>Receipt</th>
              <th>Order</th>
              <th>Received by</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {history.payments.map((payment) => (
              <tr key={payment.id}>
                <td className="fw-650">{formatMoney(payment.amount, currency)}</td>
                <td><Badge>{titleCase(payment.method)}</Badge></td>
                <td className="mono">{payment.receipt_no || '—'}</td>
                <td className="mono">{payment.order_no}</td>
                <td>{payment.received_by_name || '—'}</td>
                <td className="text-xs text-muted">{formatDateTime(payment.paid_at)}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
