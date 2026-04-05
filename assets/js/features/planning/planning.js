/**
 * Planning Page JavaScript - Architect Pro Tool
 * Handles all interactive functionality for the planning page
 */

const helpTexts = {
    pages: "Outline every screen in your app. Think about what the user sees first and where they go next.",
    workflow: "Create step-by-step logic. 'If the user clicks X, then Y happens.'",
    design: "Choose the visual DNA of your app. This affects fonts, spacing, and brand feel.",
    integrations: "Connect your app to external worlds like payments, maps, or AI.",
    features: "Select specific functional tools your app needs to work.",
    audience: "Define who will use this and on which devices.",
    screenshot: "Upload UI screenshots as references. AI turns them into detailed English spec text you can edit."
};

const sectionDescriptions = {
    pages: "Outline every screen in your app. Think about what the user sees first and where they go next.",
    workflow: "Create step-by-step logic. Define user journeys and flows that guide users through your app.",
    design: "Choose the visual DNA of your app. This affects fonts, spacing, colors, and overall brand feel.",
    integrations: "Connect your app to external services like payments, maps, AI, and other third-party tools.",
    features: "Select specific functional tools and capabilities your app needs to work effectively.",
    audience: "Define who will use this app and on which devices they'll access it.",
    screenshot: "Upload reference screenshots of UIs you want to emulate. Add a short instruction, run analysis, edit the result, and confirm. Each confirmed item is merged into your specification."
};

const designStyles = [
    { name: "Minimal", class: "design-minimal", description: "Clean, simple design with minimal elements and maximum focus on content." },
    { name: "SaaS Soft", class: "design-saas", description: "Modern, friendly interface with rounded corners and soft colors for SaaS applications." },
    { name: "Cyberpunk", class: "design-cyberpunk", description: "Bold, futuristic aesthetic with neon colors and high-tech visual elements." },
    { name: "Corporate", class: "design-corporate", description: "Professional, trustworthy design suitable for business and enterprise applications." },
    { name: "Toy/Playful", class: "design-playful", description: "Fun, energetic design with bold colors and playful elements for engaging user experience." },
    { name: "Glassmorphic", class: "design-glass", description: "Modern glass-like effect with transparency and blur for a sleek, contemporary look." },
    { name: "Neo-Brutalist", class: "design-brutalist", description: "Bold, raw design with sharp edges and strong shadows for a distinctive visual style." },
    { name: "Elegant", class: "design-elegant", description: "Sophisticated, refined design with subtle details and classic typography." }
];

const integrations = {
    popular: ["Stripe Payments", "Google Maps", "OpenAI / AI Chat", "Search Bar"],
    backend: ["Firebase Database", "AWS S3 Storage", "Auth0 Login", "Supabase"],
    growth: ["Slack Notifications", "Mailchimp Email", "Meta Pixel", "Google Analytics"]
};

const commonFeatures = [
    "User Authentication",
    "User Profiles",
    "Search Functionality",
    "Notifications",
    "File Upload",
    "Real-time Chat",
    "Payment Processing",
    "Analytics Dashboard",
    "Admin Panel",
    "Email Notifications",
    "Social Login",
    "Two-Factor Authentication",
    "Data Export",
    "Dark Mode",
    "Multi-language Support"
];

const predefinedPages = [
    { name: "Login", description: "User authentication and sign-in page" },
    { name: "Sign Up", description: "New user registration page" },
    { name: "Dashboard", description: "Main user dashboard with overview and navigation" },
    { name: "Profile", description: "User profile management and settings" },
    { name: "About", description: "Information about the app or company" },
    { name: "Contact", description: "Contact form and information page" },
    { name: "Settings", description: "Application settings and preferences" },
    { name: "Home", description: "Landing page or homepage" },
    { name: "Search", description: "Search functionality and results page" },
    { name: "Help", description: "Help center and FAQ page" }
];

/**
 * Show initial navigation when user types in the pitch textarea or focuses on it
 */
window.showInitialNav = function() {
    const pitch = document.getElementById('main-pitch');
    const footer = document.getElementById('export-area');
    const homeNav = document.getElementById('home-nav');
    
    // Show navigation buttons when user starts typing OR when textarea is focused
    // Once shown, keep them visible if there's text (even if textarea loses focus)
    const hasText = pitch && pitch.value.length > 0;
    const isFocused = pitch && document.activeElement === pitch;
    
    // Keep buttons visible if there's text, even after clicking buttons
    const shouldShow = hasText || isFocused;
    
    if (shouldShow) {
        if (homeNav && homeNav.classList.contains('hidden')) {
            // Remove hidden class first
            homeNav.classList.remove('hidden');
            // Force reflow to ensure the element is visible before animation
            void homeNav.offsetHeight;
            // Add fade-in class for animation
            homeNav.classList.add('fade-in');
        }
        if (footer) {
            footer.classList.remove('hidden');
        }
    } else {
        // Only hide if there's no text AND textarea is not focused
        // Don't hide if user just clicked a button (check if section panel is visible)
        const sectionPanel = document.getElementById('section-panel');
        const isSectionOpen = sectionPanel && !sectionPanel.classList.contains('hidden-el');
        
        if (!isSectionOpen && homeNav && !homeNav.classList.contains('hidden')) {
            // Remove fade-in class first
            homeNav.classList.remove('fade-in');
            // Wait for animation to complete before hiding
            setTimeout(() => {
                if (homeNav && !homeNav.classList.contains('fade-in')) {
                    homeNav.classList.add('hidden');
                }
            }, 400);
        }
        if (!isSectionOpen && footer) {
            footer.classList.add('hidden');
        }
    }
};

/**
 * Open a specific section panel
 */
