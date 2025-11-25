// Academy JavaScript - Main functionality

class AcademyApp {
    constructor() {
        this.currentUser = null;
        this.userProgress = null;
        this.allGuides = [];
        this.init();
    }

    init() {
        // Wait for DOM and Firebase
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    async setup() {
        // Wait for Firebase to be available
        await this.waitForFirebase();
        
        // Setup auth listener
        firebase.auth().onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                this.loadUserProgress(user.uid);
            } else {
                // Hide points button if not logged in
                const pointsBtn = document.getElementById('academy-points-btn');
                if (pointsBtn) pointsBtn.style.display = 'none';
            }
        });

        // Setup points display
        this.setupPointsDisplay();

        // Setup welcome modal
        this.setupWelcomeModal();

        // Determine which page we're on and load appropriate content
        const path = window.location.pathname;
        if (path.includes('/academy/category.html')) {
            this.loadCategoryPage();
        } else if (path.includes('/academy/guide.html')) {
            this.loadGuidePage();
        } else {
            this.loadMainPage();
        }
    }

    setupPointsDisplay() {
        const pointsBtn = document.getElementById('academy-points-btn');
        const pointsModal = document.getElementById('points-modal');
        const modalBackdrop = document.getElementById('points-modal-backdrop');
        const modalClose = document.getElementById('points-modal-close');

        if (!pointsBtn || !pointsModal) return;

        // Show/hide button based on login status
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                pointsBtn.style.display = 'flex';
                this.updatePointsButton();
            } else {
                pointsBtn.style.display = 'none';
            }
        });

        // Open modal
        pointsBtn.addEventListener('click', () => {
            this.updatePointsModal();
            pointsModal.style.display = 'block';
        });

        // Close modal
        const closeModal = () => {
            pointsModal.style.display = 'none';
        };

        if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
        if (modalClose) modalClose.addEventListener('click', closeModal);
    }

    setupWelcomeModal() {
        const welcomeModal = document.getElementById('welcome-modal');
        const welcomeModalBackdrop = document.getElementById('welcome-modal-backdrop');
        const welcomeModalClose = document.getElementById('welcome-modal-close');
        const welcomeModalBtn = document.getElementById('welcome-modal-btn');
        
        if (!welcomeModal) return;

        // Check if user has seen the welcome modal before
        const hasSeenWelcome = localStorage.getItem('academy-welcome-seen');
        const path = window.location.pathname;
        const isMainPage = !path.includes('/academy/category.html') && !path.includes('/academy/guide.html');

        // Show welcome modal only on main page and if not seen before
        if (isMainPage && !hasSeenWelcome) {
            welcomeModal.style.display = 'flex';
        }

        const closeWelcomeModal = () => {
            welcomeModal.style.display = 'none';
            localStorage.setItem('academy-welcome-seen', 'true');
        };

        if (welcomeModalBackdrop) welcomeModalBackdrop.addEventListener('click', closeWelcomeModal);
        if (welcomeModalClose) welcomeModalClose.addEventListener('click', closeWelcomeModal);
        if (welcomeModalBtn) welcomeModalBtn.addEventListener('click', closeWelcomeModal);
    }

    updatePointsButton() {
        const pointsBtn = document.getElementById('academy-points-btn');
        const pointsBtnText = document.getElementById('points-btn-text');
        
        if (!pointsBtn || !pointsBtnText) return;

        if (this.userProgress) {
            const points = this.userProgress.points || 0;
            pointsBtnText.textContent = points;
        } else {
            pointsBtnText.textContent = '0';
        }
    }

    updatePointsModal() {
        if (!this.userProgress) {
            this.userProgress = { points: 0, completedGuides: [], answers: {} };
        }

        const points = this.userProgress.points || 0;
        const completedGuides = this.userProgress.completedGuides || [];
        
        // Calculate correct answers
        let correctAnswers = 0;
        Object.values(this.userProgress.answers || {}).forEach(answer => {
            correctAnswers += answer.score || 0;
        });

        // Determine level
        let level = 'Beginner';
        let levelClass = 'beginner';
        let progressCurrent = points;
        let progressNext = 100;
        let progressPercent = (points / 100) * 100;

        if (points >= 201) {
            level = 'Expert';
            levelClass = 'advanced';
            progressCurrent = points - 200;
            progressNext = 100; // Next milestone at 300
            progressPercent = Math.min(((points - 200) / 100) * 100, 100);
        } else if (points >= 101) {
            level = 'Intermediate';
            levelClass = 'intermediate';
            progressCurrent = points - 100;
            progressNext = 100; // Next milestone at 200
            progressPercent = ((points - 100) / 100) * 100;
        } else {
            progressPercent = (points / 100) * 100;
        }

        // Update modal content
        const pointsValue = document.getElementById('points-value');
        const pointsLevel = document.getElementById('points-level');
        const progressFill = document.getElementById('progress-fill');
        const progressCurrentEl = document.getElementById('progress-current');
        const progressNextEl = document.getElementById('progress-next');
        const completedGuidesCount = document.getElementById('completed-guides-count');
        const correctAnswersCount = document.getElementById('correct-answers-count');

        if (pointsValue) pointsValue.textContent = points;
        if (pointsLevel) {
            pointsLevel.innerHTML = `<span class="level-badge ${levelClass}">${level}</span>`;
        }
        if (progressFill) progressFill.style.width = `${Math.min(progressPercent, 100)}%`;
        if (progressCurrentEl) progressCurrentEl.textContent = progressCurrent;
        if (progressNextEl) progressNextEl.textContent = progressNext;
        if (completedGuidesCount) completedGuidesCount.textContent = completedGuides.length;
        if (correctAnswersCount) correctAnswersCount.textContent = correctAnswers;
    }

    waitForFirebase() {
        return new Promise((resolve) => {
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                resolve();
                return;
            }
            const checkInterval = setInterval(() => {
                if (typeof firebase !== 'undefined' && firebase.firestore) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }

    async loadUserProgress(userId) {
        try {
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(userId)
                .get();
            
            if (userDoc.exists) {
                const data = userDoc.data();
                this.userProgress = {
                    points: data.academyPoints || 0,
                    completedGuides: data.completedGuides || [],
                    answers: data.academyAnswers || {}
                };
            } else {
                this.userProgress = {
                    points: 0,
                    completedGuides: [],
                    answers: {}
                };
            }
            
            // Update points button
            this.updatePointsButton();
        } catch (error) {
            // Error loading user progress
            this.userProgress = {
                points: 0,
                completedGuides: [],
                answers: {}
            };
        }
    }

    // Main Page - Load Categories
    async loadMainPage() {
        const grid = document.getElementById('categories-grid');
        if (!grid) return;

        try {
            // Load all categories and guides for search
            const [categoriesSnapshot, guidesSnapshot] = await Promise.all([
                firebase.firestore().collection('academy_categories').orderBy('title').get(),
                firebase.firestore().collection('academy_guides').get()
            ]);

            // Store all data for search
            this.allCategories = categoriesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            this.allGuides = guidesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Update SEO for main page
            this.updateMainPageSEO(this.allCategories, this.allGuides);

            // Render categories
            this.renderCategories(this.allCategories);
        } catch (error) {
            // Error loading categories
            grid.innerHTML = '<div class="loading-placeholder">Error loading categories. Please try again later.</div>';
        }
    }

    setupSearch() {
        const searchInput = document.getElementById('academy-search-input');
        const searchClear = document.getElementById('search-clear');
        const searchResultsInfo = document.getElementById('search-results-info');
        
        if (!searchInput) return;

        const path = window.location.pathname;
        const isCategoryPage = path.includes('/academy/category.html');

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            this.currentFilters.search = query;
            
            if (query.length === 0) {
                searchClear.style.display = 'none';
                if (searchResultsInfo) searchResultsInfo.style.display = 'none';
                
                if (isCategoryPage) {
                    // Reset to show all guides with current filters
                    this.currentFilters.search = '';
                    this.applyFilters();
                } else {
                    this.renderCategories(this.allCategories);
                }
                return;
            }

            searchClear.style.display = 'block';
            
            if (isCategoryPage) {
                // Search in guides for category page - combine with filters
                this.applyFilters();
                
                if (searchResultsInfo) {
                    const filtered = this.allGuidesOriginal.filter(guide => {
                        const titleMatch = guide.title.toLowerCase().includes(query);
                        const summaryMatch = guide.summary?.toLowerCase().includes(query);
                        const contentMatch = guide.content?.toLowerCase().includes(query);
                        return titleMatch || summaryMatch || contentMatch;
                    });
                    searchResultsInfo.style.display = 'block';
                    searchResultsInfo.textContent = `Found ${filtered.length} guide${filtered.length !== 1 ? 's' : ''} matching "${e.target.value}"`;
                }
            } else {
                // Search in categories and guides for main page
                const filteredCategories = this.allCategories.filter(cat => {
                    const titleMatch = cat.title.toLowerCase().includes(query);
                    const descMatch = cat.description?.toLowerCase().includes(query);
                    return titleMatch || descMatch;
                });

                // Also search guides and show matching categories
                const matchingGuideCategories = new Set();
                this.allGuides.forEach(guide => {
                    const titleMatch = guide.title.toLowerCase().includes(query);
                    const summaryMatch = guide.summary?.toLowerCase().includes(query);
                    if (titleMatch || summaryMatch) {
                        matchingGuideCategories.add(guide.category);
                    }
                });

                // Include categories that have matching guides
                const categoriesWithMatchingGuides = this.allCategories.filter(cat => 
                    matchingGuideCategories.has(cat.id)
                );

                // Combine and deduplicate
                const allMatchingCategories = [...new Map([
                    ...filteredCategories.map(c => [c.id, c]),
                    ...categoriesWithMatchingGuides.map(c => [c.id, c])
                ]).values()];

                this.renderCategories(allMatchingCategories);
                
                if (searchResultsInfo) {
                    searchResultsInfo.style.display = 'block';
                    searchResultsInfo.textContent = `Found ${allMatchingCategories.length} categor${allMatchingCategories.length !== 1 ? 'ies' : 'y'} matching "${e.target.value}"`;
                }
            }
        });

        if (searchClear) {
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                this.currentFilters.search = '';
                searchClear.style.display = 'none';
                if (searchResultsInfo) searchResultsInfo.style.display = 'none';
                
                if (isCategoryPage) {
                    this.applyFilters();
                } else {
                    this.renderCategories(this.allCategories);
                }
                searchInput.focus();
            });
        }
    }

    renderCategories(categories) {
        const grid = document.getElementById('categories-grid');
        if (!grid) return;

        if (categories.length === 0) {
            grid.innerHTML = '<div class="loading-placeholder">No categories found.</div>';
            return;
        }

        grid.innerHTML = categories.map(category => {
            return `
                <a href="/academy/category.html?category=${category.id}" class="category-card" role="listitem" aria-label="Browse ${this.escapeHTML(category.title)} guides">
                    <div class="icon" aria-hidden="true">
                        <i class="fas fa-${category.icon || 'book'}"></i>
                    </div>
                    <h3>${this.escapeHTML(category.title)}</h3>
                    <p>${this.escapeHTML(category.description || '')}</p>
                </a>
            `;
        }).join('');
    }

    // Category Page - Load Guides
    async loadCategoryPage() {
        const urlParams = new URLSearchParams(window.location.search);
        const categoryId = urlParams.get('category');

        if (!categoryId) {
            window.location.href = '/academy.html';
            return;
        }

        try {
            // Load category info
            const categoryDoc = await firebase.firestore()
                .collection('academy_categories')
                .doc(categoryId)
                .get();

            if (!categoryDoc.exists) {
                window.location.href = '/academy.html';
                return;
            }

            const category = { id: categoryDoc.id, ...categoryDoc.data() };
            document.getElementById('category-title').textContent = category.title;
            document.getElementById('category-description').textContent = category.description || '';

            // Load guides in this category
            const guidesSnapshot = await firebase.firestore()
                .collection('academy_guides')
                .where('category', '==', categoryId)
                .orderBy('title')
                .get();

            const guidesGrid = document.getElementById('guides-grid');
            if (guidesSnapshot.empty) {
                guidesGrid.innerHTML = '<div class="loading-placeholder">No guides available in this category yet.</div>';
                return;
            }

            // Store all guides
            this.allGuides = guidesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Store original guides for search (filtered by category)
            this.allGuidesOriginal = [...this.allGuides];

            // Update SEO for category page
            this.updateCategoryPageSEO(category, this.allGuides);

            // Current filters
            this.currentFilters = {
                level: 'all',
                topic: 'all',
                search: ''
            };

            // Setup search (must be before filters to initialize search input)
            this.setupSearch();

            // Setup filter buttons
            this.setupTopicFilters();
            this.setupLevelFilters();
            
            // Render guides
            this.renderGuides(this.allGuides);
        } catch (error) {
            // Error loading category
            document.getElementById('guides-grid').innerHTML = '<div class="loading-placeholder">Error loading guides. Please try again later.</div>';
        }
    }

    setupTopicFilters() {
        const topicFiltersContainer = document.getElementById('topic-filters');
        const topicFilterToggle = document.getElementById('topic-filter-toggle');
        const topicFiltersCollapsible = document.getElementById('topic-filters-collapsible');
        
        if (!topicFiltersContainer || !topicFilterToggle || !topicFiltersCollapsible) return;

        // Setup toggle button
        topicFilterToggle.addEventListener('click', () => {
            const isExpanded = topicFilterToggle.getAttribute('aria-expanded') === 'true';
            topicFilterToggle.setAttribute('aria-expanded', !isExpanded);
            topicFiltersCollapsible.style.display = isExpanded ? 'none' : 'block';
        });

        // Get unique guide titles (topics)
        const topics = [...new Set(this.allGuides.map(guide => guide.title))].sort();
        
        // Create topic filter buttons
        const topicButtons = topics.map(topic => {
            return `<button class="filter-btn" data-filter-type="topic" data-value="${this.escapeHTML(topic)}">${this.escapeHTML(topic)}</button>`;
        }).join('');

        // Insert topic buttons after "All Topics" button
        const allTopicsBtn = topicFiltersContainer.querySelector('[data-value="all"]');
        if (allTopicsBtn) {
            // Remove any existing topic buttons (except "All Topics")
            const existingTopicBtns = topicFiltersContainer.querySelectorAll('[data-filter-type="topic"]:not([data-value="all"])');
            existingTopicBtns.forEach(btn => btn.remove());
            
            // Insert new topic buttons
            allTopicsBtn.insertAdjacentHTML('afterend', topicButtons);
        } else {
            topicFiltersContainer.insertAdjacentHTML('beforeend', topicButtons);
        }

        // Setup click handlers for topic filters
        const topicFilterButtons = topicFiltersContainer.querySelectorAll('[data-filter-type="topic"]');
        topicFilterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state for topic filters
                topicFilterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update filter
                this.currentFilters.topic = btn.dataset.value;
                this.applyFilters();
                
                // Optionally close the collapsible after selection
                // topicFilterToggle.setAttribute('aria-expanded', 'false');
                // topicFiltersCollapsible.style.display = 'none';
            });
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!topicFilterToggle.contains(e.target) && !topicFiltersCollapsible.contains(e.target)) {
                topicFilterToggle.setAttribute('aria-expanded', 'false');
                topicFiltersCollapsible.style.display = 'none';
            }
        });
    }

    setupLevelFilters() {
        const levelSelect = document.getElementById('level-select');
        if (!levelSelect) return;

        levelSelect.addEventListener('change', (e) => {
            this.currentFilters.level = e.target.value;
            this.applyFilters();
        });
    }

    applyFilters() {
        let filtered = [...this.allGuidesOriginal];

        // Filter by search query
        if (this.currentFilters.search) {
            const query = this.currentFilters.search.toLowerCase();
            filtered = filtered.filter(guide => {
                const titleMatch = guide.title.toLowerCase().includes(query);
                const summaryMatch = guide.summary?.toLowerCase().includes(query);
                const contentMatch = guide.content?.toLowerCase().includes(query);
                return titleMatch || summaryMatch || contentMatch;
            });
        }

        // Filter by level
        if (this.currentFilters.level !== 'all') {
            filtered = filtered.filter(guide => guide.level === this.currentFilters.level);
        }

        // Filter by topic
        if (this.currentFilters.topic !== 'all') {
            filtered = filtered.filter(guide => guide.title === this.currentFilters.topic);
        }

        // Render filtered guides
        this.renderGuides(filtered);
    }

    renderGuides(guides) {
        const guidesGrid = document.getElementById('guides-grid');
        
        if (guides.length === 0) {
            guidesGrid.innerHTML = '<div class="loading-placeholder">No guides found for the selected filter.</div>';
            return;
        }

        guidesGrid.innerHTML = guides.map(guide => {
            const levelClass = guide.level ? guide.level.toLowerCase() : 'beginner';
            return `
                <a href="/academy/guide.html?guide=${guide.id}" class="guide-card" role="listitem" aria-label="Read ${this.escapeHTML(guide.title)} guide">
                    <div class="guide-card-header">
                        <h3>${this.escapeHTML(guide.title)}</h3>
                        <span class="level-badge ${levelClass}" aria-label="Difficulty: ${guide.level || 'Beginner'}">${guide.level || 'Beginner'}</span>
                    </div>
                </a>
            `;
        }).join('');
    }

    // Guide Page - Load Guide Content
    async loadGuidePage() {
        const urlParams = new URLSearchParams(window.location.search);
        const guideId = urlParams.get('guide');

        if (!guideId) {
            window.location.href = '/academy.html';
            return;
        }

        try {
            // Load guide
            const guideDoc = await firebase.firestore()
                .collection('academy_guides')
                .doc(guideId)
                .get();

            if (!guideDoc.exists) {
                window.location.href = '/academy.html';
                return;
            }

            const guide = { id: guideDoc.id, ...guideDoc.data() };

            // Load category for back link
            const categoryDoc = await firebase.firestore()
                .collection('academy_categories')
                .doc(guide.category)
                .get();

            const category = categoryDoc.exists ? { id: categoryDoc.id, ...categoryDoc.data() } : null;

            // Update SEO for guide page
            this.updateGuidePageSEO(guide, category);

            // Update page content
            document.getElementById('guide-title').textContent = guide.title;
            
            // Store category for use in questions section
            this.currentGuideCategory = category;
            this.currentGuideCategoryId = guide.category;

            // What You'll Learn
            const learnList = document.getElementById('what-you-learn-list');
            if (guide.whatYouLearn && guide.whatYouLearn.length > 0) {
                learnList.innerHTML = guide.whatYouLearn.map(item => 
                    `<li>${this.escapeHTML(item)}</li>`
                ).join('');
            } else {
                document.getElementById('what-you-learn-section').style.display = 'none';
            }

            // Main content
            document.getElementById('guide-body').innerHTML = guide.content || '';

            // Summary
            if (guide.summary) {
                document.getElementById('guide-summary-text').textContent = guide.summary;
            } else {
                document.getElementById('guide-summary-section').style.display = 'none';
            }

            // Questions
            this.setupQuestions(guide);

        } catch (error) {
            // Error loading guide
            document.getElementById('guide-body').innerHTML = '<div class="loading-placeholder">Error loading guide. Please try again later.</div>';
        }
    }

    setupQuestions(guide) {
        const questionsContainer = document.getElementById('questions-container');
        const loginPrompt = document.getElementById('login-prompt');
        const questionsResults = document.getElementById('questions-results');

        if (!guide.questions || guide.questions.length === 0) {
            document.getElementById('questions-section').style.display = 'none';
            return;
        }

        // Check if user is logged in
        if (!this.currentUser) {
            loginPrompt.style.display = 'block';
            questionsContainer.style.display = 'none';
            return;
        }

        loginPrompt.style.display = 'none';
        questionsContainer.style.display = 'block';

        // Check if already completed
        const isCompleted = this.userProgress && this.userProgress.completedGuides.includes(guide.id);
        
        if (isCompleted) {
            // Show results
            const answers = this.userProgress.answers[guide.id];
            this.showQuestionResults(guide, answers);
            return;
        }

        // Render questions
        questionsContainer.innerHTML = guide.questions.map((q, qIndex) => `
            <div class="question-block" data-question-index="${qIndex}">
                <h3>Question ${qIndex + 1}: ${this.escapeHTML(q.q)}</h3>
                <div class="question-options">
                    ${q.answers.map((answer, aIndex) => `
                        <div class="question-option">
                            <input type="radio" name="question-${qIndex}" id="q${qIndex}-a${aIndex}" value="${aIndex}" required>
                            <label for="q${qIndex}-a${aIndex}">${this.escapeHTML(answer)}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // Add buttons container
        const questionsActions = document.getElementById('questions-actions');
        questionsActions.style.display = 'flex';
        questionsActions.innerHTML = '';
        
        // Add submit button
        const submitBtn = document.createElement('button');
        submitBtn.className = 'submit-questions-btn';
        submitBtn.textContent = 'Submit Answers';
        submitBtn.addEventListener('click', () => this.submitAnswers(guide));
        questionsActions.appendChild(submitBtn);
        
        // Add back to category button
        if (this.currentGuideCategoryId) {
            const backBtn = document.createElement('a');
            backBtn.className = 'back-to-category-btn';
            backBtn.href = `/academy/category.html?category=${this.currentGuideCategoryId}`;
            backBtn.innerHTML = '<i class="fas fa-arrow-left" aria-hidden="true"></i> Back to Category';
            questionsActions.appendChild(backBtn);
        }
    }

    async submitAnswers(guide) {
        const questions = guide.questions;
        const userAnswers = [];
        let correctCount = 0;

        // Collect answers
        questions.forEach((q, qIndex) => {
            const selected = document.querySelector(`input[name="question-${qIndex}"]:checked`);
            if (!selected) {
                alert('Please answer all questions');
                return;
            }
            const answerIndex = parseInt(selected.value);
            userAnswers.push(answerIndex);
            if (answerIndex === q.correctIndex) {
                correctCount++;
            }
        });

        if (userAnswers.length !== questions.length) {
            return; // Not all answered
        }

        // Calculate points based on guide level
        // Only award points if answered BOTH questions correctly
        let pointsPerAnswer = 5; // Default
        if (guide.level === 'Beginner') {
            pointsPerAnswer = 5; // 10 points total for beginner guide (2 questions × 5)
        } else if (guide.level === 'Intermediate') {
            pointsPerAnswer = 10; // 20 points total for intermediate guide (2 questions × 10)
        } else if (guide.level === 'Advanced') {
            pointsPerAnswer = 15; // 30 points total for advanced guide (2 questions × 15)
        }
        
        // Only award points if answered BOTH questions correctly (all 2 questions)
        const pointsEarned = (correctCount === questions.length && questions.length === 2) ? correctCount * pointsPerAnswer : 0;

        try {
            // Update user progress in Firestore
            const userRef = firebase.firestore().collection('users').doc(this.currentUser.uid);
            const userDoc = await userRef.get();
            
            const currentPoints = userDoc.exists ? (userDoc.data().academyPoints || 0) : 0;
            const currentCompleted = userDoc.exists ? (userDoc.data().completedGuides || []) : [];
            const currentAnswers = userDoc.exists ? (userDoc.data().academyAnswers || {}) : {};

            // Update data
            const updatedCompleted = [...currentCompleted];
            if (!updatedCompleted.includes(guide.id)) {
                updatedCompleted.push(guide.id);
            }

            const updatedAnswers = {
                ...currentAnswers,
                [guide.id]: {
                    answers: userAnswers,
                    score: correctCount,
                    totalQuestions: questions.length,
                    pointsEarned: pointsEarned,
                    completedAt: firebase.firestore.FieldValue.serverTimestamp()
                }
            };

            await userRef.set({
                academyPoints: currentPoints + pointsEarned,
                completedGuides: updatedCompleted,
                academyAnswers: updatedAnswers
            }, { merge: true });

            // Update local progress
            this.userProgress = {
                points: currentPoints + pointsEarned,
                completedGuides: updatedCompleted,
                answers: updatedAnswers
            };

            // Update points button
            this.updatePointsButton();

            // Show results
            this.showQuestionResults(guide, updatedAnswers[guide.id], userAnswers);

        } catch (error) {
            // Error submitting answers
            alert('Error submitting answers. Please try again.');
        }
    }

    showQuestionResults(guide, savedAnswers, userAnswers = null) {
        const questionsContainer = document.getElementById('questions-container');
        const questionsResults = document.getElementById('questions-results');
        
        questionsContainer.style.display = 'none';
        questionsResults.style.display = 'block';

        const answers = userAnswers || savedAnswers.answers;
        const score = savedAnswers.score || answers.reduce((count, ans, idx) => 
            count + (ans === guide.questions[idx].correctIndex ? 1 : 0), 0
        );
        // Use saved pointsEarned if available, otherwise calculate
        let pointsEarned = savedAnswers.pointsEarned;
        if (pointsEarned === undefined) {
            // Calculate points based on guide level
            let pointsPerAnswer = 5;
            if (guide.level === 'Beginner') {
                pointsPerAnswer = 5;
            } else if (guide.level === 'Intermediate') {
                pointsPerAnswer = 10;
            } else if (guide.level === 'Advanced') {
                pointsPerAnswer = 15;
            }
            // Only award points if answered BOTH questions correctly
            pointsEarned = (score === guide.questions.length && guide.questions.length === 2) ? score * pointsPerAnswer : 0;
        }

        questionsResults.className = 'questions-results ' + (score === guide.questions.length ? 'success' : '');
        questionsResults.innerHTML = `
            <h3>Your Results</h3>
            <p>You got ${score} out of ${guide.questions.length} questions correct.</p>
            ${pointsEarned > 0 ? `<p class="points-earned">+${pointsEarned} points earned!</p>` : ''}
            <p>Total Academy Points: ${this.userProgress ? this.userProgress.points : 0}</p>
        `;

        // Show correct/incorrect answers
        questionsContainer.innerHTML = guide.questions.map((q, qIndex) => {
            const userAnswer = answers[qIndex];
            const isCorrect = userAnswer === q.correctIndex;
            return `
                <div class="question-block">
                    <h3>Question ${qIndex + 1}: ${this.escapeHTML(q.q)}</h3>
                    <div class="question-options">
                        ${q.answers.map((answer, aIndex) => {
                            let className = 'question-option';
                            if (aIndex === q.correctIndex) {
                                className += ' correct';
                            } else if (aIndex === userAnswer && !isCorrect) {
                                className += ' incorrect';
                            }
                            return `
                                <div class="${className}">
                                    <input type="radio" disabled ${aIndex === userAnswer ? 'checked' : ''}>
                                    <label>${this.escapeHTML(answer)}</label>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    // SEO Functions
    updateMainPageSEO(categories, guides) {
        const title = 'Specifys Academy - Learn How Modern Apps Work';
        const description = `Explore ${categories.length} learning categories with ${guides.length} comprehensive guides on app development, security, APIs, databases, and more. Learn without writing code.`;
        const keywords = 'app development, learn programming, web development guides, API tutorials, database tutorials, security tutorials, app architecture, beginner programming, coding education, tech tutorials';

        this.updateMetaTags(title, description, keywords);
        this.addBreadcrumbs([
            { name: 'Home', url: '/' },
            { name: 'Academy', url: '/academy.html' }
        ]);
        this.addMainPageStructuredData(categories, guides);
    }

    updateCategoryPageSEO(category, guides) {
        const title = `${category.title} - Specifys Academy`;
        const description = category.description || `Explore ${guides.length} guides about ${category.title.toLowerCase()}. Learn app development concepts without writing code.`;
        const keywords = `${category.title.toLowerCase()}, app development, programming guides, ${category.title.toLowerCase()} tutorials, learn ${category.title.toLowerCase()}, tech education`;

        this.updateMetaTags(title, description, keywords);
        this.addBreadcrumbs([
            { name: 'Home', url: '/' },
            { name: 'Academy', url: '/academy.html' },
            { name: category.title, url: `/academy/category.html?category=${category.id}` }
        ]);
        this.addCategoryPageStructuredData(category, guides);
    }

    updateGuidePageSEO(guide, category) {
        const title = `${guide.title} - ${guide.level || 'Beginner'} Guide | Specifys Academy`;
        const description = guide.summary || guide.description || `Learn about ${guide.title.toLowerCase()}. ${guide.level || 'Beginner'} level guide covering essential concepts.`;
        const keywords = `${guide.title.toLowerCase()}, ${guide.level || 'Beginner'} guide, app development, programming tutorial, ${category ? category.title.toLowerCase() : ''}, learn coding`;

        this.updateMetaTags(title, description, keywords);
        
        const breadcrumbs = [
            { name: 'Home', url: '/' },
            { name: 'Academy', url: '/academy.html' }
        ];
        if (category) {
            breadcrumbs.push({ name: category.title, url: `/academy/category.html?category=${category.id}` });
        }
        breadcrumbs.push({ name: guide.title, url: `/academy/guide.html?guide=${guide.id}` });
        this.addBreadcrumbs(breadcrumbs);
        
        this.addGuidePageStructuredData(guide, category);
    }

    updateMetaTags(title, description, keywords) {
        // Update title
        document.title = `${title} - Specifys.ai`;

        // Update or create meta description
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', description);

        // Update or create meta keywords
        let metaKeywords = document.querySelector('meta[name="keywords"]');
        if (!metaKeywords) {
            metaKeywords = document.createElement('meta');
            metaKeywords.setAttribute('name', 'keywords');
            document.head.appendChild(metaKeywords);
        }
        metaKeywords.setAttribute('content', keywords);

        // Update Open Graph tags
        this.updateOGTags(title, description);

        // Update canonical URL
        const canonicalUrl = window.location.href.split('?')[0]; // Remove query params for canonical
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', canonicalUrl);
    }

    updateOGTags(title, description) {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDesc = document.querySelector('meta[property="og:description"]');
        const ogUrl = document.querySelector('meta[property="og:url"]');
        const ogImage = document.querySelector('meta[property="og:image"]');

        if (ogTitle) ogTitle.setAttribute('content', title);
        if (ogDesc) ogDesc.setAttribute('content', description);
        if (ogUrl) ogUrl.setAttribute('content', window.location.href);
        if (ogImage) ogImage.setAttribute('content', 'https://specifys-ai.com/assets/images/og-image.png');

        // Twitter Card
        const twitterTitle = document.querySelector('meta[name="twitter:title"]');
        const twitterDesc = document.querySelector('meta[name="twitter:description"]');
        if (twitterTitle) twitterTitle.setAttribute('content', title);
        if (twitterDesc) twitterDesc.setAttribute('content', description);
    }

    addBreadcrumbs(items) {
        // Remove existing breadcrumbs
        const existingBreadcrumbs = document.querySelector('.academy-breadcrumbs');
        if (existingBreadcrumbs) {
            existingBreadcrumbs.remove();
        }

        // Remove existing breadcrumb structured data
        const existingBreadcrumbScript = document.querySelector('script[data-breadcrumb-seo]');
        if (existingBreadcrumbScript) {
            existingBreadcrumbScript.remove();
        }

        if (items.length === 0) return;

        // Create breadcrumb HTML
        const breadcrumbHTML = `
            <nav class="academy-breadcrumbs" aria-label="Breadcrumb">
                <ol itemscope itemtype="https://schema.org/BreadcrumbList">
                    ${items.map((item, index) => `
                        <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
                            <a itemprop="item" href="${item.url}">
                                <span itemprop="name">${this.escapeHTML(item.name)}</span>
                            </a>
                            <meta itemprop="position" content="${index + 1}" />
                        </li>
                    `).join('')}
                </ol>
            </nav>
        `;

        // Insert breadcrumbs at the beginning of academy-page
        const academyPage = document.querySelector('.academy-page');
        if (academyPage) {
            academyPage.insertAdjacentHTML('afterbegin', breadcrumbHTML);
        }

        // Add structured data
        const breadcrumbData = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": items.map((item, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "name": item.name,
                "item": `https://specifys-ai.com${item.url}`
            }))
        };

        const script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        script.setAttribute('data-breadcrumb-seo', 'true');
        script.textContent = JSON.stringify(breadcrumbData);
        document.head.appendChild(script);
    }

    addMainPageStructuredData(categories, guides) {
        // Remove existing academy structured data
        const existingScript = document.querySelector('script[data-academy-seo]');
        if (existingScript) {
            existingScript.remove();
        }

        const structuredData = {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Specifys Academy",
            "description": `Learn how modern apps work without writing code. Explore ${categories.length} categories with ${guides.length} comprehensive guides.`,
            "url": "https://specifys-ai.com/academy.html",
            "mainEntity": {
                "@type": "ItemList",
                "numberOfItems": categories.length,
                "itemListElement": categories.slice(0, 10).map((cat, index) => ({
                    "@type": "ListItem",
                    "position": index + 1,
                    "name": cat.title,
                    "url": `https://specifys-ai.com/academy/category.html?category=${cat.id}`
                }))
            },
            "about": {
                "@type": "EducationalOrganization",
                "name": "Specifys Academy",
                "description": "Free educational platform for learning app development concepts"
            }
        };

        const script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        script.setAttribute('data-academy-seo', 'true');
        script.textContent = JSON.stringify(structuredData);
        document.head.appendChild(script);
    }

    addCategoryPageStructuredData(category, guides) {
        // Remove existing academy structured data
        const existingScript = document.querySelector('script[data-academy-seo]');
        if (existingScript) {
            existingScript.remove();
        }

        const structuredData = {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": category.title,
            "description": category.description || `Explore ${guides.length} guides about ${category.title.toLowerCase()}.`,
            "url": `https://specifys-ai.com/academy/category.html?category=${category.id}`,
            "mainEntity": {
                "@type": "ItemList",
                "numberOfItems": guides.length,
                "itemListElement": guides.slice(0, 20).map((guide, index) => ({
                    "@type": "ListItem",
                    "position": index + 1,
                    "name": guide.title,
                    "url": `https://specifys-ai.com/academy/guide.html?guide=${guide.id}`,
                    "description": guide.summary || guide.description || ""
                }))
            },
            "about": {
                "@type": "Thing",
                "name": category.title,
                "description": category.description
            }
        };

        const script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        script.setAttribute('data-academy-seo', 'true');
        script.textContent = JSON.stringify(structuredData);
        document.head.appendChild(script);
    }

    addGuidePageStructuredData(guide, category) {
        // Remove existing academy structured data
        const existingScript = document.querySelector('script[data-academy-seo]');
        if (existingScript) {
            existingScript.remove();
        }

        const structuredData = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": guide.title,
            "description": guide.summary || guide.description || `Learn about ${guide.title.toLowerCase()}.`,
            "url": `https://specifys-ai.com/academy/guide.html?guide=${guide.id}`,
            "author": {
                "@type": "Organization",
                "name": "Specifys.ai",
                "url": "https://specifys-ai.com"
            },
            "publisher": {
                "@type": "Organization",
                "name": "Specifys.ai",
                "logo": {
                    "@type": "ImageObject",
                    "url": "https://specifys-ai.com/favicon.ico"
                }
            },
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": `https://specifys-ai.com/academy/guide.html?guide=${guide.id}`
            },
            "educationalLevel": guide.level || "Beginner",
            "learningResourceType": "Tutorial",
            "about": category ? {
                "@type": "Thing",
                "name": category.title
            } : undefined
        };

        // Add whatYouLearn as keywords
        if (guide.whatYouLearn && guide.whatYouLearn.length > 0) {
            structuredData.keywords = guide.whatYouLearn.join(', ');
        }

        // Remove undefined fields
        Object.keys(structuredData).forEach(key => {
            if (structuredData[key] === undefined) {
                delete structuredData[key];
            }
        });

        const script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        script.setAttribute('data-academy-seo', 'true');
        script.textContent = JSON.stringify(structuredData);
        document.head.appendChild(script);
    }

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize Academy App
new AcademyApp();

