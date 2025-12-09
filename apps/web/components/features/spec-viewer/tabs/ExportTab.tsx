'use client';

import { useState } from 'react';
import { generateHTMLExport, generateJiraExport as generateJiraExportClient, downloadHTML, downloadJira, extractDiagramSVGs, ExportSections } from '@/lib/utils/export';
import { generateJiraExport, downloadJiraCSV } from '@/lib/api/jira';
import { sendSpecReadyNotification } from '@/lib/api/specs';
import { Button } from '@/components/ui/Button';

interface ExportTabProps {
  spec: {
    id: string;
    title?: string;
    overview?: any;
    technical?: any;
    market?: any;
    design?: any;
    diagrams?: any;
    prompts?: any;
    mockups?: any;
  };
}

export function ExportTab({ spec }: ExportTabProps) {
  const [activeInnerTab, setActiveInnerTab] = useState<'html' | 'jira'>('html');
  const [sections, setSections] = useState<ExportSections>({
    overview: true,
    technical: true,
    market: true,
    design: true,
    diagrams: true,
    prompts: false,
    mockups: false
  });
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [useWorker, setUseWorker] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleSectionToggle = (section: keyof ExportSections) => {
    setSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSelectAll = () => {
    const allSelected = Object.values(sections).every(v => v);
    setSections({
      overview: !allSelected,
      technical: !allSelected,
      market: !allSelected,
      design: !allSelected,
      diagrams: !allSelected,
      prompts: !allSelected,
      mockups: !allSelected
    });
  };

  const handleGenerateHTML = async () => {
    setGenerating(true);
    setProgress(0);

    try {
      setProgress(10);

      // Extract diagram SVGs
      let diagramSVGs: Record<string, string> = {};
      if (sections.diagrams && spec.diagrams?.diagrams) {
        setProgress(30);
        diagramSVGs = await extractDiagramSVGs(spec.diagrams.diagrams);
      }

      setProgress(60);

      // Generate HTML
      const html = await generateHTMLExport(spec as any, sections, diagramSVGs);

      setProgress(90);

      // Download
      const filename = `${spec.title || 'specification'}-${new Date().toISOString().split('T')[0]}.html`;
      downloadHTML(html, filename);

      setProgress(100);
    } catch (error: any) {
      console.error('Error generating HTML export:', error);
      alert(error.message || 'Failed to generate HTML export');
    } finally {
      setGenerating(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const handleGenerateJira = async () => {
    setGenerating(true);
    setProgress(0);

    try {
      setProgress(10);

      if (useWorker) {
        // Use worker for advanced Jira export
        setProgress(30);
        const result = await generateJiraExport({
          spec: {
            title: spec.title || 'Untitled Specification',
            overview: spec.overview,
            technical: spec.technical,
            market: spec.market,
            design: spec.design,
          },
          projectKey: jiraProjectKey || undefined,
        });

        setProgress(70);

        if (result.success && result.csv) {
          setProgress(90);
          const projectKey = jiraProjectKey || 'PROJ';
          downloadJiraCSV(result.csv, projectKey);
          setProgress(100);
        } else {
          throw new Error(result.error?.message || 'Failed to generate Jira export');
        }
      } else {
        // Use client-side export as fallback
        setProgress(50);
        const jira = generateJiraExportClient(spec as any);
        setProgress(90);
        const filename = `${spec.title || 'specification'}-${new Date().toISOString().split('T')[0]}.txt`;
        downloadJira(jira, filename);
        setProgress(100);
      }
    } catch (error: any) {
      console.error('Error generating Jira export:', error);
      alert(error.message || 'Failed to generate Jira export');
    } finally {
      setGenerating(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const handleSendEmailNotification = async () => {
    setSendingEmail(true);
    try {
      const result = await sendSpecReadyNotification(spec.id);
      if (result.success) {
        alert('Email notification sent successfully!');
      } else {
        alert(result.message || 'Failed to send email notification');
      }
    } catch (error: any) {
      alert(error.message || 'Failed to send email notification');
    } finally {
      setSendingEmail(false);
    }
  };

  const allSelected = Object.values(sections).every(v => v);
  const anySelected = Object.values(sections).some(v => v);

  // Check if all sections are ready
  const allSectionsReady = !!(
    spec.overview &&
    spec.technical &&
    spec.market &&
    spec.design
  );

  return (
    <div className="tab-content" id="export-content">
      <div className="content-header">
        <h2><i className="fa fa-download"></i> Export Specification</h2>
        {allSectionsReady && (
            <Button
            
            onClick={handleSendEmailNotification}
            disabled={sendingEmail}
           
          >
            {sendingEmail ? (
              <>
                <i className="fa fa-spinner fa-spin"></i> Sending...
              </>
            ) : (
              <>
                <i className="fa fa-envelope"></i> Send Email Notification
              </>
            )}
          </Button>
        )}
      </div>
      <div className="content-body" id="export-data">
        {/* Inner Tabs */}
        <div className="export-inner-tabs">
          <button
            className={`export-inner-tab ${activeInnerTab === 'html' ? 'active' : ''}`}
            onClick={() => setActiveInnerTab('html')}
          >
            HTML Export
          </button>
          <button
            className={`export-inner-tab ${activeInnerTab === 'jira' ? 'active' : ''}`}
            onClick={() => setActiveInnerTab('jira')}
          >
            Jira Export
          </button>
        </div>

        {/* HTML Export Tab */}
        {activeInnerTab === 'html' && (
          <div id="export-html-content">
            <div>
              <h3>Select Sections to Export</h3>
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={sections.overview}
                    onChange={() => handleSectionToggle('overview')}
                  />
                  <span>Overview</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={sections.technical}
                    onChange={() => handleSectionToggle('technical')}
                  />
                  <span>Technical</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={sections.market}
                    onChange={() => handleSectionToggle('market')}
                  />
                  <span>Market Research</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={sections.design}
                    onChange={() => handleSectionToggle('design')}
                  />
                  <span>Design & Branding</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={sections.diagrams}
                    onChange={() => handleSectionToggle('diagrams')}
                  />
                  <span>Diagrams</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={sections.prompts}
                    onChange={() => handleSectionToggle('prompts')}
                  />
                  <span>Prompts</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={sections.mockups}
                    onChange={() => handleSectionToggle('mockups')}
                  />
                  <span>Mockups</span>
                </label>
              </div>
              <Button
                onClick={handleSelectAll}
                
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            {progress > 0 && (
              <div>
                <div>
                  <div
                  >
                    {progress}%
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleGenerateHTML}
              disabled={generating || !anySelected}
              
            >
              {generating ? (
                <>
                  <i className="fa fa-spinner fa-spin"></i> Generating...
                </>
              ) : (
                <>
                  <i className="fa fa-download"></i> Generate & Download HTML
                </>
              )}
            </Button>
          </div>
        )}

        {/* Jira Export Tab */}
        {activeInnerTab === 'jira' && (
          <div id="export-jira-content">
            <div>
              <p>Export your specification in Jira format for easy import into Jira issues.</p>
              <p>
                The system will automatically create Epics, Stories, Tasks, and Sub-tasks based on your spec content.
              </p>
            </div>

            <div>
              <label>
                <input
                  type="checkbox"
                  checked={useWorker}
                  onChange={(e) => setUseWorker(e.target.checked)}
                />
                <span>Use advanced worker export (recommended)</span>
              </label>
            </div>

            {useWorker && (
              <div>
                <label htmlFor="jira-project-key">
                  Jira Project Key (optional)
                </label>
                <input
                  type="text"
                  id="jira-project-key"
                  value={jiraProjectKey}
                  onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
                  placeholder="e.g., PROJ"
                  maxLength={10}
                />
                <small>
                  The project key for your Jira project (e.g., PROJ, APP, DEV). Leave empty for generic export.
                </small>
              </div>
            )}

            {progress > 0 && (
              <div>
                <div>
                  <div
                  >
                    {progress}%
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleGenerateJira}
              disabled={generating}
              
            >
              {generating ? (
                <>
                  <i className="fa fa-spinner fa-spin"></i> Generating...
                </>
              ) : (
                <>
                  <i className="fa fa-download"></i> Generate & Download Jira Format
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

