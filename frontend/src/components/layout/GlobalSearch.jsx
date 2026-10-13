import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { api } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import Icon from '../ui/Icon.jsx';
import { Spinner } from '../ui/index.jsx';

const GROUP_ICONS = {
  patients: 'users',
  orders: 'clipboard',
  reports: 'file-text',
  receipts: 'receipt',
  tests: 'flask',
  doctors: 'stethoscope',
};

export function GlobalSearch({ open, onClose }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [data, setData] = useState({ groups: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounced = useDebounce(term, 280);

  useEffect(() => {
    if (open) {
      setTerm('');
      setData({ groups: [], total: 0 });
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    if (debounced.trim().length < 2) {
      setData({ groups: [], total: 0 });
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    api
      .get('/search', { params: { q: debounced, limit: 5 } })
      .then(({ data: payload }) => {
        if (!cancelled) setData(payload.data);
      })
      .catch(() => {
        if (!cancelled) setData({ groups: [], total: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const flat = useMemo(() => data.groups.flatMap((group) => group.items), [data]);

  const go = (item) => {
    onClose();
    navigate(item.route);
  };

  if (!open) return null;

  return createPortal(
    <div className="palette-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Global search">
        <div className="palette-input">
          <Icon name="search" size={19} />
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search patients, orders, reports, receipts, tests, doctors…"
            aria-label="Search the laboratory database"
          />
          {loading && <Spinner />}
          <span className="kbd">ESC</span>
        </div>

        <div className="palette-results">
          {term.trim().length < 2 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-icon"><Icon name="search" /></div>
              <div className="empty-text">
                Type at least two characters to search by patient name, patient ID, phone, order number,
                report number, receipt number, doctor or test name.
              </div>
            </div>
          ) : flat.length === 0 && !loading ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-icon"><Icon name="x-circle" /></div>
              <div className="empty-text">No records matched <strong>{term}</strong>.</div>
            </div>
          ) : (
            data.groups.map((group) => (
              <div key={group.key}>
                <div className="palette-group-label">{group.label}</div>
                {group.items.map((item) => (
                  <button type="button" key={`${group.key}-${item.id}`} className="palette-item" onClick={() => go(item)}>
                    <span className="pi-icon"><Icon name={GROUP_ICONS[group.key] || 'file-text'} /></span>
                    <span className="flex-1" style={{ minWidth: 0 }}>
                      <span className="pi-title text-truncate" style={{ display: 'block' }}>{item.title}</span>
                      <span className="pi-sub text-truncate" style={{ display: 'block' }}>{item.subtitle}</span>
                    </span>
                    {item.code && <span className="pi-code">{item.code}</span>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="palette-footer">
          <span><span className="kbd">Enter</span> open</span>
          <span><span className="kbd">Esc</span> close</span>
          <span className="pt-spacer" style={{ flex: 1 }} />
          <span>{data.total} result{data.total === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default GlobalSearch;
