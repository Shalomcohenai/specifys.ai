'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getFirebaseFirestore } from '@/lib/firebase/init';
import { collection, addDoc } from 'firebase/firestore';
import { requireAdmin } from '@/lib/utils/admin';

export default function NewCategoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }

    if (!requireAdmin(user)) {
      alert('Access denied. Admin privileges required.');
      router.push('/');
      return;
    }

    setAuthorized(true);
  }, [user, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const form = e.currentTarget;
      const title = (form.querySelector('#category-title') as HTMLInputElement)?.value.trim();
      const icon = (form.querySelector('#category-icon') as HTMLInputElement)?.value.trim();
      const description = (form.querySelector('#category-description') as HTMLTextAreaElement)?.value.trim();

      if (!title || !icon || !description) {
        setFeedback({ message: 'All fields are required', type: 'error' });
        setSubmitting(false);
        return;
      }

      const db = getFirebaseFirestore();
      await addDoc(collection(db, 'academy_categories'), {
        title,
        icon,
        description,
        createdAt: new Date().toISOString()
      });

      setFeedback({ message: 'Category created successfully! Redirecting...', type: 'success' });
      setTimeout(() => {
        router.push('/admin/academy');
      }, 1500);
    } catch (error) {
      console.error('Error creating category:', error);
      setFeedback({ message: `Error: ${(error as Error).message}`, type: 'error' });
      setSubmitting(false);
    }
  };

  if (!authorized) {
    return (
      <div className="admin-shell">
        <div className="admin-content">
          <div className="loading-placeholder">Checking permissions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <span className="brand-name">Specifys<span className="accent">.</span>AI</span>
          <span className="brand-subtitle">Admin</span>
        </div>
        <nav className="sidebar-nav">
          <Link href="/admin-dashboard" className="nav-link">
            <span className="icon"><i className="fas fa-chart-line"></i></span>
            Dashboard
          </Link>
          <Link href="/admin/academy" className="nav-link active">
            <span className="icon"><i className="fas fa-graduation-cap"></i></span>
            Academy
          </Link>
        </nav>
        <div className="sidebar-footer">
          <Link className="home-link" href="/">
            <i className="fas fa-arrow-left"></i>
            Back to site
          </Link>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <div className="page-title">
              <h1>New Category</h1>
              <p>Add a new category to the Academy</p>
            </div>
          </div>
          <div className="topbar-actions">
            <Link href="/admin/academy" className="action-btn">
              <i className="fas fa-arrow-left"></i>
              Back
            </Link>
          </div>
        </header>

        <main className="admin-content">
          <section className="dashboard-section active">
            <form id="category-form" className="admin-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="category-title">Title *</label>
                <input
                  type="text"
                  id="category-title"
                  name="title"
                  required
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label htmlFor="category-icon">Icon (FontAwesome class name) *</label>
                <input
                  type="text"
                  id="category-icon"
                  name="icon"
                  required
                  placeholder="e.g., lock, layers, book"
                />
                <small className="field-hint">Enter FontAwesome icon name without &quot;fa-&quot; prefix</small>
              </div>

              <div className="form-group">
                <label htmlFor="category-description">Description *</label>
                <textarea
                  id="category-description"
                  name="description"
                  rows={4}
                  required
                  maxLength={500}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="action-btn primary" disabled={submitting}>
                  <i className="fas fa-save"></i>
                  {submitting ? 'Creating...' : 'Create Category'}
                </button>
                <Link href="/admin/academy" className="action-btn secondary">
                  Cancel
                </Link>
              </div>

              {feedback && (
                <div
                  className="form-feedback"
                  id="form-feedback"
                  role="status"
                  aria-live="polite"
                 
                >
                  {feedback.message}
                </div>
              )}
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}