window.openSection = function(id) {
    const sectionPanel = document.getElementById('section-panel');
    const secTitle = document.getElementById('sec-title');
    const secDescription = document.getElementById('sec-description');
    const secHelp = document.getElementById('sec-help');
    
    if (!sectionPanel || !secTitle) return;
    
    // Prevent scroll jump - store current scroll position
    const scrollY = window.scrollY;
    
    // Show section panel without animation
    sectionPanel.classList.remove('hidden-el');
    secTitle.innerText = id.charAt(0).toUpperCase() + id.slice(1);
    
    if (secDescription && sectionDescriptions[id]) {
        secDescription.innerText = sectionDescriptions[id];
    }
    
    if (secHelp && helpTexts[id]) {
        secHelp.innerText = helpTexts[id];
    }
    
    // Hide all sub-views
    const allViews = sectionPanel.querySelectorAll('.section-view');
    allViews.forEach(v => v.classList.add('hidden-el'));
    
    // Show specific view
    if (id === 'design') {
        renderDesign();
        const designView = document.getElementById('view-design');
        if (designView) designView.classList.remove('hidden-el');
    } else if (id === 'integrations') {
        renderIntegrations();
        const integrationsView = document.getElementById('view-integrations');
        if (integrationsView) integrationsView.classList.remove('hidden-el');
    } else if (id === 'pages') {
        renderPredefinedPages();
        // Add default Homepage if no pages exist (excluding add-page-card)
        const pagesList = document.getElementById('pages-list');
        if (pagesList) {
            const existingPages = pagesList.querySelectorAll('.page-card:not(.add-page-card)');
            if (existingPages.length === 0) {
                addPage("Homepage", "Main landing page or homepage of the application");
            }
        }
        const pagesView = document.getElementById('view-pages');
        if (pagesView) pagesView.classList.remove('hidden-el');
    } else if (id === 'workflow') {
        const workflowView = document.getElementById('view-workflow');
        if (workflowView) workflowView.classList.remove('hidden-el');
    } else if (id === 'features') {
        renderFeatures();
        const featuresView = document.getElementById('view-features');
        if (featuresView) featuresView.classList.remove('hidden-el');
    } else if (id === 'audience') {
        renderAudience();
        const audienceView = document.getElementById('view-audience');
        if (audienceView) audienceView.classList.remove('hidden-el');
    } else if (id === 'screenshot') {
        const screenshotView = document.getElementById('view-screenshot');
        if (screenshotView) screenshotView.classList.remove('hidden-el');
        updateScreenshotLimitUI();
    } else {
        const genericView = document.getElementById('view-generic');
        if (genericView) genericView.classList.remove('hidden-el');
    }
    
    // Ensure navigation buttons stay visible when section is open
    const pitch = document.getElementById('main-pitch');
    const homeNav = document.getElementById('home-nav');
    if (pitch && homeNav) {
        // Keep buttons visible if there's text OR if section is now open
        if (pitch.value.length > 0 || !sectionPanel.classList.contains('hidden-el')) {
            homeNav.classList.remove('hidden');
            if (!homeNav.classList.contains('fade-in')) {
                homeNav.classList.add('fade-in');
            }
        }
    }
    
    // Restore scroll position to prevent jump
    window.scrollTo(0, scrollY);
};

/**
 * Close the section panel and return to menu
 * Note: Navigation buttons remain visible at all times
 */
window.closeSection = function() {
    const sectionPanel = document.getElementById('section-panel');
    const homeNav = document.getElementById('home-nav');
    
    if (sectionPanel) sectionPanel.classList.add('hidden-el');
    // Keep navigation buttons visible
    if (homeNav) {
        homeNav.classList.remove('hidden');
    }
};

/**
 * Render design style cards
 */
function renderDesign() {
    const grid = document.getElementById('design-grid');
    if (!grid || grid.children.length > 0) return;
    
    designStyles.forEach(style => {
        const div = document.createElement('div');
        div.className = "design-card";
        div.onclick = function() { 
            document.querySelectorAll('.design-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            updateSectionIndicator('design');
        };
        
        const button = document.createElement('button');
        button.className = `design-preview-btn ${style.class}`;
        button.textContent = "Button";
        button.disabled = true;
        
        const name = document.createElement('p');
        name.className = "design-name";
        name.textContent = style.name;
        
        const description = document.createElement('p');
        description.className = "design-description";
        description.textContent = style.description;
        
        const checkIcon = document.createElement('span');
        checkIcon.className = "selected-check-icon";
        const iconElement = document.createElement('i');
        iconElement.className = "fa fa-check";
        checkIcon.appendChild(iconElement);
        
        div.appendChild(button);
        div.appendChild(name);
        div.appendChild(description);
        div.appendChild(checkIcon);
        grid.appendChild(div);
    });
}

/**
 * Render integration buttons
 */
function renderIntegrations() {
    for (const cat in integrations) {
        const container = document.getElementById('int-' + cat);
        if (!container || container.children.length > 0) continue;
        
        integrations[cat].forEach(item => {
            const btn = document.createElement('button');
            btn.className = "integration-btn";
            
            const textSpan = document.createElement('span');
            textSpan.textContent = item;
            
            const checkIcon = document.createElement('span');
            checkIcon.className = "integration-check-icon";
            const iconElement = document.createElement('i');
            iconElement.className = "fa fa-check";
            checkIcon.appendChild(iconElement);
            
            btn.appendChild(textSpan);
            btn.appendChild(checkIcon);
            
            btn.onclick = function() {
                this.classList.toggle('selected');
                updateSectionIndicator('integrations');
            };
            container.appendChild(btn);
        });
    }
}

/**
 * Render features
 */
function renderFeatures() {
    const grid = document.getElementById('features-grid');
    if (!grid || grid.children.length > 0) return;
    
    commonFeatures.forEach(feature => {
        const btn = document.createElement('button');
        btn.className = "feature-btn";
        const textSpan = document.createElement('span');
        textSpan.textContent = feature;
        
        const checkIcon = document.createElement('span');
        checkIcon.className = "selected-check-icon";
        const iconElement = document.createElement('i');
        iconElement.className = "fa fa-check";
        checkIcon.appendChild(iconElement);
        
        btn.appendChild(textSpan);
        btn.appendChild(checkIcon);
        btn.onclick = function() {
            this.classList.toggle('selected');
            updateSectionIndicator('features');
        };
        grid.appendChild(btn);
    });
}

/**
 * Audience data
 */
const interestCategories = [
    "Technology", "Business", "Health & Fitness", "Education", "Entertainment",
    "Travel", "Food & Cooking", "Sports", "Music", "Art & Design",
    "Fashion", "Finance", "Gaming", "Photography", "Social Media",
    "News & Politics", "Science", "Environment", "Pets", "Parenting"
];

/**
 * Render audience section
 */
function renderAudience() {
    const interestsGrid = document.getElementById('interests-grid');
    if (!interestsGrid || interestsGrid.children.length > 0) return;
    
    interestCategories.forEach(interest => {
        const btn = document.createElement('button');
        btn.className = "interest-btn";
        const textSpan = document.createElement('span');
        textSpan.textContent = interest;
        
        const checkIcon = document.createElement('span');
        checkIcon.className = "selected-check-icon";
        const iconElement = document.createElement('i');
        iconElement.className = "fa fa-check";
        checkIcon.appendChild(iconElement);
        
        btn.appendChild(textSpan);
        btn.appendChild(checkIcon);
        btn.onclick = function() {
            this.classList.toggle('selected');
            updateSectionIndicator('audience');
        };
        interestsGrid.appendChild(btn);
    });
}

/**
 * Select platform
 */
window.selectPlatform = function(platform) {
    document.querySelectorAll('.platform-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    const selectedBtn = document.querySelector(`.platform-btn[data-platform="${platform}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('selected');
    }
    updateSectionIndicator('audience');
}


/**
 * Update age display and slider
 */
window.updateAgeDisplay = function(rangeNum) {
    updateAgeRange(rangeNum);
}

window.updateAgeRange = function(rangeNum) {
    const minSlider = document.getElementById(`age-range-${rangeNum}-min`);
    const maxSlider = document.getElementById(`age-range-${rangeNum}-max`);
    const display = document.getElementById(`age-display-${rangeNum}`);
    const fill = document.getElementById(`age-slider-fill-${rangeNum}`);
    
    if (!minSlider || !maxSlider || !display) return;
    
    let min = parseInt(minSlider.value);
    let max = parseInt(maxSlider.value);
    
    // Ensure min <= max
    if (min > max) {
        if (minSlider === document.activeElement) {
            max = min;
            maxSlider.value = max;
        } else {
            min = max;
            minSlider.value = min;
        }
    }
    
    display.textContent = `${min} - ${max}`;
    
    // Update indicator
    updateSectionIndicator('audience');
    
    // Update slider fill (the colored portion between min and max)
    if (fill) {
        const minPercent = ((min - 13) / (80 - 13)) * 100;
        const maxPercent = ((max - 13) / (80 - 13)) * 100;
        fill.style.left = minPercent + '%';
        fill.style.width = (maxPercent - minPercent) + '%';
    }
}

// Initialize age range on page load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (document.getElementById('age-range-1-min')) {
            updateAgeRange('1');
        }
    }, 100);
});


