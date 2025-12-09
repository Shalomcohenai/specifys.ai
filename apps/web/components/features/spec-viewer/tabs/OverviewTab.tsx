'use client';

import { useState, useEffect, useRef } from 'react';
import { formatTextContent, calculateComplexityScore, renderComplexityScore } from '@/lib/utils/spec-renderer';
import { getFirebaseFirestore } from '@/lib/firebase/init';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { clearChatHistory } from '@/lib/api/chat';
import { showNotification } from '@/components/features/spec-viewer/Notification';
import { Button } from '@/components/ui/Button';

interface OverviewTabProps {
  overview: any;
  specId?: string;
  isPro?: boolean;
  onEditToggle?: () => void;
  isEditMode?: boolean;
  onSave?: () => void;
}

export function OverviewTab({ overview, specId, isPro = false, onEditToggle, isEditMode = false, onSave }: OverviewTabProps) {
  const [editMode, setEditMode] = useState(isEditMode);
  const [originalHTML, setOriginalHTML] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);
  const originalContentRef = useRef<any>(overview);

  useEffect(() => {
    setEditMode(isEditMode);
  }, [isEditMode]);

  useEffect(() => {
    if (editMode && contentRef.current) {
      // Save original HTML
      if (!originalHTML) {
        setOriginalHTML(contentRef.current.innerHTML);
      }

      // Make content editable
      const contentSections = contentRef.current.querySelectorAll('.content-section');
      contentSections.forEach((section) => {
        section.classList.add('editing');
        
        // Lock icons - make them non-editable
        const icons = section.querySelectorAll('i');
        icons.forEach((icon) => {
          icon.setAttribute('contenteditable', 'false');
          icon.classList.add('icon-locked');
        });
        
        // Make paragraphs editable
        const paragraphs = section.querySelectorAll('p');
        paragraphs.forEach((p) => {
          p.setAttribute('contenteditable', 'true');
        });
        
        // Make headings editable
        const headings = section.querySelectorAll('h3');
        headings.forEach((heading) => {
          heading.setAttribute('contenteditable', 'true');
        });
      });
      
      contentRef.current.classList.add('edit-mode-active');
    } else if (!editMode && contentRef.current) {
      // Exit edit mode
      const contentSections = contentRef.current.querySelectorAll('.content-section');
      contentSections.forEach((section) => {
        section.setAttribute('contenteditable', 'false');
        section.classList.remove('editing');
      });
      
      contentRef.current.classList.remove('edit-mode-active');
    }
  }, [editMode, originalHTML]);

  const handleSave = async () => {
    if (!contentRef.current || !specId) return;

    try {
      // Exit edit mode first
      const contentSections = contentRef.current.querySelectorAll('.content-section');
      contentSections.forEach((section) => {
        section.setAttribute('contenteditable', 'false');
        section.classList.remove('editing');
      });
      
      contentRef.current.classList.remove('edit-mode-active');

      // Extract text content from HTML structure
      const sections: string[] = [];
      contentSections.forEach((section) => {
        const heading = section.querySelector('h3');
        const paragraphs = Array.from(section.querySelectorAll('p'));
        const content = paragraphs
          .map((p) => p.textContent?.trim())
          .filter((t) => t) as string[];

        if (heading) {
          // Extract text from heading, ignoring icons
          const headingText = Array.from(heading.childNodes)
            .filter((node) => node.nodeType === 3 || (node.nodeType === 1 && (node as Element).tagName !== 'I'))
            .map((node) => {
              if (node.nodeType === 3) {
                return node.textContent || '';
              } else if (node.nodeType === 1 && (node as Element).tagName !== 'I') {
                return Array.from(node.childNodes)
                  .filter((n) => n.nodeType === 3)
                  .map((n) => n.textContent || '')
                  .join('');
              }
              return '';
            })
            .join('')
            .trim();

          if (headingText && content.length > 0) {
            const sectionContent = content.join('\n\n');
            sections.push(headingText + '\n' + sectionContent);
          }
        }
      });

      const editedContent = sections.join('\n\n---\n\n');
      const originalContent = originalContentRef.current;

      // Compare with original - if no changes, use original to preserve structure
      let finalContent = editedContent;

      // Check if content actually changed
      const normalizedOriginal = (typeof originalContent === 'string' ? originalContent : JSON.stringify(originalContent || {}))
        .trim()
        .replace(/\s+/g, ' ');
      const normalizedEdited = editedContent.trim().replace(/\s+/g, ' ');

      if (normalizedOriginal === normalizedEdited && originalContent) {
        // No actual changes - keep original
        finalContent = typeof originalContent === 'string' ? originalContent : JSON.stringify(originalContent);
      }

      // Only save to Firebase if content actually changed
      if (normalizedOriginal !== normalizedEdited || !originalContent) {
        // Save to Firebase
        const db = getFirebaseFirestore();
        await updateDoc(doc(db, 'specs', specId), {
          overview: finalContent,
          updatedAt: serverTimestamp()
        });

        // Reset chat history since spec was updated
        clearChatHistory(specId);

        showNotification('Overview saved successfully!', 'success');
        
        // Update original content reference
        originalContentRef.current = finalContent;
      }

      // Exit edit mode
      setEditMode(false);
      if (onSave) {
        onSave();
      }
    } catch (error: any) {
      console.error('Error saving overview:', error);
      showNotification('Failed to save overview: ' + (error.message || 'Unknown error'), 'error');
    }
  };

  if (!overview) {
    return (
      <div className="tab-content" id="overview-content">
        <div className="content-header">
          <h2><i className="fa fa-book"></i> Application Overview</h2>
        </div>
        <div className="content-body" id="overview-data">
          <p>No overview data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content" id="overview-content">
      <div className="content-header">
        <h2><i className="fa fa-book"></i> Application Overview</h2>
        {isPro && specId && (
          <div>
            {editMode ? (
              <Button
                
                onClick={handleSave}
              >
                <i className="fa fa-save"></i> Save
              </Button>
            ) : (
              <Button
                
                onClick={() => {
                  setEditMode(true);
                  if (onEditToggle) {
                    onEditToggle();
                  }
                }}
              >
                <i className="fa fa-pencil"></i> Edit
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="content-body" id="overview-data">
        <div 
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: formatTextContent(overview) }} 
        />
        {!editMode && (
        <div dangerouslySetInnerHTML={{ __html: renderComplexityScore(calculateComplexityScore(overview)) }} />
        )}
      </div>
    </div>
  );
}

