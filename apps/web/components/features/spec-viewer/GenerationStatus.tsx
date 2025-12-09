'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getGenerationStatus, GenerationStatus } from '@/lib/api/specs';

interface GenerationStatusProps {
  specId: string;
  isGenerating: boolean;
}

export function GenerationStatusComponent({ specId, isGenerating }: GenerationStatusProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isGenerating || !user || !specId) {
      setStatus(null);
      return;
    }

    // Poll for status every 3 seconds while generating
    const pollInterval = setInterval(async () => {
      try {
        setLoading(true);
        const result = await getGenerationStatus(specId);
        setStatus(result);
        setError(null);
        
        // Stop polling if job is completed or failed
        if (result.job && (result.job.status === 'completed' || result.job.status === 'failed')) {
          clearInterval(pollInterval);
        }
      } catch (err: any) {
        // Silently handle 404 - endpoint may not be available in dev environment
        if (err.status === 404 || err.code === 'ENDPOINT_NOT_FOUND') {
          // Endpoint not available, stop polling
          clearInterval(pollInterval);
          setStatus(null);
          return;
        }
        console.error('Error fetching generation status:', err);
        setError(err.message || 'Failed to fetch status');
      } finally {
        setLoading(false);
      }
    }, 3000);

    // Initial fetch
    getGenerationStatus(specId)
      .then(setStatus)
      .catch((err: any) => {
        // Silently handle 404 - endpoint may not be available in dev environment
        if (err.status === 404 || err.code === 'ENDPOINT_NOT_FOUND') {
          console.log('Generation status endpoint not available, skipping status display');
          return;
        }
        console.error('Error fetching initial generation status:', err);
        setError(err.message || 'Failed to fetch status');
      });

    return () => {
      clearInterval(pollInterval);
    };
  }, [specId, isGenerating, user]);

  if (!isGenerating || !status) {
    return null;
  }

  const job = status.job;
  const queueStatus = status.queueStatus;

  const getStatusLabel = (jobStatus?: string): string => {
    switch (jobStatus) {
      case 'completed':
        return 'Completed';
      case 'processing':
        return 'Processing';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  const formatDuration = (ms: number | null): string => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4 mb-5">
      <div className="flex justify-between items-center mb-3">
        <h3 className="m-0 text-base font-semibold">
          <i className="fa fa-cog fa-spin mr-2"></i>
          Generation Status
        </h3>
        {job && (
          <span
            className="px-3 py-1 rounded font-semibold text-xs"
          >
            {getStatusLabel(job.status)}
          </span>
        )}
      </div>

      {error && (
        <div className="text-sm mb-3">
          <i className="fa fa-exclamation-circle mr-1.5"></i>
          {error}
        </div>
      )}

      {job && (
        <div className="text-sm">
          <div className="mb-2">
            <strong>Job ID:</strong> {job.id}
          </div>
          {job.startedAt && (
            <div className="mb-2">
              <strong>Duration:</strong> {formatDuration(Date.now() - job.startedAt)}
            </div>
          )}
          {job.error && (
            <div className="mt-2 p-2 rounded">
              <strong>Error:</strong> {job.error.message || 'Unknown error'}
              {job.error.retryCount !== undefined && (
                <div className="mt-1 text-xs">
                  Retries: {job.error.retryCount} / 2
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {queueStatus && (
        <div className="mt-3 pt-3 border-t border-gray-300 text-[13px]">
          <div className="flex gap-4 flex-wrap">
            <div>
              <strong>Queue:</strong> {queueStatus.queueLength} waiting
            </div>
            <div>
              <strong>Active:</strong> {queueStatus.activeJobs}
            </div>
            <div>
              <strong>Total Jobs:</strong> {queueStatus.totalJobs}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-2 text-xs">
          <i className="fa fa-spinner fa-spin mr-1.5"></i>
          Updating status...
        </div>
      )}
    </div>
  );
}

