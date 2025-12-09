'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface Diagram {
  id: string;
  title: string;
  description?: string;
  mermaidCode: string;
  type: string;
}

interface FullscreenDiagramProps {
  diagram: Diagram;
  onClose: () => void;
}

export function FullscreenDiagram({ diagram, onClose }: FullscreenDiagramProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const renderDiagram = async () => {
      if (!contentRef.current) return;

      try {
        // Initialize Mermaid
        mermaid.initialize({
          theme: 'base',
          themeVariables: {
            primaryColor: '#FF6B35',
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

        const uniqueId = `mermaid-fullscreen-${diagram.id}-${Date.now()}`;
        const { svg } = await mermaid.render(uniqueId, diagram.mermaidCode);

        if (contentRef.current) {
          contentRef.current.innerHTML = `<div class="mermaid-fullscreen">${svg}</div>`;
          updateTransform();
        }
      } catch (error: any) {
        if (contentRef.current) {
          contentRef.current.innerHTML = `<pre style="color: white; padding: 20px;">${diagram.mermaidCode}</pre>`;
        }
      }
    };

    renderDiagram();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [diagram, onClose]);

  const updateTransform = () => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
      contentRef.current.style.transformOrigin = 'center center';
    }
  };

  useEffect(() => {
    updateTransform();
  }, [zoom, pan]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      id="fullscreenModal"
      className="fullscreen-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
      >
        <div
        >
          <h2>{diagram.title}</h2>
          <div>
            <button
              onClick={handleZoomOut}
              className="btn-icon"
             
            >
              <i className="fa fa-search-minus"></i>
            </button>
            <span>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="btn-icon"
             
            >
              <i className="fa fa-search-plus"></i>
            </button>
            <button
              onClick={handleResetZoom}
              className="btn-icon"
             
            >
              <i className="fa fa-undo"></i> Reset
            </button>
            <button
              onClick={onClose}
              className="btn-icon"
             
            >
              <i className="fa fa-times"></i> Close
            </button>
          </div>
        </div>
        <div
          ref={contentRef}
          id="fullscreenContent"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        ></div>
      </div>
    </div>
  );
}

