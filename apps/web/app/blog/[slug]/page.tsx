'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient as api } from '@/lib/api/client';
import { marked } from 'marked';
import { MermaidRenderer } from '@/components/diagrams/MermaidRenderer';

interface BlogPost {
  title: string;
  content: string;
  date?: string;
  author?: string;
  description?: string;
  seoDescription?: string;
  tags?: string[];
}

export default function BlogPostPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [readingTime, setReadingTime] = useState(0);

  useEffect(() => {
    if (!slug) {
      setError('Invalid post URL');
      setLoading(false);
      return;
    }

    loadPost();
  }, [slug]);

  useEffect(() => {
    if (post?.content) {
      // Calculate reading time
      const words = post.content.split(/\s+/).length;
      const time = Math.ceil(words / 200); // Average reading speed: 200 words/min
      setReadingTime(time);
    }
  }, [post]);

  const loadPost = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.get<{ success: boolean; post?: BlogPost }>(
        `/api/blog/public/post?slug=${encodeURIComponent(slug)}`
      );

      if (!data.success || !data.post) {
        setError('Post not found');
        setLoading(false);
        return;
      }

      // Convert markdown to HTML
      const htmlContent = await convertMarkdownToHTML(data.post.content || '');
      setPost({
        ...data.post,
        content: htmlContent
      });

      // Update page title
      document.title = `${data.post.title} - Specifys.ai Blog`;

      // Update meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && data.post.seoDescription) {
        metaDesc.setAttribute('content', data.post.seoDescription);
      } else if (metaDesc && data.post.description) {
        metaDesc.setAttribute('content', data.post.description);
      }

    } catch (err: any) {
      console.error('Error loading post:', err);
      if (err.status === 404) {
        setError('Post not found');
      } else {
        setError('Error loading post. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const convertMarkdownToHTML = async (markdown: string): Promise<string> => {
    if (!markdown) return '';
    
    try {
      // Configure marked to handle mermaid code blocks
      const customRenderer = {
        code(code: string, infostring: string | undefined, escaped: boolean) {
          const language = infostring || '';
          
          if (language === 'mermaid') {
            // Return a div with class mermaid that will be processed by MermaidRenderer
            return `<div class="mermaid">${code}</div>`;
          }
          
          // Default code block rendering
          const lang = language || 'plaintext';
          const escapedCode = escaped ? code : code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
          return `<pre><code class="language-${lang}">${escapedCode}</code></pre>`;
        }
      };
      
      // Use marked library for markdown conversion with custom renderer
      marked.use({ renderer: customRenderer as any });
      return marked.parse(markdown);
    } catch (error) {
      console.error('Error converting markdown:', error);
      return markdown;
    }
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'No date';
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const shareOnTwitter = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!post) return;
    const url = window.location.href;
    const text = post.title;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  };

  const shareOnLinkedIn = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = window.location.href;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
  };

  const shareOnFacebook = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = window.location.href;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  };

  const copyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  if (loading) {
    return (
      <>
        <div className="reading-progress-bar" id="reading-progress"></div>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="separator">/</span>
          <Link href="/blog/">Blog</Link>
          <span className="separator">/</span>
          <span className="current">Loading...</span>
        </nav>
        <article className="post-content">
          <div>
            <p>Loading post...</p>
          </div>
        </article>
      </>
    );
  }

  if (error || !post) {
    return (
      <>
        <div className="reading-progress-bar" id="reading-progress"></div>
        <article className="post-content">
          <div>
            <h1>Post Not Found</h1>
            <p>{error || 'The requested post could not be found.'}</p>
            <Link href="/blog/" className="back-to-blog-btn">
              <i className="fas fa-arrow-left"></i> Back to Blog
            </Link>
          </div>
        </article>
      </>
    );
  }

  return (
    <>
      <div className="reading-progress-bar" id="reading-progress"></div>

      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="separator">/</span>
        <Link href="/blog/">Blog</Link>
        <span className="separator">/</span>
        <span className="current">{post.title}</span>
      </nav>

      <article className="post-content">
        <header className="post-header">
          <h1 className="post-title">{post.title}</h1>
          <div className="post-meta">
            <div className="meta-item">
              <i className="far fa-calendar-alt"></i>
              <time dateTime={post.date} className="post-date">{formatDate(post.date)}</time>
            </div>
            
            {post.author && (
              <div className="meta-item">
                <i className="far fa-user"></i>
                <span className="post-author">{post.author}</span>
              </div>
            )}
            
            <div className="meta-item">
              <i className="far fa-clock"></i>
              <span className="reading-time">{readingTime} min read</span>
            </div>
          </div>
          
          {post.tags && post.tags.length > 0 && (
            <div className="post-tags-header">
              {post.tags.slice(0, 5).map((tag, idx) => (
                <span key={idx} className="tag">{tag}</span>
              ))}
            </div>
          )}
          
          {post.description && (
            <div className="post-description">
              <i className="fas fa-quote-left quote-icon"></i>
              <p>{post.description}</p>
            </div>
          )}
        </header>
        
        <div className="post-body" id="post-body" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: post.content }} />
        <MermaidRenderer containerId="post-body" />
        
        <footer className="post-footer">
          <div className="share-section">
            <h4>Share this article</h4>
            <div className="share-buttons">
              <a href="#" className="share-btn twitter" onClick={shareOnTwitter} aria-label="Share on Twitter">
                <i className="fab fa-twitter"></i>
              </a>
              <a href="#" className="share-btn linkedin" onClick={shareOnLinkedIn} aria-label="Share on LinkedIn">
                <i className="fab fa-linkedin-in"></i>
              </a>
              <a href="#" className="share-btn facebook" onClick={shareOnFacebook} aria-label="Share on Facebook">
                <i className="fab fa-facebook-f"></i>
              </a>
              <a href="#" className="share-btn copy" onClick={copyLink} aria-label="Copy link">
                <i className="fas fa-link"></i>
              </a>
            </div>
          </div>
          
          {post.tags && post.tags.length > 0 && (
            <div className="post-tags-footer">
              <h4>Related Topics</h4>
              <div className="post-tags">
                {post.tags.map((tag, idx) => (
                  <span key={idx} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          )}
          
          <div className="back-to-blog">
            <Link href="/blog/" className="back-to-blog-btn">
              <i className="fas fa-arrow-left"></i>
              <span>Back to All Articles</span>
            </Link>
          </div>
        </footer>
      </article>

      <button className="back-to-top" id="back-to-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <i className="fas fa-arrow-up"></i>
      </button>
    </>
  );
}