/**
 * Add a custom feature
 */
window.addCustomFeature = function() {
    const grid = document.getElementById('features-grid');
    if (!grid) return;
    
    const featureWrapper = document.createElement('div');
    featureWrapper.className = "feature-custom-wrapper";
    
    const input = document.createElement('input');
    input.type = "text";
    input.className = "feature-custom-input";
    input.placeholder = "Enter feature name...";
    input.value = "New Feature";
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = "feature-delete-btn";
    deleteBtn.innerHTML = "×";
    deleteBtn.onclick = function(e) {
        e.stopPropagation();
        featureWrapper.remove();
    };
    
    featureWrapper.appendChild(input);
    featureWrapper.appendChild(deleteBtn);
    grid.appendChild(featureWrapper);
    
    // Focus on the input
    setTimeout(() => {
        input.focus();
        input.select();
    }, 100);
};

/**
 * Render predefined pages buttons
 */
function renderPredefinedPages() {
    const container = document.getElementById('predefined-pages-buttons');
    if (!container || container.children.length > 0) return;
    
    predefinedPages.forEach(page => {
        const btn = document.createElement('button');
        btn.className = "predefined-page-btn";
        btn.textContent = page.name;
        btn.onclick = function() {
            addPage(page.name, page.description);
        };
        container.appendChild(btn);
    });
}

/**
 * Add a custom page (creates new empty page card)
 */
window.addCustomPage = function() {
    addPage("New Page", "");
    // Focus on the name input of the newly created page
    setTimeout(() => {
        const cards = document.querySelectorAll('.page-card:not(.add-page-card)');
        if (cards.length > 0) {
            const lastCard = cards[cards.length - 1];
            const nameInput = lastCard.querySelector('.page-name-input');
            if (nameInput) {
                nameInput.focus();
                nameInput.select();
            }
        }
    }, 100);
};

/**
 * Add a new page card
 */
window.addPage = function(name, description = "") {
    const list = document.getElementById('pages-list');
    if (!list) return;
    
    // Check if page already exists (excluding the add-page-card)
    const existingPages = list.querySelectorAll('.page-card:not(.add-page-card)');
    for (let page of existingPages) {
        const pageName = page.querySelector('.page-name-input')?.value;
        if (pageName === name) {
            return; // Page already exists, don't add duplicate
        }
    }
    
    // Find the add-page-card to insert before it
    const addCard = list.querySelector('.add-page-card');
    
    const card = document.createElement('div');
    card.className = "page-card fade-in";
    
    const nameInput = document.createElement('input');
    nameInput.type = "text";
    nameInput.className = "page-name-input";
    nameInput.value = name;
    nameInput.placeholder = "Page name";
    
    const descTextarea = document.createElement('textarea');
    descTextarea.className = "page-description-input";
    descTextarea.placeholder = "Describe this page's purpose and functionality...";
    descTextarea.value = description;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = "page-delete-btn";
    deleteBtn.innerHTML = "×";
    deleteBtn.onclick = function() {
        card.remove();
    };
    
    card.appendChild(nameInput);
    card.appendChild(descTextarea);
    card.appendChild(deleteBtn);
    
    // Insert before the add-page-card
    if (addCard) {
        list.insertBefore(card, addCard);
    } else {
        list.appendChild(card);
    }
};

/**
 * Create a new workflow flow
 */
window.createNewFlow = function() {
    const area = document.getElementById('workflow-area');
    if (!area) return;
    
    const flowId = Date.now();
    const workflowWrapper = document.createElement('div');
    workflowWrapper.className = "workflow-wrapper fade-in";
    workflowWrapper.id = `workflow-${flowId}`;
    
    const workflowDelete = document.createElement('button');
    workflowDelete.className = "workflow-delete-btn";
    workflowDelete.innerHTML = "×";
    workflowDelete.onclick = function(e) {
        e.stopPropagation();
        workflowWrapper.remove();
    };
    
    const stepsContainer = document.createElement('div');
    stepsContainer.className = "workflow-steps-container";
    stepsContainer.id = `steps-${flowId}`;
    stepsContainer.style.display = "flex";
    
    workflowWrapper.appendChild(workflowDelete);
    workflowWrapper.appendChild(stepsContainer);
    area.appendChild(workflowWrapper);
    
    // Add workflow name as first step (special colored box) - pass container directly
    addWorkflowNameStepToContainer(stepsContainer);
    
    // Initialize arrows and add step button
    updateWorkflowArrows(stepsContainer);
    updateAddStepButton(stepsContainer, flowId);
};

