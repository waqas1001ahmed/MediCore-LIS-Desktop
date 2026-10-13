import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../components/ui/Confirm.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Can } from '../../components/RouteGuards.jsx';
import {
  Alert, Badge, Button, Card, CardBody, CardHeader, DataList, EmptyState, Field, FlagBadge,
  Input, LoadingBlock, Modal, Select, StatusBadge, TableShell, Textarea,
} from '../../components/ui/index.jsx';
import { PAYMENT_METHOD_OPTIONS } from '../../utils/constants.js';
import { formatDateTime, formatMoney, titleCase } from '../../utils/format.js';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { currency } = useSettings();
  const requestedOrderId = Number(id);
  const [results, setResults] = useState({});
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash', reference_no: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get(`/orders/${id}`);
    const detail = payload.data;
    if (Number(detail.order?.id) !== requestedOrderId) {
      throw new Error('Order detail response did not match the requested order.');
    }
    return detail;
  }, [id]);

  const dataMatchesRoute = Number(data?.order?.id) === requestedOrderId;
  const order = data?.order;
  const items = data?.items || [];
  const pendingResults = items.filter((item) => !item.result_value).length;

  useEffect(() => {
    if (!dataMatchesRoute) return;
    const next = {};
    for (const item of data.items || []) {
      next[item.id] = {
        result_value: item.result_value || '',
        result_unit: item.result_unit || '',
        reference_range: item.reference_range || '',
        remarks: item.remarks || '',
        flag: item.flag || '',
      };
    }
    setResults(next);
  }, [data, dataMatchesRoute]);

  const money = (value) => formatMoney(value, currency);

  const collect = async () => {
    try {
      await api.post(`/orders/${id}/collect`, {});
      toast.success('Sample marked collected');
      reload();
    } catch (actionError) {
      toast.error('Unable to collect', apiError(actionError));
    }
  };

  const saveResults = async (verify = false) => {
    setSaving(true);
    try {
      await api.post(`/orders/${id}/results`, {
        verify,
        items: items.map((item) => ({ id: item.id, ...results[item.id] })),
      });
      toast.success(verify ? 'Results verified' : 'Results saved');
      reload();
    } catch (actionError) {
      toast.error('Unable to save results', apiError(actionError));
    } finally {
      setSaving(false);
    }
  };

  const generateReport = async () => {
    try {
      const { data: payload } = await api.post('/reports', { order_id: Number(id) });
      toast.success('Report generated', payload.data.report_no);
      navigate(`/reports/${payload.data.id}`);
    } catch (actionError) {
      toast.error('Unable to generate report', apiError(actionError));
    }
  };

  const recordPayment = async () => {
    setSaving(true);
    try {
      const { data: payload } = await api.post('/receipts', {
        order_id: Number(id),
        amount_paid: Number(payForm.amount),
        payment_method: payForm.method,
        reference_no: payForm.reference_no || undefined,
        notes: payForm.notes || undefined,
      });
      toast.success('Receipt issued', payload.data.receipt.receipt_no);
      setPayOpen(false);
      reload();
      navigate(`/receipts/${payload.data.receipt.id}`);
    } catch (actionError) {
      toast.error('Payment failed', apiError(actionError));
    } finally {
      setSaving(false);
    }
  };

  const cancelOrder = async () => {
    const ok = await confirm({
      title: `Cancel ${order.order_no}?`,
      message: 'Refund any payments before cancelling. This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Cancel order',
    });
    if (!ok) return;
    try {
      await api.patch(`/orders/${id}/status`, { status: 'cancelled' });
      toast.success('Order cancelled');
      reload();
    } catch (actionError) {
      toast.error('Unable to cancel', apiError(actionError));
    }
  };

  if (loading && !dataMatchesRoute) return <LoadingBlock label="Loading order…" />;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!dataMatchesRoute || !order) return <LoadingBlock label="Loading order…" />;

  return (
    <div className="page">
      <PageHeader
        icon="clipboard"
        title={order.order_no}
        subtitle={`${order.patient_name} · ${order.patient_code}`}
        actions={
          <>
            <Button variant="ghost" icon="arrow-left" onClick={() => navigate('/orders')}>Back</Button>
            <Can permissions={['orders.collect', 'orders.edit']}>
              {['pending'].includes(order.status) && <Button icon="clipboard-check" onClick={collect}>Collect sample</Button>}
            </Can>
            <Can permission="receipts.create">
              {order.balance > 0 && order.status !== 'cancelled' && (
                <Button icon="credit-card" onClick={() => { setPayForm((c) => ({ ...c, amount: order.balance })); setPayOpen(true); }}>
                  Collect payment
                </Button>
              )}
            </Can>
            <Can permission="reports.generate">
              {items.some((item) => item.result_value) && (
                <Button variant="primary" icon="file-text" onClick={generateReport}>
                  {data.report ? 'Open report' : 'Generate report'}
                </Button>
              )}
            </Can>
          </>
        }
      />

      <div className="d-flex gap-2 flex-wrap mb-2">
        <StatusBadge status={order.status} />
        <StatusBadge status={order.payment_status} />
        {order.priority === 'urgent' && <Badge tone="danger">Urgent</Badge>}
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHeader title="Patient & sample" />
          <CardBody>
            <DataList
              items={[
                { label: 'Patient', value: `${order.patient_name} (${order.patient_code})` },
                { label: 'Age / gender', value: `${order.age || '—'} ${order.age_unit || ''} · ${titleCase(order.gender)}` },
                { label: 'Phone', value: order.patient_phone || '—' },
                { label: 'Doctor', value: order.doctor_name || 'Walk-in' },
                { label: 'Sample type', value: order.sample_type || '—' },
                { label: 'Collected', value: formatDateTime(order.sample_collected_at) },
                { label: 'Created', value: `${formatDateTime(order.created_at)} by ${order.created_by_name || '—'}` },
                { label: 'Notes', value: order.clinical_notes || '—' },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Billing" />
          <CardBody>
            <DataList
              items={[
                { label: 'Subtotal', value: money(order.subtotal) },
                { label: 'Discount', value: money(order.discount) },
                { label: `Tax (${order.tax_percent}%)`, value: money(order.tax_amount) },
                { label: 'Total', value: money(order.total) },
                { label: 'Paid', value: money(order.paid_amount) },
                { label: 'Balance', value: money(order.balance) },
              ]}
            />
            <Can permission="orders.delete">
              {order.status !== 'cancelled' && order.paid_amount <= 0 && (
                <div className="mt-4">
                  <Button variant="danger-soft" size="sm" onClick={cancelOrder}>Cancel order</Button>
                </div>
              )}
            </Can>
          </CardBody>
        </Card>
      </div>

      <Card className="card-flush">
        <CardHeader
          title="Results"
          subtitle={pendingResults ? `${pendingResults} test${pendingResults === 1 ? '' : 's'} awaiting a value` : 'All results entered'}
          actions={
            <Can permissions={['results.enter', 'results.verify']}>
              <div className="d-flex gap-2">
                <Button size="sm" loading={saving} onClick={() => saveResults(false)}>Save results</Button>
                <Can permission="results.verify">
                  <Button size="sm" variant="primary" loading={saving} onClick={() => saveResults(true)}>Save & verify</Button>
                </Can>
              </div>
            </Can>
          }
        />
        <TableShell empty={!items.length ? <EmptyState icon="flask" title="No tests on this order" /> : null}>
          <thead>
            <tr>
              <th>Test</th>
              <th>Result</th>
              <th>Unit</th>
              <th>Reference</th>
              <th>Flag</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const draft = results[item.id] || {};
              return (
                <tr key={item.id}>
                  <td>
                    <div className="fw-550">{item.test_name}</div>
                    <div className="text-xs text-subtle">{item.test_code} · {item.category_name || '—'}</div>
                  </td>
                  <td>
                    <Input
                      className={`result-input ${draft.flag ? `flag-${draft.flag}` : ''}`}
                      value={draft.result_value || ''}
                      onChange={(e) => setResults((c) => ({ ...c, [item.id]: { ...c[item.id], result_value: e.target.value } }))}
                    />
                  </td>
                  <td><Input className="result-input" value={draft.result_unit || ''} onChange={(e) => setResults((c) => ({ ...c, [item.id]: { ...c[item.id], result_unit: e.target.value } }))} /></td>
                  <td><Input value={draft.reference_range || ''} onChange={(e) => setResults((c) => ({ ...c, [item.id]: { ...c[item.id], reference_range: e.target.value } }))} /></td>
                  <td><FlagBadge flag={item.flag || draft.flag} /></td>
                  <td><StatusBadge status={item.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      </Card>

      <div className="grid grid-2">
        <Card className="card-flush">
          <CardHeader title="Payments" />
          <TableShell empty={!data.payments.length ? <EmptyState icon="credit-card" title="No payments yet" /> : null}>
            <thead>
              <tr>
                <th>Amount</th>
                <th>Method</th>
                <th>Receipt</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((payment) => (
                <tr key={payment.id} className={payment.receipt_id ? 'is-clickable' : ''} onClick={() => payment.receipt_id && navigate(`/receipts/${payment.receipt_id}`)}>
                  <td className="fw-650">{money(payment.amount)}{payment.is_void ? <Badge tone="danger">Void</Badge> : null}</td>
                  <td>{titleCase(payment.method)}</td>
                  <td className="mono">{payment.receipt_no || '—'}</td>
                  <td className="text-xs text-muted">{formatDateTime(payment.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>
        <Card className="card-flush">
          <CardHeader title="Documents" />
          <CardBody>
            {data.report ? (
              <Button variant="secondary" icon="file-text" onClick={() => navigate(`/reports/${data.report.id}`)}>
                Report {data.report.report_no}
              </Button>
            ) : <p className="text-sm text-muted">No report generated yet.</p>}
            <div className="d-flex flex-col gap-2 mt-3">
              {data.receipts.map((receipt) => (
                <Button key={receipt.id} variant="ghost" icon="receipt" onClick={() => navigate(`/receipts/${receipt.id}`)}>
                  {receipt.receipt_no} · {money(receipt.amount_paid)}
                </Button>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Collect payment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={recordPayment}>Issue receipt</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Amount" required>
            <Input type="number" min="0.01" step="0.01" value={payForm.amount} onChange={(e) => setPayForm((c) => ({ ...c, amount: e.target.value }))} />
          </Field>
          <Field label="Method">
            <Select value={payForm.method} options={PAYMENT_METHOD_OPTIONS} onChange={(e) => setPayForm((c) => ({ ...c, method: e.target.value }))} />
          </Field>
          <Field label="Reference" className="span-full">
            <Input value={payForm.reference_no} onChange={(e) => setPayForm((c) => ({ ...c, reference_no: e.target.value }))} />
          </Field>
          <Field label="Notes" className="span-full">
            <Textarea rows={2} value={payForm.notes} onChange={(e) => setPayForm((c) => ({ ...c, notes: e.target.value }))} />
          </Field>
          <p className="text-sm text-muted span-full">Outstanding balance: {money(order.balance)}</p>
        </div>
      </Modal>
    </div>
  );
}
