'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { generatePrompts } from '@/lib/api/prompts';
import { Button } from '@/components/ui/Button';

interface PromptsTabProps {
  prompts: {
    generated?: boolean;
    fullPrompt?: string;
    thirdPartyIntegrations?: Array<{
      service: string;
      description: string;
      instructions: string[];
    }>;
  } | null;
  specId: string;
  overviewApproved?: boolean;
  technicalReady?: boolean;
  designReady?: boolean;
  onGenerate?: () => void;
}

export function PromptsTab({
  prompts,
  specId,
  overviewApproved,
  technicalReady,
  designReady,
  onGenerate
}: PromptsTabProps) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);

  const canGenerate = overviewApproved && technicalReady && designReady;
  const hasPrompts = prompts?.generated && prompts?.fullPrompt;

  const handleGenerate = async () => {
    if (!user || generating || !canGenerate) return;

    setGenerating(true);
    try {
      await generatePrompts(specId);
      
      if (onGenerate) {
        onGenerate();
      }
    } catch (error: any) {
      console.error('Error generating prompts:', error);
      alert(error.message || 'Failed to generate prompts');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!prompts?.fullPrompt) return;

    navigator.clipboard.writeText(prompts.fullPrompt).then(() => {
      alert('Prompt copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy prompt');
    });
  };

  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  if (!canGenerate) {
    return (
      <div className="tab-content" id="prompts-content">
        <div className="content-header">
          <h2><i className="fa fa-terminal"></i> Development Prompts</h2>
        </div>
        <div className="content-body" id="prompts-data">
          <div className="locked-tab-message">
            <h3><i className="fa fa-lock"></i> Prompts</h3>
            <p>Please approve the Overview and generate Technical & Design specifications first to create development prompts.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasPrompts) {
    return (
      <div className="tab-content" id="prompts-content">
        <div className="content-header">
          <h2><i className="fa fa-terminal"></i> Development Prompts</h2>
          <Button
            id="generatePromptsBtn"
            
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <i className="fa fa-spinner fa-spin"></i> Generating...
              </>
            ) : (
              <>
                <i className="fa fa-magic"></i> Generate Prompts
              </>
            )}
          </Button>
        </div>
        <div className="content-body" id="prompts-data">
          <div className="locked-tab-message">
            <h3><i className="fa fa-terminal"></i> Prompts</h3>
            <p>Click "Generate Prompts" to create comprehensive development prompts and third-party integration instructions.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content" id="prompts-content">
      <div className="content-header">
        <h2><i className="fa fa-terminal"></i> Development Prompts</h2>
      </div>
      <div className="content-body" id="prompts-data">
        {/* Full Prompt Section */}
        <div className="prompt-section">
          <div className="prompt-header">
            <h3><i className="fa fa-code"></i> Full Development Prompt</h3>
            <Button
              onClick={handleCopy}
              
            >
              <i className="fa fa-copy"></i> Copy Prompt
            </Button>
          </div>
          <div className="prompt-content">
            <pre className="prompt-text">
              {prompts.fullPrompt}
            </pre>
          </div>
        </div>

        {/* Third-Party Integrations Section */}
        {prompts.thirdPartyIntegrations && prompts.thirdPartyIntegrations.length > 0 && (
          <div className="integrations-section">
            <h3><i className="fa fa-plug"></i> Third-Party Integration Instructions</h3>
            <div className="integrations-container">
              {prompts.thirdPartyIntegrations.map((integration, index) => {
                // Convert URLs in instructions to clickable links
                const instructionsWithLinks = integration.instructions.map(instruction => {
                  const urlRegex = /(https?:\/\/[^\s<>]+|www\.[^\s<>]+)/gi;
                  let match;
                  let lastIndex = 0;
                  let result = '';

                  while ((match = urlRegex.exec(instruction)) !== null) {
                    result += escapeHtml(instruction.substring(lastIndex, match.index));
                    const url = match[0];
                    const fullUrl = url.startsWith('http') ? url : `http://${url}`;
                    result += `<a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; cursor: pointer;">${escapeHtml(url)}</a>`;
                    lastIndex = match.index + match[0].length;
                  }
                  result += escapeHtml(instruction.substring(lastIndex));
                  return result || escapeHtml(instruction);
                });

                return (
                  <div key={index} className="integration-card">
                    <div className="integration-header">
                      <h4><i className="fa fa-link"></i> {integration.service}</h4>
                    </div>
                    <div className="integration-description">
                      <p>{integration.description}</p>
                    </div>
                    <div className="integration-instructions">
                      <h5>Setup Instructions:</h5>
                      <ol>
                        {instructionsWithLinks.map((instruction, i) => (
                          <li key={i} dangerouslySetInnerHTML={{ __html: instruction }} />
                        ))}
                      </ol>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

