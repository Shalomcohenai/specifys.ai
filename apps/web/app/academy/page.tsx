'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient as api } from '@/lib/api/client';

interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  guideCount?: number;
}

export default function AcademyPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [points, setPoints] = useState(0);

  useEffect(() => {
    loadCategories();
    checkWelcomeModal();
    loadPoints();
  }, []);

  const loadCategories = async () => {
    try {
      const result = await api.get<{ success: boolean; categories?: Category[] }>('/api/academy/categories');
      if (result.success && result.categories) {
        setCategories(result.categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkWelcomeModal = () => {
    const hasSeenWelcome = localStorage.getItem('academy-welcome-seen');
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    }
  };

  const loadPoints = async () => {
    try {
      // Load user points if authenticated
      // For now, set to 0
      setPoints(0);
    } catch (error) {
      console.error('Error loading points:', error);
    }
  };

  const closeWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('academy-welcome-seen', 'true');
  };

  return (
    <>
      <main className="academy-page">
        {/* Hero Section */}
        <section className="academy-hero">
          <div className="container">
            <div className="hero-header">
              <div className="hero-title-section">
                <h1>Specifys Academy</h1>
                <p className="hero-subtitle">Learn how modern apps work without writing code</p>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Grid */}
        <section className="academy-categories" aria-label="Learning Categories">
          <div className="container">
            <h2 className="text-2xl font-bold mb-6">Browse by Category</h2>
            <div className="categories-grid" id="categories-grid" role="list">
              {loading ? (
                <div className="loading-placeholder">Loading categories...</div>
              ) : categories.length === 0 ? (
                <div className="loading-placeholder">No categories available</div>
              ) : (
                categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/academy/category?category=${category.id}`}
                    className="category-card"
                  >
                    {category.icon && (
                      <div className="category-icon">
                        <i className={category.icon}></i>
                      </div>
                    )}
                    <h3>{category.name}</h3>
                    {category.description && <p>{category.description}</p>}
                    {category.guideCount !== undefined && (
                      <div className="category-meta">
                        <span>{category.guideCount} guides</span>
                      </div>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Points Display Button */}
      <button className="academy-points-btn" id="academy-points-btn" aria-label="View your Academy points">
        <i className="fas fa-trophy"></i>
        <span id="points-btn-text">Points: {points}</span>
      </button>

      {/* Welcome Modal */}
      {showWelcome && (
        <div className="welcome-modal" id="welcome-modal">
          <div className="welcome-modal-backdrop" id="welcome-modal-backdrop" onClick={closeWelcome}></div>
          <div className="welcome-modal-content">
            <div className="welcome-modal-header">
              <h2>Welcome to Specifys Academy</h2>
              <button className="welcome-modal-close" id="welcome-modal-close" onClick={closeWelcome} aria-label="Close">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="welcome-modal-body">
              <div className="welcome-icon">
                <i className="fas fa-graduation-cap"></i>
              </div>
              <h3>Learn How Modern Apps Work</h3>
              <p>
                Specifys Academy is designed to help you understand how modern applications are built and
                work, without needing to write code yourself.
              </p>
              <p>
                Whether you&apos;re a product manager, designer, entrepreneur, or simply curious about
                technology, our guides will help you:
              </p>
              <ul className="welcome-features">
                <li>
                  <i className="fas fa-check-circle"></i> Understand app architecture and structure
                </li>
                <li>
                  <i className="fas fa-check-circle"></i> Learn about security, APIs, databases, and more
                </li>
                <li>
                  <i className="fas fa-check-circle"></i> Communicate better with developers and AI tools
                </li>
                <li>
                  <i className="fas fa-check-circle"></i> Make informed decisions about your projects
                </li>
              </ul>
              <button className="welcome-modal-btn" id="welcome-modal-btn" onClick={closeWelcome}>
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

