import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function track(name, params) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params);
  }
}

function toolsUrl() {
  const root = document.getElementById('root');
  const fromDom = root && root.getAttribute('data-tools-url');
  return fromDom || '/tools/map/tools.json';
}

async function ensureFirestore() {
  if (typeof window.__specifysEnsureFirestore === 'function') {
    await window.__specifysEnsureFirestore();
  }
  if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') {
    throw new Error('Firestore is not available');
  }
  return firebase.firestore();
}

function readCurrentUser() {
  if (typeof firebase === 'undefined' || !firebase.auth) return null;
  return firebase.auth().currentUser;
}

async function fetchTools() {
  const response = await fetch(toolsUrl());
  if (!response.ok) throw new Error('Tools file failed: ' + response.status);
  let data = await response.json();
  if (!Array.isArray(data)) data = data.tools || data.data || [];
  data = data.filter((tool) => tool && !tool.unavailable && tool.category && typeof tool.category === 'string' && tool.category.trim() !== '');
  data = data.map((tool) => {
    if (tool.category === 'UI/UX Design & Prototyping Tools') {
      return { ...tool, category: 'Prototyping Tools' };
    }
    return tool;
  });
  return data.map((tool) => ({
    ...tool,
    rating: tool.rating || Math.floor(Math.random() * 5) + 1,
    pros: tool.pros && tool.pros.length > 0 ? tool.pros : ['No additional pros available'],
    cons: tool.cons && tool.cons.length > 0 ? tool.cons : [],
    special: tool.special || '',
    stats: tool.stats || { users: 'N/A', globalRating: tool.rating || 4, monthlyUsage: 'N/A', ARR: 'N/A' }
  }));
}

