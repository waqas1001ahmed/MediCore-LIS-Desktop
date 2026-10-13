import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../components/ui/Confirm.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Can } from '../../components/RouteGuards.jsx';
import {
  Alert, Button, Card, CardBody, DataList, Field, LoadingBlock, Modal, StatusBadge, Textarea,
} from '../../components/ui/index.jsx';
import { formatDateTime, formatMoney, titleCase } from '../../utils/format.js';
import ReceiptDocument from '../../components/print/ReceiptDocument.jsx';

export default function ReceiptView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { currency } = useSettings();
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get(`/receipts/${id}`);
    return payload.data;
  }, [id]);

  if (loading && !data) return <LoadingBlock label="Loading receipt…" />;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return null;

  const receipt = data.receipt;

  const voidReceipt = async () => {
    if (!reason.trim()) return;
    const ok = await confirm({
      title: `Void ${receipt.receipt_no}?`,
      message: 'The linked payment will be reversed and the order balance restored.',
      tone: 'danger',
      confirmLabel: 'Void receipt',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await api.post(`/receipts/${id}/void`, { reason });
      toast.success('Receipt voided');
      setVoidOpen(false);
      reload();
    } catch (actionError) {
      toast.error('Unable to void', apiError(actionError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="receipt"
        title={receipt.receipt_no}
        subtitle={`${receipt.patient_name} · ${receipt.order_no}`}
        actions={
          <>
            <Button variant="ghost" icon="arrow-left" onClick={() => navigate('/receipts')}>Back</Button>
            <Button variant="ghost" icon="clipboard" onClick={() => navigate(`/orders/${receipt.order_id}`)}>Open order</Button>
            <Can permission="receipts.void">
              {receipt.status === 'active' && (
                <Button variant="danger-soft" icon="ban" onClick={() => setVoidOpen(true)}>Void</Button>
              )}
            </Can>
            <Can permission="receipts.print">
              <Button variant="primary" icon="printer" onClick={() => navigate(`/receipts/${id}/print`)}>Print 80mm</Button>
            </Can>
          </>
        }
      />

      <StatusBadge status={receipt.status} />

      <div className="grid grid-2">
        <Card>
          <CardBody>
            <DataList
              items={[
                { label: 'Patient', value: `${receipt.patient_name} (${receipt.patient_code})` },
                { label: 'Order', value: receipt.order_no },
                { label: 'Method', value: titleCase(receipt.payment_method) },
                { label: 'Reference', value: receipt.reference_no || '—' },
                { label: 'Received by', value: receipt.received_by_name || '—' },
                { label: 'Issued', value: formatDateTime(receipt.created_at) },
                { label: 'Subtotal', value: formatMoney(receipt.subtotal, currency) },
                { label: 'Discount', value: formatMoney(receipt.discount, currency) },
                { label: 'Tax', value: formatMoney(receipt.tax_amount, currency) },
                { label: 'Total', value: formatMoney(receipt.total, currency) },
                { label: 'Paid', value: formatMoney(receipt.amount_paid, currency) },
                { label: 'Balance after', value: formatMoney(receipt.balance, currency) },
              ]}
            />
          </CardBody>
        </Card>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ReceiptDocument payload={data} />
        </div>
      </div>

      <Modal
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        title="Void receipt"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVoidOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={saving} onClick={voidReceipt} disabled={!reason.trim()}>Void</Button>
          </>
        }
      >
        <Field label="Reason" required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this receipt being voided?" />
        </Field>
      </Modal>
    </div>
  );
}
