'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { generateMindmap } from '@/lib/api/mindmap';

interface MindmapTabProps {
  spec: {
    id: string;
    overview?: any;
    technical?: any;
    mindmap?: any;
  };
}

declare global {
  interface Window {
    Drawflow: any;
  }
}

export function MindmapTab({ spec }: MindmapTabProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawflowInstanceRef = useRef<any>(null);

  useEffect(() => {
    // Check if mindmap already exists
    if (spec.mindmap) {
      setGenerated(true);
      displayMindmap(spec.mindmap);
    }
  }, [spec.mindmap]);

  const ensureDrawflowLoaded = (): Promise<void> => {
    if (typeof window !== 'undefined' && window.Drawflow) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      // Check if script is already being loaded
      if (document.querySelector('script[src*="drawflow"]')) {
        const checkInterval = setInterval(() => {
          if (window.Drawflow) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Drawflow library failed to load'));
        }, 10000);
      } else {
        // Load Drawflow CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href =
          'https://cdn.jsdelivr.net/gh/jerosoler/Drawflow/dist/drawflow.min.css';
        document.head.appendChild(link);

        // Load Drawflow JS
        const script = document.createElement('script');
        script.src =
          'https://cdn.jsdelivr.net/gh/jerosoler/Drawflow/dist/drawflow.min.js';
        script.onload = () => {
          setTimeout(() => {
            if (window.Drawflow) {
              resolve();
            } else {
              reject(new Error('Drawflow loaded but not available'));
            }
          }, 200);
        };
        script.onerror = () =>
          reject(
            new Error(
              'Failed to load Drawflow library. Please check your internet connection.'
            )
          );
        document.head.appendChild(script);
      }
    });
  };

  const convertToDrawflow = (mindElixirData: any) => {
    if (!mindElixirData || !mindElixirData.nodeData) {
      throw new Error('Invalid MindElixir data format');
    }

    const drawflowData = {
      drawflow: {
        Home: {
          data: {},
        },
      },
    };

    let nodeId = 1;
    const nodeMap = new Map();

    const processNode = (
      node: any,
      parentId: number | null = null,
      level: number = 0
    ): number => {
      const currentNodeId = nodeId++;
      const nodeName = node.id || `node-${currentNodeId}`;
      const nodeLabel = node.topic || node.name || 'Untitled';

      const posX = 100 + level * 300;
      const posY = 100 + (currentNodeId - 1) * 150;

      const drawflowNode: any = {
        id: currentNodeId,
        name: nodeName,
        data: {
          label: nodeLabel,
        },
        class:
          level === 0 ? 'product' : level === 1 ? 'category' : 'item',
        html: `<div class="title-box" style="padding: 10px; background: ${
          level === 0 ? '#FF6B35' : level === 1 ? '#4A90E2' : '#7B68EE' // Mermaid specific colors - keep as is
        }; color: white; border-radius: 5px; text-align: center; min-width: 150px;">${nodeLabel}</div>`,
        typenode: false,
        inputs: {},
        outputs: {},
        pos_x: posX,
        pos_y: posY,
      };

      if (parentId !== null) {
        drawflowNode.inputs = {
          input_1: {
            connections: [
              {
                node: parentId.toString(),
                output: 'output_1',
              },
            ],
          },
        };
      }

      if (node.children && node.children.length > 0) {
        drawflowNode.outputs = {
          output_1: {
            connections: [],
          },
        };
      }

      nodeMap.set(node.id || currentNodeId, currentNodeId);
      (drawflowData.drawflow.Home.data as any)[currentNodeId.toString()] = drawflowNode;

      if (node.children && node.children.length > 0) {
        node.children.forEach((child: any) => {
          const childNodeId = processNode(child, currentNodeId, level + 1);
          if (drawflowNode.outputs.output_1) {
            drawflowNode.outputs.output_1.connections.push({
              node: childNodeId.toString(),
              input: 'input_1',
            });
          }
        });
      }

      return currentNodeId;
    };

    processNode(mindElixirData.nodeData);
    return drawflowData;
  };

  const displayMindmap = async (data: any) => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML =
      '<div class="flex items-center justify-center h-full"><i class="fa fa-spinner fa-spin text-3xl"></i><span class="ml-4">Loading flow diagram viewer...</span></div>';

    try {
      await ensureDrawflowLoaded();

      containerRef.current.innerHTML = '<div id="drawflow"></div>';
      const drawflowElement = document.getElementById('drawflow');
      if (!drawflowElement) return;

      const drawflowInstance = new window.Drawflow(drawflowElement);
      drawflowInstance.start();
      drawflowInstanceRef.current = drawflowInstance;

      let drawflowData;
      if (data.drawflow && data.drawflow.Home && data.drawflow.Home.data) {
        drawflowData = data;
      } else if (data.nodeData) {
        drawflowData = convertToDrawflow(data);
      } else {
        throw new Error('Unknown data format');
      }

      drawflowInstance.import(drawflowData);
    } catch (err: any) {
      if (containerRef.current) {
        containerRef.current.innerHTML = `<div style="padding: 20px; text-align: center;"><h3><i class="fa fa-exclamation-triangle"></i> Error Displaying Mind Map</h3><p>${err.message}</p></div>`;
      }
    }
  };

  const handleGenerate = async () => {
    if (!spec.overview || !spec.technical) {
      setError('Overview and Technical sections must be ready');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await generateMindmap(spec.overview, spec.technical);

      if (result.success && result.mindMap) {
        setGenerated(true);
        await displayMindmap(result.mindMap);

        // Save to Firestore
        const { getFirebaseFirestore } = await import('@/lib/firebase/init');
        const { doc, updateDoc, serverTimestamp } = await import(
          'firebase/firestore'
        );
        const db = getFirebaseFirestore();

        await updateDoc(doc(db, 'specs', spec.id), {
          mindmap: result.mindMap,
          updatedAt: serverTimestamp(),
        });
      } else {
        throw new Error(
          result.error?.message || 'Failed to generate mind map'
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate mind map');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setGenerated(false);
    setError(null);
    handleGenerate();
  };

  return (
    <div className="tab-content" id="mindmap-content">
      <div className="content-header">
        <h2>
          <i className="fa fa-project-diagram"></i> Mind Map
        </h2>
      </div>
      <div className="content-body" id="mindmap-data">
        {!generated && !loading && (
          <div>
            <p>
              Generate a visual mind map of your application structure
            </p>
              <Button
              
              onClick={handleGenerate}
              disabled={!spec.overview || !spec.technical}
            >
              <i className="fa fa-magic"></i> Generate Mind Map
            </Button>
          </div>
        )}

        {loading && (
          <div>
            <i className="fa fa-spinner fa-spin"></i>
            <p>Generating mind map...</p>
          </div>
        )}

        {error && (
          <div
            className="alert alert-danger"
           
          >
            <h3>
              <i className="fa fa-exclamation-triangle"></i> Error Generating
              Mind Map
            </h3>
            <p>{error}</p>
            <Button  onClick={handleRetry}>
              <i className="fa fa-redo"></i> Retry
            </Button>
          </div>
        )}

        {generated && !loading && (
          <>
            <div>
              <Button  onClick={handleRetry}>
                <i className="fa fa-redo"></i> Regenerate
              </Button>
            </div>
            <div
              id="mindmap-container"
              ref={containerRef}
            ></div>
          </>
        )}
      </div>
    </div>
  );
}