/**
 * Add workflow name step (first step, special color)
 */
function addWorkflowNameStep(flowId) {
    const container = document.getElementById('steps-' + flowId);
    if (!container) {
        // Retry after a short delay if container not found
        setTimeout(() => addWorkflowNameStep(flowId), 50);
        return;
    }
    addWorkflowNameStepToContainer(container);
}

/**
 * Add workflow name step to container (direct)
 */
function addWorkflowNameStepToContainer(container) {
    if (!container) return;
    
    // Check if workflow name step already exists
    if (container.querySelector('.workflow-name-step')) {
        return;
    }
    
    const stepWrapper = document.createElement('div');
    stepWrapper.className = "workflow-step-wrapper workflow-name-step fade-in";
    
    const stepTextarea = document.createElement('textarea');
    stepTextarea.className = "workflow-step-textarea workflow-name-textarea";
    stepTextarea.placeholder = "Workflow Name (e.g. User Onboarding)";
    stepTextarea.rows = 3;
    
    stepWrapper.appendChild(stepTextarea);
    container.appendChild(stepWrapper);
    
    // Focus on the textarea
    setTimeout(() => {
        stepTextarea.focus();
    }, 100);
    
    // Add input listener to update indicator
    stepTextarea.addEventListener('input', function() {
        updateSectionIndicator('workflow');
    });
}


/**
 * Add a step to a workflow
 */
window.addStep = function(flowId, insertAfter = null) {
    const container = document.getElementById('steps-' + flowId);
    if (!container) return;
    
    const stepWrapper = document.createElement('div');
    stepWrapper.className = "workflow-step-wrapper fade-in";
    
    const stepTextarea = document.createElement('textarea');
    stepTextarea.className = "workflow-step-textarea";
    stepTextarea.placeholder = "Enter step description...";
    stepTextarea.rows = 3;
    
    stepWrapper.appendChild(stepTextarea);
    
    // Only add delete button if it's not the workflow name step
    if (!stepWrapper.classList.contains('workflow-name-step')) {
        const deleteStepBtn = document.createElement('button');
        deleteStepBtn.className = "delete-step-btn";
        deleteStepBtn.innerHTML = "×";
        deleteStepBtn.title = "Delete this step";
        deleteStepBtn.onclick = function(e) {
            e.stopPropagation();
            stepWrapper.remove();
            updateWorkflowArrows(container);
            updateAddStepButton(container, flowId);
        };
        stepWrapper.appendChild(deleteStepBtn);
    }
    
    if (insertAfter) {
        // Insert after the specified step
        insertAfter.parentNode.insertBefore(stepWrapper, insertAfter.nextSibling);
    } else {
        // Append to the end
        container.appendChild(stepWrapper);
    }
    
    // Update arrows and add step button
    updateWorkflowArrows(container);
    updateAddStepButton(container, flowId);
    
    // Focus on the new textarea
    setTimeout(() => {
        stepTextarea.focus();
    }, 100);
    
    // Add input listener to update indicator
    stepTextarea.addEventListener('input', function() {
        updateSectionIndicator('workflow');
    });
    
    updateSectionIndicator('workflow');
};

/**
 * Update workflow arrows between steps
 */
function updateWorkflowArrows(container) {
    // Get all steps except workflow name step
    const allSteps = Array.from(container.querySelectorAll('.workflow-step-wrapper'));
    // Remove all existing arrows
    container.querySelectorAll('.workflow-arrow').forEach(el => el.remove());
    
    // Add arrows between steps (including after workflow name step)
    allSteps.forEach((step, index) => {
        if (index < allSteps.length - 1) {
            // Add arrow
            const arrow = document.createElement('span');
            arrow.className = "workflow-arrow";
            arrow.textContent = "→";
            step.parentNode.insertBefore(arrow, step.nextSibling);
        }
    });
}

/**
 * Update add step button (only after last step)
 */
function updateAddStepButton(container, flowId) {
    // Remove existing add step button
    container.querySelectorAll('.add-step-after-btn').forEach(btn => btn.remove());
    
    // Get all steps except workflow name step
    const allSteps = Array.from(container.querySelectorAll('.workflow-step-wrapper')).filter(
        step => !step.classList.contains('workflow-name-step')
    );
    
    if (allSteps.length > 0) {
        const lastStep = allSteps[allSteps.length - 1];
        const addStepBtn = document.createElement('button');
        addStepBtn.className = "add-step-after-btn";
        addStepBtn.innerHTML = "+";
        addStepBtn.title = "Add step after this one";
        addStepBtn.onclick = function(e) {
            e.stopPropagation();
            addStep(flowId, lastStep);
        };
        lastStep.parentNode.insertBefore(addStepBtn, lastStep.nextSibling);
    } else {
        // If no regular steps, add button after workflow name step
        const workflowNameStep = container.querySelector('.workflow-name-step');
        if (workflowNameStep) {
            const addStepBtn = document.createElement('button');
            addStepBtn.className = "add-step-after-btn";
            addStepBtn.innerHTML = "+";
            addStepBtn.title = "Add step after this one";
            addStepBtn.onclick = function(e) {
                e.stopPropagation();
                addStep(flowId, workflowNameStep);
            };
            workflowNameStep.parentNode.insertBefore(addStepBtn, workflowNameStep.nextSibling);
        }
    }
}

/**
 * Generate final JSON specification
 */
