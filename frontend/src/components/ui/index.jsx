import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */
export function Spinner({ size, className = '' }) {
  return <span className={`spinner ${size === 'lg' ? 'spinner-lg' : ''} ${className}`} role="status" aria-label="Loading" />;
}

export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="loading-overlay">
      <div className="flex-col align-center gap-3" style={{ display: 'flex' }}>
        <Spinner size="lg" />
        <span className="text-sm text-muted">{label}</span>
      </div>
    </div>
  );
}

export function Alert({ tone = 'info', title, children, icon }) {
  const iconName = icon || { info: 'info', warning: 'alert-triangle', danger: 'alert-circle', success: 'check-circle' }[tone];
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={iconName} />
      <div className="flex-1">
        {title && <div className="alert-title">{title}</div>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, description, action, children }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} /></div>
      {title && <div className="empty-title">{title}</div>}
      {description && <p className="empty-text">{description}</p>}
      {action}
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */
const Button = forwardRef(function Button(
  { variant = 'secondary', size, icon, iconRight, loading = false, children, className = '', type = 'button', ...rest },
  ref,
) {
  const classes = ['btn', `btn-${variant}`, size ? `btn-${size}` : '', !children && icon ? 'btn-icon' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={classes} disabled={rest.disabled || loading} {...rest}>
      {loading ? <Spinner /> : icon ? <Icon name={icon} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} /> : null}
    </button>
  );
});

export { Button };

export function IconButton({ icon, label, variant = 'ghost', size = 'sm', ...rest }) {
  return (
    <Button variant={variant} size={size} icon={icon} aria-label={label} title={label} {...rest} />
  );
}

export function ButtonGroup({ children }) {
  return <div className="btn-group">{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */
export function Field({ label, required, hint, error, htmlFor, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ error, className = '', ...rest }, ref) {
  return <input ref={ref} className={`input ${error ? 'has-error' : ''} ${className}`} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ error, className = '', ...rest }, ref) {
  return <textarea ref={ref} className={`textarea ${error ? 'has-error' : ''} ${className}`} {...rest} />;
});

export const Select = forwardRef(function Select({ error, className = '', options, children, placeholder, ...rest }, ref) {
  return (
    <select ref={ref} className={`select ${error ? 'has-error' : ''} ${className}`} {...rest}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options
        ? options.map((option) => (
            <option key={String(option.value)} value={option.value}>
              {option.label}
            </option>
          ))
        : children}
    </select>
  );
});

export function Checkbox({ label, className = '', ...rest }) {
  return (
    <label className={`checkbox ${className}`}>
      <input type="checkbox" {...rest} />
      {label && <span>{label}</span>}
    </label>
  );
}

export function Radio({ label, className = '', ...rest }) {
  return (
    <label className={`radio ${className}`}>
      <input type="radio" {...rest} />
      {label && <span>{label}</span>}
    </label>
  );
}

