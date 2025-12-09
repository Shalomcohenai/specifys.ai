'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useEntitlementsCache } from '@/lib/hooks/useEntitlementsCache';
import { CreditsDisplay } from '@/components/features/credits/CreditsDisplay';
import { LiveBrief } from '@/components/features/spec-generation/LiveBrief';
import { MermaidRenderer } from '@/components/diagrams/MermaidRenderer';
import { PROMPTS } from '@/lib/utils/prompts';
import { Button } from '@/components/ui/Button';
import { HeroSection } from '@/components/ui/HeroSection';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { ProcessFlow } from '@/components/ui/ProcessFlow';
import { Container } from '@/components/ui/Container';
import { IconCard } from '@/components/ui/IconCard';
import { InfoCard } from '@/components/ui/InfoCard';
import { PricingCard } from '@/components/ui/PricingCard';
import { Table } from '@/components/ui/Table';
import { FlowchartNode } from '@/components/ui/FlowchartNode';
import {
  checkEntitlements,
  generateSpecification,
  saveSpecToFirebase,
  triggerOpenAIUpload,
  consumeCredit,
  refundCredit
} from '@/lib/api/specs';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { refresh: refreshEntitlements } = useEntitlementsCache();
  const [showQuestions, setShowQuestions] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [typingMode, setTypingMode] = useState(true);
  const [selectedPlatforms, setSelectedPlatforms] = useState({ mobile: false, web: false });
  const [error, setError] = useState<string | null>(null);

  // Character limits for each question
  const characterLimits = [900, 800, 600];

  // Animation effects removed - will be reimplemented with Tailwind
  useEffect(() => {
    // Placeholder for future animations
  }, []);

  // Focus input when questions are shown
  useEffect(() => {
    if (showInput && typingMode && typeof window !== 'undefined') {
      // Focus will be handled by the textarea's autoFocus or we can add a ref if needed
      setTimeout(() => {
        const textarea = document.querySelector('textarea');
        if (textarea) {
          textarea.focus();
        }
      }, 100);
    }
  }, [showInput, typingMode]);

  // Scroll-based animations removed - will be reimplemented with Tailwind
  useEffect(() => {
    // Placeholder for future scroll animations
  }, []);

  const questions = [
    {
      title: 'Describe your application',
      detail: 'Describe the main idea of your application - including core features, target audience, and the problem it solves',
      maxChars: characterLimits[0]
    },
    {
      title: 'Describe the workflow',
      detail: 'Walk through a typical user journey step by step - explain how users interact with different features and workflows',
      maxChars: characterLimits[1]
    },
    {
      title: 'Additional details',
      detail: 'Add any technical requirements, integrations with other services, future features, or special considerations',
      maxChars: characterLimits[2]
    }
  ];

  const handleStart = () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    
    // Show questions - no credit check here, only when generating
    setTimeout(() => {
      setShowQuestions(true);
      setShowInput(true);
      setCurrentQuestion(0);
      setAnswers(['', '', '']);
      setSelectedPlatforms({ mobile: false, web: false });
      setError(null);
      
      // Scroll to questions after they're rendered
      setTimeout(() => {
        const questionsElement = document.querySelector('[data-questions-section]');
        if (questionsElement) {
          questionsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }, 300);
  };

  const handleNext = () => {
    // Validate current answer before proceeding
    if (currentQuestion < questions.length - 1) {
      // Check if first 2 questions are answered (required)
      if (currentQuestion < 2 && !answers[currentQuestion]?.trim()) {
        setError('Please provide an answer before proceeding.');
        return;
      }
      setCurrentQuestion(currentQuestion + 1);
      setError(null);
    } else {
      // Last question - validate all required answers before generating
      if (!answers[0]?.trim() || !answers[1]?.trim()) {
        setError('Please provide answers to the first two questions before generating the specification.');
        return;
      }
      // All questions answered - proceed to generate (credit check happens in handleGenerateSpec)
      handleGenerateSpec();
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setError(null);
    }
  };

  const handleJumpToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestion(index);
      setError(null);
    }
  };

  const handlePlatformToggle = (platform: 'mobile' | 'web') => {
    setSelectedPlatforms((prev) => ({
      ...prev,
      [platform]: !prev[platform]
    }));
  };

  const handleTestGenerate = () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    // Fill in test answers automatically
    const testAnswers = [
      'A task management application for teams to collaborate on projects. The app allows users to create tasks, assign them to team members, set deadlines, and track progress. It solves the problem of scattered communication and missed deadlines by centralizing all project information in one place. Target audience: small to medium-sized teams, project managers, and remote workers.',
      'User journey: 1) User signs up and creates a workspace. 2) User creates a project and invites team members. 3) User creates tasks within the project, assigns them to team members, and sets due dates. 4) Team members receive notifications, update task status, and add comments. 5) Project manager views dashboard with progress overview. 6) Tasks are completed and archived. The workflow includes real-time updates, notifications, file attachments, and progress tracking.',
      'Technical requirements: Real-time synchronization using WebSockets, file storage integration (AWS S3), email notifications, mobile app support (React Native), RESTful API, PostgreSQL database, Redis for caching. Future features: AI-powered task prioritization, time tracking, Gantt charts, and integration with Slack and Jira.'
    ];

    // Set answers and move to last question
    setAnswers(testAnswers);
    setError(null);
    setCurrentQuestion(2); // Move to last question to show all answers are filled
    
    // Automatically trigger generation after a short delay to allow state to update
    setTimeout(() => {
      handleGenerateSpec();
    }, 300);
  };

  const handleGenerateSpec = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    // Validate that all required questions are answered before checking credits
    if (!answers[0]?.trim() || !answers[1]?.trim()) {
      setError('Please provide answers to the first two questions before generating the specification.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    // Credit validation happens ONLY here, after all questions are answered and user clicks Generate

    try {
      // Clear any previous spec data
      if (typeof window !== 'undefined') {
        localStorage.removeItem('currentSpecId');
        localStorage.removeItem('generatedOverviewContent');
        localStorage.removeItem('initialAnswers');
      }

      // Ensure we have 3 answers (pad with empty string for question 3 if needed)
      const finalAnswers = [...answers];
      while (finalAnswers.length < 3) {
        finalAnswers.push('');
      }

      // Check entitlements before generating
      const entitlementCheck = await checkEntitlements();
      if (!entitlementCheck.hasAccess) {
        setLoading(false);
        const paywallData = entitlementCheck.paywallData || {
          reason: 'insufficient_credits',
          message: 'You have no remaining spec credits'
        };
        const searchParams = new URLSearchParams({
          reason: paywallData.reason || 'insufficient_credits',
          message: paywallData.message || 'You have no remaining spec credits'
        });
        router.push(`/pricing?${searchParams.toString()}`);
        return;
      }

      // Prepare the prompt for overview generation
      const prompt = PROMPTS.overview(finalAnswers);

      // Add platform information to the prompt
      const platformInfo: string[] = [];
      if (selectedPlatforms.mobile) platformInfo.push('Mobile App');
      if (selectedPlatforms.web) platformInfo.push('Web App');

      const platformText = platformInfo.length > 0
        ? `Target Platform: ${platformInfo.join(', ')}`
        : 'Target Platform: Not specified';

      // Generate specification using API
      let data;
      try {
        data = await generateSpecification(prompt, platformText);
      } catch (error: any) {
        // Handle network errors (backend not running)
        if (error.isNetworkError || error.status === 0 || error.message?.includes('Cannot connect to backend')) {
          setLoading(false);
          setError('Cannot connect to backend server. Please try again later or contact support if the problem persists.');
          console.error('Backend connection error:', error);
          return;
        }
        
        // Handle 403 (paywall) errors
        if (error.status === 403) {
          setLoading(false);
          let paywallPayload;
          if (error.data) {
            paywallPayload = error.data?.paywallData || {
              reason: error.data?.error || 'insufficient_credits',
              message: error.data?.message || error.data?.details || 'You have no remaining spec credits'
            };
          } else {
            paywallPayload = {
              reason: 'insufficient_credits',
              message: 'You have no remaining spec credits'
            };
          }
          const searchParams = new URLSearchParams({
            reason: paywallPayload.reason || 'insufficient_credits',
            message: paywallPayload.message || 'You have no remaining spec credits'
          });
          router.push(`/pricing?${searchParams.toString()}`);
          return;
        }
        
        // Handle 500 (server errors) - show user-friendly message
        if (error.status === 500) {
          setLoading(false);
          let errorMessage = 'An error occurred while generating your specification. ';
          
          if (error.data) {
            const errorData = error.data;
            // Backend returns: { success: false, error: { code, message, requestId }, timestamp }
            const backendMessage = errorData.error?.message || errorData.message;
            
            // If backend message is generic "Internal server error", provide more helpful message
            if (backendMessage && !backendMessage.toLowerCase().includes('internal server error')) {
              errorMessage = backendMessage;
            } else {
              errorMessage += 'This might be a temporary issue. Please try again in a few moments.';
            }
            
            // Add requestId for debugging (from error.error.requestId or error.requestId)
            const requestId = errorData.error?.requestId || errorData.requestId;
            if (requestId) {
              errorMessage += ` (Request ID: ${requestId})`;
            }
            
            // Add error code if available
            if (errorData.error?.code && errorData.error.code !== 'INTERNAL_ERROR') {
              errorMessage += ` [${errorData.error.code}]`;
            }
          } else {
            errorMessage += 'Please try again in a few moments. If the problem persists, contact support.';
          }
          
          setError(errorMessage);
          console.error('Server error (500):', {
            message: error.message,
            errorData: error.data,
            fullError: error
          });
          return;
        }
        
        // Handle other errors
        let errorMessage = error.message || 'Failed to generate specification';
        if (error.data) {
          const errorData = error.data;
          if (errorData.requestId) {
            errorMessage += ` [Server Request ID: ${errorData.requestId}]`;
          }
          if (errorData.errorType) {
            errorMessage += ` (${errorData.errorType})`;
          }
        }
        throw new Error(errorMessage);
      }

      // Extract overview content from the response
      const overviewContent = data.specification || 'No overview generated';

      // Consume credit BEFORE saving to Firebase
      // If save fails, we'll refund the credit
      let creditConsumed = false;
      let consumeTransactionId: string | null = null;

      try {
        // First, create a temporary spec ID for credit consumption
        const tempSpecId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const consumeResult = await consumeCredit(tempSpecId);
        creditConsumed = true;
        consumeTransactionId = consumeResult.transactionId || tempSpecId;
      } catch (creditError: any) {
        setLoading(false);
        let errorMessage = creditError.message || 'Failed to consume credit';
        // Check if user already has a spec
        if (errorMessage.includes('already has a spec') || errorMessage.includes('Only one spec per user')) {
          errorMessage = 'You already have a spec. Only one spec per user is allowed. Please edit your existing spec instead.';
        }
        setError(`Failed to consume credit: ${errorMessage}`);
        return;
      }

      // Save to Firebase and redirect
      let firebaseId: string | null = null;
      try {
        firebaseId = await saveSpecToFirebase(overviewContent, finalAnswers, selectedPlatforms);
      } catch (saveError: any) {
        // Refund credit if save failed
        if (creditConsumed && consumeTransactionId) {
          try {
            await refundCredit(1, 'Spec creation failed - save to Firebase failed', consumeTransactionId);
          } catch (refundError) {
            // Error refunding credit - the main error is the save failure
          }
        }

        setLoading(false);
        setError(`Failed to save specification: ${saveError.message}`);
        return;
      }

      // Store in localStorage for backup
      if (typeof window !== 'undefined') {
        localStorage.setItem('generatedOverviewContent', overviewContent);
        localStorage.setItem('initialAnswers', JSON.stringify(finalAnswers));
      }

      // Refresh entitlements to update credits display
      refreshEntitlements().catch((err) => {
        console.warn('[refreshEntitlements] Failed to refresh:', err);
      });

      // Trigger OpenAI upload (non-blocking)
      triggerOpenAIUpload(firebaseId).catch((err) => {
        // Background OpenAI upload failed - silently fail
        console.warn('[triggerOpenAIUpload] Background upload failed:', err);
      });

      // Redirect to spec viewer with Firebase ID (immediate redirect)
      router.push(`/spec-viewer?id=${firebaseId}`);
    } catch (error: any) {
      setLoading(false);
      const errorMessage = error.message || 'Error generating specification. Please try again.';
      setError(errorMessage);
      console.error('Error generating specification:', error);
    }
  };

  const handleAnswerChange = (value: string) => {
    const maxLength = characterLimits[currentQuestion];
    if (value.length <= maxLength) {
      const newAnswers = [...answers];
      newAnswers[currentQuestion] = value;
      setAnswers(newAnswers);
      setError(null);
    }
  };

  const specCards = [
    {
      icon: <i className="fa fa-file-alt"></i>,
      title: 'Overview',
      description: 'Comprehensive app information including idea summary and core features',
    },
    {
      icon: <i className="fa fa-code"></i>,
      title: 'Technical',
      description: 'Technical specifications including tech stack and API endpoints',
    },
    {
      icon: <i className="fa fa-chart-line"></i>,
      title: 'Market Research',
      description: 'Market analysis including competitors and monetization strategies',
    },
    {
      icon: <i className="fa fa-palette"></i>,
      title: 'Design & Branding',
      description: 'Visual design guidelines including color schemes and typography',
    },
    {
      icon: <i className="fa fa-project-diagram"></i>,
      title: 'Diagrams',
      description: 'Visual diagrams including architecture and user flow charts',
    },
    {
      icon: <i className="fa fa-robot"></i>,
      title: 'AI Chat',
      description: 'Interactive AI assistant to refine your specification',
    },
  ];

  return (
    <div className="bg-bg-secondary min-h-screen">
      {/* Hero Section */}
      <HeroSection
        title="Build faster with AI-driven insights"
        subtitle="Transform your idea into a complete specification with AI-powered insights."
        startButtonText="Start"
        onStartClick={handleStart}
        specCards={specCards}
        bottomLinks={[
          { text: 'Demo', href: '/demo-spec' },
          { text: 'Pricing', href: '/pricing' },
          { text: 'Why', href: '/why' },
        ]}
      />

          {/* Questions Display */}
          {showQuestions && (
            <div className="relative z-10 bg-bg-secondary p-8 rounded-lg" data-questions-section>
              <div className="flex items-center justify-between mb-4">
                <div className="font-heading text-text-DEFAULT font-bold text-xl md:text-2xl">
                  {questions[currentQuestion].title}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-DEFAULT text-sm">Voice</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={typingMode}
                      onChange={(e) => setTypingMode(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-light peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-light after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                  <span className="text-text-DEFAULT text-sm">Typing</span>
                </div>
              </div>
              <div className="text-text-DEFAULT font-medium text-base">
                {questions[currentQuestion].detail}
              </div>
            </div>
          )}

          {/* Loading Overlay */}
          {loading && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <Card className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <div className="text-text-DEFAULT font-bold text-lg">Generating Your Specification</div>
                <div className="text-text-DEFAULT text-sm mt-2">This may take a few moments...</div>
              </Card>
            </div>
          )}

          {/* Live Brief (Voice Mode) */}
          {showInput && !typingMode && (
            <LiveBrief
              currentQuestion={currentQuestion}
              questionText={questions[currentQuestion]?.detail || ''}
              onAnswersReady={(liveBriefAnswers) => {
                // Use the answers from Live Brief
                setAnswers(liveBriefAnswers);
                // Move to next question or generate
                if (currentQuestion < questions.length - 1) {
                  setCurrentQuestion(currentQuestion + 1);
                } else {
                  handleGenerateSpec();
                }
              }}
              onClose={() => setTypingMode(true)}
            />
          )}

          {/* Modern Input Container (Typing Mode) */}
          {showInput && typingMode && (
            <Card className="relative z-10 p-6 bg-bg-primary">
              <div className="text-text-DEFAULT text-sm mb-4 text-center">
                Start typing, press Enter for next question, press Backspace for previous question
              </div>

              <div className="space-y-4">
                <textarea
                  className="w-full p-4 border border-gray-light rounded-md text-text-DEFAULT bg-bg-primary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Write your answer here..."
                  rows={4}
                  value={answers[currentQuestion] || ''}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleNext();
                    } else if (e.key === 'Backspace' && (!answers[currentQuestion] || answers[currentQuestion].length === 0)) {
                      e.preventDefault();
                      handleBack();
                    }
                  }}
                  maxLength={characterLimits[currentQuestion]}
                />
                <div className="flex justify-end">
                  <span className="text-text-DEFAULT text-sm">
                    {answers[currentQuestion]?.length || 0} / {characterLimits[currentQuestion]}
                  </span>
                </div>
              </div>
              {error && (
                <div className="mt-4 p-3 bg-danger/10 border border-danger rounded-md text-danger text-sm">
                  {error}
                </div>
              )}

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    title="Lightbulb"
                    className="p-2 rounded-md hover:bg-bg-secondary transition-colors text-text-DEFAULT"
                    onClick={() => {
                      // TODO: Show tooltip/hints
                      console.log('Lightbulb clicked - show hints');
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    title="Click for mobile app"
                    className={`p-2 rounded-md transition-colors ${
                      selectedPlatforms.mobile
                        ? 'bg-primary text-white'
                        : 'bg-bg-secondary text-text-DEFAULT hover:bg-gray-light'
                    }`}
                    onClick={() => handlePlatformToggle('mobile')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                      <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                  </button>

                  <button
                    type="button"
                    title="Click for web app"
                    className={`p-2 rounded-md transition-colors ${
                      selectedPlatforms.web
                        ? 'bg-primary text-white'
                        : 'bg-bg-secondary text-text-DEFAULT hover:bg-gray-light'
                    }`}
                    onClick={() => handlePlatformToggle('web')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                  </button>
                </div>

                <div className="flex justify-center gap-2">
                  {questions.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      title={`Question ${index + 1}${answers[index]?.trim() ? ' (answered)' : ''}`}
                      onClick={() => handleJumpToQuestion(index)}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        index === currentQuestion
                          ? 'bg-primary'
                          : answers[index]?.trim()
                          ? 'bg-primary/50'
                          : 'bg-gray-light'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex justify-center gap-4">
                  <Button 
                    onClick={handleTestGenerate} 
                    disabled={loading}
                    title="Fill test answers and generate (for testing)"
                    size="sm"
                    variant="primary"
                  >
                    Test
                  </Button>
                  
                  <Button onClick={handleNext} disabled={loading} size="md" variant="primary">
                    {loading ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i> Generating...
                      </>
                    ) : currentQuestion === questions.length - 1 ? (
                      <>
                        Generate
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          height="20"
                          width="20"
                          className="ml-2"
                        >
                          <path
                            stroke="white"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 12h14m-7-7l7 7-7 7"
                          ></path>
                        </svg>
                      </>
                    ) : (
                      <>
                        Next
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          height="20"
                          width="20"
                          className="ml-2"
                        >
                          <path
                            stroke="white"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 12h14m-7-7l7 7-7 7"
                          ></path>
                        </svg>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          )}

        {/* Why Sections */}
        <section className="bg-bg-secondary py-16">
          <Container>
            <SectionHeader
              title="The Promise That Falls Short"
              subtitle="Every platform promises one prompt, but reality is different."
            />
            <div className="max-w-3xl mx-auto">
              <Card className="p-8">
                <div className="space-y-4">
                  <p className="text-text-DEFAULT">
                    But here&apos;s what actually happens: You spend hours, sometimes days, tweaking prompts,
                    fixing errors, and trying to get the AI to understand what you really want.
                  </p>
                  <p className="text-text-DEFAULT">
                    The code comes out messy. Features don&apos;t connect. And when you want to add something new,
                    everything breaks.
                  </p>
                  <div className="mt-6">
                    <Button as={Link} href="/" size="md" variant="primary">
                      Start Planning
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </Container>
        </section>

        <section className="bg-bg-secondary py-16">
          <Container>
            <SectionHeader
              title="The Right Way to Build"
              subtitle="Start with foundations, then build the structure."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Flowchart Card */}
              <Card className="p-6" variant="elevated">
                <div className="space-y-4">
                  <FlowchartNode>Data Structures</FlowchartNode>
                  <div className="flex justify-center">
                    <svg className="w-6 h-6 text-text-DEFAULT" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <FlowchartNode>Functions</FlowchartNode>
                  <div className="flex justify-center">
                    <svg className="w-6 h-6 text-text-DEFAULT" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <FlowchartNode>Logic Flow</FlowchartNode>
                  <div className="flex justify-center">
                    <svg className="w-6 h-6 text-text-DEFAULT" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <FlowchartNode>UI Layout</FlowchartNode>
                </div>
              </Card>
              {/* Text Card */}
              <Card className="p-8" variant="elevated">
                <div className="space-y-4">
                  <p className="text-text-DEFAULT">
                    Real development doesn&apos;t start with code. It starts with foundations.
                  </p>
                  <p className="text-text-DEFAULT">
                    First, you define your data structures - arrays, variables, the core information your app
                    needs.
                  </p>
                  <p className="text-text-DEFAULT">
                    Then, you map out your functions - what each piece does, how they connect, the logic that
                    makes everything work.
                  </p>
                  <p className="text-text-DEFAULT">
                    Only after that foundation is solid do you build the layout - the UI that users actually see.
                  </p>
                  <div className="mt-6">
                    <Button as={Link} href="/" size="md" variant="primary">
                      Start Planning
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </Container>
        </section>

        <section className="bg-bg-secondary py-16">
          <Container>
            <SectionHeader
              title="How It Works"
              subtitle="Answer questions, get a comprehensive specification."
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Process Flow */}
              <div className="flex justify-center">
                <ProcessFlow
                  steps={[
                    { icon: <i className="fas fa-edit"></i>, label: 'Questions' },
                    { icon: <i className="fas fa-file-alt"></i>, label: 'Specification' },
                    { icon: <i className="fas fa-rocket"></i>, label: 'Application' },
                  ]}
                />
              </div>
              {/* Text Card */}
              <Card className="p-8" variant="elevated">
                <div className="space-y-4">
                  <p className="text-text-DEFAULT">
                    Our AI analyzes your answers and generates a comprehensive specification - organized,
                    structured, ready to guide development.
                  </p>
                  <p className="text-text-DEFAULT">
                    You review, refine, and approve. Then you take that spec to any coding tool, any developer,
                    any platform. They know exactly what to build.
                  </p>
                  <div className="mt-6">
                    <Button as={Link} href="/" size="md" variant="primary">
                      Start Planning
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </Container>
        </section>

        {/* Content Sections */}
        <div className="bg-bg-secondary">
          {/* Tools Section */}
          <section className="bg-bg-secondary py-16">
            <Container>
              <SectionHeader
                title="Discover Our Tools"
                subtitle="Everything you need to build your app - from planning to deployment"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6" variant="elevated">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <IconCard icon={<i className="fa fa-map"></i>} />
                    <h3 className="font-heading text-text-DEFAULT font-bold text-lg">Tools Map</h3>
                    <p className="text-text-DEFAULT text-sm">Explore AI tools for developers</p>
                    <Button as={Link} href="/tools/map/vibe-coding-tools-map" size="md" variant="primary">
                      Explore Now
                    </Button>
                  </div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <IconCard icon={<i className="fa fa-search"></i>} />
                    <h3 className="font-heading text-text-DEFAULT font-bold text-lg">Tool Finder</h3>
                    <p className="text-text-DEFAULT text-sm">Find perfect tools for your needs</p>
                    <Button as={Link} href="/tool-picker" size="md" variant="primary">
                      Find Now
                    </Button>
                  </div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <IconCard icon={<i className="fa fa-cogs"></i>} />
                    <h3 className="font-heading text-text-DEFAULT font-bold text-lg">App Management</h3>
                    <p className="text-text-DEFAULT text-sm">Manage your apps & specs (Members)</p>
                    <Button
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      size="md"
                      variant="primary"
                    >
                      Start Here
                    </Button>
                  </div>
                </Card>
              </div>
            </Container>
          </section>

          {/* Stats Section */}
          <section className="bg-bg-secondary py-16">
            <Container>
              <SectionHeader
                title="Our Impact"
                subtitle="Join thousands who've planned apps with Specifys.ai!"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InfoCard
                  value="0+"
                  label="Vibe Coding Tools"
                  description="Curated tools in our Vibe Coding Tools Map."
                />
                <InfoCard
                  value="0+"
                  label="Specs Created"
                  description="AI-powered specifications created by our community."
                />
                <InfoCard
                  value="0+"
                  label="Tool Finder Users"
                  description="Creators finding perfect tools with our AI-powered Tool Finder."
                />
              </div>
            </Container>
          </section>

          {/* Pricing Section */}
          <section className="bg-bg-secondary py-16">
            <Container>
              <SectionHeader
                title="Choose Your Plan"
                subtitle="Start free or upgrade for unlimited specifications"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <PricingCard
                  title="Single Spec"
                  description="One-time payment"
                  price="4.90"
                  features={[
                    { text: '1 additional spec', included: true },
                    { text: 'Edit saved specs', included: true },
                    { text: 'All free features', included: true },
                  ]}
                  ctaText="View Details"
                  ctaHref="/pricing"
                />
                <PricingCard
                  title="3-Pack"
                  description="Three specs at a discount"
                  price="9.90"
                  badge="BEST VALUE"
                  highlightTop={true}
                  features={[
                    { text: '3 additional specs', included: true },
                    { text: 'Edit saved specs', included: true },
                    { text: 'All free features', included: true },
                  ]}
                  ctaText="View Details"
                  ctaHref="/pricing"
                />
                <PricingCard
                  title="Pro"
                  description="Unlimited specifications"
                  price="29.90"
                  pricePeriod="/month"
                  badge="Popular"
                  features={[
                    { text: 'Unlimited specs', included: true },
                    { text: 'Edit all specs', included: true },
                    { text: 'Priority support', included: true },
                  ]}
                  ctaText="View Details"
                  ctaHref="/pricing"
                />
              </div>
              <p className="text-center text-text-DEFAULT">Start for free • No credit card required</p>
            </Container>
          </section>

          {/* Benefits Section */}
          <section className="bg-bg-secondary py-16">
            <Container>
              <SectionHeader
                title="Why Specifys.ai Shines"
                subtitle="Your complete AI-powered app planning ecosystem—from idea to launch!"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <Card className="p-6" variant="elevated">
                  <div className="flex items-start gap-4">
                    <div className="text-primary text-2xl">
                      <i className="fa fa-map"></i>
                    </div>
                    <div>
                      <h3 className="font-heading text-text-DEFAULT font-bold text-lg mb-2">Vibe Coding Tools Map</h3>
                      <p className="text-text-DEFAULT text-sm">Discover curated AI-driven development tools, all organized and categorized.</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="flex items-start gap-4">
                    <div className="text-primary text-2xl">
                      <i className="fa fa-search"></i>
                    </div>
                    <div>
                      <h3 className="text-text-DEFAULT font-bold text-lg mb-2">Smart Tool Finder</h3>
                      <p className="text-text-DEFAULT text-sm">Find the perfect tools for your project with our AI-powered recommendation engine.</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="flex items-start gap-4">
                    <div className="text-primary text-2xl">
                      <i className="fa fa-line-chart"></i>
                    </div>
                    <div>
                      <h3 className="font-heading text-text-DEFAULT font-bold text-lg mb-2">Market Research & Validation</h3>
                      <p className="text-text-DEFAULT text-sm">Get AI-powered market insights and competitor analysis.</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="flex items-start gap-4">
                    <div className="text-primary text-2xl">
                      <i className="fa fa-cogs"></i>
                    </div>
                    <div>
                      <h3 className="text-text-DEFAULT font-bold text-lg mb-2">Complete Project Management</h3>
                      <p className="text-text-DEFAULT text-sm">Plan, track, and manage your entire app development journey.</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="flex items-start gap-4">
                    <div className="text-primary text-2xl">
                      <i className="fa fa-gift"></i>
                    </div>
                    <div>
                      <h3 className="font-heading text-text-DEFAULT font-bold text-lg mb-2">Start Free</h3>
                      <p className="text-text-DEFAULT text-sm">Get one specification free, then upgrade for more with flexible pricing plans.</p>
                    </div>
                  </div>
                </Card>
              </div>
              <div className="text-center">
                <Button as={Link} href="/" size="md" variant="primary">
                  Start Planning Free
                </Button>
              </div>
            </Container>
          </section>

          {/* Use Cases Section */}
          <section className="bg-bg-secondary py-16">
            <Container>
              <SectionHeader
                title="WHO'S USING SPECIFYS.AI?"
                subtitle="From dreamers to developers, entrepreneurs to teams!"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="p-6" variant="elevated">
                  <h3 className="font-heading text-text-DEFAULT font-bold text-lg mb-2">Dreamers & Entrepreneurs</h3>
                  <p className="text-text-DEFAULT text-sm">Transform ideas into actionable plans with one free specification.</p>
                </Card>
                <Card className="p-6" variant="elevated">
                  <h3 className="font-heading text-text-DEFAULT font-bold text-lg mb-2">Developers & Coders</h3>
                  <p className="text-text-DEFAULT text-sm">Create multiple specs and accelerate development with Vibe Coding Tools Map.</p>
                </Card>
                <Card className="p-6" variant="elevated">
                  <h3 className="text-text-DEFAULT font-bold text-lg mb-2">Startup Teams</h3>
                  <p className="text-text-DEFAULT text-sm">Validate multiple ideas, track milestones with unlimited specifications on Pro.</p>
                </Card>
                <Card className="p-6" variant="elevated">
                  <h3 className="font-heading text-text-DEFAULT font-bold text-lg mb-2">Product Managers</h3>
                  <p className="text-text-DEFAULT text-sm">Plan and edit specs freely with the Pro subscription.</p>
                </Card>
                <Card className="p-6" variant="elevated">
                  <h3 className="font-heading text-text-DEFAULT font-bold text-lg mb-2">No-Code Creators</h3>
                  <p className="text-text-DEFAULT text-sm">Build multiple apps—start free and upgrade as you grow.</p>
                </Card>
                <Card className="p-6" variant="elevated">
                  <h3 className="font-heading text-text-DEFAULT font-bold text-lg mb-2">Freelancers & Consultants</h3>
                  <p className="text-text-DEFAULT text-sm">Deliver professional app plans with flexible pricing options.</p>
                </Card>
              </div>
            </Container>
          </section>

          {/* FAQ Section */}
          <section className="bg-bg-secondary py-16">
            <Container>
              <SectionHeader
                title="Got Questions? We Got You!"
                subtitle="Everything you need to know about Specifys.ai!"
              />
              <div className="max-w-3xl mx-auto space-y-4">
                <Card className="p-6" variant="elevated">
                  <div className="text-text-DEFAULT font-bold text-lg mb-2">
                    What&apos;s Specifys.ai all about? <i className="fa fa-chevron-down float-right"></i>
                  </div>
                  <div className="text-text-DEFAULT text-sm">
                    Specifys.ai is a complete AI-powered app planning ecosystem. Create specifications,
                    discover tools, manage projects, and more.
                  </div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="text-text-DEFAULT font-bold text-lg mb-2">
                    Is there a free plan? <i className="fa fa-chevron-down float-right"></i>
                  </div>
                  <div className="text-text-DEFAULT text-sm">
                    Yes! Get one specification free to try our platform. Additional specifications start at
                    $4.90.
                  </div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="text-text-DEFAULT font-bold text-lg mb-2">
                    Can I edit my specifications? <i className="fa fa-chevron-down float-right"></i>
                  </div>
                  <div className="text-text-DEFAULT text-sm">
                    Pro subscribers can edit all specifications. With purchased credits, you can edit saved
                    specifications.
                  </div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="text-text-DEFAULT font-bold text-lg mb-2">
                    What is the Vibe Coding Tools Map? <i className="fa fa-chevron-down float-right"></i>
                  </div>
                  <div className="text-text-DEFAULT text-sm">
                    Our curated collection of AI-driven development tools, organized by category.
                  </div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="text-text-DEFAULT font-bold text-lg mb-2">
                    How does the Tool Finder work? <i className="fa fa-chevron-down float-right"></i>
                  </div>
                  <div className="text-text-DEFAULT text-sm">
                    Our AI analyzes your project needs and suggests the most suitable tools.
                  </div>
                </Card>
              </div>
            </Container>
          </section>

          {/* Testimonials Section */}
          <section className="bg-bg-secondary py-16">
            <Container>
              <SectionHeader
                title="Our Users Say"
                subtitle="Hear from users building amazing apps!"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <Card className="p-6" variant="elevated">
                  <div className="text-text-DEFAULT font-bold text-lg mb-2">Sarah M.</div>
                  <div className="text-text-DEFAULT text-sm">The user management system is a game-changer!</div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="text-text-DEFAULT font-bold text-lg mb-2">David K.</div>
                  <div className="text-text-DEFAULT text-sm">Vibe Coding Tools Map saved me weeks of research.</div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="text-text-DEFAULT font-bold text-lg mb-2">Lisa R.</div>
                  <div className="text-text-DEFAULT text-sm">Tool Finder helped me find the right no-code platform.</div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="text-text-DEFAULT font-bold text-lg mb-2">Alex T.</div>
                  <div className="text-text-DEFAULT text-sm">The market research feature gave me amazing insights.</div>
                </Card>
                <Card className="p-6" variant="elevated">
                  <div className="text-text-DEFAULT font-bold text-lg mb-2">Maria G.</div>
                  <div className="text-text-DEFAULT text-sm">I love how I can save all my specs in one place.</div>
                </Card>
              </div>
              <div className="text-center">
                <p className="text-text-DEFAULT mb-4">
                  Ready to join them?
                </p>
                <Button as={Link} href="/" size="md" variant="primary">
                  Start Planning Free
                </Button>
              </div>
            </Container>
          </section>
        </div>
      <MermaidRenderer />
    </div>
  );
}
