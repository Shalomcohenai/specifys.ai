'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getFirebaseFirestore } from '@/lib/firebase/init';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import Script from 'next/script';

interface Tool {
  id: number;
  name: string;
  category: string;
  description: string;
  link: string;
  rating: number;
  pros: string[];
  cons?: string[];
  special?: string;
  stats?: {
    users?: string;
    globalRating?: number;
    monthlyUsage?: string;
    ARR?: string;
  };
}

export default function VibeCodingToolsMapPage() {
  const { user } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCategoryClicked, setIsCategoryClicked] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [savedTools, setSavedTools] = useState<Set<number>>(new Set());
  const [newsletterVisible, setNewsletterVisible] = useState(false);

  useEffect(() => {
    fetchTools();
  }, []);

  useEffect(() => {
    if (user && tools.length > 0) {
      const loadSaved = async () => {
        try {
          const db = getFirebaseFirestore();
          const savedToolIds = new Set<number>();
          for (const tool of tools) {
            const toolRef = doc(db, 'userTools', user.uid, 'savedTools', tool.id.toString());
            const docSnap = await getDoc(toolRef);
            if (docSnap.exists()) {
              savedToolIds.add(tool.id);
            }
          }
          setSavedTools(savedToolIds);
        } catch (error) {
          console.error('Error loading saved tools:', error);
        }
      };
      loadSaved();
    } else if (!user) {
      setSavedTools(new Set());
    }
  }, [user, tools]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNewsletterVisible(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  async function fetchTools() {
    try {
      const response = await fetch('/tools/map/tools.json');
      if (!response.ok) throw new Error('Network response was not ok ' + response.status);
      let data: Tool[] = await response.json();
      data = data.filter(tool => tool && tool.category && typeof tool.category === 'string' && tool.category.trim() !== '');
      data = data.map(tool => {
        if (tool.category === "UI/UX Design & Prototyping Tools") {
          return { ...tool, category: "Prototyping Tools" };
        }
        return tool;
      });
      setTools(data.map(tool => ({
        ...tool,
        rating: tool.rating || Math.floor(Math.random() * 5) + 1,
        pros: tool.pros && tool.pros.length > 0 ? tool.pros : ["No additional pros available"],
        cons: tool.cons && tool.cons.length > 0 ? tool.cons : [],
        special: tool.special || "",
        stats: tool.stats || { users: "N/A", globalRating: tool.rating || 4, monthlyUsage: "N/A", ARR: "N/A" }
      })));
    } catch (error) {
      console.error('Failed to fetch tools:', error);
      setError("Failed to load tools. Please try again later.");
    }
  }


  async function handleAddToList(toolId: number) {
    if (!user) {
      alert('Please log in to add tools to your list');
      return;
    }

    try {
      const db = getFirebaseFirestore();
      const toolRef = doc(db, 'userTools', user.uid, 'savedTools', toolId.toString());
      
      if (savedTools.has(toolId)) {
        await deleteDoc(toolRef);
        setSavedTools(prev => {
          const newSet = new Set(prev);
          newSet.delete(toolId);
          return newSet;
        });
      } else {
        const tool = tools.find(t => t.id === toolId);
        if (tool) {
          await setDoc(toolRef, {
            id: tool.id,
            name: tool.name,
            category: tool.category,
            description: tool.description,
            link: tool.link,
            rating: tool.rating,
            pros: tool.pros,
            addedAt: new Date().toISOString()
          });
          setSavedTools(prev => new Set(prev).add(toolId));
        }
      }
    } catch (error) {
      console.error('Error updating tool list:', error);
      alert('Error updating your tool list');
    }
  }

  async function submitNewsletterForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = (form.querySelector('input[name="email"]') as HTMLInputElement)?.value;
    if (!email) return;

    const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitButton.classList.add('loading');
    const url = 'https://script.google.com/macros/s/AKfycbzRv07wfY5DRmhXKTeELv0GXgTyGYFan6XYbzd5a6cH-tpju_3q7L1Y4ByWA5SI4RFRBQ/exec';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `email=${encodeURIComponent(email)}`
      });
      const data = await response.json();
      submitButton.classList.remove('loading');
      if (data.result === 'success') {
        alert('Successfully subscribed to the newsletter!');
        form.reset();
        setNewsletterVisible(false);
      } else {
        alert('An error occurred. Please try again.');
      }
    } catch (error) {
      submitButton.classList.remove('loading');
      console.error('Error:', error);
      alert('An error occurred. Please try again.');
    }
  }

  const categories = [...new Set(tools.map(tool => tool.category).filter(category => category && typeof category === 'string' && category.trim() !== ''))];
  const initialCategories = ['Prompt-to-App Builders', 'User Design', 'Prototyping Tools'];
  const displayedCategories = showAllCategories ? categories : ['All', ...initialCategories];

  const filteredTools = selectedCategory
    ? tools.filter(tool => tool.category === selectedCategory)
    : tools;

  const handleCategoryClick = (category: string) => {
    const cat = category === 'All' ? null : category;
    setSelectedCategory(cat);
    setIsCategoryClicked(cat !== null);
    if (window.innerWidth <= 768) {
      setTimeout(() => {
        const section = document.querySelector(
          cat === null
            ? `h2.text-center:first-of-type`
            : `h2.${cat.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`
        );
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    }
  };

  const handleCategoryHover = (category: string) => {
    if (!isCategoryClicked) {
      setSelectedCategory(category === 'All' ? null : category);
    }
  };

  const handleMouseLeave = () => {
    if (!isCategoryClicked && selectedCategory !== null) {
      setSelectedCategory(null);
    }
  };

  const getCategoryColor = (category: string) => {
    const categoryColors: Record<string, string> = {
      'Prompt-to-App Builders': '#23a6d5',
      'Prototyping Tools': '#e57373',
      'User Design': '#888',
      'AI-Augmented IDEs & Code Assistants': '#e73c7e',
      'AI Agent & Workflow Tools': '#ee7752',
      'Deployment, Marketing & Integrations': '#2e7d32',
      'Data-Driven App Builders': '#0288d1',
      'Business Process Automation': '#7b1fa2',
      'Game Development Tools': '#d81b60',
      'Code Security Tools': '#388e3c',
      'UI/UX Code Tools': '#f57c00',
      'Educational & Coding Tools': '#00838f',
      'AR/VR Development Tools': '#c2185b',
      'Misc Tools': '#6b7280'
    };
    return categoryColors[category] || '#6b7280';
  };

  const getCategoryClassName = (category: string) => {
    return category.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
  };

  return (
    <>
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700&display=block");

        :root {
          --background-color: #f5f5f5;
          --header-background: rgba(255, 255, 255, 0.9);
          --header-text: #333;
          --footer-background: #fff;
          --footer-text: #333;
          --footer-link: #333;
          --footer-link-hover: #FF6B35;
          --footer-divider: #333;
          --footer-social: #333;
          --footer-social-hover: #FF6B35;
          --footer-copyright: #666;
          --content-background: rgba(255, 255, 255, 0.95);
          --content-text: #333;
          --content-link: #FF6B35;
          --content-link-hover: #FF8551;
          --category-filter-background: rgba(255, 255, 255, 0.95);
          --category-filter-button: #f5f5f5;
          --category-filter-button-border: #ddd;
          --tool-card-background: #fff;
          --tool-card-border: #ddd;
          --tool-description: #666;
          --tool-pros: #444;
          --tool-rating: #f4c430;
          --cta-background: rgba(255, 255, 255, 0.95);
          --newsletter-background: #fff;
          --newsletter-text: #333;
          --newsletter-input-background: #f5f5f5;
          --newsletter-input-border: #ddd;
          --error-message: #ff4444;
        }

        .tools-map-page {
          font-family: "Montserrat", sans-serif;
          background: #f5f5f5;
          min-height: 100vh;
        }

        .main-content-wrapper {
          width: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          padding: 10rem 1.5rem 2rem;
          box-sizing: border-box;
          position: relative;
          max-width: 1200px;
          margin: 0 auto;
          padding-left: 20px;
          padding-right: 20px;
        }

        .header-text {
          width: 100%;
          max-width: 800px;
          text-align: center;
          padding: 0 1rem;
          position: absolute;
          top: 6rem;
          color: var(--content-text);
          z-index: 5;
        }

        .header-text h1 {
          font-size: clamp(1.8rem, 4vw, 2.5rem);
          font-weight: 700;
          margin-bottom: 0.5rem;
          line-height: 1.2;
        }

        .header-text p {
          max-width: 700px;
          margin: 1rem auto 0;
          text-align: center;
          color: var(--content-text);
          font-size: 1rem;
          font-weight: 500;
          line-height: 1.5;
          background: var(--content-background);
          padding: 15px;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .header-text p a {
          color: var(--content-link);
          text-decoration: underline;
          font-weight: 600;
        }

        .header-text p a:hover {
          color: var(--content-link-hover);
        }

        .category-filter {
          background: var(--category-filter-background);
          padding: 20px;
          text-align: center;
          width: 100%;
          max-width: 850px;
          margin: 8rem auto 0;
          border-radius: 15px;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-bottom: 10px;
          flex-wrap: wrap;
          z-index: 4;
        }

        .category-filter button {
          background: var(--category-filter-button);
          border: 1px solid var(--category-filter-button-border);
          border-radius: 5px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 0.9rem;
          color: var(--content-text);
          position: relative;
          overflow: hidden;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .category-filter button.active {
          transform: scale(1.05) translateY(-2px);
          box-shadow: 0 0 15px rgba(0, 120, 212, 0.5);
        }

        .show-more-btn {
          display: block;
          margin: 10px auto 20px;
          background: var(--content-background);
          border: 1px solid var(--category-filter-button-border);
          border-radius: 5px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 0.9rem;
          color: var(--content-link);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
          width: fit-content;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          animation: gentleBounce 2s ease infinite;
        }

        .show-more-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }

        @keyframes gentleBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        .tool-card {
          background: var(--tool-card-background);
          border: 1px solid var(--tool-card-border);
          border-radius: 10px;
          padding: 15px;
          margin-bottom: 20px;
          cursor: pointer;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          min-height: 180px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
        }

        .tool-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }

        .tool-special {
          font-size: 0.8rem;
          color: var(--error-message);
          font-weight: bold;
          margin-bottom: 5px;
        }

        .tool-name {
          font-weight: bold;
          font-size: 1.2rem;
          margin-bottom: 5px;
          color: var(--content-text);
        }

        .tool-description {
          font-size: 0.9rem;
          color: var(--tool-description);
          margin-bottom: 5px;
          flex-grow: 1;
          overflow: hidden;
          max-height: 4.5em;
          line-height: 1.5em;
        }

        .tool-pros {
          font-size: 0.85rem;
          color: var(--tool-pros);
          margin-bottom: 5px;
          font-style: italic;
        }

        .tool-rating {
          font-size: 0.9rem;
          color: var(--tool-rating);
        }

        .tool-link-icon {
          position: absolute;
          top: 10px;
          right: 10px;
          font-size: 0.8rem;
          transition: transform 0.3s ease;
          color: var(--content-link);
        }

        .tool-card:hover .tool-link-icon {
          transform: scale(1.2);
        }

        .add-to-list-btn {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          background: #FF6B35;
          color: white;
          border: none;
          border-radius: 15px;
          padding: 6px 12px;
          font-size: 0.7rem;
          cursor: pointer;
          transition: all 0.3s ease;
          opacity: 0;
          z-index: 5;
          font-weight: 500;
        }

        .tool-card:hover .add-to-list-btn {
          opacity: 1;
          transform: translateX(-50%) scale(1.05);
        }

        .add-to-list-btn.added {
          background: #28a745;
          opacity: 1;
        }

        .add-to-list-btn:hover {
          transform: translateX(-50%) scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .col {
          min-width: 0;
        }

        h2 {
          margin-bottom: 1rem;
          color: var(--content-text);
          text-align: center;
        }

        .error-message {
          text-align: center;
          color: var(--error-message);
          font-size: 1rem;
          margin-top: 20px;
        }

        .cta-box {
          background: var(--cta-background);
          padding: 20px;
          text-align: center;
          width: 100%;
          max-width: 850px;
          margin: 2rem auto;
          border-radius: 15px;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
        }

        .cta-box p {
          font-size: 1.1rem;
          color: var(--content-text);
          font-weight: 500;
          line-height: 1.5;
        }

        .cta-box a {
          color: var(--content-link);
          text-decoration: underline;
          font-weight: 600;
        }

        .cta-box a:hover {
          color: var(--content-link-hover);
        }

        .newsletter-container {
          position: fixed;
          bottom: 5rem;
          left: 50%;
          transform: translateX(-50%);
          background: var(--newsletter-background);
          padding: 0.6rem 1rem;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 10;
          text-align: center;
          display: ${newsletterVisible ? 'block' : 'none'};
        }

        .newsletter-container.hidden {
          display: none;
        }

        .newsletter-container h3 {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 0.3rem;
          color: var(--newsletter-text);
        }

        .newsletter-container p {
          font-size: 0.8rem;
          color: var(--tool-description);
          margin-bottom: 0.5rem;
        }

        .newsletter-container form {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .newsletter-container input {
          padding: 0.3rem;
          border-radius: 5px;
          border: 1px solid var(--newsletter-input-border);
          outline: none;
          background: var(--newsletter-input-background);
          color: var(--content-text);
          width: 250px;
        }

        .newsletter-container button {
          padding: 0.3rem 0.8rem;
          background: #FF6B35;
          color: white;
          border-radius: 5px;
          border: none;
          cursor: pointer;
          transition: background 0.3s ease;
        }

        .newsletter-container button:hover {
          background: #FF8551;
        }

        .newsletter-close {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          color: var(--newsletter-text);
          font-size: 0.9rem;
          cursor: pointer;
          padding: 3px;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .newsletter-close:hover {
          background-color: rgba(0, 0, 0, 0.1);
        }

        @media (max-width: 768px) {
          .main-content-wrapper { padding: 8rem 1rem 2rem; max-width: 650px; }
          .header-text { top: 5rem; }
          .header-text h1 { font-size: clamp(1.4rem, 3vw, 1.8rem); }
          .header-text p { font-size: 0.9rem; padding: 10px; }
          .category-filter { padding: 15px; max-width: 650px; flex-direction: column; gap: 10px; margin-top: 9rem; }
          .category-filter button { width: 100%; text-align: center; }
          .show-more-btn { width: 50%; }
          .tool-card { padding: 10px; min-height: 160px; }
          .cta-box { padding: 15px; max-width: 650px; }
          .row { grid-template-columns: 1fr; }
          .newsletter-container { width: 90%; bottom: 4rem; padding: 0.4rem 0.8rem; }
          .newsletter-container input { width: 100%; margin-bottom: 0.4rem; }
          .newsletter-container form { flex-direction: column; gap: 0.2rem; }
        }

        @media (max-width: 480px) {
          .main-content-wrapper { padding: 7rem 0.5rem 2rem; max-width: 90%; }
          .header-text { top: 4.5rem; }
          .header-text p { font-size: 0.85rem; padding: 8px; }
          .category-filter { padding: 10px; max-width: 90%; margin-top: 8.5rem; }
          .show-more-btn { width: 70%; }
          .tool-card { padding: 8px; min-height: 140px; }
          .cta-box { padding: 10px; max-width: 90%; }
        }
      `}</style>

      <div className="tools-map-page">
        <div className="main-content-wrapper">
          <div className="header-text">
            <h1>Vibe Coding Tools Map</h1>
            <p>
              Don&apos;t know which tool to use? Check our new <Link href="/tool-picker">Tool Finder</Link> here!
            </p>
          </div>

          {error && <p className="error-message" aria-live="assertive">{error}</p>}

          <div className="category-filter">
            {displayedCategories.map(category => {
              const cat = category === 'All' ? null : category;
              const isActive = selectedCategory === cat;
              const className = category === 'All' ? 'all-btn' : `${getCategoryClassName(category)}-btn`;
              return (
                <button
                  key={category === 'All' ? 'all' : category}
                  className={`${isActive ? 'active' : ''} ${className}`}
                  onClick={() => handleCategoryClick(category)}
                  onMouseOver={() => handleCategoryHover(category)}
                  onMouseLeave={handleMouseLeave}
                >
                  {category}
                </button>
              );
            })}
          </div>

          {categories.length > initialCategories.length && (
            <button className="show-more-btn" onClick={() => setShowAllCategories(!showAllCategories)}>
              {showAllCategories ? 'Show Less' : 'Show More'}
            </button>
          )}

          {filteredTools.length > 0 ? (
            selectedCategory ? (
              <>
                <h2 className={`text-center mb-3 ${getCategoryClassName(selectedCategory)}`}>
                  {selectedCategory}
                </h2>
                <div className="row">
                  {filteredTools.map(tool => (
                    <div key={tool.id} className="col">
                      <div
                        className={`tool-card ${getCategoryClassName(tool.category)}`}
                        onClick={() => {
                          if (tool.link !== "#") {
                            window.open(tool.link, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      >
                        {tool.special && <div className="tool-special">{tool.special}</div>}
                        <div>
                          <div className="tool-name">{tool.name}</div>
                          <div className="tool-description">{tool.description || "Placeholder tool with basic functionality."}</div>
                          <div className="tool-pros">Pros: {tool.pros.join(", ")}</div>
                          <div className="tool-rating">
                            {Array.from({ length: 5 }, (_, i) => (
                              <i
                                key={i}
                                className={`fas fa-star ${i < Math.floor(tool.rating) ? 'text-warning' : ''}`}
                               
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                        </div>
                        {tool.link !== "#" && (
                          <i className="fas fa-arrow-right tool-link-icon"></i>
                        )}
                        <button
                          className={`add-to-list-btn ${savedTools.has(tool.id) ? 'added' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToList(tool.id);
                          }}
                        >
                          {savedTools.has(tool.id) ? '✓ In My List' : '+ Add to List'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              categories.map(category => (
                <div key={category}>
                  <h2 className={`text-center mb-3 ${getCategoryClassName(category)}`}>
                    {category}
                  </h2>
                  <div className="row">
                    {tools.filter(tool => tool.category === category).map(tool => (
                      <div key={tool.id} className="col">
                        <div
                          className={`tool-card ${getCategoryClassName(tool.category)}`}
                          onClick={() => {
                            if (tool.link !== "#") {
                              window.open(tool.link, '_blank', 'noopener,noreferrer');
                            }
                          }}
                        >
                          {tool.special && <div className="tool-special">{tool.special}</div>}
                          <div>
                            <div className="tool-name">{tool.name}</div>
                            <div className="tool-description">{tool.description || "Placeholder tool with basic functionality."}</div>
                            <div className="tool-pros">Pros: {tool.pros.join(", ")}</div>
                            <div className="tool-rating">
                              {Array.from({ length: 5 }, (_, i) => (
                                <i
                                  key={i}
                                  className={`fas fa-star ${i < Math.floor(tool.rating) ? 'text-warning' : ''}`}
                                 
                                  aria-hidden="true"
                                />
                              ))}
                            </div>
                          </div>
                          {tool.link !== "#" && (
                            <i className="fas fa-arrow-right tool-link-icon"></i>
                          )}
                          <button
                            className={`add-to-list-btn ${savedTools.has(tool.id) ? 'added' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToList(tool.id);
                            }}
                          >
                            {savedTools.has(tool.id) ? '✓ In My List' : '+ Add to List'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )
          ) : (
            <p className="text-center" aria-live="polite">No tools available for the selected category.</p>
          )}
        </div>

        <div className="cta-box">
          <p>Looking to turn your app idea into a real plan? Try <Link href="/">Specifys.ai</Link> — the AI-powered spec generator trusted by indie makers.</p>
        </div>

        {newsletterVisible && (
          <div className="newsletter-container">
            <button className="newsletter-close" onClick={() => setNewsletterVisible(false)} aria-label="Close newsletter">
              <i className="fas fa-times"></i>
            </button>
            <h3>Join Our Newsletter</h3>
            <p>Get weekly updates on trending AI tools!</p>
            <form onSubmit={submitNewsletterForm}>
              <input type="email" name="email" placeholder="Enter your email" aria-label="Email for newsletter" required />
              <button type="submit">Subscribe</button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}

