'use client';

import { formatTextContent } from '@/lib/utils/spec-renderer';
import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { showNotification } from '@/components/features/spec-viewer/Notification';
import { Button } from '@/components/ui/Button';

interface MarketTabProps {
  market: any;
  specId: string;
  status?: string;
  onRetry?: () => void;
}

export function MarketTab({ market, specId, status, onRetry }: MarketTabProps) {
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
      console.error('Error retrying market:', error);
      showNotification(error.message || 'Failed to retry market generation', 'error');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="tab-content" id="market-content">
      <div className="content-header">
        <h2><i className="fa fa-bar-chart"></i> Market Research</h2>
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
      <div className="content-body" id="market-data">
        {status === 'generating' ? (
          <div>
            <i className="fa fa-spinner fa-spin"></i>
            <h3>Generating Market Research</h3>
            <p>Please wait while we generate your market research...</p>
          </div>
        ) : market ? (
          <div dangerouslySetInnerHTML={{ __html: formatTextContent(market) }} />
        ) : (
          <p>No market research data available. Market research will be generated after you approve the overview.</p>
        )}
      </div>
    </div>
  );
}

