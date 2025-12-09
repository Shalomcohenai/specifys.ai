'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getFirebaseFirestore } from '@/lib/firebase/init';
import { collection, getDocs, query, orderBy, addDoc } from 'firebase/firestore';
import { requireAdmin } from '@/lib/utils/admin';

interface Category {
  id: string;
  title: string;
}

export default function NewGuidePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
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
    loadCategories();
  }, [user, router]);

  const loadCategories = async () => {
    try {
      const db = getFirebaseFirestore();
      const categoriesQuery = query(
        collection(db, 'academy_categories'),
        orderBy('title')
      );
      const snapshot = await getDocs(categoriesQuery);
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const form = e.currentTarget;
      
      const whatYouLearn = (form.querySelector('#guide-what-you-learn') as HTMLTextAreaElement)?.value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      const questions = [
        {
          q: (form.querySelector('#q1-question') as HTMLInputElement)?.value.trim(),
          answers: [
            (form.querySelector('#q1-answer0') as HTMLInputElement)?.value.trim(),
            (form.querySelector('#q1-answer1') as HTMLInputElement)?.value.trim(),
            (form.querySelector('#q1-answer2') as HTMLInputElement)?.value.trim(),
            (form.querySelector('#q1-answer3') as HTMLInputElement)?.value.trim()
          ],
          correctIndex: parseInt((form.querySelector('#q1-correct') as HTMLInputElement)?.value || '0')
        },
        {
          q: (form.querySelector('#q2-question') as HTMLInputElement)?.value.trim(),
          answers: [
            (form.querySelector('#q2-answer0') as HTMLInputElement)?.value.trim(),
            (form.querySelector('#q2-answer1') as HTMLInputElement)?.value.trim(),
            (form.querySelector('#q2-answer2') as HTMLInputElement)?.value.trim(),
            (form.querySelector('#q2-answer3') as HTMLInputElement)?.value.trim()
          ],
          correctIndex: parseInt((form.querySelector('#q2-correct') as HTMLInputElement)?.value || '0')
        }
      ];

      const guideData = {
        category: (form.querySelector('#guide-category') as HTMLSelectElement)?.value,
        title: (form.querySelector('#guide-title') as HTMLInputElement)?.value.trim(),
        level: (form.querySelector('#guide-level') as HTMLSelectElement)?.value,
        whatYouLearn,
        content: (form.querySelector('#guide-content') as HTMLTextAreaElement)?.value.trim(),
        summary: (form.querySelector('#guide-summary') as HTMLTextAreaElement)?.value.trim(),
        questions,
        updatedAt: new Date().toISOString(),
        views: 0
      };

      const db = getFirebaseFirestore();
      await addDoc(collection(db, 'academy_guides'), guideData);

      setFeedback({ message: 'Guide created successfully! Redirecting...', type: 'success' });
      setTimeout(() => {
        router.push('/admin/academy');
      }, 1500);
    } catch (error) {
      console.error('Error creating guide:', error);
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
              <h1>New Guide</h1>
              <p>Add a new guide to the Academy</p>
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
            <form id="guide-form" className="admin-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="guide-category">Category *</label>
                <select id="guide-category" name="category" required>
                  {loadingCategories ? (
                    <option value="">Loading categories...</option>
                  ) : (
                    <>
                      <option value="">Select a category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.title}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="guide-title">Title *</label>
                <input
                  type="text"
                  id="guide-title"
                  name="title"
                  required
                  maxLength={200}
                />
              </div>

              <div className="form-group">
                <label htmlFor="guide-level">Level *</label>
                <select id="guide-level" name="level" required>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="guide-what-you-learn">What You&apos;ll Learn (one per line) *</label>
                <textarea
                  id="guide-what-you-learn"
                  name="whatYouLearn"
                  rows={5}
                  required
                  placeholder="Enter each learning point on a new line"
                />
              </div>

              <div className="form-group">
                <label htmlFor="guide-content">Content (HTML) *</label>
                <textarea
                  id="guide-content"
                  name="content"
                  rows={15}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="guide-summary">Summary *</label>
                <textarea
                  id="guide-summary"
                  name="summary"
                  rows={3}
                  required
                  maxLength={500}
                />
              </div>

              {/* Question 1 */}
              <div className="question-form-block">
                <h3>Question 1</h3>
                <div className="form-group">
                  <label htmlFor="q1-question">Question *</label>
                  <input type="text" id="q1-question" name="q1-question" required />
                </div>
                <div className="form-group">
                  <label>Answers *</label>
                  <input type="text" id="q1-answer0" placeholder="Answer 1" required />
                  <input type="text" id="q1-answer1" placeholder="Answer 2" required />
                  <input type="text" id="q1-answer2" placeholder="Answer 3" required />
                  <input type="text" id="q1-answer3" placeholder="Answer 4" required />
                </div>
                <div className="form-group">
                  <label htmlFor="q1-correct">Correct Answer Index (0-3) *</label>
                  <input
                    type="number"
                    id="q1-correct"
                    name="q1-correct"
                    min={0}
                    max={3}
                    required
                  />
                </div>
              </div>

              {/* Question 2 */}
              <div className="question-form-block">
                <h3>Question 2</h3>
                <div className="form-group">
                  <label htmlFor="q2-question">Question *</label>
                  <input type="text" id="q2-question" name="q2-question" required />
                </div>
                <div className="form-group">
                  <label>Answers *</label>
                  <input type="text" id="q2-answer0" placeholder="Answer 1" required />
                  <input type="text" id="q2-answer1" placeholder="Answer 2" required />
                  <input type="text" id="q2-answer2" placeholder="Answer 3" required />
                  <input type="text" id="q2-answer3" placeholder="Answer 4" required />
                </div>
                <div className="form-group">
                  <label htmlFor="q2-correct">Correct Answer Index (0-3) *</label>
                  <input
                    type="number"
                    id="q2-correct"
                    name="q2-correct"
                    min={0}
                    max={3}
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="action-btn primary" disabled={submitting}>
                  <i className="fas fa-save"></i>
                  {submitting ? 'Creating...' : 'Create Guide'}
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