export function Switch({ label, checked, onChange, disabled, id }) {
  const generated = useId();
  const inputId = id || generated;
  return (
    <label className="d-flex align-center gap-3" style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <span className="switch">
        <input id={inputId} type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
        <span className="track" />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', onClear, className = '' }) {
  return (
    <div className={`search-input ${className}`}>
      <Icon name="search" />
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
      />
      {value && onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}
        >
          <Icon name="x" size={15} />
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */
export function Card({ children, className = '', accent = false }) {
  return <section className={`card ${accent ? 'card-accent' : ''} ${className}`}>{children}</section>;
}

export function CardHeader({ title, subtitle, icon, actions, children }) {
  return (
    <header className="card-header">
      <div>
        <h3 className="card-title">
          {icon && <Icon name={icon} />}
          {title}
        </h3>
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      {actions || children}
    </header>
  );
}

export function CardBody({ children, className = '', tight = false }) {
  return <div className={`card-body ${tight ? 'card-body-tight' : ''} ${className}`}>{children}</div>;
}

export function CardFooter({ children }) {
  return <footer className="card-footer">{children}</footer>;
}

export function SectionTitle({ children, actions }) {
  return (
    <div className="d-flex justify-between align-center mb-2">
      <h4 className="section-title" style={{ margin: 0 }}>{children}</h4>
      {actions}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Data display                                                               */
/* -------------------------------------------------------------------------- */
export function Badge({ tone = 'neutral', dot = false, children, className = '' }) {
  return <span className={`badge badge-${tone} ${dot ? 'badge-dot' : ''} ${className}`}>{children}</span>;
}

export function Avatar({ name, size = '', src, className = '' }) {
  const label = useMemo(() => {
    if (!name) return '?';
    return String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }, [name]);
  return (
    <span className={`avatar ${size ? `avatar-${size}` : ''} ${className}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : label}
    </span>
  );
}

export function StatCard({ label, value, meta, icon, tone = '', loading = false, onClick }) {
  return (
    <div className="stat-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {icon && <div className={`stat-icon ${tone}`}><Icon name={icon} /></div>}
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{loading ? <span className="skeleton" style={{ width: 72, height: 24, display: 'block' }} /> : value}</div>
        {meta && <div className="stat-meta">{meta}</div>}
      </div>
    </div>
  );
}

export function Progress({ value = 0, tone = '' }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress" role="progressbar" aria-valuenow={safe} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-bar ${tone}`} style={{ width: `${safe}%` }} />
    </div>
  );
}

export function DataList({ items, columns = 2 }) {
  return (
    <div className={`dl ${columns === 1 ? 'dl-1' : ''}`}>
      {items.filter(Boolean).map((item) => (
        <div className="dl-row" key={item.label}>
          <div className="dl-label">{item.label}</div>
          <div className="dl-value">{item.value ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}

export function Tooltip({ label, children }) {
  return (
    <span className="tooltip-wrap">
      {children}
      <span className="tooltip" role="tooltip">{label}</span>
    </span>
  );
}

export function CopyButton({ value, label = 'Copy', size = 'xs' }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value ?? ''));
      setCopied(true);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Button variant="ghost" size={size} icon={copied ? 'check' : 'copy'} onClick={copy} title={label} aria-label={label}>
      {copied ? 'Copied' : null}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */
export function Modal({ open, onClose, title, subtitle, size = '', footer, children, closeOnBackdrop = true }) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className={`modal ${size ? `modal-${size}` : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Dialog'}>
        <header className="modal-header">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle && <div className="card-subtitle">{subtitle}</div>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={17} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/* Dropdown menu                                                              */
/* -------------------------------------------------------------------------- */
export function Dropdown({ trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    const escape = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="dropdown" ref={containerRef}>
      {typeof trigger === 'function' ? trigger({ open, toggle: () => setOpen((v) => !v) }) : (
        <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      )}
      {open && (
        <div className={`dropdown-menu ${align === 'left' ? 'dropdown-menu-left' : ''}`} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ icon, danger, children, ...rest }) {
  return (
    <button type="button" className={`dropdown-item ${danger ? 'danger' : ''}`} {...rest}>
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </button>
  );
}

export function DropdownHeader({ children }) {
  return <div className="dropdown-header">{children}</div>;
}

export function DropdownSeparator() {
  return <div className="dropdown-sep" />;
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.filter((tab) => tab.hidden !== true).map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={`tab ${value === tab.value ? 'is-active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.icon && <Icon name={tab.icon} size={15} />}
          {tab.label}
          {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                 */
/* -------------------------------------------------------------------------- */
export function Pagination({ page, pages, total, limit, onPageChange, onLimitChange, limitOptions = [10, 20, 50, 100] }) {
  if (!total) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(pages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const numbers = [];
  for (let i = start; i <= end; i += 1) numbers.push(i);

  return (
    <div className="pagination">
      <div className="d-flex align-center gap-3 flex-wrap">
        <span>
          Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
        </span>
        {onLimitChange && (
          <label className="d-flex align-center gap-2">
            <span className="text-subtle">Rows</span>
            <select className="select select-sm" value={limit} onChange={(event) => onLimitChange(Number(event.target.value))} style={{ width: 74 }}>
              {limitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="page-btns">
        <button type="button" className="page-btn" onClick={() => onPageChange(1)} disabled={page <= 1} aria-label="First page">«</button>
        <button type="button" className="page-btn" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <Icon name="chevron-left" size={14} />
        </button>
        {numbers.map((number) => (
          <button
            key={number}
            type="button"
            className={`page-btn ${number === page ? 'is-active' : ''}`}
            onClick={() => onPageChange(number)}
          >
            {number}
          </button>
        ))}
        <button type="button" className="page-btn" onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label="Next page">
          <Icon name="chevron-right" size={14} />
        </button>
        <button type="button" className="page-btn" onClick={() => onPageChange(pages)} disabled={page >= pages} aria-label="Last page">»</button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Table shell with loading / empty handling                                  */
/* -------------------------------------------------------------------------- */
export function TableShell({ loading, empty, children, footer, compact = false }) {
  return (
    <div className="card card-flush">
      <div className="table-wrap">
        {loading ? (
          <LoadingBlock label="Loading records…" />
        ) : empty ? (
          empty
        ) : (
          <table className={`table ${compact ? 'table-compact' : ''}`}>{children}</table>
        )}
      </div>
      {footer}
    </div>
  );
}

export function StatusBadge({ status }) {
  const tones = {
    pending: 'warning', collected: 'info', in_progress: 'info', completed: 'success', reported: 'success',
    cancelled: 'danger', draft: 'warning', verified: 'success', final: 'brand', amended: 'info',
    paid: 'success', partial: 'warning', unpaid: 'danger', active: 'success', void: 'danger',
    routine: 'neutral', urgent: 'danger',
  };
  const labels = {
    in_progress: 'In progress', pending: 'Pending', void: 'Void',
  };
  const value = status || 'unknown';
  return <Badge tone={tones[value] || 'neutral'} dot>{labels[value] || value.replace(/_/g, ' ')}</Badge>;
}

export function FlagBadge({ flag }) {
  if (!flag) return <span className="text-subtle">—</span>;
  const tone = { normal: 'success', low: 'info', high: 'danger', abnormal: 'warning', critical: 'danger' }[flag] || 'neutral';
  return <Badge tone={tone}>{flag}</Badge>;
}
