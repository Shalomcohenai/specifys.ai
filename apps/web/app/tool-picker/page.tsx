'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface Tool {
  name: string;
  category: string;
  features: string[];
  link: string;
}

export default function ToolPickerPage() {
  const [description, setDescription] = useState('');
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const charCount = description.length;
  const maxChars = 2000;

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxChars) {
      setDescription(value);
    }
  };

  const fetchTools = async (description: string): Promise<Tool[]> => {
    // Simulate API call - in real implementation, this would be an API call
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockTools: Tool[] = [
          {
            name: 'Bubble',
            category: 'NoCode Platform',
            features: ['Visual Editor', 'Database', 'API Integration', 'User Authentication'],
            link: 'https://bubble.io'
          },
          {
            name: 'Webflow',
            category: 'Design + Code',
            features: ['Visual Design', 'CMS', 'E-commerce', 'Custom Code'],
            link: 'https://webflow.com'
          },
          {
            name: 'Glide',
            category: 'NoCode App Builder',
            features: ['Mobile Apps', 'Data Integration', 'User Management', 'Custom Logic'],
            link: 'https://glideapps.com'
          }
        ];
        resolve(mockTools);
      }, 2000);
    });
  };

  const handleSearch = async () => {
    if (!description.trim()) {
      setError('Please enter a description of your app');
      return;
    }

    setLoading(true);
    setError(null);
    setShowResults(false);

    try {
      const fetchedTools = await fetchTools(description);
      setTools(fetchedTools);
      setShowResults(true);
    } catch (err: any) {
      setError(err.message || 'Error finding tools. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSearch();
    }
  };

  const getCharCounterClass = () => {
    if (charCount > 1800) return 'text-danger';
    if (charCount > 1500) return 'text-warning';
    return 'text-secondary';
  };

  // Get unique features from all tools
  const allFeatures = Array.from(
    new Set(tools.flatMap((tool) => tool.features))
  );

  return (
    <>
      <div className="tool-picker-page">
        <div className="container">
          <h1>AI Tool Finder</h1>
          <p className="subtitle">
            Describe your app idea, and we&apos;ll recommend the perfect tools for your project
          </p>

          <div className="input-section">
            <label htmlFor="app-description">Describe Your App Idea</label>
            <textarea
              id="app-description"
              className="form-control"
              placeholder="Example: I want to build a social media app where users can share photos and follow each other. I need user authentication, image upload, and a feed feature."
              value={description}
              onChange={handleDescriptionChange}
              onKeyDown={handleKeyPress}
              rows={8}
            />
            <div className={`char-counter ${getCharCounterClass()}`}>
              {charCount}/{maxChars} characters
            </div>
          </div>

          <div className="flex justify-center mt-8">
            <Button
              
              className="search-button"
              onClick={handleSearch}
              disabled={loading || !description.trim()}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Finding Tools...
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane"></i> Find Tools
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="alert alert-danger error-message">
              {error}
            </div>
          )}

          {showResults && (
            <>
              <div className="features-section">
                <h3>App Components</h3>
                <div className="features-list">
                  {allFeatures.map((feature, index) => (
                    <div key={index} className="feature-item">
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              <div className="comparison-section">
                <h3>Recommended Tools Comparison</h3>
                <div className="table-container">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Feature</th>
                        {tools.map((tool, index) => (
                          <th key={index}>{tool.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="comparison-table-body">
                      {allFeatures.map((feature, featureIndex) => (
                        <tr key={featureIndex}>
                          <td>{feature}</td>
                          {tools.map((tool, toolIndex) => (
                            <td key={toolIndex}>
                              {tool.features.includes(feature) ? (
                                <i className="fas fa-check text-success"></i>
                              ) : (
                                <i className="fas fa-times text-danger"></i>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Stats Section */}
        <div className="section">
          <h2>Our Impact</h2>
          <p>
            Join thousands who&apos;ve planned apps with Specifys.ai!
          </p>
          <div className="stats-list">
            <div className="stat-item">
              <div className="stat-number" data-target="0" data-stats-type="tools">
                0+
              </div>
              <h3>Vibe Coding Tools</h3>
              <p>Curated tools in our Vibe Coding Tools Map.</p>
            </div>
            <div className="stat-item">
              <div className="stat-number" data-target="0" data-stats-type="specs">
                0+
              </div>
              <h3>Specs Created</h3>
              <p>AI-powered specifications created by our community.</p>
            </div>
            <div className="stat-item">
              <div className="stat-number" data-target="0" data-stats-type="tool-finder">
                0+
              </div>
              <h3>Tool Finder Users</h3>
              <p>Creators finding perfect tools with our AI-powered Tool Finder.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

