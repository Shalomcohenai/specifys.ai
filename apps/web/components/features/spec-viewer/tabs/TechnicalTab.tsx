'use client';

import { formatTextContent } from '@/lib/utils/spec-renderer';
import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import { showNotification } from '@/components/features/spec-viewer/Notification';
import { Button } from '@/components/ui/Button';

interface TechnicalTabProps {
  technical: any;
  specId: string;
  status?: string;
  onRetry?: () => void;
}

export function TechnicalTab({ technical, specId, status, onRetry }: TechnicalTabProps) {
  const { user } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!user || retrying) return;

    setRetrying(true);
    try {
      const token = await user.getIdToken();
      // Call retry endpoint - need to check what endpoint exists
      // For now, we'll just reload the spec
      if (onRetry) {
        onRetry();
      }
    } catch (error: any) {
      console.error('Error retrying technical:', error);
      showNotification(error.message || 'Failed to retry technical generation', 'error');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="tab-content" id="technical-content">
      <div className="content-header">
        <h2><i className="fa fa-cog"></i> Technical Specification</h2>
        {status === 'error' && (
          <Button
            
            className="retry-btn"
            onClick={handleRetry}
            disabled={retrying}
           
          >
            {retrying ? (
              <>
                <i className="fa fa-spinner fa-spin"></i> Retrying...
              </>
            ) : (
              <>
                <i className="fa fa-refresh"></i> Retry
              </>
            )}
          </Button>
        )}
      </div>
      <div className="content-body" id="technical-data">
        {status === 'generating' ? (
          <div>
            <i className="fa fa-spinner fa-spin"></i>
            <h3>Generating Technical Specification</h3>
            <p>Please wait while we generate your technical specification...</p>
          </div>
        ) : technical ? (
          <div dangerouslySetInnerHTML={{ __html: formatTextContent(technical) }} />
        ) : (
          <p>No technical data available. Technical specification will be generated after you approve the overview.</p>
        )}
      </div>
    </div>
  );
}

