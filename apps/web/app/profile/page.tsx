'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient as api } from '@/lib/api/client';
import { getFirebaseFirestore } from '@/lib/firebase/init';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { TransactionsTab } from '@/components/features/profile/tabs/TransactionsTab';
import { SubscriptionTab } from '@/components/features/profile/tabs/SubscriptionTab';
import { PurchasesTab } from '@/components/features/profile/tabs/PurchasesTab';

interface Spec {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
}

interface Tool {
  id: string;
  name: string;
  category?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [specsCount, setSpecsCount] = useState(0);
  const [credits, setCredits] = useState<number | string>('—');
  const [toolsCount, setToolsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);
  const [activeContentTab, setActiveContentTab] = useState<'tools' | 'transactions' | 'subscription' | 'purchases'>('tools');

  useEffect(() => {
    // Wait a bit for auth to load before redirecting
    if (!authLoading && !user) {
      // Small delay to ensure auth state is fully loaded
      const timer = setTimeout(() => {
        if (!user) {
          router.push('/auth');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load specs - try API first, fallback to Firestore
      let specsLoaded = false;
      try {
        const specsResult = await api.get<{ success: boolean; specs?: Spec[] }>('/api/specs');

        if (specsResult.success && specsResult.specs) {
          setSpecs(specsResult.specs);
          setSpecsCount(specsResult.specs.length);
          specsLoaded = true;
        }
      } catch (specsError: any) {
        // If API fails, try loading directly from Firestore as fallback
        console.warn('Failed to load specs from API, trying Firestore fallback:', specsError);
        
        try {
          const db = getFirebaseFirestore();
          // Try with orderBy first (requires index), fallback to without orderBy if it fails
          let specsQuery;
          try {
            specsQuery = query(
              collection(db, 'specs'),
              where('userId', '==', user.uid),
              orderBy('createdAt', 'desc')
            );
          } catch (queryError: any) {
            // If orderBy fails (missing index), try without it
            console.warn('OrderBy query failed, trying without orderBy:', queryError);
            specsQuery = query(
              collection(db, 'specs'),
              where('userId', '==', user.uid)
            );
          }
          
          const specsSnapshot = await getDocs(specsQuery);
          const specsData: Spec[] = specsSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || 'Untitled Specification',
              createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || null
            };
          });
          
          // Sort manually if orderBy wasn't used
          if (specsData.length > 0 && !specsData[0].createdAt) {
            specsData.sort((a, b) => {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              return dateB - dateA; // Descending order
            });
          }
          
          setSpecs(specsData);
          setSpecsCount(specsData.length);
          specsLoaded = true;
          console.log(`✅ Loaded ${specsData.length} specs from Firestore (fallback)`);
        } catch (firestoreError: any) {
          // If Firestore also fails, just log and continue
          console.error('Failed to load specs from Firestore:', firestoreError);
          setSpecs([]);
          setSpecsCount(0);
        }
      }

      // Load user info and credits
      try {
        const userResult = await api.get<{
          success: boolean;
          user?: any;
          credits?: number;
          isAdmin?: boolean;
        }>('/api/users/me');

        if (userResult.success) {
          if (userResult.user?.unlimited) {
            setCredits('∞');
          } else {
            setCredits(userResult.credits || 0);
          }
          setIsAdmin(userResult.isAdmin || false);
        }
      } catch (userError: any) {
        // If user endpoint fails, just log and continue
        console.warn('Failed to load user info:', userError);
      }

      // Load saved tools (if API exists)
      // For now, set to empty
      setTools([]);
      setToolsCount(0);
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleDeleteSpec = async (specId: string) => {
    if (!confirm('Are you sure you want to delete this specification?')) return;

    try {
      await api.delete(`/api/specs/${specId}`);
      setSpecs(specs.filter((s) => s.id !== specId));
      setSpecsCount(specsCount - 1);
    } catch (error) {
      console.error('Error deleting spec:', error);
      alert('Failed to delete specification');
    }
  };

  const filteredAndSortedSpecs = specs
    .filter((spec) => spec.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'a-z':
          return a.title.localeCompare(b.title);
        case 'z-a':
          return b.title.localeCompare(a.title);
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  if (authLoading || loading) {
    return (
      <div className="profile-container">
        <div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const firstLetter = displayName.charAt(0).toUpperCase();

  return (
    <>
      <main className="profile-container">
        {/* User Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar-section">
            <div className="avatar-placeholder" id="user-avatar">
              <span id="avatar-initial">{firstLetter}</span>
            </div>
            <div className="profile-actions-buttons">
              <button
                className="personal-info-btn"
                onClick={() => setShowPersonalInfo(true)}
                title="Personal Information"
              >
                <i className="fas fa-user-circle"></i> Personal Info
              </button>
              {isAdmin && (
                <Link href="/admin-dashboard" className="admin-dashboard-btn" title="Admin Dashboard">
                  <i className="fas fa-user-shield"></i> Admin Dashboard
                </Link>
              )}
              <button className="logout-btn-small" onClick={handleLogout} title="Sign Out">
                Sign Out
              </button>
            </div>
          </div>
          <div className="profile-info">
            <h2 id="user-name">{displayName}</h2>
            <p id="user-email">{user.email}</p>
          </div>
          <div className="profile-stats">
            <div className="stat-item">
              <div className="stat-number" id="specs-count">
                {specsCount}
              </div>
              <div className="stat-label">Specs</div>
            </div>
            <div className="stat-item">
              <div className="stat-number" id="specs-remaining-count">
                {credits}
              </div>
              <div className="stat-label">Remaining Specification Credits</div>
            </div>
            <div className="stat-item">
              <div className="stat-number" id="saved-tools-count">
                {toolsCount}
              </div>
              <div className="stat-label">Tools</div>
            </div>
          </div>
        </div>

        {/* Workspace Section */}
        <div className="profile-specs-section">
          <div className="section-header">
            <h3>Workspace</h3>
            <div className="section-actions">
              <Link href="/" className="create-app-btn" title="Create New Specification">
                <i className="fas fa-plus"></i>
              </Link>
            </div>
          </div>

          {/* Search and Sort */}
          <div className="workspace-controls">
            <input
              type="text"
              id="workspace-search"
              placeholder="Search workspace items..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
             
            />
            <select
              id="workspace-sort"
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
             
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="a-z">A-Z</option>
              <option value="z-a">Z-A</option>
            </select>
          </div>

          <div id="workspace-container" className="workspace-grid">
            {filteredAndSortedSpecs.length === 0 ? (
              <div className="loading">No specifications found</div>
            ) : (
              filteredAndSortedSpecs.map((spec) => (
                <div key={spec.id} className="workspace-item">
                  <Link href={`/spec-viewer?id=${spec.id}`} className="workspace-card">
                    <h4>{spec.title}</h4>
                    <p className="workspace-meta">
                      Created: {new Date(spec.createdAt).toLocaleDateString()}
                    </p>
                  </Link>
                  <button
                    className="workspace-delete-btn"
                    onClick={() => handleDeleteSpec(spec.id)}
                    title="Delete"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* User's Content Section - Saved Tools */}
        <div className="profile-specs-section">
          <div className="section-header">
            <h3>My Content</h3>
          </div>

          <div className="tabbed-section">
            <div className="tab-header">
              <div className="tab-buttons">
                <button
                  className={`tab-button ${activeContentTab === 'tools' ? 'active' : ''}`}
                  onClick={() => setActiveContentTab('tools')}
                >
                  <i className="fas fa-wrench"></i> Saved Tools
                </button>
                <button
                  className={`tab-button ${activeContentTab === 'transactions' ? 'active' : ''}`}
                  onClick={() => setActiveContentTab('transactions')}
                >
                  <i className="fas fa-history"></i> Transactions
                </button>
                <button
                  className={`tab-button ${activeContentTab === 'subscription' ? 'active' : ''}`}
                  onClick={() => setActiveContentTab('subscription')}
                >
                  <i className="fas fa-crown"></i> Subscription
                </button>
                <button
                  className={`tab-button ${activeContentTab === 'purchases' ? 'active' : ''}`}
                  onClick={() => setActiveContentTab('purchases')}
                >
                  <i className="fas fa-shopping-bag"></i> Purchases
                </button>
              </div>
            </div>
            <div className="tab-content expanded">
              {activeContentTab === 'tools' && (
                <div className="tab-pane active" id="tools-tab">
                  <div id="tools-container" className="apps-grid">
                    {tools.length === 0 ? (
                      <div className="loading">No saved tools</div>
                    ) : (
                      tools.map((tool) => (
                        <div key={tool.id} className="app-card">
                          <h4>{tool.name}</h4>
                          {tool.category && <p className="app-category">{tool.category}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              {activeContentTab === 'transactions' && (
                <div className="tab-pane active" id="transactions-tab">
                  <TransactionsTab />
                </div>
              )}
              {activeContentTab === 'subscription' && (
                <div className="tab-pane active" id="subscription-tab">
                  <SubscriptionTab />
                </div>
              )}
              {activeContentTab === 'purchases' && (
                <div className="tab-pane active" id="purchases-tab">
                  <PurchasesTab />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Personal Information Side Panel */}
      {showPersonalInfo && (
        <div id="personalInfoPanel" className="personal-info-panel">
          <div className="panel-overlay" onClick={() => setShowPersonalInfo(false)}></div>
          <div className="panel-content">
            <div className="panel-header">
              <h2>
                <i className="fas fa-user-circle"></i> Account & Subscription
              </h2>
              <button className="panel-close" onClick={() => setShowPersonalInfo(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="panel-body" id="personalInfoContent">
              <div className="info-section">
                <h3>Personal Information</h3>
                <div className="info-card">
                  <div className="info-row">
                    <label>Display Name</label>
                    <div className="info-value">
                      <span id="info-display-name">{displayName}</span>
                    </div>
                  </div>
                  <div className="info-row">
                    <label>Email</label>
                    <div className="info-value" id="info-email">
                      {user.email}
                    </div>
                  </div>
                  <div className="info-row">
                    <label>Account Created</label>
                    <div className="info-value" id="info-created">
                      {user.metadata?.creationTime
                        ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3>Subscription Details</h3>
                <div className="info-card">
                  <div className="info-row">
                    <label>Plan Type</label>
                    <div className="info-value">
                      <span id="info-plan" className="plan-badge">
                        {credits === '∞' ? 'Pro' : 'Free'}
                      </span>
                    </div>
                  </div>
                  <div className="info-row">
                    <label>Specifications</label>
                    <div className="info-value" id="info-specs">
                      {credits === '∞'
                        ? 'Unlimited specifications available'
                        : `${credits} specification ${credits === 1 ? 'credit' : 'credits'} available`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

