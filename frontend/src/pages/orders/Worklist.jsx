import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useFetch } from '../../hooks/useApi.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Alert, Badge, Button, EmptyState, LoadingBlock, Progress, StatusBadge } from '../../components/ui/index.jsx';
import { ageLabel, formatDateTime, titleCase } from '../../utils/format.js';

export default function Worklist() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get('/orders/worklist');
    return payload.data;
  }, []);

  if (loading && !data) return <LoadingBlock label="Loading worklist…" />;
  if (error) return <Alert tone="danger">{error}</Alert>;

  const rows = data || [];

  return (
    <div className="page">
      <PageHeader
        icon="clipboard-list"
        title="Sample worklist"
        subtitle="Orders waiting for collection or result entry. Urgent work is listed first."
        actions={<Button variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>}
      />

      {!rows.length ? (
        <div className="card"><EmptyState icon="clipboard-check" title="Worklist is clear" description="There are no pending or in-progress samples." /></div>
      ) : (
        <div className="grid grid-2">
          {rows.map((order) => {
            const pct = order.test_count ? Math.round((order.done_count / order.test_count) * 100) : 0;
            return (
              <div
                key={order.id}
                className={`work-card ${order.priority === 'urgent' ? 'is-urgent' : ''}`}
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <div className="d-flex justify-between align-center">
                  <span className="mono fw-650">{order.order_no}</span>
                  <div className="d-flex gap-2">
                    {order.priority === 'urgent' && <Badge tone="danger">Urgent</Badge>}
                    <StatusBadge status={order.status} />
                  </div>
                </div>
                <div>
                  <div className="fw-550">{order.patient_name}</div>
                  <div className="text-xs text-subtle">
                    {order.patient_code} · {titleCase(order.gender)} · {ageLabel(order.age, order.age_unit)}
                  </div>
                </div>
                <div className="text-sm text-muted">{order.doctor_name || 'Walk-in'} · {formatDateTime(order.created_at)}</div>
                <Progress value={pct} tone={pct === 100 ? 'success' : ''} />
                <div className="text-xs text-subtle">{order.done_count}/{order.test_count} tests completed</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
