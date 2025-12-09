'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getFirebaseFirestore } from '@/lib/firebase/init';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/Button';

interface Guide {
  id: string;
  title: string;
  level?: string;
  summary?: string;
  category: string;
}

interface Category {
  id: string;
  title: string;
  description?: string;
  icon?: string;
}

function AcademyCategoryPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const categoryId = searchParams?.get('category') || null;
  
  const [category, setCategory] = useState<Category | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [filteredGuides, setFilteredGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [topics, setTopics] = useState<string[]>([]);
  const [showTopicFilters, setShowTopicFilters] = useState(false);
  const [userProgress, setUserProgress] = useState<any>(null);

  useEffect(() => {
    if (!categoryId) {
      router.push('/academy');
      return;
    }
    loadCategory();
  }, [categoryId, router]);

  useEffect(() => {
    if (user) {
      loadUserProgress();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [guides, searchQuery, levelFilter, topicFilter]);

  const loadCategory = async () => {
    if (!categoryId) return;

    setLoading(true);
    try {
      const db = getFirebaseFirestore();
      
      // Load category
      const categoryDoc = await getDoc(doc(db, 'academy_categories', categoryId));
      if (!categoryDoc.exists()) {
        router.push('/academy');
        return;
      }

      const categoryData = { id: categoryDoc.id, ...categoryDoc.data() } as Category;
      setCategory(categoryData);

      // Load guides
      const guidesQuery = query(
        collection(db, 'academy_guides'),
        where('category', '==', categoryId),
        orderBy('title')
      );
      const guidesSnapshot = await getDocs(guidesQuery);
      
      const guidesData = guidesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Guide[];

      setGuides(guidesData);
      setFilteredGuides(guidesData);
      
      // Extract unique topics (guide titles)
      const uniqueTopics = [...new Set(guidesData.map(g => g.title))].sort();
      setTopics(uniqueTopics);
    } catch (error) {
      console.error('Error loading category:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProgress = async () => {
    if (!user) return;

    try {
      const db = getFirebaseFirestore();
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserProgress({
          points: data.academyPoints || 0,
          completedGuides: data.completedGuides || [],
          answers: data.academyAnswers || {}
        });
      }
    } catch (error) {
      console.error('Error loading user progress:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...guides];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(guide => {
        const titleMatch = guide.title.toLowerCase().includes(query);
        const summaryMatch = guide.summary?.toLowerCase().includes(query);
        return titleMatch || summaryMatch;
      });
    }

    // Level filter
    if (levelFilter !== 'all') {
      filtered = filtered.filter(guide => guide.level === levelFilter);
    }

    // Topic filter
    if (topicFilter !== 'all') {
      filtered = filtered.filter(guide => guide.title === topicFilter);
    }

    setFilteredGuides(filtered);
  };

  const handleSearchClear = () => {
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className="academy-page">
        <div className="container">
          <div className="loading-placeholder">Loading category...</div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="academy-page">
        <div className="container">
          <div className="loading-placeholder">Category not found</div>
          <Button as="a" href="/academy" >Back to Academy</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="academy-page" itemScope itemType="https://schema.org/CollectionPage">
        {/* Category Header */}
        <section className="academy-category-header">
          <div className="container">
            <Link href="/academy" className="back-link" aria-label="Back to Academy">
              <i className="fas fa-arrow-left" aria-hidden="true"></i> Back to Academy
            </Link>
            <div className="category-header-content">
              <div className="category-title-section">
                <h1 id="category-title" itemProp="name">{category.title}</h1>
                <p id="category-description" className="category-description" itemProp="description">
                  {category.description || ''}
                </p>
              </div>
              <div className="category-search-section">
                <div className="search-wrapper">
                  <i className="fas fa-search search-icon"></i>
                  <input
                    type="search"
                    id="academy-search-input"
                    className="search-input"
                    placeholder="Search guides in this category..."
                    autoComplete="off"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="search-clear"
                      id="search-clear"
                      onClick={handleSearchClear}
                      aria-label="Clear search"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>
              </div>
            </div>
            {searchQuery && (
              <div className="search-results-info" id="search-results-info">
                Found {filteredGuides.length} guide{filteredGuides.length !== 1 ? 's' : ''} matching "{searchQuery}"
              </div>
            )}
          </div>
        </section>

        {/* Guides List */}
        <section className="academy-guides-list">
          <div className="container">
            <div className="guides-header">
              <h2 className="text-2xl font-bold mb-6">Guides</h2>
              <div className="filters-container">
                <div className="filter-group level-filter-group">
                  <label className="filter-label" htmlFor="level-select">Level:</label>
                  <select
                    id="level-select"
                    className="level-select"
                    name="level"
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                  >
                    <option value="all">All Levels</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <div className="filter-group topic-filter-group">
                  <button
                    className="filter-toggle-btn"
                    id="topic-filter-toggle"
                    aria-expanded={showTopicFilters}
                    onClick={() => setShowTopicFilters(!showTopicFilters)}
                  >
                    <span>Filter by Topic</span>
                    <i className={`fas fa-chevron-${showTopicFilters ? 'up' : 'down'}`}></i>
                  </button>
                  {showTopicFilters && (
                    <div className="topic-filters-collapsible" id="topic-filters-collapsible">
                      <div className="topic-filters" id="topic-filters">
                        <button
                          className={`filter-btn ${topicFilter === 'all' ? 'active' : ''}`}
                          data-filter-type="topic"
                          data-value="all"
                          onClick={() => setTopicFilter('all')}
                        >
                          All Topics
                        </button>
                        {topics.map(topic => (
                          <button
                            key={topic}
                            className={`filter-btn ${topicFilter === topic ? 'active' : ''}`}
                            data-filter-type="topic"
                            data-value={topic}
                            onClick={() => setTopicFilter(topic)}
                          >
                            {topic}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="guides-grid" id="guides-grid" role="list">
              {filteredGuides.length === 0 ? (
                <div className="loading-placeholder">No guides found for the selected filter.</div>
              ) : (
                filteredGuides.map(guide => {
                  const levelClass = guide.level ? guide.level.toLowerCase() : 'beginner';
                  return (
                    <Link
                      key={guide.id}
                      href={`/academy/guide?guide=${guide.id}`}
                      className="guide-card"
                      role="listitem"
                      aria-label={`Read ${guide.title} guide`}
                    >
                      <div className="guide-card-header">
                        <h3>{guide.title}</h3>
                        <span
                          className={`level-badge ${levelClass}`}
                          aria-label={`Difficulty: ${guide.level || 'Beginner'}`}
                        >
                          {guide.level || 'Beginner'}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export default function AcademyCategoryPage() {
  return (
    <Suspense fallback={<div className="academy-page"><div className="container"><div className="loading-placeholder">Loading...</div></div></div>}>
      <AcademyCategoryPageContent />
    </Suspense>
  );
}

