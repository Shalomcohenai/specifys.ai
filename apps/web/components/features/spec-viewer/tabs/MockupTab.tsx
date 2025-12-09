'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient as api } from '@/lib/api/client';
import { analyzeScreens, generateSingleMockup, Mockup } from '@/lib/api/mockups';
import { getFirebaseFirestore } from '@/lib/firebase/init';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/Button';

interface MockupTabProps {
  mockups: any;
  specId: string;
  overview?: any;
  design?: any;
  technical?: any;
  designReady?: boolean;
  onGenerate?: () => void;
}

export function MockupTab({
  mockups,
  specId,
  overview,
  design,
  technical,
  designReady,
  onGenerate
}: MockupTabProps) {
  const { user } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [useMockData, setUseMockData] = useState(false);
  const [currentMockups, setCurrentMockups] = useState<Mockup[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentDevice, setCurrentDevice] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const checkProAccess = async () => {
      if (!user) {
        setIsPro(false);
        return;
      }

      try {
        const result = await api.get<{ success: boolean; entitlements?: { unlimited?: boolean; plan?: string } }>('/api/credits/entitlements');
        if (result.success && result.entitlements) {
          setIsPro(result.entitlements.unlimited === true || result.entitlements.plan === 'pro');
        } else {
          setIsPro(false);
        }
      } catch (error) {
        setIsPro(false);
      }
    };

    checkProAccess();
  }, [user]);

  useEffect(() => {
    if (mockups?.mockups && Array.isArray(mockups.mockups)) {
      setCurrentMockups(mockups.mockups);
    }
  }, [mockups]);

  const handleGenerate = async () => {
    if (!user || generating || !isPro || !designReady) return;

    setGenerating(true);
    setProgress({ current: 0, total: 0, status: 'Analyzing screens...' });

    try {
      // Step 1: Analyze screens
      const analyzeResult = await analyzeScreens(overview, design, technical);
      const screens = analyzeResult.screens || [];

      if (screens.length === 0) {
        throw new Error('No screens found to generate');
      }

      setProgress({ current: 0, total: screens.length, status: `Generating ${screens.length} mockups...` });

      // Step 2: Generate mockups for each screen
      const generatedMockups: Mockup[] = [];
      const failedScreens: string[] = [];

      for (let i = 0; i < screens.length; i++) {
        const screen = screens[i];
        setProgress({
          current: i + 1,
          total: screens.length,
          status: `Generating mockup ${i + 1} of ${screens.length}: ${screen.name}`
        });

        const mockup = await generateSingleMockup(overview, design, technical, screen, useMockData, 3);

        if (mockup) {
          generatedMockups.push(mockup);
        } else {
          failedScreens.push(screen.name);
        }
      }

      if (generatedMockups.length === 0) {
        throw new Error('Failed to generate any mockups');
      }

      // Step 3: Save to Firebase
      const db = getFirebaseFirestore();
      await updateDoc(doc(db, 'specs', specId), {
        mockups: {
          generated: true,
          mockups: generatedMockups,
          failedScreens: failedScreens.length > 0 ? failedScreens : undefined,
          generatedAt: new Date().toISOString()
        },
        'status.mockup': 'ready',
        updatedAt: serverTimestamp()
      });

      setCurrentMockups(generatedMockups);
      setCurrentIndex(0);

      if (onGenerate) {
        onGenerate();
      }

      if (failedScreens.length > 0) {
        alert(`Generated ${generatedMockups.length} of ${screens.length} mockups (${failedScreens.length} failed)`);
      } else {
        alert('Mockups generated successfully!');
      }
    } catch (error: any) {
      console.error('Error generating mockups:', error);
      alert(error.message || 'Failed to generate mockups');
    } finally {
      setGenerating(false);
      setProgress({ current: 0, total: 0, status: '' });
    }
  };

  const handleDeviceChange = (device: 'mobile' | 'tablet' | 'desktop') => {
    setCurrentDevice(device);
  };

  const handlePrevScreen = () => {
    if (currentMockups.length === 0) return;
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : currentMockups.length - 1));
  };

  const handleNextScreen = () => {
    if (currentMockups.length === 0) return;
    setCurrentIndex(prev => (prev < currentMockups.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = () => {
    if (!currentMockups[currentIndex]) return;

    const mockup = currentMockups[currentIndex];
    const blob = new Blob([mockup.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mockup.id || 'mockup'}-${mockup.name.replace(/\s+/g, '-').toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isPro) {
    return (
      <div className="tab-content" id="mockup-content">
        <div className="content-header">
          <h2><i className="fa fa-desktop"></i> Mockups <span className="pro-badge">(Pro)</span></h2>
        </div>
        <div className="content-body" id="mockup-data">
          <div className="locked-tab-message">
            <h3><i className="fa fa-lock"></i> Mockups (PRO Only)</h3>
            <p>Mockup generation is available for PRO users only. Please upgrade to PRO to access this feature.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!designReady) {
    return (
      <div className="tab-content" id="mockup-content">
        <div className="content-header">
          <h2><i className="fa fa-desktop"></i> Mockups <span className="pro-badge">(Pro)</span></h2>
        </div>
        <div className="content-body" id="mockup-data">
          <div className="locked-tab-message">
            <h3><i className="fa fa-lock"></i> Mockups</h3>
            <p>Please generate Design specification first to create mockups.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentMockups || currentMockups.length === 0) {
    return (
      <div className="tab-content" id="mockup-content">
        <div className="content-header">
          <h2><i className="fa fa-desktop"></i> Mockups <span className="pro-badge">(Pro)</span></h2>
        </div>
        <div className="content-body" id="mockup-data">
          <div id="mockup-generate-section">
            <div>
              <h3>Generate Mockups</h3>
              <p>Generate HTML+CSS mockups for all screens in your specification.</p>
            </div>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={useMockData}
                  onChange={(e) => setUseMockData(e.target.checked)}
                />
                <span>Use mock data (for testing)</span>
              </label>
            </div>
            {progress.total > 0 && (
              <div>
                <div>
                  <div
                  >
                    {Math.round((progress.current / progress.total) * 100)}%
                  </div>
                </div>
                <p>
                  {progress.status}
                </p>
              </div>
            )}
            <Button
              id="generateMockupBtn"
              
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <i className="fa fa-spinner fa-spin"></i> Generating...
                </>
              ) : (
                <>
                  <i className="fa fa-magic"></i> Generate Mockups
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentMockup = currentMockups[currentIndex];

  return (
    <div className="tab-content" id="mockup-content">
      <div className="content-header">
        <h2><i className="fa fa-desktop"></i> Mockups <span className="pro-badge">(Pro)</span></h2>
      </div>
      <div className="content-body" id="mockup-data">
        {/* Mockup Viewer */}
        <div className="mockup-viewer">
          <div className="mockup-controls">
            <div>
              <Button
                onClick={handlePrevScreen}
                
              >
                <i className="fa fa-chevron-left"></i> Prev
              </Button>
              <span>
                Screen {currentIndex + 1} of {currentMockups.length}
              </span>
              <Button
                onClick={handleNextScreen}
                
              >
                Next <i className="fa fa-chevron-right"></i>
              </Button>
            </div>
            <div>
              <Button
                onClick={() => handleDeviceChange('mobile')}
                
              >
                Mobile
              </Button>
              <Button
                onClick={() => handleDeviceChange('tablet')}
                
              >
                Tablet
              </Button>
              <Button
                onClick={() => handleDeviceChange('desktop')}
                
              >
                Desktop
              </Button>
            </div>
            <Button
              onClick={handleDownload}
              
            >
              <i className="fa fa-download"></i> Download
            </Button>
          </div>
          <div
            id="mockup-preview-container"
          >
            <iframe
              id="mockup-iframe"
              srcDoc={currentMockup.html}
              onLoad={(e) => {
                try {
                  const iframe = e.currentTarget;
                  const iframeDoc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
                  if (iframeDoc) {
                    const height = Math.max(iframeDoc.body.scrollHeight, iframeDoc.body.offsetHeight, 600);
                    iframe.style.height = height + 'px';
                  }
                } catch (err) {
                  // Cross-origin or other error
                  (e.currentTarget as HTMLIFrameElement).style.height = '600px';
                }
              }}
            />
          </div>
          <div>
            <h4>{currentMockup.name}</h4>
            {currentMockup.device && (
              <p>
                Device: {currentMockup.device}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

