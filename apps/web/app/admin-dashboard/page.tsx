'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient as api } from '@/lib/api/client';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    try {
      const token = await user.getIdToken();
      const result = await api.get<{ success: boolean; isAdmin?: boolean }>('/admin/check', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (result.success && result.isAdmin) {
        setIsAdmin(true);
        loadStats();
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const result = await api.get('/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(result);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="admin-shell">
        <div>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const sections = [
    { id: 'overview', label: 'Overview', icon: 'fa-chart-line' },
    { id: 'users', label: 'Users', icon: 'fa-users' },
    { id: 'payments', label: 'Payments', icon: 'fa-credit-card' },
    { id: 'logs', label: 'Live Logs', icon: 'fa-stream' },
    { id: 'articles', label: 'Articles', icon: 'fa-file-alt' },
    { id: 'stats', label: 'Statistics', icon: 'fa-chart-pie' }
  ];

  return (
    <div className="admin-shell" id="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="sidebar-brand">
          <span className="brand-name">
            Specifys<span className="accent">.</span>AI
          </span>
          <span className="brand-subtitle">Admin</span>
        </div>

        <nav className="sidebar-nav" id="sidebar-nav">
          {sections.map((section) => (
            <button
              key={section.id}
              className={`nav-link ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="icon">
                <i className={`fas ${section.icon}`}></i>
              </span>
              {section.label}
            </button>
          ))}
          <Link href="/admin/academy" className="nav-link">
            <span className="icon">
              <i className="fas fa-graduation-cap"></i>
            </span>
            Academy
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="connection-indicator" id="connection-indicator">
            <span className="dot status-pending"></span>
            <span className="label">Connected</span>
          </div>
          <small className="sync-label">
            Last sync · <span id="sidebar-last-sync">Just now</span>
          </small>
          <Link href="/" className="home-link">
            <i className="fas fa-arrow-left"></i>
            Back to site
          </Link>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <div className="page-title">
              <h1>Admin Dashboard</h1>
              <p>Live control center for Specifys.ai</p>
            </div>
            <div className="topbar-status">
              <span id="topbar-sync-status">System operational</span>
            </div>
          </div>
          <div className="topbar-actions">
            <Link href="/" className="action-btn home-btn" title="Back to homepage">
              <i className="fas fa-home"></i>
              Home
            </Link>
            <button className="action-btn" id="manual-refresh-btn" type="button" onClick={loadStats}>
              <i className="fas fa-sync-alt"></i>
              Refresh
            </button>
          </div>
        </header>

        <main className="admin-content" id="admin-content">
          {activeSection === 'overview' && (
            <section className="dashboard-section active" id="overview-section">
              <header className="section-header">
                <div>
                  <h2>Live Overview</h2>
                  <p>Realtime snapshot of the platform.</p>
                </div>
              </header>

              <div className="metrics-grid" id="overview-metrics">
                <article className="metric-card">
                  <h3>Total users</h3>
                  <p className="metric-value" data-metric="users-total">
                    {stats?.usersTotal || '—'}
                  </p>
                  <span className="metric-sub" data-kpi="users-new">
                    New: {stats?.usersNew || '—'}
                  </span>
                </article>
                <article className="metric-card">
                  <h3>Total specs</h3>
                  <p className="metric-value" data-metric="specs-total">
                    {stats?.specsTotal || '—'}
                  </p>
                  <span className="metric-sub" data-kpi="specs-new">
                    New: {stats?.specsNew || '—'}
                  </span>
                </article>
                <article className="metric-card">
                  <h3>Active subscriptions</h3>
                  <p className="metric-value" data-metric="subscriptions-active">
                    {stats?.subscriptionsActive || '—'}
                  </p>
                  <span className="metric-sub" data-kpi="subscriptions-new">
                    New: {stats?.subscriptionsNew || '—'}
                  </span>
                </article>
              </div>
            </section>
          )}

          {activeSection === 'users' && (
            <section className="dashboard-section active" id="users-section">
              <header className="section-header">
                <div>
                  <h2>Users</h2>
                  <p>Manage platform users</p>
                </div>
              </header>
              <div className="section-content">
                <p>User management interface coming soon...</p>
              </div>
            </section>
          )}

          {activeSection === 'payments' && (
            <section className="dashboard-section active" id="payments-section">
              <header className="section-header">
                <div>
                  <h2>Payments</h2>
                  <p>View payment transactions</p>
                </div>
              </header>
              <div className="section-content">
                <p>Payment management interface coming soon...</p>
              </div>
            </section>
          )}

          {activeSection === 'logs' && (
            <section className="dashboard-section active" id="logs-section">
              <header className="section-header">
                <div>
                  <h2>Live Logs</h2>
                  <p>Real-time system logs</p>
                </div>
              </header>
              <div className="section-content">
                <p>Live logs interface coming soon...</p>
              </div>
            </section>
          )}

          {activeSection === 'articles' && (
            <section className="dashboard-section active" id="articles-section">
              <header className="section-header">
                <div>
                  <h2>Articles</h2>
                  <p>Manage blog articles</p>
                </div>
              </header>
              <div className="section-content">
                <p>Article management interface coming soon...</p>
              </div>
            </section>
          )}

          {activeSection === 'stats' && (
            <section className="dashboard-section active" id="stats-section">
              <header className="section-header">
                <div>
                  <h2>Statistics</h2>
                  <p>Platform analytics and metrics</p>
                </div>
              </header>
              <div className="section-content">
                <p>Statistics interface coming soon...</p>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

