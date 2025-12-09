'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getFirebaseFirestore } from '@/lib/firebase/init';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';

interface Question {
  q: string;
  answers: string[];
  correctIndex: number;
}

interface Guide {
  id: string;
  title: string;
  level?: string;
  summary?: string;
  content?: string;
  whatYouLearn?: string[];
  questions?: Question[];
  category: string;
}

interface Category {
  id: string;
  title: string;
}

function AcademyGuidePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const guideId = searchParams?.get('guide') || null;

  const [guide, setGuide] = useState<Guide | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userProgress, setUserProgress] = useState<any>(null);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    if (!guideId) {
      router.push('/academy');
      return;
    }
    loadGuide();
  }, [guideId, router]);

  useEffect(() => {
    if (user) {
      loadUserProgress();
    }
  }, [user]);

  const loadGuide = async () => {
    if (!guideId) return;

    setLoading(true);
    try {
      const db = getFirebaseFirestore();

      // Load guide
      const guideDoc = await getDoc(doc(db, 'academy_guides', guideId));
      if (!guideDoc.exists()) {
        router.push('/academy');
        return;
      }

      const guideData = { id: guideDoc.id, ...guideDoc.data() } as Guide;
      setGuide(guideData);

      // Track guide visit
      try {
        await apiClient.post(`/api/academy/guides/${guideId}/view`);
      } catch (error) {
        // Silently fail - view tracking is not critical
      }

      // Load category
      if (guideData.category) {
        const categoryDoc = await getDoc(doc(db, 'academy_categories', guideData.category));
        if (categoryDoc.exists()) {
          setCategory({ id: categoryDoc.id, ...categoryDoc.data() } as Category);
        }
      }

      // Check if already completed
      if (user && userProgress) {
        const isCompleted = userProgress.completedGuides?.includes(guideId);
        if (isCompleted) {
          setSubmitted(true);
          setResults(userProgress.answers?.[guideId]);
        }
      }
    } catch (error) {
      console.error('Error loading guide:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProgress = async () => {
    if (!user) return;

    try {
      const db = getFirebaseFirestore();
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (userDoc.exists()) {
        const data = userDoc.data();
        const progress = {
          points: data.academyPoints || 0,
          completedGuides: data.completedGuides || [],
          answers: data.academyAnswers || {}
        };
        setUserProgress(progress);

        // Check if guide is completed
        if (progress.completedGuides.includes(guideId || '')) {
          setSubmitted(true);
          setResults(progress.answers[guideId || '']);
        }
      }
    } catch (error) {
      console.error('Error loading user progress:', error);
    }
  };

  const handleAnswerChange = (questionIndex: number, answerIndex: number) => {
    const newAnswers = [...userAnswers];
    newAnswers[questionIndex] = answerIndex;
    setUserAnswers(newAnswers);
  };

  const handleSubmit = async () => {
    if (!user || !guide || !guide.questions) return;

    // Validate all questions answered
    if (userAnswers.length !== guide.questions.length) {
      alert('Please answer all questions');
      return;
    }

    setSubmitting(true);

    try {
      const questions = guide.questions;
      let correctCount = 0;

      // Calculate score
      questions.forEach((q, qIndex) => {
        if (userAnswers[qIndex] === q.correctIndex) {
          correctCount++;
        }
      });

      // Calculate points
      let pointsPerAnswer = 5;
      if (guide.level === 'Beginner') {
        pointsPerAnswer = 5;
      } else if (guide.level === 'Intermediate') {
        pointsPerAnswer = 10;
      } else if (guide.level === 'Advanced') {
        pointsPerAnswer = 15;
      }

      // Only award points if answered BOTH questions correctly
      const pointsEarned = (correctCount === questions.length && questions.length === 2)
        ? correctCount * pointsPerAnswer
        : 0;

      // Update user progress in Firestore
      const db = getFirebaseFirestore();
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      const currentPoints = userDoc.exists() ? (userDoc.data().academyPoints || 0) : 0;
      const currentCompleted = userDoc.exists() ? (userDoc.data().completedGuides || []) : [];
      const currentAnswers = userDoc.exists() ? (userDoc.data().academyAnswers || {}) : {};

      const updatedCompleted = [...currentCompleted];
      if (!updatedCompleted.includes(guideId || '')) {
        updatedCompleted.push(guideId || '');
      }

      const updatedAnswers = {
        ...currentAnswers,
        [guideId || '']: {
          answers: userAnswers,
          score: correctCount,
          totalQuestions: questions.length,
          pointsEarned: pointsEarned,
          completedAt: serverTimestamp()
        }
      };

      await updateDoc(userRef, {
        academyPoints: currentPoints + pointsEarned,
        completedGuides: updatedCompleted,
        academyAnswers: updatedAnswers
      });

      // Update local state
      const newProgress = {
        points: currentPoints + pointsEarned,
        completedGuides: updatedCompleted,
        answers: updatedAnswers
      };
      setUserProgress(newProgress);
      setResults(updatedAnswers[guideId || '']);
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting answers:', error);
      alert('Error submitting answers. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="academy-page">
        <div className="container">
          <div className="loading-placeholder">Loading guide...</div>
        </div>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="academy-page">
        <div className="container">
          <div className="loading-placeholder">Guide not found</div>
          <Button as="a" href="/academy" >Back to Academy</Button>
        </div>
      </div>
    );
  }

  const isCompleted = submitted && results;
  const score = results?.score || 0;
  const pointsEarned = results?.pointsEarned || 0;

  return (
    <>
      <main className="academy-page">
        {/* Guide Title */}
        <div className="guide-title-container">
          <div className="container">
            <h1 id="guide-title" className="guide-title-centered" itemProp="headline">
              {guide.title}
            </h1>
          </div>
        </div>

        {/* Guide Content */}
        <article className="academy-guide-content" itemScope itemType="https://schema.org/Article">
          <div className="container">
            <div className="guide-main">
              {/* What You'll Learn */}
              {guide.whatYouLearn && guide.whatYouLearn.length > 0 && (
                <section className="what-you-learn" id="what-you-learn-section" aria-label="Learning Objectives">
                  <h2>What You'll Learn</h2>
                  <ul id="what-you-learn-list" role="list">
                    {guide.whatYouLearn.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Main Content */}
              <section className="guide-body" id="guide-body" itemProp="articleBody">
                {guide.content ? (
                  <div dangerouslySetInnerHTML={{ __html: guide.content }} />
                ) : (
                  <div className="loading-placeholder">No content available</div>
                )}
              </section>

              {/* Summary */}
              {guide.summary && (
                <section className="guide-summary" id="guide-summary-section" aria-label="Summary">
                  <h2>Summary</h2>
                  <p id="guide-summary-text" itemProp="description">{guide.summary}</p>
                </section>
              )}

              {/* Questions Section */}
              {guide.questions && guide.questions.length > 0 && (
                <section className="guide-questions" id="questions-section" aria-label="Knowledge Check">
                  <h2>Test Your Knowledge</h2>
                  <div id="questions-container" role="group">
                    {!isCompleted ? (
                      guide.questions.map((q, qIndex) => (
                        <div key={qIndex} className="question-block" data-question-index={qIndex}>
                          <h3>Question {qIndex + 1}: {q.q}</h3>
                          <div className="question-options">
                            {q.answers.map((answer, aIndex) => (
                              <div key={aIndex} className="question-option">
                                <input
                                  type="radio"
                                  name={`question-${qIndex}`}
                                  id={`q${qIndex}-a${aIndex}`}
                                  value={aIndex}
                                  checked={userAnswers[qIndex] === aIndex}
                                  onChange={() => handleAnswerChange(qIndex, aIndex)}
                                  required
                                />
                                <label htmlFor={`q${qIndex}-a${aIndex}`}>{answer}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      guide.questions.map((q, qIndex) => {
                        const userAnswer = results.answers[qIndex];
                        const isCorrect = userAnswer === q.correctIndex;
                        return (
                          <div key={qIndex} className="question-block">
                            <h3>Question {qIndex + 1}: {q.q}</h3>
                            <div className="question-options">
                              {q.answers.map((answer, aIndex) => {
                                let className = 'question-option';
                                if (aIndex === q.correctIndex) {
                                  className += ' correct';
                                } else if (aIndex === userAnswer && !isCorrect) {
                                  className += ' incorrect';
                                }
                                return (
                                  <div key={aIndex} className={className}>
                                    <input
                                      type="radio"
                                      disabled
                                      checked={aIndex === userAnswer}
                                    />
                                    <label>{answer}</label>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {!isCompleted && (
                    <div id="questions-actions" className="questions-actions">
                      <button
                        className="submit-questions-btn"
                        onClick={handleSubmit}
                        disabled={submitting || userAnswers.length !== guide.questions!.length}
                      >
                        {submitting ? 'Submitting...' : 'Submit Answers'}
                      </button>
                      {category && (
                        <Link
                          href={`/academy/category?category=${category.id}`}
                          className="back-to-category-btn"
                        >
                          <i className="fas fa-arrow-left" aria-hidden="true"></i> Back to Category
                        </Link>
                      )}
                    </div>
                  )}
                  {!user && (
                    <div id="login-prompt" className="login-prompt">
                      <p>
                        <i className="fas fa-lock" aria-hidden="true"></i> Sign in to answer questions and earn points!
                      </p>
                      <Button as="a" href="/auth" >Sign In</Button>
                    </div>
                  )}
                  {isCompleted && (
                    <div
                      id="questions-results"
                      className={`questions-results ${score === guide.questions.length ? 'success' : ''}`}
                      role="status"
                    >
                      <h3>Your Results</h3>
                      <p>You got {score} out of {guide.questions.length} questions correct.</p>
                      {pointsEarned > 0 && (
                        <p className="points-earned">+{pointsEarned} points earned!</p>
                      )}
                      <p>Total Academy Points: {userProgress?.points || 0}</p>
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        </article>
      </main>
    </>
  );
}

export default function AcademyGuidePage() {
  return (
    <Suspense fallback={<div className="academy-page"><div className="container"><div className="loading-placeholder">Loading...</div></div></div>}>
      <AcademyGuidePageContent />
    </Suspense>
  );
}

