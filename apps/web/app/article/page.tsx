'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient as api } from '@/lib/api/client';
import { MermaidRenderer } from '@/components/diagrams/MermaidRenderer';
import { Button } from '@/components/ui/Button';

interface Article {
  slug: string;
  title: string;
  short_title?: string;
  seo_title?: string;
  description_160?: string;
  teaser_90?: string;
  content?: string;
  publishedAt?: string;
  createdAt?: string;
  tags?: string[];
  views?: number;
}

interface RelatedArticle {
  slug: string;
  title: string;
  short_title?: string;
  teaser_90?: string;
  description_160?: string;
  publishedAt?: string;
  createdAt?: string;
  tags?: string[];
}

function ArticlePageContent() {
  const searchParams = useSearchParams();
  const slug = searchParams?.get('slug') || null;
  const [article, setArticle] = useState<Article | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('Article slug is required');
      setLoading(false);
      return;
    }

    loadArticle();
  }, [slug]);

  const loadArticle = async () => {
    if (!slug) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.get<{ success: boolean; article?: Article; error?: string }>(
        `/api/articles/${slug}`
      );

      if (result.success && result.article) {
        setArticle(result.article);
        updateViewCount(result.article.slug);
        loadRelatedArticles(result.article);
      } else {
        throw new Error(result.error || 'Failed to load article');
      }
    } catch (err: any) {
      console.error('Error loading article:', err);
      setError(err.message || 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const updateViewCount = async (articleSlug: string) => {
    try {
      await api.post(`/api/articles/${articleSlug}/view`, {});
    } catch (err) {
      console.error('Error updating view count:', err);
    }
  };

  const loadRelatedArticles = async (currentArticle: Article) => {
    try {
      const tags = currentArticle.tags || [];
      if (tags.length === 0) return;

      const result = await api.get<{
        success: boolean;
        articles?: RelatedArticle[];
      }>(`/api/articles/related?slug=${currentArticle.slug}&tags=${tags.join(',')}&limit=3`);

      if (result.success && result.articles) {
        setRelatedArticles(result.articles);
      }
    } catch (err) {
      console.error('Error loading related articles:', err);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="article-page">
        <div className="container">
          <div className="article-loading">
            <p>Loading article...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="article-page">
        <div className="container">
          <div className="article-error">
            <p>{error || 'Article not found'}</p>
            <Button as="a" href="/articles" >
              Back to Articles
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="article-page">
        <div className="container">
          {/* Article Content */}
          <article className="article-content" id="article-content">
            <header className="article-header">
              <h1 className="article-title">{article.title || article.short_title || 'Untitled'}</h1>
              <div className="article-meta">
                <span className="article-date">{formatDate(article.publishedAt || article.createdAt)}</span>
                {article.views !== undefined && article.views > 0 && (
                  <span className="article-views">
                    <i className="fas fa-eye"></i> {article.views} views
                  </span>
                )}
              </div>
              {article.tags && article.tags.length > 0 && (
                <div className="article-tags">
                  {article.tags.map((tag, index) => (
                    <span key={index} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            {article.teaser_90 || article.description_160 ? (
              <div className="article-teaser">
                {article.teaser_90 || article.description_160}
              </div>
            ) : null}

            <div
              className="article-body"
              suppressHydrationWarning
              dangerouslySetInnerHTML={{
                __html: article.content || '<p>No content available.</p>'
              }}
            />
            <MermaidRenderer containerId="article-content" />
          </article>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <section className="related-articles" id="related-articles">
              <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
              <div className="related-articles-grid" id="related-articles-grid">
                {relatedArticles.map((related) => {
                  const date = formatDate(related.publishedAt || related.createdAt);
                  const teaser = related.teaser_90 || related.description_160 || '';

                  return (
                    <article key={related.slug} className="article-card">
                      <div className="article-card-header">
                        <div className="article-card-meta">
                          <span className="article-card-date">{date}</span>
                        </div>
                        {related.tags && related.tags.length > 0 && (
                          <div className="article-card-tags">
                            {related.tags.slice(0, 3).map((tag, index) => (
                              <span key={index} className="tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <h3 className="article-card-title">
                        <Link href={`/article?slug=${related.slug}`}>
                          {related.title || related.short_title || 'Untitled'}
                        </Link>
                      </h3>
                      {teaser && <p className="article-card-teaser">{teaser}</p>}
                      <Link href={`/article?slug=${related.slug}`} className="article-card-link">
                        Read More <i className="fas fa-arrow-right"></i>
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default function ArticlePage() {
  return (
    <Suspense fallback={<div className="article-page"><div className="container"><div className="article-loading"><p>Loading...</p></div></div></div>}>
      <ArticlePageContent />
    </Suspense>
  );
}

