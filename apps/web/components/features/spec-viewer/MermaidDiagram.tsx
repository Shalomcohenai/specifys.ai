'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface Diagram {
  id: string;
  title: string;
  description?: string;
  mermaidCode: string;
  type: string;
  status?: string;
  _isValid?: boolean;
  _lastError?: string;
}

interface MermaidDiagramProps {
  diagram: Diagram;
  onRefresh?: () => void;
  onRepair?: () => void;
  onFullscreen?: () => void;
}

export function MermaidDiagram({ diagram, onRefresh, onRepair, onFullscreen }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'generating' | 'ready' | 'error'>('generating');
  const [error, setError] = useState<string | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initializeMermaid = async () => {
      if (!containerRef.current) return;

      try {
        // Initialize Mermaid with custom theme
        mermaid.initialize({
          theme: 'base',
          themeVariables: {
            primaryColor: '#FF6B35', // Using primary color from design system
            primaryTextColor: '#333333',
            primaryBorderColor: '#FF6B35',
            lineColor: '#333333',
            secondaryColor: '#f5f5f5',
            tertiaryColor: '#ffffff',
            background: '#ffffff',
            mainBkg: '#ffffff',
            secondBkg: '#f5f5f5',
            tertiaryBkg: '#ffffff'
          }
        });

        // Validate Mermaid code
        if (!diagram.mermaidCode || typeof diagram.mermaidCode !== 'string' || diagram.mermaidCode.trim().length === 0) {
          throw new Error('Invalid or empty Mermaid code');
        }

        // Clear container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // Create unique ID for this diagram
        const uniqueId = `mermaid-${diagram.id}-${Date.now()}`;

        // Render diagram
        const { svg } = await mermaid.render(uniqueId, diagram.mermaidCode);

        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setStatus('ready');
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setError(err.message || 'Failed to render diagram');
          
          if (containerRef.current) {
            const needsAIRepair = isSyntaxError(err);
            containerRef.current.innerHTML = `
              <div class="diagram-error">
                <h4><i class="fa fa-exclamation-triangle"></i> ${needsAIRepair ? 'Syntax Error' : 'Rendering Error'}</h4>
                <p>${needsAIRepair ? 'Diagram has syntax errors. Click "Repair" to fix automatically.' : 'Failed to render diagram: ' + err.message}</p>
                <details style="margin-top: 10px;">
                  <summary className="cursor-pointer text-gray-600">Show Mermaid code</summary>
                  <pre className="bg-gray-50 p-2.5 mt-2.5 rounded max-h-[200px] overflow-y-auto text-xs">${diagram.mermaidCode}</pre>
                </details>
              </div>
            `;
          }
        }
      }
    };

    initializeMermaid();

    return () => {
      isMounted = false;
    };
  }, [diagram]);

  const isSyntaxError = (error: any): boolean => {
    if (!error || !error.message) return false;
    
    const errorMsg = error.message.toLowerCase();
    const syntaxErrorKeywords = [
      'syntax', 'parse', 'invalid', 'expecting', 'unexpected',
      'missing', 'malformed', 'broken', 'error parsing',
      'syntax error', 'invalid character', 'unknown token'
    ];
    
    return syntaxErrorKeywords.some(keyword => errorMsg.includes(keyword));
  };

  const handleRepair = async () => {
    if (isRepairing || !onRepair) return;
    setIsRepairing(true);
    try {
      await onRepair();
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="diagram-container" id={`diagram-${diagram.id}`}>
      <div className="diagram-header">
        <div>
          <h3>{diagram.title}</h3>
          {diagram.description && (
            <p className="diagram-description">
              {diagram.description}
            </p>
          )}
        </div>
        <div className="diagram-controls">
          {onFullscreen && (
            <button onClick={onFullscreen} className="btn-icon" title="Fullscreen">
              <i className="fa fa-expand"></i>
            </button>
          )}
          {status === 'error' && onRefresh && (
            <button onClick={onRefresh} className="btn-icon" title="Refresh">
              <i className="fa fa-refresh"></i>
            </button>
          )}
          {status === 'error' && isSyntaxError({ message: error || '' }) && onRepair && (
            <button
              onClick={handleRepair}
              className="btn-icon"
              title="Repair Diagram"
              disabled={isRepairing}
            >
              {isRepairing ? (
                <i className="fa fa-spinner fa-spin"></i>
              ) : (
                <i className="fa fa-tools"></i>
              )}
            </button>
          )}
        </div>
      </div>
      <div className="diagram-content" ref={containerRef}>
        {status === 'generating' && (
          <div className="diagram-status">
            <div className="status-indicator generating"></div>
            <span className="status-text">Generating...</span>
            <div className="diagram-loading">🔄 Rendering diagram...</div>
          </div>
        )}
      </div>
    </div>
  );
}