window.generateJSON = function() {
    // Collect main vision/pitch
    const mainPitch = document.getElementById('main-pitch')?.value || '';
    
    // Collect pages
    const pages = [];
    document.querySelectorAll('.page-card:not(.add-page-card)').forEach(card => {
        const name = card.querySelector('input[type="text"]')?.value?.trim() || '';
        const description = card.querySelector('textarea')?.value?.trim() || '';
        if (name) {
            pages.push({
                name: name,
                description: description || 'No description provided'
            });
        }
    });
    
    // Collect workflows
    const workflows = [];
    document.querySelectorAll('.workflow-wrapper').forEach(wrapper => {
        const nameTextarea = wrapper.querySelector('.workflow-name-textarea');
        const workflowName = nameTextarea?.value?.trim() || '';
        
        const steps = [];
        wrapper.querySelectorAll('.workflow-step-textarea:not(.workflow-name-textarea)').forEach(stepTextarea => {
            const stepText = stepTextarea?.value?.trim() || '';
            if (stepText) {
                steps.push(stepText);
            }
        });
        
        if (workflowName || steps.length > 0) {
            workflows.push({
                name: workflowName || 'Unnamed Workflow',
                steps: steps.length > 0 ? steps : ['No steps defined']
            });
        }
    });
    
    // Collect features
    const features = {
        selected: [],
        custom: []
    };
    
    // Selected features
    document.querySelectorAll('.feature-btn.selected').forEach(btn => {
        const featureName = btn.textContent?.trim() || '';
        if (featureName) {
            features.selected.push(featureName);
        }
    });
    
    // Custom features
    document.querySelectorAll('.feature-custom-input').forEach(input => {
        const featureName = input.value?.trim() || '';
        if (featureName) {
            features.custom.push(featureName);
        }
    });
    
    // Collect design style
    const selectedDesignCard = document.querySelector('.design-card.selected');
    const design = {
        name: '',
        description: ''
    };
    
    if (selectedDesignCard) {
        const designName = selectedDesignCard.querySelector('.design-name')?.textContent?.trim() || '';
        const designDescription = selectedDesignCard.querySelector('.design-description')?.textContent?.trim() || '';
        design.name = designName;
        design.description = designDescription || 'No description available';
    }
    
    // Collect integrations
    const integrations = [];
    document.querySelectorAll('.integration-btn.selected').forEach(btn => {
        const textSpan = btn.querySelector('span');
        const integrationName = textSpan?.textContent?.trim() || btn.textContent?.trim() || '';
        if (integrationName) {
            integrations.push(integrationName);
        }
    });
    
    // Collect audience data
    const selectedPlatform = document.querySelector('.platform-btn.selected');
    const platform = selectedPlatform ? {
        type: selectedPlatform.dataset.platform || '',
        label: selectedPlatform.querySelector('.platform-label')?.textContent?.trim() || ''
    } : null;
    
    const interests = Array.from(document.querySelectorAll('.interest-btn.selected')).map(btn => {
        return btn.textContent?.trim() || '';
    }).filter(interest => interest.length > 0);
    
    const ageMin = parseInt(document.getElementById('age-range-1-min')?.value || 18);
    const ageMax = parseInt(document.getElementById('age-range-1-max')?.value || 35);
    
    // Build comprehensive JSON specification
    const spec = {
        metadata: {
            generatedAt: new Date().toISOString(),
            version: "1.0",
            tool: "Specifys.ai Planning Tool"
        },
        vision: {
            description: mainPitch || 'No vision description provided',
            explanation: mainPitch ? 'This is the main application vision and purpose as described by the user.' : 'No vision was provided.'
        },
        pages: {
            count: pages.length,
            list: pages,
            explanation: pages.length > 0 
                ? `The application includes ${pages.length} page(s) with their names and descriptions.`
                : 'No pages were defined for this application.'
        },
        workflows: {
            count: workflows.length,
            list: workflows,
            explanation: workflows.length > 0
                ? `The application includes ${workflows.length} workflow(s) defining user journeys and processes.`
                : 'No workflows were defined for this application.'
        },
        features: {
            selectedCount: features.selected.length,
            customCount: features.custom.length,
            selected: features.selected,
            custom: features.custom,
            explanation: features.selected.length > 0 || features.custom.length > 0
                ? `The application includes ${features.selected.length} predefined feature(s) and ${features.custom.length} custom feature(s).`
                : 'No features were selected for this application.'
        },
        design: {
            selected: design.name || null,
            description: design.description || null,
            explanation: design.name
                ? `The selected design style is "${design.name}". ${design.description}`
                : 'No design style was selected for this application.'
        },
        integrations: {
            count: integrations.length,
            list: integrations,
            explanation: integrations.length > 0
                ? `The application integrates with ${integrations.length} external service(s): ${integrations.join(', ')}.`
                : 'No integrations were selected for this application.'
        },
        audience: {
            platform: platform,
            interests: {
                count: interests.length,
                list: interests,
                explanation: interests.length > 0
                    ? `Target audience interests include: ${interests.join(', ')}.`
                    : 'No specific interests were selected for the target audience.'
            },
            ageRange: {
                min: ageMin,
                max: ageMax,
                explanation: `Target age range is ${ageMin} to ${ageMax} years old.`
            },
            explanation: `Target audience: ${platform ? platform.label : 'No platform selected'}, ${interests.length} interest(s), age ${ageMin}-${ageMax}.`
        },
        screenshots: (function collectScreenshots() {
            const refs = [];
            document.querySelectorAll('.screenshot-ref-card').forEach((card) => {
                const noteEl = card.querySelector('.screenshot-ref-note-text');
                const descEl = card.querySelector('.screenshot-ref-description');
                const note = noteEl ? noteEl.textContent.trim() : '';
                const description = descEl ? descEl.value.trim() : '';
                if (description) {
                    refs.push({
                        index: refs.length + 1,
                        userNote: note === '—' ? '' : note,
                        confirmedDescription: description
                    });
                }
            });
            const capped = refs.slice(0, PLANNING_MAX_SCREENSHOT_REFS);
            capped.forEach((r, i) => {
                r.index = i + 1;
            });
            return {
                count: capped.length,
                list: capped,
                explanation: capped.length > 0
                    ? `${capped.length} screenshot reference(s) with UI/visual requirements derived from images and user notes.`
                    : 'No screenshot references were confirmed for this application.'
            };
        })()
    };
    
    // Convert to JSON string with pretty formatting
    const jsonString = JSON.stringify(spec, null, 2);
    
    // Return both object and string
    return {
        object: spec,
        json: jsonString
    };
};

/**
 * Convert planning data to formatted text string for prompt
 */
