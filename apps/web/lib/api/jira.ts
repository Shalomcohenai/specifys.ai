/**
 * Jira API
 * Handles Jira export generation using Cloudflare Worker
 */

const JIRA_WORKER_URL = 'https://jiramaker.shalom-cohen-111.workers.dev/';

export interface JiraExportRequest {
  spec: {
    title: string;
    overview?: any;
    technical?: any;
    market?: any;
    design?: any;
  };
  projectKey?: string;
}

export interface JiraIssue {
  summary: string;
  description: string;
  issueType: 'Epic' | 'Story' | 'Task' | 'Sub-task';
  priority?: string;
  labels?: string[];
  components?: string[];
  customFields?: Record<string, any>;
}

export interface JiraExportResponse {
  success: boolean;
  csv?: string;
  issues?: JiraIssue[];
  error?: {
    message: string;
  };
}

/**
 * Generate Jira export using worker
 */
export async function generateJiraExport(
  request: JiraExportRequest
): Promise<JiraExportResponse> {
  try {
    const response = await fetch(JIRA_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: { message: 'Unknown error' },
      }));
      throw new Error(
        errorData.error?.message || `HTTP ${response.status}`
      );
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || 'Failed to generate Jira export');
    }

    return {
      success: true,
      csv: result.csv,
      issues: result.issues,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Failed to generate Jira export',
      },
    };
  }
}

/**
 * Download Jira CSV file
 */
export function downloadJiraCSV(
  csvContent: string,
  projectKey: string
): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectKey}_jira_export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}



