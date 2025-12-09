'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuth as useAuthHook } from '@/lib/hooks/useAuth';
import { apiClient as api } from '@/lib/api/client';
import { getFirebaseFirestore } from '@/lib/firebase/init';
import { doc, getDoc } from 'firebase/firestore';
import { formatTextContent, calculateComplexityScore, renderComplexityScore } from '@/lib/utils/spec-renderer';
import { useSpecListener, Spec } from '@/lib/hooks/useSpecListener';
import { SideMenu } from '@/components/features/spec-viewer/SideMenu';
import { ApprovalContainer } from '@/components/features/spec-viewer/ApprovalContainer';
import { Button } from '@/components/ui/Button';
import { OverviewTab } from '@/components/features/spec-viewer/tabs/OverviewTab';
import { TechnicalTab } from '@/components/features/spec-viewer/tabs/TechnicalTab';
import { MarketTab } from '@/components/features/spec-viewer/tabs/MarketTab';
import { DesignTab } from '@/components/features/spec-viewer/tabs/DesignTab';
import { DiagramsTab } from '@/components/features/spec-viewer/tabs/DiagramsTab';
import { AIChatTab } from '@/components/features/spec-viewer/tabs/AIChatTab';
import { PromptsTab } from '@/components/features/spec-viewer/tabs/PromptsTab';
import { ExportTab } from '@/components/features/spec-viewer/tabs/ExportTab';
import { MockupTab } from '@/components/features/spec-viewer/tabs/MockupTab';
import { RawDataTab } from '@/components/features/spec-viewer/tabs/RawDataTab';
import { MindmapTab } from '@/components/features/spec-viewer/tabs/MindmapTab';
import { Notification } from '@/components/features/spec-viewer/Notification';
import { showNotification } from '@/components/features/spec-viewer/Notification';
import { GenerationStatusComponent } from '@/components/features/spec-viewer/GenerationStatus';


function SpecViewerPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const specId = searchParams?.get('id') || null;
  const [initialSpec, setInitialSpec] = useState<Spec | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPro, setIsPro] = useState(false);

  // Check PRO access
  useEffect(() => {
    const checkProAccess = async () => {
      if (!user) {
        setIsPro(false);
        return;
      }

      try {
        const result = await api.get<{ success: boolean; entitlements?: { unlimited?: boolean; plan?: string } }>('/api/credits/entitlements');
        if (result.success && result.entitlements) {
          setIsPro(result.entitlements.unlimited === true || result.entitlements.plan === 'pro');
        } else {
          setIsPro(false);
        }
      } catch (error) {
        setIsPro(false);
      }
    };

    checkProAccess();
  }, [user]);

  // Use real-time listener hook
  const spec = useSpecListener(specId, initialSpec);

  // Show notifications when specs are ready
  useEffect(() => {
    if (!spec) return;

    const status = spec.status;
    if (!status) return;

    // Check if all specs are ready
    const allDone = ['technical', 'market', 'design'].every(
      (stage) => status[stage as keyof typeof status] === 'ready' || status[stage as keyof typeof status] === 'error'
    );

    if (allDone) {
      const allSuccessful = ['technical', 'market', 'design'].every(
        (stage) => status[stage as keyof typeof status] === 'ready'
      );

      if (allSuccessful) {
        showNotification('All specifications generated successfully!', 'success');
      } else {
        showNotification('Some specifications failed to generate. You can retry using the retry buttons.', 'error');
      }
    }
  }, [spec?.status]);

  useEffect(() => {
    // Wait for auth to load before attempting to load spec
    if (authLoading) {
      return;
    }

    // Allow loading specs without authentication (for public/demo specs)
    // The loadSpec function will check permissions and redirect to auth if needed
    if (specId) {
      loadSpec();
    } else {
      setError('Spec ID is required');
      setLoading(false);
    }
  }, [specId, user, router, authLoading]);

  const loadSpec = async () => {
    if (!specId) return;

    // Wait for auth to finish loading before proceeding
    if (authLoading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try loading from Firebase first (direct access - works for public specs)
      const db = getFirebaseFirestore();
      const specDoc = await getDoc(doc(db, 'specs', specId));

      if (!specDoc.exists()) {
        // Spec not found in Firebase - try API (only if user is authenticated)
        if (user) {
          try {
            const result = await api.get<{ success: boolean; spec?: Spec }>(`/api/specs/${specId}`);

            if (result.success && result.spec) {
              setInitialSpec({ ...result.spec, id: specId });
              setLoading(false);
              return;
            } else {
              // API returned success but no spec
              setError('Spec not found');
              setLoading(false);
              return;
            }
          } catch (apiError: any) {
            // If API fails, show error
            console.error('API fallback failed:', apiError);
            if (apiError.status === 404 || apiError.code === 'ENDPOINT_NOT_FOUND') {
              setError('Spec not found');
            } else {
              setError(apiError.message || 'Failed to load specification');
            }
            setLoading(false);
            return;
          }
        }
        
        // Spec not found and no user - show error (don't redirect, just show error)
        setError('Spec not found. Please make sure you are logged in if this is a private specification.');
        setLoading(false);
        return;
      }

      const specData = specDoc.data();

      // Check permissions
      const adminEmails = ['specifysai@gmail.com', 'admin@specifys.ai', 'shalom@specifys.ai'];
      const isPublic = specData.isPublic === true;
      const isOwner = user && specData.userId === user.uid;
      const isAdmin = user && adminEmails.includes(user.email || '');

      // Allow viewing public specs without authentication
      if (!isPublic && !isOwner && !isAdmin) {
        // Only redirect to auth if we're certain the user is not authenticated
        // Since we already wait for authLoading to be false before calling loadSpec,
        // if user is null here, they're truly not authenticated
        if (!user) {
          // For private specs, require authentication
          router.push('/auth');
          setLoading(false);
          return;
        }
        setError('You do not have permission to view this specification.');
        setLoading(false);
        return;
      }

      // Spec found and user has permission - set initial spec for real-time listener
      const loadedSpec = { id: specDoc.id, ...specData } as Spec;
      setInitialSpec(loadedSpec);
    } catch (err: any) {
      console.error('Error loading spec:', err);
      setError(err.message || 'Failed to load specification');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="spec-viewer-page">
        <div className="container">
          <div className="loading">Loading specification...</div>
        </div>
      </div>
    );
  }

  if (error || !spec) {
    return (
      <div className="spec-viewer-page">
        <div className="container">
          <div className="error-message">{error || 'Spec not found'}</div>
          <Button as="a" href="/profile" >
            Back to Profile
          </Button>
        </div>
      </div>
    );
  }

  // Map activeTab to handle 'ai-chat' -> 'chat' mapping
  const handleTabChange = (tabId: string) => {
    // Map 'chat' to 'ai-chat' for consistency with tab content
    const mappedTabId = tabId === 'chat' ? 'ai-chat' : tabId;
    setActiveTab(mappedTabId);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'fa-file-alt', enabled: true },
    { id: 'technical', label: 'Technical', icon: 'fa-code', enabled: spec?.status?.technical === 'ready' },
    { id: 'market', label: 'Market Research', icon: 'fa-chart-line', enabled: spec?.status?.market === 'ready' },
    { id: 'design', label: 'Design & Branding', icon: 'fa-palette', enabled: spec?.status?.design === 'ready' },
    { id: 'diagrams', label: 'Diagrams', icon: 'fa-project-diagram', enabled: !!spec?.diagrams },
    { id: 'ai-chat', label: 'AI Chat', icon: 'fa-robot', enabled: spec?.overviewApproved },
    { id: 'prompts', label: 'Prompts', icon: 'fa-terminal', enabled: spec?.status?.technical === 'ready' && spec?.status?.design === 'ready' },
    { id: 'export', label: 'Export', icon: 'fa-download', enabled: true }
  ];

  return (
    <>
      <div className="spec-viewer-page">
        <SideMenu
          activeTab={activeTab === 'ai-chat' ? 'chat' : activeTab}
          spec={spec}
          onTabChange={handleTabChange}
        />
        <div className="container">
          <div className="page-intro-section">
            <h1 className="page-title">Project Specifications</h1>
            <p className="page-description">
              Comprehensive specifications generated by AI to guide your development process.
              Review, edit, and approve each section to build a complete project blueprint.
            </p>
          </div>

          <div className="spec-content">
            {/* Generation Status - Show only when generating */}
            {spec && (
              <GenerationStatusComponent
                specId={specId || ''}
                isGenerating={
                  spec.status?.technical === 'generating' ||
                  spec.status?.market === 'generating' ||
                  spec.status?.design === 'generating'
                }
              />
            )}
            
            {activeTab === 'overview' && (
              <>
                <ApprovalContainer
                  specId={spec.id}
                  overviewApproved={spec.overviewApproved || false}
                  overview={spec.overview}
                  answers={spec.answers as string[]}
                  onApproved={() => {
                    // Real-time listener will update automatically
                    // Enable chat tab
                    setActiveTab('ai-chat');
                  }}
                  onEditToggle={() => {
                    setIsEditMode(!isEditMode);
                  }}
                />
                <OverviewTab 
                  overview={spec.overview} 
                  specId={spec.id}
                  isPro={isPro}
                  isEditMode={isEditMode}
                  onEditToggle={() => {
                    setIsEditMode(!isEditMode);
                  }}
                  onSave={() => {
                    setIsEditMode(false);
                  }}
                />
              </>
            )}

            {activeTab === 'technical' && (
              <TechnicalTab
                technical={spec.technical}
                specId={spec.id}
                status={spec.status?.technical}
                onRetry={() => {
                  // Real-time listener will update automatically
                  loadSpec();
                }}
              />
            )}

            {activeTab === 'mindmap' && (
              <MindmapTab
                spec={{
                  id: spec.id,
                  overview: spec.overview,
                  technical: spec.technical,
                  mindmap: (spec as any).mindmap,
                }}
              />
            )}

            {activeTab === 'market' && (
              <MarketTab
                market={spec.market}
                specId={spec.id}
                status={spec.status?.market}
                onRetry={() => {
                  // Real-time listener will update automatically
                  loadSpec();
                }}
              />
            )}

            {activeTab === 'design' && (
              <DesignTab
                design={spec.design}
                specId={spec.id}
                status={spec.status?.design}
                onRetry={() => {
                  // Real-time listener will update automatically
                  loadSpec();
                }}
              />
            )}

            {activeTab === 'diagrams' && (
              <DiagramsTab
                diagrams={spec.diagrams}
                specId={spec.id}
                overviewApproved={spec.overviewApproved}
                technicalReady={spec.status?.technical === 'ready'}
                marketReady={spec.status?.market === 'ready'}
                onGenerate={() => {
                  // Real-time listener will update automatically
                  loadSpec();
                }}
              />
            )}

            {activeTab === 'ai-chat' && (
              <AIChatTab
                specId={spec.id}
                enabled={spec.overviewApproved === true}
                specUpdatedAt={spec.updatedAt}
              />
            )}

            {activeTab === 'prompts' && (
              <PromptsTab
                prompts={spec.prompts}
                specId={spec.id}
                overviewApproved={spec.overviewApproved}
                technicalReady={spec.status?.technical === 'ready'}
                designReady={spec.status?.design === 'ready'}
                onGenerate={() => {
                  // Real-time listener will update automatically
                  loadSpec();
                }}
              />
            )}

            {activeTab === 'export' && (
              <ExportTab spec={spec} />
            )}

            {activeTab === 'raw' && (
              <RawDataTab spec={spec} />
            )}

            {activeTab === 'mockup' && (
              <MockupTab
                mockups={spec.mockups}
                specId={spec.id}
                overview={spec.overview}
                design={spec.design}
                technical={spec.technical}
                designReady={spec.status?.design === 'ready'}
                onGenerate={() => {
                  // Real-time listener will update automatically
                  loadSpec();
                }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function SpecViewerPage() {
  return (
    <Suspense fallback={<div className="spec-viewer-page"><div className="container"><div className="loading-placeholder">Loading...</div></div></div>}>
      <SpecViewerPageContent />
    </Suspense>
  );
}

