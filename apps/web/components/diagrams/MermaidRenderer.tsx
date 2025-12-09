'use client';

import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidRendererProps {
  containerId?: string;
}

/**
 * Component that initializes and renders Mermaid diagrams in the page
 * Looks for elements with class 'mermaid' and renders them
 */
export function MermaidRenderer({ containerId }: MermaidRendererProps) {
  const initializedRef = useRef(false);

  useEffect(() => {
    // Initialize Mermaid once
    if (!initializedRef.current) {
      mermaid.initialize({
        theme: 'default',
        startOnLoad: false,
        securityLevel: 'loose',
        fontFamily: 'inherit',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
        },
      });
      initializedRef.current = true;
    }

    // Find all mermaid code blocks and render them
    const renderMermaidDiagrams = async () => {
      // Determine the container to search within
      const container = containerId 
        ? document.getElementById(containerId) || document.querySelector(`#${containerId}`)
        : document;
      
      if (!container) {
        return;
      }

      // Look for div.mermaid elements (from our custom renderer)
      const mermaidDivs = container.querySelectorAll('div.mermaid:not([data-processed])');
      
      // Also look for pre.mermaid elements (direct mermaid pre blocks)
      const mermaidPreBlocks = container.querySelectorAll('pre.mermaid:not([data-processed])');
      
      // Also look for pre > code with mermaid language (fallback for standard markdown)
      const mermaidCodeBlocks = container.querySelectorAll('pre code.language-mermaid, pre code[class*="mermaid"]');

      // Process mermaid divs first (from our custom renderer)
      for (const element of mermaidDivs) {
        // Skip if already rendered
        if (element.getAttribute('data-processed') === 'true') {
          continue;
        }

        try {
          const mermaidCode = element.textContent || element.innerHTML || '';
          if (!mermaidCode.trim()) {
            continue;
          }

          const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { svg } = await mermaid.render(uniqueId, mermaidCode.trim());
          element.innerHTML = svg;
          element.setAttribute('data-processed', 'true');
        } catch (error: any) {
          console.error('Error rendering Mermaid diagram:', error);
          element.setAttribute('data-processed', 'true');
          // Show error message
          const errorDiv = document.createElement('div');
          errorDiv.className = 'mermaid-error';
          errorDiv.style.cssText = 'padding: 1rem; margin: 1rem 0; background: #fee; border: 1px solid #fcc; border-radius: 4px; color: #c33;';
          errorDiv.innerHTML = `
            <strong>Mermaid Diagram Error:</strong>
            <pre style="margin-top: 0.5rem; font-size: 0.875rem; overflow-x: auto; white-space: pre-wrap;">${error.message || 'Failed to render diagram'}</pre>
          `;
          element.parentElement?.replaceChild(errorDiv, element);
        }
      }

      // Process pre.mermaid blocks (like in why page)
      for (const preElement of mermaidPreBlocks) {
        // Skip if already processed
        if (preElement.getAttribute('data-processed') === 'true') {
          continue;
        }

        try {
          const mermaidCode = preElement.textContent || '';
          if (!mermaidCode.trim()) {
            continue;
          }

          // Create a new div for mermaid
          const mermaidDiv = document.createElement('div');
          mermaidDiv.className = 'mermaid';
          mermaidDiv.textContent = mermaidCode.trim();
          mermaidDiv.setAttribute('data-processed', 'true');
          
          // Replace the pre element with the mermaid div
          preElement.replaceWith(mermaidDiv);
          
          // Render this new div
          const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { svg } = await mermaid.render(uniqueId, mermaidCode.trim());
          mermaidDiv.innerHTML = svg;
        } catch (error: any) {
          console.error('Error rendering Mermaid diagram:', error);
          preElement.setAttribute('data-processed', 'true');
          // Show error message
          const errorDiv = document.createElement('div');
          errorDiv.className = 'mermaid-error';
          errorDiv.style.cssText = 'padding: 1rem; margin: 1rem 0; background: #fee; border: 1px solid #fcc; border-radius: 4px; color: #c33;';
          errorDiv.innerHTML = `
            <strong>Mermaid Diagram Error:</strong>
            <pre style="margin-top: 0.5rem; font-size: 0.875rem; overflow-x: auto; white-space: pre-wrap;">${error.message || 'Failed to render diagram'}</pre>
          `;
          preElement.parentElement?.replaceChild(errorDiv, preElement);
        }
      }

      // Process code blocks (fallback for standard markdown)
      for (const codeElement of mermaidCodeBlocks) {
        // Skip if already processed
        if (codeElement.getAttribute('data-processed') === 'true') {
          continue;
        }

        try {
          const mermaidCode = codeElement.textContent || '';
          if (!mermaidCode.trim()) {
            continue;
          }

          // Get the parent pre element
          const preElement = codeElement.parentElement;
          if (preElement && preElement.tagName === 'PRE') {
            // Create a new div for mermaid
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.textContent = mermaidCode.trim();
            mermaidDiv.setAttribute('data-processed', 'true');
            
            // Replace the pre element with the mermaid div
            preElement.replaceWith(mermaidDiv);
            
            // Render this new div
            const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const { svg } = await mermaid.render(uniqueId, mermaidCode.trim());
            mermaidDiv.innerHTML = svg;
          }
        } catch (error: any) {
          console.error('Error rendering Mermaid diagram:', error);
          // Mark as processed to avoid retrying
          codeElement.setAttribute('data-processed', 'true');
          // Show error message
          const preElement = codeElement.parentElement;
          if (preElement) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'mermaid-error';
            errorDiv.style.cssText = 'padding: 1rem; margin: 1rem 0; background: #fee; border: 1px solid #fcc; border-radius: 4px; color: #c33;';
            errorDiv.innerHTML = `
              <strong>Mermaid Diagram Error:</strong>
              <pre style="margin-top: 0.5rem; font-size: 0.875rem; overflow-x: auto; white-space: pre-wrap;">${error.message || 'Failed to render diagram'}</pre>
            `;
            preElement.parentElement?.replaceChild(errorDiv, preElement);
          }
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      renderMermaidDiagrams();
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [containerId]);

  return null; // This component doesn't render anything
}

