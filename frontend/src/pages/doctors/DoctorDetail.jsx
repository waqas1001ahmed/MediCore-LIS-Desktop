import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useFetch } from '../../hooks/useApi.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import {
  Alert, Avatar, Badge, Button, Card, CardBody, DataList, EmptyState, LoadingBlock, TableShell,
} from '../../components/ui/index.jsx';
import { formatDateTime, formatMoney } from '../../utils/format.js';

export default function DoctorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency } = useSettings();
  const { data, loading, error } = useFetch(async () => {
    const { data: payload } = await api.get(`/doctors/${id}`);
    return payload.data;
  }, [id]);

  if (loading && !data) return <LoadingBlock label="Loading doctor…" />;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return null;

  return (
    <div className="page">
      <PageHeader
        icon="stethoscope"
        title={data.name}
        subtitle={data.specialization || 'Referring clinician'}
        actions={<Button variant="ghost" icon="arrow-left" onClick={() => navigate('/doctors')}>Back</Button>}
      />

      <div className="grid grid-2">
        <Card>
          <CardBody>
            <div className="patient-banner mb-4">
              <Avatar name={data.name} />
              <div>
                <div className="fw-650">{data.name}</div>
                <div className="text-sm text-muted">{data.qualification || data.specialization}</div>
                {data.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
              </div>
            </div>
            <DataList
              items={[
                { label: 'Hospital', value: data.hospital || '—' },
                { label: 'Phone', value: data.phone || '—' },
                { label: 'Email', value: data.email || '—' },
                { label: 'Address', value: data.address || '—' },
                { label: 'Commission', value: `${data.commission_percent || 0}%` },
                { label: 'Patients', value: data.patient_count },
                { label: 'Orders', value: data.order_count },
                { label: 'Referred revenue', value: formatMoney(data.referred_revenue, currency) },
                { label: 'Notes', value: data.notes || '—' },
              ]}
            />
          </CardBody>
        </Card>

        <Card className="card-flush">
          <div className="card-header"><h3 className="card-title">Recent patients</h3></div>
          <TableShell empty={!data.recent_patients?.length ? <EmptyState icon="users" title="No referred patients yet" /> : null}>
            <thead>
              <tr>
                <th>Patient</th>
                <th>ID</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {(data.recent_patients || []).map((patient) => (
                <tr key={patient.id} className="is-clickable" onClick={() => navigate(`/patients/${patient.id}`)}>
                  <td>{patient.full_name}</td>
                  <td className="mono">{patient.patient_code}</td>
                  <td className="text-xs text-muted">{formatDateTime(patient.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>
      </div>
    </div>
  );
}
