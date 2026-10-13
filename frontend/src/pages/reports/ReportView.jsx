import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useConfirm } from '../../components/ui/Confirm.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Can } from '../../components/RouteGuards.jsx';
import {
  Alert, Button, Card, CardBody, Field, FlagBadge, LoadingBlock, StatusBadge, TableShell, Textarea,
} from '../../components/ui/index.jsx';
import { formatDateTime } from '../../utils/format.js';
import ReportDocument from '../../components/print/ReportDocument.jsx';

export default function ReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [notes, setNotes] = useState({ conclusion: '', remarks: '' });
  const [saving, setSaving] = useState(false);

  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get(`/reports/${id}`);
    setNotes({
      conclusion: payload.data.report.conclusion || '',
      remarks: payload.data.report.remarks || '',
    });
    return payload.data;
  }, [id]);

  if (loading && !data) return <LoadingBlock label="Loading report…" />;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return null;

  const report = data.report;

  const saveNotes = async () => {
    setSaving(true);
    try {
      await api.patch(`/reports/${id}`, notes);
      toast.success('Notes saved');
      reload();
    } catch (saveError) {
      toast.error('Unable to save', apiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const verify = async () => {
    try {
      await api.post(`/reports/${id}/verify`);
      toast.success('Report verified');
      reload();
    } catch (actionError) {
      toast.error('Unable to verify', apiError(actionError));
    }
  };

  const finalize = async () => {
    const ok = await confirm({
      title: 'Finalise this report?',
      message: 'A final report is locked and cannot be edited or deleted.',
      confirmLabel: 'Finalise',
    });
    if (!ok) return;
    try {
      await api.post(`/reports/${id}/finalize`);
      toast.success('Report finalised');
      reload();
    } catch (actionError) {
      toast.error('Unable to finalise', apiError(actionError));
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="file-text"
        title={report.report_no}
        subtitle={`${data.patient.full_name} · ${data.order.order_no}`}
        actions={
          <>
            <Button variant="ghost" icon="arrow-left" onClick={() => navigate('/reports')}>Back</Button>
            <Can permission="reports.verify">
              {report.status !== 'final' && report.status !== 'verified' && (
                <Button icon="check-circle" onClick={verify}>Verify</Button>
              )}
              {report.status === 'verified' && (
                <Button variant="primary" icon="lock" onClick={finalize}>Finalise</Button>
              )}
            </Can>
            <Can permission="reports.print">
              <Button variant="primary" icon="printer" onClick={() => navigate(`/reports/${id}/print`)}>Print / PDF</Button>
            </Can>
          </>
        }
      />

      <div className="d-flex gap-2 align-center">
        <StatusBadge status={report.status} />
        <span className="text-sm text-muted">Printed {report.print_count || 0} time{(report.print_count || 0) === 1 ? '' : 's'}</span>
      </div>

      <div className="grid grid-2">
        <Card>
          <CardBody>
            {report.status !== 'final' ? (
              <div className="form-grid">
                <Field label="Conclusion" className="span-full">
                  <Textarea rows={3} value={notes.conclusion} onChange={(e) => setNotes((c) => ({ ...c, conclusion: e.target.value }))} />
                </Field>
                <Field label="Remarks" className="span-full">
                  <Textarea rows={3} value={notes.remarks} onChange={(e) => setNotes((c) => ({ ...c, remarks: e.target.value }))} />
                </Field>
                <Can permissions={['reports.generate', 'reports.verify']}>
                  <div className="span-full">
                    <Button variant="secondary" loading={saving} icon="save" onClick={saveNotes}>Save notes</Button>
                  </div>
                </Can>
              </div>
            ) : (
              <>
                <p className="text-sm"><strong>Conclusion:</strong> {report.conclusion || '—'}</p>
                <p className="text-sm mt-2"><strong>Remarks:</strong> {report.remarks || '—'}</p>
              </>
            )}
            <p className="text-xs text-subtle mt-3">
              Created {formatDateTime(report.created_at)}
              {report.verified_by_name ? ` · Verified by ${report.verified_by_name}` : ''}
            </p>
          </CardBody>
        </Card>
        <Card className="card-flush">
          <div className="card-header"><h3 className="card-title">Results</h3></div>
          <TableShell>
            <thead>
              <tr>
                <th>Test</th>
                <th>Result</th>
                <th>Reference</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="fw-550">{item.test_name}</div>
                    <div className="text-xs text-subtle">{item.test_code}</div>
                  </td>
                  <td className="mono">{item.result_value} {item.result_unit || ''}</td>
                  <td className="text-xs">{item.reference_range || '—'}</td>
                  <td><FlagBadge flag={item.flag} /></td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <ReportDocument payload={data} compact />
      </div>
    </div>
  );
}
