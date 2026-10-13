import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { hasAnyPermission } from '../../utils/permissions.js';
import { resolveAssetUrl, APP_NAME } from '../../api/client.js';
import Icon from '../ui/Icon.jsx';
import { Avatar, Dropdown, DropdownItem, DropdownHeader, DropdownSeparator } from '../ui/index.jsx';
import { GlobalSearch } from './GlobalSearch.jsx';

const NAVIGATION = [
  {
    group: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: 'dashboard', permission: 'dashboard.view', end: true }],
  },
  {
    group: 'Clinical',
    items: [
      { to: '/patients', label: 'Patients', icon: 'users', permission: 'patients.view' },
      { to: '/orders', label: 'Test Orders', icon: 'clipboard', permission: 'orders.view' },
      { to: '/worklist', label: 'Sample Worklist', icon: 'clipboard-list', permission: 'orders.view' },
      { to: '/reports', label: 'Reports', icon: 'file-text', permission: 'reports.view' },
    ],
  },
  {
    group: 'Billing',
    items: [
      { to: '/receipts', label: 'Receipts', icon: 'receipt', permission: 'receipts.view' },
      { to: '/revenue', label: 'Revenue', icon: 'bar-chart', permission: 'revenue.view' },
    ],
  },
  {
    group: 'Catalogue',
    items: [
      { to: '/tests', label: 'Test Catalogue', icon: 'flask', permission: 'tests.view' },
      { to: '/doctors', label: 'Referring Doctors', icon: 'stethoscope', permission: 'doctors.view' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { to: '/users', label: 'Users', icon: 'user-check', permission: 'users.view' },
      { to: '/roles', label: 'Roles & Permissions', icon: 'shield', permission: 'roles.view' },
      { to: '/audit', label: 'Audit Log', icon: 'activity', permission: 'audit.view' },
      { to: '/settings', label: 'Settings', icon: 'settings', permission: 'settings.view' },
    ],
  },
];

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/patients': 'Patients',
  '/orders': 'Test Orders',
  '/worklist': 'Sample Worklist',
  '/reports': 'Laboratory Reports',
  '/receipts': 'Receipts',
  '/revenue': 'Revenue Management',
  '/tests': 'Test Catalogue',
  '/doctors': 'Referring Doctors',
  '/users': 'User Management',
  '/roles': 'Roles & Permissions',
  '/audit': 'Audit Log',
  '/settings': 'Laboratory Settings',
  '/profile': 'My Profile',
};

export function AppShell() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const { resolved, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const navigation = useMemo(
    () =>
      NAVIGATION.map((group) => ({
        ...group,
        items: group.items.filter((item) => hasAnyPermission(user, [item.permission])),
      })).filter((group) => group.items.length > 0),
    [user],
  );

  const labName = settings?.lab_name || 'Laboratory';
  const logo = resolveAssetUrl(settings?.lab_logo);

  const title = useMemo(() => {
    if (location.pathname.startsWith('/patients/')) return 'Patient Record';
    if (location.pathname.startsWith('/orders/')) return 'Order Details';
    if (location.pathname.startsWith('/doctors/')) return 'Doctor Details';
    if (location.pathname.startsWith('/reports/')) return 'Report';
    if (location.pathname.startsWith('/receipts/')) return 'Receipt';
    return PAGE_TITLES[location.pathname] || 'Laboratory';
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-scrim no-print" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar no-print ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            {logo ? <img src={logo} alt={`${labName} logo`} /> : <Icon name="droplet" />}
          </div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name" title={labName}>{labName}</div>
            <div className="sidebar-brand-sub">Laboratory Information System</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navigation.map((group) => (
            <div key={group.group}>
              <div className="sidebar-group-label">{group.group}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-link" style={{ cursor: 'default', margin: 0, paddingLeft: 12 }}>
            <Icon name="shield" />
            <span className="text-xs" style={{ color: 'var(--sidebar-text-muted)' }}>
              {user?.roleLabel || 'Signed in'}
            </span>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar no-print">
          <button type="button" className="topbar-icon-btn mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
            <Icon name="menu" />
          </button>

          <span className="text-sm fw-600 mobile-only">{title}</span>

          <button type="button" className="topbar-search" onClick={() => setSearchOpen(true)}>
            <Icon name="search" size={16} />
            <span>Search patients, orders, reports…</span>
            <span className="kbd">Ctrl K</span>
          </button>

          <div className="topbar-spacer" />

          <button type="button" className="topbar-icon-btn" onClick={toggle} title="Toggle theme" aria-label="Toggle colour theme">
            <Icon name={resolved === 'dark' ? 'sun' : 'moon'} />
          </button>

          <button type="button" className="topbar-icon-btn" onClick={() => setSearchOpen(true)} title="Search" aria-label="Search">
            <Icon name="search" />
          </button>

          <Dropdown
            trigger={({ toggle: toggleMenu }) => (
              <button type="button" className="topbar-user" onClick={toggleMenu}>
                <Avatar name={user?.full_name} />
                <span className="topbar-user-text">
                  <span className="topbar-user-name" style={{ display: 'block' }}>{user?.full_name}</span>
                  <span className="topbar-user-role" style={{ display: 'block' }}>{user?.roleLabel}</span>
                </span>
                <Icon name="chevron-down" size={15} />
              </button>
            )}
          >
            <DropdownHeader>{user?.username}</DropdownHeader>
            <DropdownItem icon="user" onClick={() => navigate('/profile')}>My profile</DropdownItem>
            <DropdownItem icon="key" onClick={() => navigate('/profile?tab=password')}>Change password</DropdownItem>
            {(user?.permissions || []).includes('settings.view') && (
              <DropdownItem icon="settings" onClick={() => navigate('/settings')}>Lab settings</DropdownItem>
            )}
            <DropdownSeparator />
            <DropdownItem icon="logout" danger onClick={handleLogout}>Sign out</DropdownItem>
          </Dropdown>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export default AppShell;
export { APP_NAME };
