'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getFirebaseFirestore } from '@/lib/firebase/init';
import { doc, getDoc } from 'firebase/firestore';
import { marked } from 'marked';
import mermaid from 'mermaid';
import Link from 'next/link';

function LegacyViewerPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const specId = searchParams?.get('id') || null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>('Legacy Specification');

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }

    if (!specId) {
      setError('No specification ID provided');
      setLoading(false);
      return;
    }

    loadSpec();
  }, [user, specId, router]);

  useEffect(() => {
    if (content) {
      // Initialize Mermaid after content is loaded
      mermaid.initialize({ 
        startOnLoad: false,
        theme: 'default'
      });

      // Find and render Mermaid diagrams
      const mermaidElements = document.querySelectorAll('.mermaid, pre code');
      mermaidElements.forEach((element) => {
        const text = element.textContent?.trim() || '';
        if (text.startsWith('flowchart') || text.startsWith('graph') || 
            text.startsWith('sequenceDiagram') || text.startsWith('classDiagram') || 
            text.startsWith('stateDiagram') || text.startsWith('erDiagram') ||
            text.startsWith('journey') || text.startsWith('gantt') || 
            text.startsWith('pie') || text.startsWith('gitgraph')) {
          
          const mermaidDiv = document.createElement('div');
          mermaidDiv.className = 'mermaid';
          mermaidDiv.textContent = text;

          if (element.tagName === 'CODE' && element.parentElement?.tagName === 'PRE') {
            element.parentElement.replaceWith(mermaidDiv);
          } else {
            element.replaceWith(mermaidDiv);
          }
        }
      });

      // Render Mermaid diagrams
      const mermaidDivs = document.querySelectorAll('.mermaid');
      if (mermaidDivs.length > 0) {
        mermaid.run();
      }
    }
  }, [content]);

  const loadSpec = async () => {
    if (!specId || !user) return;

    setLoading(true);
    setError(null);

    try {
      const db = getFirebaseFirestore();
      const specDoc = await getDoc(doc(db, 'specs', specId));

      if (!specDoc.exists()) {
        setError('Specification not found');
        setLoading(false);
        return;
      }

      const specData = specDoc.data();

      // Check if user owns this spec
      if (specData.userId !== user.uid) {
        setError('You do not have permission to view this specification');
        setLoading(false);
        return;
      }

      // Extract content
      let specContent = '';
      if (specData.content) {
        specContent = specData.content;
      } else if (specData.overview) {
        specContent = JSON.stringify(specData.overview, null, 2);
      } else {
        specContent = JSON.stringify(specData, null, 2);
      }

      // Convert markdown to HTML
      const htmlContent = await marked.parse(specContent);
      setContent(htmlContent as string);
      setTitle(specData.title || 'Legacy Specification');
      document.title = `${specData.title || 'Legacy Specification'} - Specifys.ai`;

    } catch (err: any) {
      console.error('Error loading spec:', err);
      setError('Failed to load specification: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <main id="main-content" className="main-content">
        <div>
          {loading && <div>Loading...</div>}
          {error && <div>{error}</div>}
          {!loading && !error && content && (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          )}
        </div>
      </main>
    </>
  );
}

export default function LegacyViewerPage() {
  return (
    <Suspense fallback={<div className="legacy-viewer-page"><div className="container"><div className="loading-placeholder">Loading...</div></div></div>}>
      <LegacyViewerPageContent />
    </Suspense>
  );
}