const categoryColors = {
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

function categoryClass(category) {
  return String(category || '').toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
}

function getCategoryColor(category) {
  return categoryColors[category] || '#6b7280';
}

function ToolCard({ tool }) {
  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    if (tool.link && tool.link !== '#') {
      track('click', {
        event_category: 'Tool Link',
        event_label: tool.name,
        value: tool.link
      });
      window.open(tool.link, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAddToList = async (event) => {
    event.stopPropagation();
    const user = readCurrentUser();
    if (!user) {
      alert('Please log in to add tools to your list');
      return;
    }
    setIsLoading(true);
    try {
      const db = await ensureFirestore();
      const ref = db.collection('userTools').doc(user.uid).collection('savedTools').doc(String(tool.id));
      if (isAdded) {
        await ref.delete();
        setIsAdded(false);
        track('click', { event_category: 'Remove from List', event_label: tool.name, value: 'removed' });
      } else {
        await ref.set({
          id: tool.id,
          name: tool.name,
          category: tool.category,
          description: tool.description,
          link: tool.link,
          rating: tool.rating,
          pros: tool.pros,
          addedAt: new Date().toISOString()
        });
        setIsAdded(true);
        track('click', { event_category: 'Add to List', event_label: tool.name, value: 'saved' });
      }
    } catch (error) {
      console.error('Error updating tool list:', error);
      alert('Error updating your tool list');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let stopped = false;
    let unsubscribe = function () {};

    async function check(user) {
      if (!user) {
        if (!stopped) setIsAdded(false);
        return;
      }
      try {
        const db = await ensureFirestore();
        const doc = await db.collection('userTools').doc(user.uid).collection('savedTools').doc(String(tool.id)).get();
        if (!stopped) setIsAdded(!!(doc && doc.exists));
      } catch (error) {
        console.error('Error checking saved status:', error);
        if (!stopped) setIsAdded(false);
      }
    }

    function bind() {
      if (typeof firebase === 'undefined' || !firebase.auth) return;
      unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        check(user);
      });
    }

    if (typeof firebase !== 'undefined' && firebase.auth) bind();
    else window.addEventListener('firebase-ready', bind, { once: true });

    return () => {
      stopped = true;
      unsubscribe();
      window.removeEventListener('firebase-ready', bind);
    };
  }, [tool.id]);

  return (
    <div
      className={`tool-card ${categoryClass(tool.category)}`}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={tool.link === '#' ? `Placeholder: ${tool.name}` : `Open ${tool.name} website`}
    >
      {tool.special ? <div className="tool-special">{tool.special}</div> : null}
      <div>
        <div className="tool-name">{tool.name}</div>
        <div className="tool-description">{tool.description || 'Placeholder tool with basic functionality.'}</div>
        <div className="tool-pros">Pros: {tool.pros.join(', ')}</div>
        <div className="tool-rating">
          {Array.from({ length: 5 }, (_, i) => (
            <i
              key={i}
              className={`fas fa-star ${i < Math.floor(tool.rating) ? 'text-warning' : ''}`}
              style={{ opacity: i < tool.rating ? 1 : 0.3 }}
              aria-hidden="true"
            />
          ))}
          <span className="visually-hidden">{tool.rating} out of 5 stars</span>
        </div>
      </div>
      {tool.link !== '#' ? (
        <>
          <i className="fas fa-arrow-right tool-link-icon" aria-hidden="true"></i>
          <span className="tool-tooltip">Visit Website</span>
        </>
      ) : null}
      <button
        type="button"
        className={`add-to-list-btn ${isAdded ? 'added' : ''} ${isLoading ? 'loading' : ''}`}
        onClick={handleAddToList}
        disabled={isLoading}
        style={{
          backgroundColor: isAdded ? '#28a745' : getCategoryColor(tool.category),
          borderColor: getCategoryColor(tool.category)
        }}
        aria-label={isAdded ? `Remove ${tool.name} from your list` : `Add ${tool.name} to your list`}
      >
        <span>{isAdded ? '✓ In My List' : '+ Add to List'}</span>
      </button>
    </div>
  );
}

function ToolMap() {
  const [tools, setTools] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [error, setError] = useState(null);
  const [isCategoryClicked, setIsCategoryClicked] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  useEffect(() => {
    fetchTools().then((data) => {
      if (!data.length) setError('Failed to load tools. Please try again later.');
      else {
        setTools(data);
        setError(null);
      }
    }).catch(() => {
      setError('Failed to load tools. Please try again later.');
    });
  }, []);

  const categories = [...new Set(tools.map((tool) => tool.category).filter((category) => category && typeof category === 'string' && category.trim() !== ''))];
  const initialCategories = ['Prompt-to-App Builders', 'User Design', 'Prototyping Tools'];
  const displayedCategories = showAllCategories ? categories : ['All', ...initialCategories];
  const filteredTools = selectedCategory ? tools.filter((tool) => tool.category === selectedCategory) : tools;

  const handleCategoryClick = (category) => {
    setSelectedCategory(category === 'all' ? null : category);
    setIsCategoryClicked(category !== 'all');
    if (window.innerWidth <= 768) {
      setTimeout(() => {
        const section = document.querySelector(
          category === 'all'
            ? 'h2.text-center:first-of-type'
            : `h2.${categoryClass(category)}`
        );
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  };

  const handleCategoryHover = (category) => {
    if (!isCategoryClicked) setSelectedCategory(category === 'all' ? null : category);
  };

  const handleMouseLeave = () => {
    if (!isCategoryClicked && selectedCategory !== null) setSelectedCategory(null);
  };

  return (
    <div>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      <div className="category-filter">
        {displayedCategories.map((category) => (
          <button
            key={category === 'All' ? 'all' : category}
            type="button"
            className={`${selectedCategory === (category === 'All' ? null : category) ? 'active' : ''} ${
              category === 'All' ? 'all-btn' : `${categoryClass(category)}-btn`
            }`}
            onClick={() => handleCategoryClick(category === 'All' ? 'all' : category)}
            onMouseOver={() => handleCategoryHover(category === 'All' ? 'all' : category)}
            onMouseLeave={handleMouseLeave}
            aria-pressed={selectedCategory === (category === 'All' ? null : category)}
          >
            {category}
          </button>
        ))}
      </div>
      {categories.length > initialCategories.length ? (
        <button type="button" className="show-more-btn" onClick={() => setShowAllCategories((value) => !value)}>
          {showAllCategories ? 'Show Less' : 'Show More'}
        </button>
      ) : null}
      {filteredTools.length > 0 ? (
        selectedCategory ? (
          <>
            <h2 className={`text-center mb-3 ${categoryClass(selectedCategory)}`} aria-live="polite">{selectedCategory}</h2>
            <div className="row row-cols-1 row-cols-md-2 g-3">
              {filteredTools.map((tool) => (
                <div key={tool.id} className="col">
                  <ToolCard tool={tool} />
                </div>
              ))}
            </div>
          </>
        ) : (
          categories.map((category) => (
            <div key={category}>
              <h2 className={`text-center mb-3 ${categoryClass(category)}`} aria-live="polite">{category}</h2>
              <div className="row row-cols-1 row-cols-md-2 g-3">
                {tools.filter((tool) => tool.category === category).map((tool) => (
                  <div key={tool.id} className="col">
                    <ToolCard tool={tool} />
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
  );
}

window.closeNewsletter = function () {
  const newsletterContainer = document.getElementById('newsletter-container');
  if (newsletterContainer) newsletterContainer.classList.add('hidden');
};

window.submitNewsletterForm = function (event) {
  event.preventDefault();
  const form = event.target;
  const email = form.querySelector('input[name="email"]').value;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.classList.add('loading');
  const url = 'https://script.google.com/macros/s/AKfycbzRv07wfY5DRmhXKTeELv0GXgTyGYFan6XYbzd5a6cH-tpju_3q7L1Y4ByWA5SI4RFRBQ/exec';
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `email=${encodeURIComponent(email)}`
  })
    .then((response) => response.json())
    .then((data) => {
      submitButton.classList.remove('loading');
      if (data.result === 'success') {
        alert('Successfully subscribed to the newsletter!');
        form.reset();
        document.getElementById('newsletter-container').classList.add('hidden');
      } else {
        alert('An error occurred. Please try again.');
      }
    })
    .catch((error) => {
      submitButton.classList.remove('loading');
      console.error('Error:', error);
      alert('An error occurred. Please try again.');
    });
};

setTimeout(() => {
  const newsletterContainer = document.getElementById('newsletter-container');
  if (newsletterContainer) newsletterContainer.classList.remove('hidden');
}, 10000);

document.querySelectorAll('a[href*="utm_source=toolsmap"]').forEach((link) => {
  link.addEventListener('click', () => {
    track('click', {
      event_category: 'CTA Link',
      event_label: link.getAttribute('href').includes('toolsmap_intro') ? 'Intro CTA' : 'Bottom CTA',
      value: link.getAttribute('href')
    });
  });
});

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<ToolMap />);
}
