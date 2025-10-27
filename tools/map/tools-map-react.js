    // Wait for all libraries to load before running React code
    function waitForLibraries() {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds timeout
        
        const checkLibraries = () => {
          attempts++;
          
          if (typeof React !== 'undefined' && typeof ReactDOM !== 'undefined' && typeof Babel !== 'undefined') {
            console.log('All libraries loaded successfully');
            resolve();
          } else if (attempts >= maxAttempts) {
            console.error('Timeout waiting for libraries to load');
            reject(new Error('Libraries failed to load within timeout period'));
          } else {
            console.log('Waiting for libraries...', {
              React: typeof React !== 'undefined',
              ReactDOM: typeof ReactDOM !== 'undefined', 
              Babel: typeof Babel !== 'undefined',
              attempts: attempts
            });
            setTimeout(checkLibraries, 100);
          }
        };
        checkLibraries();
      });
    }

    // Initialize React app after libraries are loaded
    waitForLibraries().then(() => {
      console.log('Starting React app initialization...');
      try {
        // Run the React app
        initializeReactApp();
      } catch (error) {
        console.error('Error initializing React app:', error);
        document.getElementById('root').innerHTML = '<div style="padding: 20px; color: red;">Error loading tools map. Please refresh the page.</div>';
      }
    }).catch((error) => {
      console.error('Failed to load required libraries:', error);
      document.getElementById('root').innerHTML = `
        <div style="padding: 20px; text-align: center; color: #e74c3c;">
          <h3>Unable to Load Tools Map</h3>
          <p>The required JavaScript libraries failed to load. This might be due to:</p>
          <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
            <li>Network connectivity issues</li>
            <li>Ad blocker blocking external scripts</li>
            <li>Browser security settings</li>
          </ul>
          <p style="margin-top: 15px;">
            <button onclick="window.location.reload()" style="padding: 10px 20px; background: #0078d4; color: white; border: none; border-radius: 5px; cursor: pointer;">
              Refresh Page
            </button>
          </p>
        </div>
      `;
    });

    function initializeReactApp() {
    async function fetchTools() {
      try {
        const response = await fetch(TOOLS_JSON_URL);
        if (!response.ok) throw new Error('Network response was not ok ' + response.status);
        let data = await response.json();
        data = data.filter(tool => tool && tool.category && typeof tool.category === 'string' && tool.category.trim() !== '');
        data = data.map(tool => {
          if (tool.category === "UI/UX Design & Prototyping Tools") {
            return { ...tool, category: "Prototyping Tools" };
          }
          return tool;
        });
        return data.map(tool => ({
          ...tool,
          rating: tool.rating || Math.floor(Math.random() * 5) + 1,
          pros: tool.pros && tool.pros.length > 0 ? tool.pros : ["No additional pros available"],
          cons: tool.cons && tool.cons.length > 0 ? tool.cons : [],
          special: tool.special || "",
          stats: tool.stats || { users: "N/A", globalRating: tool.rating || 4, monthlyUsage: "N/A", ARR: "N/A" }
        }));
      } catch (error) {
        console.error('Failed to fetch tools:', error);
        return [];
      }
    }

    function closeNewsletter() {
      const newsletterContainer = document.getElementById('newsletter-container');
      if (newsletterContainer) {
        newsletterContainer.classList.add('hidden');
      }
    }

    function submitNewsletterForm(event) {
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
      .then(response => response.json())
      .then(data => {
        submitButton.classList.remove('loading');
        if (data.result === 'success') {
          alert('Successfully subscribed to the newsletter!');
          form.reset();
          document.getElementById('newsletter-container').classList.add('hidden');
        } else {
          alert('An error occurred. Please try again.');
        }
      })
      .catch(error => {
        submitButton.classList.remove('loading');
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
      });
    }

    setTimeout(() => {
      const newsletterContainer = document.getElementById('newsletter-container');
      if (newsletterContainer) {
        newsletterContainer.classList.remove('hidden');
      }
    }, 10000);

    document.querySelectorAll('a[href*="utm_source=toolsmap"]').forEach(link => {
      link.addEventListener('click', () => {
        gtag('event', 'click', {
          'event_category': 'CTA Link',
          'event_label': link.getAttribute('href').includes('toolsmap_intro') ? 'Intro CTA' : 'Bottom CTA',
          'value': link.getAttribute('href')
        });
      });
    });

    // Function to get category color
    const getCategoryColor = (category) => {
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
      return categoryColors[category] || '#6b7280';
    };

    const ToolCard = ({ tool }) => {
      const [isAdded, setIsAdded] = React.useState(false);
      const [isLoading, setIsLoading] = React.useState(false);

      const handleClick = () => {
        if (tool.link !== "#") {
          gtag('event', 'click', {
            'event_category': 'Tool Link',
            'event_label': tool.name,
            'value': tool.link
          });
          window.open(tool.link, '_blank', 'noopener,noreferrer');
        }
      };

      const handleAddToList = async (e) => {
        e.stopPropagation();
        
        const user = firebase.auth().currentUser;
        if (!user) {
          alert('Please log in to add tools to your list');
          return;
        }

        setIsLoading(true);
        
        try {
          if (isAdded) {
            // Remove tool from saved list
            await firebase.firestore().collection('userTools').doc(user.uid).collection('savedTools').doc(tool.id.toString()).delete();
            setIsAdded(false);
            
            gtag('event', 'click', {
              'event_category': 'Remove from List',
              'event_label': tool.name,
              'value': 'removed'
            });
          } else {
            // Add tool to saved list
            const toolData = {
              id: tool.id,
              name: tool.name,
              category: tool.category,
              description: tool.description,
              link: tool.link,
              rating: tool.rating,
              pros: tool.pros,
              addedAt: new Date().toISOString()
            };

            await firebase.firestore().collection('userTools').doc(user.uid).collection('savedTools').doc(tool.id.toString()).set(toolData);
            setIsAdded(true);
            
            gtag('event', 'click', {
              'event_category': 'Add to List',
              'event_label': tool.name,
              'value': 'saved'
            });
          }
          
          setIsLoading(false);
        } catch (error) {
          console.error('Error updating tool list:', error);
          alert('Error updating your tool list');
          setIsLoading(false);
        }
      };

      // Check if tool is already saved on component mount and when auth state changes
      React.useEffect(() => {
        const checkIfSaved = async () => {
          const user = firebase.auth().currentUser;
          if (user) {
            try {
              const doc = await firebase.firestore().collection('userTools').doc(user.uid).collection('savedTools').doc(tool.id.toString()).get();
              if (doc.exists) {
                setIsAdded(true);
              } else {
                setIsAdded(false);
              }
            } catch (error) {
              console.error('Error checking saved status:', error);
              setIsAdded(false);
            }
          } else {
            setIsAdded(false);
          }
        };
        
        checkIfSaved();
        
        // Listen for auth state changes
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
          checkIfSaved();
        });
        
        return () => unsubscribe();
      }, [tool.id]);

      return (
        <div
          className={`tool-card ${tool.category.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}
          onClick={handleClick}
          onTouchStart={() => {}}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => e.key === 'Enter' && handleClick()}
          aria-label={tool.link === "#" ? `Placeholder: ${tool.name}` : `Open ${tool.name} website`}
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
                  style={{ opacity: i < tool.rating ? 1 : 0.3 }}
                  aria-hidden="true"
                />
              ))}
              <span className="visually-hidden">{tool.rating} out of 5 stars</span>
            </div>
          </div>
          {tool.link !== "#" && (
            <>
              <i className="fas fa-arrow-right tool-link-icon" aria-hidden="true"></i>
              <span className="tool-tooltip">Visit Website</span>
            </>
          )}
          <button 
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
    };

    const ToolMap = () => {
      const [tools, setTools] = React.useState([]);
      const [selectedCategory, setSelectedCategory] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [isCategoryClicked, setIsCategoryClicked] = React.useState(false);
      const [showAllCategories, setShowAllCategories] = React.useState(false);

      React.useEffect(() => {
        fetchTools().then(data => {
          if (data.length === 0) {
            setError("Failed to load tools. Please try again later.");
          } else {
            setTools(data);
            setError(null);
          }
        });
      }, []);

      const categories = [...new Set(tools.map(tool => tool.category).filter(category => category && typeof category === 'string' && category.trim() !== ''))];
      const initialCategories = ['Prompt-to-App Builders', 'User Design', 'Prototyping Tools'];
      const displayedCategories = showAllCategories ? categories : ['All', ...initialCategories];

      const filteredTools = selectedCategory
        ? tools.filter(tool => tool.category === selectedCategory)
        : tools;

      const handleCategoryClick = (category) => {
        setSelectedCategory(category === 'all' ? null : category);
        setIsCategoryClicked(category !== 'all');
        if (window.innerWidth <= 768) {
          setTimeout(() => {
            const section = document.querySelector(
              category === 'all'
                ? `h2.text-center:first-of-type`
                : `h2.${category.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`
            );
            if (section) {
              section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              console.warn('Section not found for category:', category);
            }
          }, 200);
        }
      };

      const handleCategoryHover = (category) => {
        if (!isCategoryClicked) {
          setSelectedCategory(category === 'all' ? null : category);
        }
      };

      const handleMouseLeave = () => {
        if (!isCategoryClicked && selectedCategory !== null) {
          setSelectedCategory(null);
        }
      };

      const toggleCategories = () => {
        setShowAllCategories(!showAllCategories);
      };

      return (
        <div>
          {error && <p className="error-message" aria-live="assertive">{error}</p>}
          <div className="category-filter">
            {displayedCategories.map(category => (
              <button
                key={category === 'All' ? 'all' : category}
                className={`${selectedCategory === (category === 'All' ? null : category) ? 'active' : ''} ${
                  category === 'All' ? 'all-btn' : `${category.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}-btn`
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
          {categories.length > initialCategories.length && (
            <button className="show-more-btn" onClick={toggleCategories}>
              {showAllCategories ? 'Show Less' : 'Show More'}
            </button>
          )}
          {filteredTools.length > 0 ? (
            selectedCategory ? (
              <>
                <h2
                  className={`text-center mb-3 ${selectedCategory.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}
                  aria-live="polite"
                >
                  {selectedCategory}
                </h2>
                <div className="row row-cols-1 row-cols-md-2 g-3">
                  {filteredTools.map(tool => (
                    <div key={tool.id} className="col">
                      <ToolCard tool={tool} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              categories.map(category => (
                <div key={category}>
                  <h2
                    className={`text-center mb-3 ${category.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}
                    aria-live="polite"
                  >
                    {category}
                  </h2>
                  <div className="row row-cols-1 row-cols-md-2 g-3">
                    {tools.filter(tool => tool.category === category).map(tool => (
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
    };

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<ToolMap />);
    } // End of initializeReactApp function
