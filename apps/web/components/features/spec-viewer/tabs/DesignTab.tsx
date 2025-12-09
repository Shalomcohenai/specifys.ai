'use client';

import { formatTextContent } from '@/lib/utils/spec-renderer';
import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { showNotification } from '@/components/features/spec-viewer/Notification';
import { Button } from '@/components/ui/Button';

interface DesignTabProps {
  design: any;
  specId: string;
  status?: string;
  onRetry?: () => void;
}

export function DesignTab({ design, specId, status, onRetry }: DesignTabProps) {
  const { user } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!user || retrying) return;

    setRetrying(true);
    try {
      if (onRetry) {
        onRetry();
      }
    } catch (error: any) {
      console.error('Error retrying design:', error);
      showNotification(error.message || 'Failed to retry design generation', 'error');
    } finally {
      setRetrying(false);
    }
  };

  if (!design && status !== 'error' && status !== 'generating') {
    return (
      <div className="tab-content" id="design-content">
        <div className="content-header">
          <h2><i className="fa fa-paint-brush"></i> Design & Branding</h2>
        </div>
        <div className="content-body" id="design-data">
          <div className="locked-tab-message">
            <h3><i className="fa fa-lock"></i> Design & Branding</h3>
            <p>Please approve the Overview and generate Technical & Market specifications first to create design guidelines.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content" id="design-content">
      <div className="content-header">
        <h2><i className="fa fa-paint-brush"></i> Design & Branding</h2>
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
      <div className="content-body" id="design-data">
        {status === 'generating' ? (
          <div>
            <i className="fa fa-spinner fa-spin"></i>
            <h3>Generating Design & Branding</h3>
            <p>Please wait while we generate your design guidelines...</p>
          </div>
        ) : design ? (
          <div dangerouslySetInnerHTML={{ __html: formatTextContent(design) }} />
        ) : (
          <p>No design data available. Design specification will be generated after technical and market research are ready.</p>
        )}
      </div>
    </div>
  );
}

