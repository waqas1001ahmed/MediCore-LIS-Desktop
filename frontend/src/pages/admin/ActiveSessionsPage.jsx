import { useState } from 'react';
import { api, apiError } from '../../api/client.js';
import { useFetch } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import {
  Alert, Badge, Button, EmptyState, TableShell,
} from '../../components/ui/index.jsx';
import { formatDateTime } from '../../utils/format.js';

export default function ActiveSessionsPage() {
  const toast = useToast();
  const [revoking, setRevoking] = useState(null);

  const { data, loading, error, reload } = useFetch(async () => {
    const { data: payload } = await api.get('/users/sessions/active');
    return payload.data || [];
  }, []);

  const rows = data || [];

  const revoke = async (session) => {
    setRevoking(session.id);
    try {
      await api.delete(`/users/sessions/${session.id}`);
      toast.success('Session revoked');
      reload();
    } catch (revokeError) {
      toast.error(apiError(revokeError, 'Unable to revoke the session.'));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="shield"
        title="Active sessions"
        subtitle="Every device currently signed in across the laboratory."
        actions={<Button variant="ghost" icon="refresh" onClick={reload}>Refresh</Button>}
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <TableShell
        loading={loading}
        empty={!rows.length ? <EmptyState icon="shield" title="No active sessions" description="Nobody is currently signed in." /> : null}
      >
        <thead>
          <tr>
            <th>User</th>
            <th>IP address</th>
            <th>Device</th>
            <th>Signed in</th>
            <th>Expires</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((session) => (
            <tr key={session.id}>
              <td>
                <div className="fw-550">{session.full_name || session.username || '—'}</div>
                <div className="text-xs text-subtle">{session.username || ''}</div>
              </td>
              <td className="mono">{session.ip || '—'}</td>
              <td className="text-xs text-muted">{session.user_agent || 'Unknown device'}</td>
              <td className="nowrap text-xs text-muted">{formatDateTime(session.created_at)}</td>
              <td className="nowrap text-xs text-muted">{formatDateTime(session.expires_at)}</td>
              <td className="nowrap">
                {session.current ? (
                  <Badge tone="success">Current</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="xs"
                    icon="logout"
                    loading={revoking === session.id}
                    onClick={() => revoke(session)}
                  >
                    Sign out
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <p className="text-xs text-subtle mt-3">
        <Badge tone="info">Note</Badge> Revoking a session signs that device out immediately.
      </p>
    </div>
  );
}