window.generatePlanningText = function() {
    const spec = window.generateJSON();
    if (!spec || !spec.object) {
        return '';
    }
    
    const data = spec.object;
    let text = '';
    
    // Main Vision
    text += `Application Vision:\n${data.vision.description || 'No vision provided'}\n\n`;
    
    // Pages
    if (data.pages && data.pages.list && data.pages.list.length > 0) {
        text += `Pages (${data.pages.count}):\n`;
        data.pages.list.forEach((page, index) => {
            text += `${index + 1}. ${page.name}`;
            if (page.description && page.description !== 'No description provided') {
                text += ` - ${page.description}`;
            }
            text += '\n';
        });
        text += '\n';
    }
    
    // Workflows
    if (data.workflows && data.workflows.list && data.workflows.list.length > 0) {
        text += `Workflows (${data.workflows.count}):\n`;
        data.workflows.list.forEach((workflow, index) => {
            text += `${index + 1}. ${workflow.name || 'Unnamed Workflow'}\n`;
            if (workflow.steps && workflow.steps.length > 0) {
                workflow.steps.forEach((step, stepIndex) => {
                    text += `   Step ${stepIndex + 1}: ${step}\n`;
                });
            }
        });
        text += '\n';
    }
    
    // Features
    if (data.features) {
        const allFeatures = [];
        if (data.features.selected && data.features.selected.length > 0) {
            allFeatures.push(...data.features.selected);
        }
        if (data.features.custom && data.features.custom.length > 0) {
            allFeatures.push(...data.features.custom);
        }
        if (allFeatures.length > 0) {
            text += `Features (${allFeatures.length}):\n`;
            allFeatures.forEach((feature, index) => {
                text += `${index + 1}. ${feature}\n`;
            });
            text += '\n';
        }
    }
    
    // Design
    if (data.design && data.design.selected) {
        text += `Design Style: ${data.design.selected}`;
        if (data.design.description) {
            text += ` - ${data.design.description}`;
        }
        text += '\n\n';
    }
    
    // Integrations
    if (data.integrations && data.integrations.list && data.integrations.list.length > 0) {
        text += `Integrations (${data.integrations.count}): ${data.integrations.list.join(', ')}\n\n`;
    }
    
    // Audience
    if (data.audience) {
        text += `Target Audience:\n`;
        if (data.audience.platform) {
            text += `Platform: ${data.audience.platform.label || data.audience.platform.type}\n`;
        }
        if (data.audience.interests && data.audience.interests.list && data.audience.interests.list.length > 0) {
            text += `Interests: ${data.audience.interests.list.join(', ')}\n`;
        }
        if (data.audience.ageRange) {
            text += `Age Range: ${data.audience.ageRange.min} - ${data.audience.ageRange.max} years\n`;
        }
        text += '\n';
    }

    if (data.screenshots && data.screenshots.list && data.screenshots.list.length > 0) {
        text += `UI Screenshot References (${data.screenshots.count}):\n`;
        data.screenshots.list.forEach((ref) => {
            text += `${ref.index}. `;
            if (ref.userNote) {
                text += `(User note: ${ref.userNote}) `;
            }
            text += `${ref.confirmedDescription}\n`;
        });
        text += '\n';
    }
    
    return text.trim();
};

/**
 * Check if a section has data and update indicator
 */
function updateSectionIndicator(sectionId) {
    const btn = document.querySelector(`.nav-btn[data-section="${sectionId}"]`);
    if (!btn) return;
    
    let hasData = false;
    
    switch(sectionId) {
        case 'pages':
            const pageCards = document.querySelectorAll('.page-card:not(.add-page-card)');
            hasData = pageCards.length > 0 && Array.from(pageCards).some(card => {
                const nameInput = card.querySelector('input[type="text"]');
                return nameInput && nameInput.value.trim().length > 0;
            });
            break;
            
        case 'workflow':
            const workflows = document.querySelectorAll('.workflow-wrapper');
            hasData = workflows.length > 0 && Array.from(workflows).some(wf => {
                const nameTextarea = wf.querySelector('.workflow-name-textarea');
                const steps = wf.querySelectorAll('.workflow-step-textarea:not(.workflow-name-textarea)');
                return (nameTextarea && nameTextarea.value.trim().length > 0) ||
                       Array.from(steps).some(step => step.value.trim().length > 0);
            });
            break;
            
        case 'features':
            const selectedFeatures = document.querySelectorAll('.feature-btn.selected, .feature-custom-input');
            hasData = selectedFeatures.length > 0 && Array.from(selectedFeatures).some(feature => {
                if (feature.classList.contains('feature-btn')) return true;
                return feature.value && feature.value.trim().length > 0;
            });
            break;
            
        case 'design':
            hasData = document.querySelector('.design-card.selected') !== null;
            break;
            
        case 'integrations':
            hasData = document.querySelectorAll('.integration-btn.selected').length > 0;
            break;
            
        case 'audience':
            const hasPlatform = document.querySelector('.platform-btn.selected') !== null;
            const hasInterests = document.querySelectorAll('.interest-btn.selected').length > 0;
            const ageMin = document.getElementById('age-range-1-min');
            const ageMax = document.getElementById('age-range-1-max');
            const hasAgeRange = ageMin && ageMax && 
                (parseInt(ageMin.value) !== 18 || parseInt(ageMax.value) !== 35);
            hasData = hasPlatform || hasInterests || hasAgeRange;
            break;

        case 'screenshot':
            hasData = document.querySelectorAll('.screenshot-ref-card').length > 0;
            break;
    }
    
    if (hasData) {
        btn.classList.add('has-data');
    } else {
        btn.classList.remove('has-data');
    }
}

/**
 * Update all section indicators
 */
function updateAllIndicators() {
    ['pages', 'workflow', 'features', 'design', 'integrations', 'audience', 'screenshot'].forEach(sectionId => {
        updateSectionIndicator(sectionId);
    });
}

/** Maximum confirmed screenshot references merged into one spec */
const PLANNING_MAX_SCREENSHOT_REFS = 10;

const screenshotComposerState = {
    previewObjectUrl: null,
    selectedFile: null
};

function getScreenshotRefCount() {
    return document.querySelectorAll('.screenshot-ref-card').length;
}

function updateScreenshotLimitUI() {
    const uploadBtn = document.getElementById('screenshot-upload-trigger');
    const notice = document.getElementById('screenshot-at-limit-notice');
    const composer = document.querySelector('.screenshot-composer');
    const atLimit = getScreenshotRefCount() >= PLANNING_MAX_SCREENSHOT_REFS;
    if (uploadBtn) {
        uploadBtn.disabled = atLimit;
        uploadBtn.setAttribute('aria-disabled', atLimit ? 'true' : 'false');
        if (atLimit) {
            uploadBtn.classList.add('screenshot-upload-trigger--disabled');
        } else {
            uploadBtn.classList.remove('screenshot-upload-trigger--disabled');
        }
    }
    if (notice) {
        if (atLimit) {
            notice.classList.remove('hidden-el');
        } else {
            notice.classList.add('hidden-el');
        }
    }
    if (composer) {
        composer.classList.toggle('screenshot-composer--at-limit', atLimit);
    }
}

