'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient as api } from '@/lib/api/client';
import { showNotification } from './Notification';
import { Button } from '@/components/ui/Button';

interface ApprovalContainerProps {
  specId: string;
  overviewApproved: boolean;
  overview?: any;
  answers?: string[];
  onApproved: () => void;
  onEditToggle?: () => void;
}

export function ApprovalContainer({ specId, overviewApproved, overview, answers, onApproved, onEditToggle }: ApprovalContainerProps) {
  const { user } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const handleApprove = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const token = await user.getIdToken();
      
      // First, update Firebase to mark overview as approved
      const { getFirebaseFirestore } = await import('@/lib/firebase/init');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const db = getFirebaseFirestore();
      
      await updateDoc(doc(db, 'specs', specId), {
        overviewApproved: true,
        status: {
          overview: 'ready',
          technical: 'generating',
          market: 'generating',
          design: 'generating'
        },
        updatedAt: serverTimestamp()
      });

      // Then call generate-all to start parallel generation
      // Get overview and answers from current spec data
      const overviewContent = typeof overview === 'string' ? overview : JSON.stringify(overview || {});
      const answersArray = answers || [];
      
      try {
        const result = await api.post<{ success: boolean; message?: string }>(
          `/api/specs/${specId}/generate-all`,
          {
            overview: overviewContent,
            answers: answersArray
          }
        );
        
        if (result.success) {
          showNotification('Overview approved! Generating specifications...', 'success');
          onApproved();
        } else {
          throw new Error(result.message || 'Failed to start generation');
        }
      } catch (apiError: any) {
        // If API endpoint doesn't exist (404), that's okay - Firestore update is enough
        // The real-time listener will pick up the status changes
        if (apiError.status === 404 || apiError.code === 'ENDPOINT_NOT_FOUND') {
          console.log('Generate-all endpoint not available, relying on Firestore updates');
          showNotification('Overview approved! Generating specifications...', 'success');
          onApproved();
        } else {
          throw apiError;
        }
      }
    } catch (error: any) {
      console.error('Error approving overview:', error);
      showNotification(error.message || 'Failed to approve overview', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (overviewApproved) {
    return null; // Don't show approval container if already approved
  }

  return (
    <div id="approval-container" className="approval-container">
      <div className="approval-message">
        <i className="fa fa-info-circle"></i>
        <span>
          Please review the Overview specification below. You can edit it if needed (PRO users only), then approve to generate Technical and Market specifications.
        </span>
      </div>
      <div className="approval-actions">
        <Button
          id="editBtn"
          
          className={!isPro ? 'locked' : ''}
          onClick={onEditToggle}
          disabled={!isPro || loading}
          title={!isPro ? 'Editing is available for PRO users only' : ''}
        >
          {isPro ? (
            <>
              <i className="fa fa-pencil"></i> Edit
            </>
          ) : (
            <>
              <i className="fa fa-lock"></i> Edit <span className="pro-badge">(PRO)</span>
            </>
          )}
          </Button>
        <Button
          id="approveBtn"
          
          onClick={handleApprove}
          disabled={loading}
        >
          {loading ? (
            <>
              <i className="fa fa-spinner fa-spin"></i> Approving...
            </>
          ) : (
            <>
              <i className="fa fa-check"></i> Approve Overview
            </>
          )}
          </Button>
      </div>
    </div>
  );
}

