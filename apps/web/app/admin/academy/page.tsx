'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getFirebaseFirestore } from '@/lib/firebase/init';
import { collection, doc, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
import { requireAdmin } from '@/lib/utils/admin';
import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/init';

interface Category {
  id: string;
  title: string;
  description?: string;
  icon?: string;
}

interface Guide {
  id: string;
  title: string;
  category: string;
  level?: string;
  questions?: any[];
  views?: number;
}

export default function AdminAcademyPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

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
    loadData();
  }, [user, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const db = getFirebaseFirestore();

      // Load categories
      const categoriesQuery = query(
        collection(db, 'academy_categories'),
        orderBy('title')
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesData = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];

      // Load guides
      const guidesQuery = query(
        collection(db, 'academy_guides'),
        orderBy('title')
      );
      const guidesSnapshot = await getDocs(guidesQuery);
      const guidesData = guidesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Guide[];

      setCategories(categoriesData);
      setGuides(guidesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      router.push('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? This will not delete guides in this category.')) {
      return;
    }

    try {
      const db = getFirebaseFirestore();
      await deleteDoc(doc(db, 'academy_categories', categoryId));
      await loadData();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Error deleting category: ' + (error as Error).message);
    }
  };

  const handleDeleteGuide = async (guideId: string) => {
    if (!confirm('Are you sure you want to delete this guide?')) {
      return;
    }

    try {
      const db = getFirebaseFirestore();
      await deleteDoc(doc(db, 'academy_guides', guideId));
      await loadData();
    } catch (error) {
      console.error('Error deleting guide:', error);
      alert('Error deleting guide: ' + (error as Error).message);
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

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.title : 'Unknown';
  };

  return (
    <div className="admin-shell" id="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="sidebar-brand">
          <span className="brand-name">Specifys<span className="accent">.</span>AI</span>
          <span className="brand-subtitle">Admin</span>
        </div>

        <nav className="sidebar-nav" id="sidebar-nav">
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
              <h1>Academy Management</h1>
              <p>Manage categories and guides</p>
            </div>
          </div>
          <div className="topbar-actions">
            <Link href="/" className="action-btn home-btn" title="Back to homepage">
              <i className="fas fa-home"></i>
              Home
            </Link>
            <button className="action-btn critical" id="sign-out-btn" type="button" onClick={handleSignOut}>
              <i className="fas fa-sign-out-alt"></i>
              Sign out
            </button>
          </div>
        </header>

        <main className="admin-content" id="admin-content">
          <section className="dashboard-section active" id="academy-section">
            <header className="section-header">
              <div>
                <h2>Academy Content</h2>
                <p>Manage categories and guides for the Academy section.</p>
              </div>
              <div className="section-controls">
                <Link href="/admin/academy/categories/new" className="action-btn">
                  <i className="fas fa-plus"></i>
                  Add Category
                </Link>
                <Link href="/admin/academy/guides/new" className="action-btn">
                  <i className="fas fa-plus"></i>
                  Add Guide
                </Link>
              </div>
            </header>

            {/* Categories */}
            <div className="academy-admin-section">
              <h3>Categories</h3>
              <div className="table-wrapper">
                <table className="data-table" id="categories-table">
                  <thead>
                    <tr>
                      <th scope="col">Icon</th>
                      <th scope="col">Title</th>
                      <th scope="col">Description</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="table-empty">Loading categories...</td>
                      </tr>
                    ) : categories.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="table-empty">No categories yet. Create one to get started.</td>
                      </tr>
                    ) : (
                      categories.map(cat => (
                        <tr key={cat.id}>
                          <td><i className={`fas fa-${cat.icon || 'book'}`}></i></td>
                          <td>{cat.title}</td>
                          <td>{cat.description || ''}</td>
                          <td>
                            <button
                              className="action-btn small critical"
                              onClick={() => handleDeleteCategory(cat.id)}
                            >
                              <i className="fas fa-trash"></i> Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Guides */}
            <div className="academy-admin-section">
              <h3>Guides</h3>
              <div className="table-wrapper">
                <table className="data-table" id="guides-table">
                  <thead>
                    <tr>
                      <th scope="col">Title</th>
                      <th scope="col">Category</th>
                      <th scope="col">Level</th>
                      <th scope="col">Questions</th>
                      <th scope="col">Views</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="table-empty">Loading guides...</td>
                      </tr>
                    ) : guides.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="table-empty">No guides yet. Create one to get started.</td>
                      </tr>
                    ) : (
                      guides.map(guide => {
                        const questionCount = guide.questions ? guide.questions.length : 0;
                        const views = guide.views || 0;
                        const levelClass = (guide.level || 'beginner').toLowerCase();
                        return (
                          <tr key={guide.id}>
                            <td>{guide.title}</td>
                            <td>{getCategoryName(guide.category)}</td>
                            <td>
                              <span className={`level-badge ${levelClass}`}>
                                {guide.level || 'Beginner'}
                              </span>
                            </td>
                            <td>{questionCount}</td>
                            <td><span className="visit-count">{views}</span></td>
                            <td>
                              <Link
                                href={`/admin/academy/guides/${guide.id}/edit`}
                                className="action-btn small"
                              >
                                <i className="fas fa-edit"></i> Edit
                              </Link>
                              <button
                                className="action-btn small critical"
                                onClick={() => handleDeleteGuide(guide.id)}
                              >
                                <i className="fas fa-trash"></i> Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