function getPlanningApiBase() {
    if (window.api && typeof window.api.baseUrl === 'string') {
        return window.api.baseUrl.replace(/\/$/, '');
    }
    if (typeof window.getApiBaseUrl === 'function') {
        return String(window.getApiBaseUrl() || '').replace(/\/$/, '');
    }
    return String(window.API_BASE_URL || window.BACKEND_URL || '').replace(/\/$/, '');
}

function setScreenshotError(msg) {
    const el = document.getElementById('screenshot-error');
    if (!el) return;
    if (msg) {
        el.textContent = msg;
        el.classList.remove('hidden-el');
    } else {
        el.textContent = '';
        el.classList.add('hidden-el');
    }
}

function toggleScreenshotPanelEl(id, show) {
    const el = document.getElementById(id);
    if (!el) return;
    if (show) el.classList.remove('hidden-el');
    else el.classList.add('hidden-el');
}

function resetScreenshotComposer() {
    const fileInput = document.getElementById('screenshot-file-input');
    if (screenshotComposerState.previewObjectUrl) {
        URL.revokeObjectURL(screenshotComposerState.previewObjectUrl);
        screenshotComposerState.previewObjectUrl = null;
    }
    screenshotComposerState.selectedFile = null;
    if (fileInput) fileInput.value = '';
    const prevImg = document.getElementById('screenshot-preview-img');
    if (prevImg) prevImg.removeAttribute('src');
    toggleScreenshotPanelEl('screenshot-preview-wrap', false);
    const ui = document.getElementById('screenshot-user-instruction');
    if (ui) ui.value = '';
    toggleScreenshotPanelEl('screenshot-user-instruction', false);
    toggleScreenshotPanelEl('screenshot-analyze-row', false);
    toggleScreenshotPanelEl('screenshot-generated-label', false);
    toggleScreenshotPanelEl('screenshot-generated-text', false);
    toggleScreenshotPanelEl('screenshot-confirm-btn', false);
    toggleScreenshotPanelEl('screenshot-analyze-spinner', false);
    const gen = document.getElementById('screenshot-generated-text');
    if (gen) gen.value = '';
    const analyzeBtn = document.getElementById('screenshot-analyze-btn');
    if (analyzeBtn) analyzeBtn.disabled = false;
    toggleScreenshotPanelEl('screenshot-auth-hint', false);
    setScreenshotError('');
}

function appendScreenshotRefCard(dataUrl, userNote, description) {
    const list = document.getElementById('screenshot-confirmed-list');
    if (!list) return;
    const card = document.createElement('div');
    card.className = 'screenshot-ref-card';
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'screenshot-ref-thumb-wrap';
    const thumb = document.createElement('img');
    thumb.className = 'screenshot-ref-thumb';
    thumb.alt = 'Screenshot reference';
    thumb.src = dataUrl;
    thumbWrap.appendChild(thumb);
    const body = document.createElement('div');
    body.className = 'screenshot-ref-body';
    const noteP = document.createElement('p');
    noteP.className = 'screenshot-ref-note';
    const strong = document.createElement('strong');
    strong.textContent = 'Your note: ';
    noteP.appendChild(strong);
    const noteSpan = document.createElement('span');
    noteSpan.className = 'screenshot-ref-note-text';
    noteSpan.textContent = userNote || '—';
    noteP.appendChild(noteSpan);
    const desc = document.createElement('textarea');
    desc.className = 'screenshot-ref-description';
    desc.rows = 5;
    desc.value = description || '';
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'screenshot-ref-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', function() {
        card.remove();
        updateAllIndicators();
        updateScreenshotLimitUI();
    });
    desc.addEventListener('input', function() {
        setTimeout(updateAllIndicators, 50);
    });
    body.appendChild(noteP);
    body.appendChild(desc);
    body.appendChild(removeBtn);
    card.appendChild(thumbWrap);
    card.appendChild(body);
    list.appendChild(card);
    updateAllIndicators();
    updateScreenshotLimitUI();
}

