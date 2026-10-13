import Icon from './ui/Icon.jsx';

export function PageHeader({ icon, title, subtitle, actions, children }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">
          {icon && <Icon name={icon} />}
          {title}
        </h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {(actions || children) && <div className="page-actions">{actions}{children}</div>}
    </header>
  );
}

export default PageHeader;
