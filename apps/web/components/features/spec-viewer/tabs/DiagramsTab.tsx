'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { MermaidDiagram } from '@/components/features/spec-viewer/MermaidDiagram';
import { FullscreenDiagram } from '@/components/features/spec-viewer/FullscreenDiagram';
import { Button } from '@/components/ui/Button';

interface Diagram {
  id: string;
  title: string;
  description?: string;
  mermaidCode: string;
  type: string;
  status?: string;
}

interface DiagramsTabProps {
  diagrams: {
    generated?: boolean;
    diagrams?: Diagram[];
  } | null;
  specId: string;
  overviewApproved?: boolean;
  technicalReady?: boolean;
  marketReady?: boolean;
  onGenerate?: () => void;
}

export function DiagramsTab({
  diagrams,
  specId,
  overviewApproved,
  technicalReady,
  marketReady,
  onGenerate
}: DiagramsTabProps) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [fullscreenDiagram, setFullscreenDiagram] = useState<Diagram | null>(null);

  const canGenerate = overviewApproved && technicalReady && marketReady;
  const hasDiagrams = diagrams?.generated && diagrams?.diagrams && diagrams.diagrams.length > 0;

  const handleGenerate = async () => {
    if (!user || generating || !canGenerate) return;

    setGenerating(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/chat/diagrams/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          specId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate diagrams');
      }

      if (onGenerate) {
        onGenerate();
      }
    } catch (error: any) {
      console.error('Error generating diagrams:', error);
      alert(error.message || 'Failed to generate diagrams');
    } finally {
      setGenerating(false);
    }
  };

  const handleRefresh = async (diagramId: string) => {
    // Refresh single diagram - re-render it
    if (onGenerate) {
      onGenerate();
    }
  };

  const handleRepair = async (diagramId: string, brokenCode: string, errorMessage: string) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/chat/diagrams/repair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          specId,
          diagramId,
          brokenCode,
          diagramType: diagrams?.diagrams?.find(d => d.id === diagramId)?.type || 'flowchart',
          errorMessage
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to repair diagram');
      }

      if (onGenerate) {
        onGenerate();
      }
    } catch (error: any) {
      console.error('Error repairing diagram:', error);
      alert(error.message || 'Failed to repair diagram');
    }
  };

  if (!canGenerate) {
    return (
      <div className="tab-content" id="diagrams-content">
        <div className="content-header">
          <h2><i className="fa fa-sitemap"></i> Diagrams</h2>
        </div>
        <div className="content-body" id="diagrams-data">
          <div className="locked-tab-message">
            <h3><i className="fa fa-lock"></i> Diagrams</h3>
            <p>Please approve the Overview and generate Technical & Market specifications first to create visual diagrams.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasDiagrams) {
    return (
      <div className="tab-content" id="diagrams-content">
        <div className="content-header">
          <h2><i className="fa fa-sitemap"></i> Diagrams</h2>
          <Button
            id="generateDiagramsBtn"
            
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <i className="fa fa-spinner fa-spin"></i> Generating...
              </>
            ) : (
              <>
                <i className="fa fa-magic"></i> Generate Diagrams
              </>
            )}
            </Button>
        </div>
        <div className="content-body" id="diagrams-data">
          <div className="locked-tab-message">
            <h3><i className="fa fa-bar-chart"></i> Diagrams</h3>
            <p>Click "Generate Diagrams" to create visual representations of your specification.</p>
          </div>
        </div>
      </div>
    );
  }

  const validDiagrams = diagrams.diagrams?.filter(d =>
    d && d.id && d.title &&
    d.mermaidCode &&
    typeof d.mermaidCode === 'string' &&
    d.mermaidCode.trim().length > 0
  ) || [];

  if (validDiagrams.length === 0) {
    return (
      <div className="tab-content" id="diagrams-content">
        <div className="content-header">
          <h2><i className="fa fa-sitemap"></i> Diagrams</h2>
        </div>
        <div className="content-body" id="diagrams-data">
          <div className="diagram-error">
            <h3><i className="fa fa-times-circle"></i> No Valid Diagrams</h3>
            <p>No diagrams with valid content found. Please regenerate.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="tab-content" id="diagrams-content">
        <div className="content-header">
          <h2><i className="fa fa-sitemap"></i> Diagrams</h2>
        </div>
        <div className="content-body" id="diagrams-data">
          {validDiagrams.map((diagram) => (
            <MermaidDiagram
              key={diagram.id}
              diagram={diagram}
              onRefresh={() => handleRefresh(diagram.id)}
              onRepair={() => {
                const errorMsg = (diagram as any)._lastError || 'Unknown error';
                handleRepair(diagram.id, diagram.mermaidCode, errorMsg);
              }}
              onFullscreen={() => setFullscreenDiagram(diagram)}
            />
          ))}
        </div>
      </div>
      {fullscreenDiagram && (
        <FullscreenDiagram
          diagram={fullscreenDiagram}
          onClose={() => setFullscreenDiagram(null)}
        />
      )}
    </>
  );
}

