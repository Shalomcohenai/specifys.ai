'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient as api } from '@/lib/api/client';
import { Container } from '@/components/ui/Container';

interface Article {
  slug: string;
  title: string;
  short_title?: string;
  teaser_90?: string;
  description_160?: string;
  publishedAt?: string;
  createdAt?: string;
  tags?: string[];
  views?: number;
}

export default function ArticlesPage() {
  const [featuredArticles, setFeaturedArticles] = useState<Article[]>([]);
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const pageSize = 12;

  // Load featured articles
  useEffect(() => {
    const loadFeaturedArticles = async () => {
      try {
        const result = await api.get('/api/articles/featured?limit=5') as any;
        if (result.success && result.articles && result.articles.length > 0) {
          setFeaturedArticles(result.articles);
        }
      } catch (error) {
        console.error('Error loading featured articles:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFeaturedArticles();
  }, []);

  // Load articles with pagination
  useEffect(() => {
    const loadArticles = async () => {
      setArticlesLoading(true);
      try {
        const result = await api.get(
          `/api/articles/list?page=${currentPage}&limit=${pageSize}&status=published`
        ) as any;

        if (result.success) {
          setAllArticles(result.articles || []);
          setTotalPages(result.pagination?.totalPages || 1);
        }
      } catch (error) {
        console.error('Error loading articles:', error);
      } finally {
        setArticlesLoading(false);
      }
    };

    loadArticles();
  }, [currentPage]);

  // Carousel auto-play
  useEffect(() => {
    if (featuredArticles.length <= 1) return;

    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % featuredArticles.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [featuredArticles.length]);

  // Scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const goToSlide = (index: number) => {
    setCarouselIndex(index);
  };

  const carouselPrev = () => {
    if (featuredArticles.length === 0) return;
    setCarouselIndex((prev) => (prev - 1 + featuredArticles.length) % featuredArticles.length);
  };

  const carouselNext = () => {
    if (featuredArticles.length === 0) return;
    setCarouselIndex((prev) => (prev + 1) % featuredArticles.length);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPaginationPages = () => {
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      pages.push(
        <button
          key={1}
          className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors"
          onClick={() => goToPage(1)}
        >
          1
        </button>
      );
      if (startPage > 2) {
        pages.push(
          <span key="ellipsis1" className="px-2 text-gray-500">
            ...
          </span>
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
            i === currentPage
              ? 'bg-primary text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          onClick={() => goToPage(i)}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <span key="ellipsis2" className="px-2 text-gray-500">
            ...
          </span>
        );
      }
      pages.push(
        <button
          key={totalPages}
          className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors"
          onClick={() => goToPage(totalPages)}
        >
          {totalPages}
        </button>
      );
    }

    return pages;
  };

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, allArticles.length);

  const currentArticle = featuredArticles[carouselIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section - Orange Gradient */}
      <section className="bg-gradient-to-b from-orange-500 via-orange-500 to-orange-400 py-24 text-center">
        <Container>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 font-heading">
            Specifys Articles
          </h1>
          <p className="text-xl text-white/95 max-w-2xl mx-auto font-sans">
            Discover insights on AI-driven development, vibe coding, and the future of software
          </p>
        </Container>
      </section>

      {/* Featured Articles Carousel */}
      <section className="py-16 bg-gray-50">
        <Container>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 font-heading">
            Featured Articles
          </h2>
          
          <div className="relative max-w-5xl mx-auto">
            {/* Carousel Card */}
            <div className="relative bg-white rounded-xl shadow-lg overflow-hidden">
              {loading ? (
                <div className="p-16 text-center text-gray-500">
                  Loading featured articles...
                </div>
              ) : featuredArticles.length === 0 ? (
                <div className="p-16 text-center text-gray-500">
                  No featured articles available
                </div>
              ) : currentArticle ? (
                <div className="p-8 md:p-12">
                  <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-500">
                    <span className="font-medium">
                      {formatDate(currentArticle.publishedAt || currentArticle.createdAt)}
                    </span>
                    {currentArticle.tags && currentArticle.tags.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {currentArticle.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 font-heading leading-tight">
                    <Link
                      href={`/article?slug=${currentArticle.slug}`}
                      className="hover:text-primary transition-colors"
                    >
                      {currentArticle.title || currentArticle.short_title || 'Untitled'}
                    </Link>
                  </h3>
                  
                  {(currentArticle.teaser_90 || currentArticle.description_160) && (
                    <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                      {currentArticle.teaser_90 || currentArticle.description_160}
                    </p>
                  )}
                  
                  <Link
                    href={`/article?slug=${currentArticle.slug}`}
                    className="inline-flex items-center gap-2 text-red-600 font-semibold text-lg hover:gap-3 transition-all"
                  >
                    Read More
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              ) : null}
            </div>

            {/* Carousel Navigation Arrows */}
            {featuredArticles.length > 1 && (
              <>
                <button
                  onClick={carouselPrev}
                  aria-label="Previous article"
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-6 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-primary hover:text-white transition-all hover:scale-110 z-10"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <button
                  onClick={carouselNext}
                  aria-label="Next article"
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-6 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-primary hover:text-white transition-all hover:scale-110 z-10"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </>
            )}

            {/* Carousel Indicators */}
            {featuredArticles.length > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                {featuredArticles.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    aria-label={`Go to slide ${index + 1}`}
                    className={`transition-all ${
                      index === carouselIndex
                        ? 'w-8 h-2 bg-red-600 rounded-full'
                        : 'w-2 h-2 bg-gray-300 rounded-full hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* Latest Articles Grid */}
      <section className="py-16 bg-gray-50">
        <Container>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 font-heading">
            Latest Articles
          </h2>
          
          {articlesLoading ? (
            <div className="text-center py-16 text-gray-500">Loading articles...</div>
          ) : allArticles.length === 0 ? (
            <div className="text-center py-16 text-gray-500">No articles found</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {allArticles.map((article) => {
                const date = formatDate(article.publishedAt || article.createdAt);
                const teaser = article.teaser_90 || article.description_160 || '';
                const views = article.views || 0;

                return (
                  <article
                    key={article.slug}
                    className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col hover:shadow-lg hover:-translate-y-1 hover:border-primary transition-all duration-300"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="font-medium">{date}</span>
                        {views > 0 && (
                          <span className="flex items-center gap-1">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                            {views}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {article.tags && article.tags.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-4">
                        {article.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-3 font-heading leading-tight">
                      <Link
                        href={`/article?slug=${article.slug}`}
                        className="hover:text-primary transition-colors"
                      >
                        {article.title || article.short_title || 'Untitled'}
                      </Link>
                    </h3>
                    
                    {teaser && (
                      <p className="text-gray-600 mb-4 leading-relaxed flex-grow">{teaser}</p>
                    )}
                    
                    <Link
                      href={`/article?slug=${article.slug}`}
                      className="inline-flex items-center gap-2 text-red-600 font-semibold mt-auto hover:gap-3 transition-all"
                    >
                      Read More
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  </article>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-12 pt-8 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {start}-{end} of {allArticles.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-primary hover:text-white hover:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={currentPage === 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Previous
                </button>
                <div className="flex items-center gap-1">{renderPaginationPages()}</div>
                <button
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-primary hover:text-white hover:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={currentPage === totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </Container>
      </section>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="fixed bottom-6 right-6 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-primary hover:text-white transition-all hover:scale-110 z-50"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

