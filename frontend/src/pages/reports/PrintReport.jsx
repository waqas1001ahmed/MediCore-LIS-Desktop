import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Alert, Button, Checkbox, LoadingBlock } from '../../components/ui/index.jsx';
import ReportDocument from '../../components/print/ReportDocument.jsx';

export default function PrintReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [printHeader, setPrintHeader] = useState(true);
  const [printFooter, setPrintFooter] = useState(true);
  const { data, loading, error } = useFetch(async () => {
    const { data: payload } = await api.get(`/reports/${id}`);
    return payload.data;
  }, [id]);

  useEffect(() => {
    if (!data) return undefined;
    api.post(`/reports/${id}/print`).catch(() => {});
    return undefined;
  }, [data, id]);

  const print = () => {
    window.print();
  };

  if (loading && !data) return <LoadingBlock label="Preparing report…" />;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return null;

  return (
    <div className="print-stage">
      <div className="print-toolbar no-print">
        <div>
          <div className="pt-title">{data.report.report_no}</div>
          <div className="pt-sub">{data.patient.full_name} · A4 laboratory report</div>
        </div>
        <div className="pt-spacer" />
        <Checkbox label="Print Header" checked={printHeader} onChange={(event) => setPrintHeader(event.target.checked)} />
        <Checkbox label="Print Footer" checked={printFooter} onChange={(event) => setPrintFooter(event.target.checked)} />
        <Button variant="ghost" icon="arrow-left" onClick={() => navigate(`/reports/${id}`)}>Back</Button>
        <Button variant="primary" icon="printer" onClick={print}>Print Report</Button>
      </div>
      <ReportDocument payload={data} showHeader={printHeader} showFooter={printFooter} />
    </div>
  );
}
