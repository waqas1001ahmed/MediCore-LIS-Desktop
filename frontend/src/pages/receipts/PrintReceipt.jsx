import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useFetch } from '../../hooks/useApi.js';
import { Alert, Button, LoadingBlock } from '../../components/ui/index.jsx';
import ReceiptDocument from '../../components/print/ReceiptDocument.jsx';

export default function PrintReceipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useFetch(async () => {
    const { data: payload } = await api.get(`/receipts/${id}`);
    return payload.data;
  }, [id]);

  useEffect(() => {
    if (!data) return undefined;
    api.post(`/receipts/${id}/print`).catch(() => {});
    const timer = setTimeout(() => {
      try { window.print(); } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [data, id]);

  if (loading && !data) return <LoadingBlock label="Preparing receipt…" />;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return null;

  return (
    <div className="print-stage">
      <div className="print-toolbar no-print">
        <div>
          <div className="pt-title">{data.receipt.receipt_no}</div>
          <div className="pt-sub">80mm thermal receipt</div>
        </div>
        <div className="pt-spacer" />
        <Button variant="ghost" icon="arrow-left" onClick={() => navigate(`/receipts/${id}`)}>Back</Button>
        <Button variant="primary" icon="printer" onClick={() => window.print()}>Print</Button>
      </div>
      <ReceiptDocument payload={data} />
    </div>
  );
}
