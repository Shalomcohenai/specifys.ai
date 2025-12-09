'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface RawDataTabProps {
  spec: {
    id: string;
    title?: any;
    overview?: any;
    technical?: any;
    market?: any;
    design?: any;
    diagrams?: any;
    prompts?: any;
    mockups?: any;
    [key: string]: any;
  };
}

export function RawDataTab({ spec }: RawDataTabProps) {
  const [activeSection, setActiveSection] = useState<string>('complete');

  const sections = [
    { id: 'overview', label: 'Overview', data: spec.overview },
    { id: 'technical', label: 'Technical', data: spec.technical },
    { id: 'market', label: 'Market Research', data: spec.market },
    { id: 'design', label: 'Design & Branding', data: spec.design },
    { id: 'diagrams', label: 'Diagrams', data: spec.diagrams },
    { id: 'prompts', label: 'Prompts', data: spec.prompts },
    { id: 'mockups', label: 'Mockups', data: spec.mockups },
    { id: 'complete', label: 'Complete Data', data: spec }
  ];

  const formatData = (data: any): string => {
    if (!data) {
      return 'No data available';
    }
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return String(data);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  };

  return (
    <div className="tab-content" id="raw-content">
      <div className="content-header">
        <h2><i className="fa fa-code"></i> Raw JSON Data</h2>
      </div>
      <div className="content-body" id="raw-data">
        {/* Section Tabs */}
        <div>
          {sections.map((section) => (
            <Button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              
            >
              {section.label}
            </Button>
          ))}
        </div>

        {/* Section Content */}
        {sections.map((section) => {
          if (activeSection !== section.id) return null;

          const formattedData = formatData(section.data);

          return (
            <div key={section.id}>
              <div>
                <h3>
                  <i className="fa fa-code"></i> {section.label}
                </h3>
                <Button
                  onClick={() => handleCopy(formattedData)}
                  
                >
                  <i className="fa fa-copy"></i> Copy
                </Button>
              </div>
              <pre
                id={`raw-${section.id}`}
              >
                {formattedData}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