async function postScreenshotAnalyze(file, userInstruction) {
    const base = getPlanningApiBase();
    const formData = new FormData();
    formData.append('image', file);
    formData.append('userInstruction', userInstruction);
    const headers = {};
    if (window.auth && window.auth.currentUser) {
        const token = await window.auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${base}/api/planning/analyze-screenshot`, {
        method: 'POST',
        headers: headers,
        body: formData
    });
    const data = await res.json().catch(function() { return {}; });
    if (!res.ok) {
        const msg = (data.error && data.error.message) || data.message || ('Request failed (' + res.status + ')');
        throw new Error(msg);
    }
    if (!data.description || typeof data.description !== 'string') {
        throw new Error('No description returned');
    }
    return data.description;
}

function wireScreenshotComposer() {
    const uploadBtn = document.getElementById('screenshot-upload-trigger');
    const fileInput = document.getElementById('screenshot-file-input');
    const analyzeBtn = document.getElementById('screenshot-analyze-btn');
    const confirmBtn = document.getElementById('screenshot-confirm-btn');
    if (!uploadBtn || !fileInput) return;

    uploadBtn.addEventListener('click', function() {
        if (getScreenshotRefCount() >= PLANNING_MAX_SCREENSHOT_REFS) {
            setScreenshotError('Maximum ' + PLANNING_MAX_SCREENSHOT_REFS + ' screenshot references per spec. Remove one to add another.');
            return;
        }
        fileInput.click();
    });

    fileInput.addEventListener('change', function() {
        setScreenshotError('');
        if (getScreenshotRefCount() >= PLANNING_MAX_SCREENSHOT_REFS) {
            fileInput.value = '';
            setScreenshotError('Maximum ' + PLANNING_MAX_SCREENSHOT_REFS + ' screenshot references per spec. Remove one to add another.');
            return;
        }
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (screenshotComposerState.previewObjectUrl) {
            URL.revokeObjectURL(screenshotComposerState.previewObjectUrl);
            screenshotComposerState.previewObjectUrl = null;
        }
        screenshotComposerState.selectedFile = file;
        const url = URL.createObjectURL(file);
        screenshotComposerState.previewObjectUrl = url;
        const img = document.getElementById('screenshot-preview-img');
        if (img) img.src = url;
        toggleScreenshotPanelEl('screenshot-preview-wrap', true);
        toggleScreenshotPanelEl('screenshot-user-instruction', true);
        toggleScreenshotPanelEl('screenshot-analyze-row', true);
        toggleScreenshotPanelEl('screenshot-generated-label', false);
        toggleScreenshotPanelEl('screenshot-generated-text', false);
        toggleScreenshotPanelEl('screenshot-confirm-btn', false);
        const gen = document.getElementById('screenshot-generated-text');
        if (gen) gen.value = '';
    });

    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async function() {
            setScreenshotError('');
            const file = screenshotComposerState.selectedFile;
            const instrEl = document.getElementById('screenshot-user-instruction');
            const instruction = instrEl ? instrEl.value.trim() : '';
            if (!file) {
                setScreenshotError('Please choose an image first.');
                return;
            }
            if (!instruction) {
                setScreenshotError('Please add a short description of what you want.');
                return;
            }
            if (!window.auth || !window.auth.currentUser) {
                toggleScreenshotPanelEl('screenshot-auth-hint', true);
                setScreenshotError('You need to be signed in to analyze screenshots.');
                return;
            }
            if (getScreenshotRefCount() >= PLANNING_MAX_SCREENSHOT_REFS) {
                setScreenshotError('Maximum ' + PLANNING_MAX_SCREENSHOT_REFS + ' screenshot references per spec. Remove one to add another.');
                return;
            }
            toggleScreenshotPanelEl('screenshot-auth-hint', false);
            analyzeBtn.disabled = true;
            toggleScreenshotPanelEl('screenshot-analyze-spinner', true);
            try {
                const description = await postScreenshotAnalyze(file, instruction);
                const gen = document.getElementById('screenshot-generated-text');
                if (gen) gen.value = description;
                toggleScreenshotPanelEl('screenshot-generated-label', true);
                toggleScreenshotPanelEl('screenshot-generated-text', true);
                toggleScreenshotPanelEl('screenshot-confirm-btn', true);
            } catch (e) {
                setScreenshotError(e.message || 'Analysis failed. Try again.');
            } finally {
                analyzeBtn.disabled = false;
                toggleScreenshotPanelEl('screenshot-analyze-spinner', false);
            }
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            const file = screenshotComposerState.selectedFile;
            const instrEl = document.getElementById('screenshot-user-instruction');
            const gen = document.getElementById('screenshot-generated-text');
            const instruction = instrEl ? instrEl.value.trim() : '';
            const description = gen ? gen.value.trim() : '';
            if (!file || !description) {
                setScreenshotError('Missing image or description.');
                return;
            }
            if (getScreenshotRefCount() >= PLANNING_MAX_SCREENSHOT_REFS) {
                setScreenshotError('Maximum ' + PLANNING_MAX_SCREENSHOT_REFS + ' screenshot references per spec. Remove one to add another.');
                return;
            }
            const reader = new FileReader();
            reader.onload = function() {
                appendScreenshotRefCard(reader.result, instruction, description);
                resetScreenshotComposer();
            };
            reader.readAsDataURL(file);
        });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    const pitchInput = document.getElementById('main-pitch');
    const homeNav = document.getElementById('home-nav');
    
    // Keep navigation buttons hidden initially
    if (homeNav) {
        homeNav.classList.add('hidden');
    }
    
    if (pitchInput) {
        // Show buttons when user starts typing
        pitchInput.addEventListener('input', function() {
            showInitialNav();
            updateAllIndicators();
        });
        
        // Show buttons when user focuses on textarea
        pitchInput.addEventListener('focus', function() {
            showInitialNav();
        });
        
        // Hide buttons when user blurs (loses focus) and there's no text
        // But keep them visible if there's text or if a section is open
        pitchInput.addEventListener('blur', function(e) {
            // Check if the blur was caused by clicking on a nav button or section panel
            const relatedTarget = e.relatedTarget;
            const isClickingNavButton = relatedTarget && (
                relatedTarget.closest('.nav-btn') || 
                relatedTarget.closest('#home-nav') ||
                relatedTarget.closest('#section-panel')
            );
            
            // Only hide if there's no text AND user didn't click on nav/section
            if (pitchInput.value.length === 0 && !isClickingNavButton) {
                // Use a small delay to check if focus moved to nav button or section
                setTimeout(() => {
                    // Double check that focus is not on nav button or section
                    const activeElement = document.activeElement;
                    const isNavFocused = activeElement && (
                        activeElement.closest('.nav-btn') || 
                        activeElement.closest('#home-nav') ||
                        activeElement.closest('#section-panel')
                    );
                    
                    // Also check if section panel is open
                    const sectionPanel = document.getElementById('section-panel');
                    const isSectionOpen = sectionPanel && !sectionPanel.classList.contains('hidden-el');
                    
                    if (pitchInput.value.length === 0 && !isNavFocused && !isSectionOpen) {
                        const homeNav = document.getElementById('home-nav');
                        if (homeNav) {
                            homeNav.classList.remove('fade-in');
                            homeNav.classList.add('hidden');
                        }
                        const footer = document.getElementById('export-area');
                        if (footer) {
                            footer.classList.add('hidden');
                        }
                    }
                }, 150);
            }
        });
    }
    
    // Update indicators periodically
    setInterval(updateAllIndicators, 1000);
    
    // Update indicators on various events
    document.addEventListener('input', function(e) {
        if (e.target.matches('input, textarea')) {
            setTimeout(updateAllIndicators, 100);
        }
    });
    
    document.addEventListener('click', function(e) {
        if (e.target.matches('.feature-btn, .integration-btn, .interest-btn, .platform-btn, .design-card')) {
            setTimeout(updateAllIndicators, 100);
        }
    });
    
    // Initialize character count
    if (pitchInput) {
        updateCharacterCount();
    }

    wireScreenshotComposer();
    updateScreenshotLimitUI();
});

/**
 * Update character count for main pitch textarea
 */
window.updateCharacterCount = function() {
    const pitchInput = document.getElementById('main-pitch');
    const countElement = document.getElementById('characterCount');
    
    if (!pitchInput || !countElement) return;
    
    const currentLength = pitchInput.value.length;
    const maxLength = parseInt(pitchInput.getAttribute('maxlength')) || 2000;
    
    countElement.textContent = `${currentLength} / ${maxLength}`;
    
    // Change color if approaching limit
    if (currentLength > maxLength * 0.9) {
        countElement.style.color = '#EF4444';
    } else if (currentLength > maxLength * 0.75) {
        countElement.style.color = '#F59E0B';
    } else {
        countElement.style.color = '';
    }
};

