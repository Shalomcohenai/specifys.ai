// ToolPicker page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.querySelector('.search-input') || document.querySelector('#ideaInput');
    const searchButton = document.querySelector('.search-button');
    const charCounter = document.querySelector('.char-counter');
    const featuresSection = document.querySelector('.features-section');
    const comparisonSection = document.querySelector('.comparison-section');
    const comparisonTableBody = document.querySelector('.comparison-table-body');
    const errorMessage = document.querySelector('.error-message');
    
    // Debug: Log if elements are found
    console.log('ToolPicker initialized:', {
        searchInput: !!searchInput,
        searchButton: !!searchButton,
        charCounter: !!charCounter
    });
    
    // Force textarea visibility and enable interaction if found
    if (searchInput) {
        searchInput.style.display = 'block';
        searchInput.style.visibility = 'visible';
        searchInput.style.opacity = '1';
        searchInput.style.pointerEvents = 'auto';
        searchInput.style.cursor = 'text';
        searchInput.style.zIndex = '10';
        searchInput.style.position = 'relative';
        // Remove any disabled or readonly attributes
        searchInput.removeAttribute('disabled');
        searchInput.removeAttribute('readonly');
        // Ensure it's focusable
        searchInput.setAttribute('tabindex', '0');
        
        // Add click handler to ensure focus
        searchInput.addEventListener('click', function(e) {
            e.stopPropagation();
            this.focus();
        });
        
        // Add focus handler
        searchInput.addEventListener('focus', function() {
            this.style.pointerEvents = 'auto';
            this.style.cursor = 'text';
        });
        
        // Prevent any parent elements from blocking interaction
        let parent = searchInput.parentElement;
        while (parent && parent !== document.body) {
            if (parent.style.pointerEvents === 'none') {
                parent.style.pointerEvents = 'auto';
            }
            parent = parent.parentElement;
        }
        
        // Make sure the textarea is not covered by any overlay
        setTimeout(() => {
            searchInput.focus();
            searchInput.blur(); // Remove focus but keep it interactive
        }, 100);
    }

    // Character counter - Initialize on page load
    if (searchInput && charCounter) {
        // Initialize counter with current value
        const initialCount = searchInput.value.length;
        charCounter.textContent = `${initialCount}/2000 characters`;
        
        // Set initial color class
        if (initialCount > 1800) {
            charCounter.classList.add('text-danger');
        } else if (initialCount > 1500) {
            charCounter.classList.add('text-warning');
        } else {
            charCounter.classList.add('text-secondary');
        }
        
        // Update counter on input
        searchInput.addEventListener('input', function() {
            const count = this.value.length;
            charCounter.textContent = `${count}/2000 characters`;
            
            // Remove all color classes
            charCounter.classList.remove('text-danger', 'text-warning', 'text-secondary');
            
            if (count > 1800) {
                charCounter.classList.add('text-danger');
            } else if (count > 1500) {
                charCounter.classList.add('text-warning');
            } else {
                charCounter.classList.add('text-secondary');
            }
        });
    }

    // Simulate tool fetching and recommendation
    function fetchTools(description) {
        return new Promise((resolve) => {
            if (searchButton) {
                searchButton.disabled = true;
                searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finding Tools...';
            }
            
            // Simulate API call delay
            setTimeout(() => {
                // Mock data - in real implementation, this would be an API call
                const mockTools = [
                    {
                        name: "Bubble",
                        category: "NoCode Platform",
                        features: ["Visual Editor", "Database", "API Integration", "User Authentication"],
                        link: "https://bubble.io"
                    },
                    {
                        name: "Webflow",
                        category: "Design + Code",
                        features: ["Visual Design", "CMS", "E-commerce", "Custom Code"],
                        link: "https://webflow.com"
                    },
                    {
                        name: "Glide",
                        category: "NoCode App Builder",
                        features: ["Mobile Apps", "Data Integration", "User Management", "Custom Logic"],
                        link: "https://glideapps.com"
                    }
                ];
                
                resolve(mockTools);
                
                if (searchButton) {
                    searchButton.disabled = false;
                    searchButton.innerHTML = '<i class="fas fa-paper-plane"></i> Find Tools';
                }
            }, 2000);
        });
    }

    function updateUI(tools) {
        // Update features section
        const featuresList = document.querySelector('.features-list');
        if (featuresList) {
            featuresList.innerHTML = '';
            
            tools.forEach((tool, index) => {
                tool.features.forEach(feature => {
                    const featureItem = document.createElement('div');
                    featureItem.className = 'feature-item';
                    featureItem.textContent = feature;
                    featuresList.appendChild(featureItem);
                });
            });
        }
        
        if (featuresSection) {
            featuresSection.classList.remove('hidden');
        }

        // Update comparison table
        if (comparisonTableBody) {
            const tableContent = `
                <tr>
                    <td><strong>Platform</strong></td>
                    <td>${tools[0]?.name || '-'}</td>
                    <td>${tools[1]?.name || '-'}</td>
                    <td>${tools[2]?.name || '-'}</td>
                </tr>
                <tr>
                    <td><strong>Category</strong></td>
                    <td>${tools[0]?.category || '-'}</td>
                    <td>${tools[1]?.category || '-'}</td>
                    <td>${tools[2]?.category || '-'}</td>
                </tr>
                <tr>
                    <td><strong>Key Features</strong></td>
                    <td>${tools[0]?.features.slice(0, 2).join(', ') || '-'}</td>
                    <td>${tools[1]?.features.slice(0, 2).join(', ') || '-'}</td>
                    <td>${tools[2]?.features.slice(0, 2).join(', ') || '-'}</td>
                </tr>
                <tr>
                    <td><strong>Get Started</strong></td>
                    <td>${tools[0] ? `<a href="${tools[0].link}" class="btn btn-sm btn-primary" target="_blank">Start Here</a>` : '-'}</td>
                    <td>${tools[1] ? `<a href="${tools[1].link}" class="btn btn-sm btn-primary" target="_blank">Start Here</a>` : '-'}</td>
                    <td>${tools[2] ? `<a href="${tools[2].link}" class="btn btn-sm btn-primary" target="_blank">Start Here</a>` : '-'}</td>
                </tr>
            `;
            comparisonTableBody.innerHTML = tableContent;
        }
        
        if (comparisonSection) {
            comparisonSection.classList.remove('hidden');
            comparisonSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // Add column hover effect
        setTimeout(addColumnHoverEffect, 100);
    }

    if (searchButton && searchInput) {
        searchButton.addEventListener('click', () => {
            if (searchInput.value.trim().length < 50) {
                if (errorMessage) {
                    errorMessage.textContent = 'Description must be at least 50 characters.';
                    errorMessage.classList.remove('hidden');
                    setTimeout(() => errorMessage.classList.add('hidden'), 5000);
                }
                return;
            }
            
            if (featuresSection) featuresSection.classList.add('hidden');
            if (comparisonSection) comparisonSection.classList.add('hidden');
            if (errorMessage) errorMessage.classList.add('hidden');
            
            fetchTools(searchInput.value).then(data => {
                if (data) updateUI(data);
            });
        });
    }

    // Add column hover effect for comparison table
    function addColumnHoverEffect() {
        const table = document.querySelector('.comparison-section .table');
        if (!table) return;

        const cells = table.querySelectorAll('td, th');
        
        cells.forEach(cell => {
            cell.addEventListener('mouseenter', function() {
                const cellIndex = Array.from(this.parentElement.children).indexOf(this);
                
                // Highlight all cells in the same column
                const rows = table.querySelectorAll('tr');
                rows.forEach(row => {
                    const targetCell = row.children[cellIndex];
                    if (targetCell) {
                        targetCell.classList.add('column-highlight');
                    }
                });
            });

            cell.addEventListener('mouseleave', function() {
                // Remove highlight from all cells
                const allCells = table.querySelectorAll('.column-highlight');
                allCells.forEach(c => c.classList.remove('column-highlight'));
            });
        });
    }
    
    // Load dynamic stats on page load
    if (typeof loadDynamicStats === 'function') {
        loadDynamicStats().then(() => {
            // Trigger counter animation for all stat numbers
            const statNumbers = document.querySelectorAll('.stat-number');
            statNumbers.forEach(element => {
                const target = parseInt(element.dataset.target);
                if (target && !isNaN(target) && typeof animateCounter === 'function') {
                    animateCounter(element, target);
                }
            });
        });
    }
});
