import { useNavigate } from 'react-router-dom';
import { EmptyState, Button } from '../components/ui/index.jsx';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <div className="card">
        <EmptyState
          icon="help-circle"
          title="Page not found"
          description="The page you requested does not exist or you do not have access to it."
          action={<Button variant="primary" icon="arrow-left" onClick={() => navigate('/')}>Back to dashboard</Button>}
        />
      </div>
    </div>
  );
}
