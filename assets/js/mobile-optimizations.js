// Mobile Optimizations - Specifys.ai
// Touch gestures, swipe support, and mobile-specific enhancements

(function() {
    'use strict';

    // Touch gesture support
    class TouchGestures {
        constructor(element) {
            this.element = element;
            this.startX = 0;
            this.startY = 0;
            this.endX = 0;
            this.endY = 0;
            this.threshold = 50; // Minimum distance for swipe
            this.maxVerticalDistance = 100; // Max vertical movement for horizontal swipe
            
            this.init();
        }

        init() {
            this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
            this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
        }

        handleTouchStart(e) {
            this.startX = e.touches[0].clientX;
            this.startY = e.touches[0].clientY;
        }

        handleTouchEnd(e) {
            this.endX = e.changedTouches[0].clientX;
            this.endY = e.changedTouches[0].clientY;
            
            this.detectSwipe();
        }

        detectSwipe() {
            const deltaX = this.endX - this.startX;
            const deltaY = this.endY - this.startY;
            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);

            // Check if it's a horizontal swipe
            if (absDeltaX > this.threshold && absDeltaY < this.maxVerticalDistance) {
                if (deltaX > 0) {
                    this.onSwipeRight();
                } else {
                    this.onSwipeLeft();
                }
            }
            // Check if it's a vertical swipe
            else if (absDeltaY > this.threshold && absDeltaX < this.maxVerticalDistance) {
                if (deltaY > 0) {
                    this.onSwipeDown();
                } else {
                    this.onSwipeUp();
                }
            }
        }

        onSwipeLeft() {
            this.element.dispatchEvent(new CustomEvent('swipeLeft', { bubbles: true }));
        }

        onSwipeRight() {
            this.element.dispatchEvent(new CustomEvent('swipeRight', { bubbles: true }));
        }

        onSwipeUp() {
            this.element.dispatchEvent(new CustomEvent('swipeUp', { bubbles: true }));
        }

        onSwipeDown() {
            this.element.dispatchEvent(new CustomEvent('swipeDown', { bubbles: true }));
        }
    }

    // Mobile tab navigation with swipe support
    class MobileTabNavigation {
        constructor(container) {
            this.container = container;
            this.tabs = container.querySelectorAll('.tab-button');
            this.panes = container.querySelectorAll('.tab-pane');
            this.currentIndex = 0;
            
            this.init();
        }

        init() {
            // Add swipe support to tab content
            const tabContent = this.container.querySelector('.tab-content');
            if (tabContent) {
                new TouchGestures(tabContent);
                tabContent.addEventListener('swipeLeft', this.nextTab.bind(this));
                tabContent.addEventListener('swipeRight', this.prevTab.bind(this));
            }

            // Add touch indicators
            this.addTouchIndicators();
        }

        nextTab() {
            if (this.currentIndex < this.tabs.length - 1) {
                this.currentIndex++;
                this.switchToTab(this.currentIndex);
            }
        }

        prevTab() {
            if (this.currentIndex > 0) {
                this.currentIndex--;
                this.switchToTab(this.currentIndex);
            }
        }

        switchToTab(index) {
            // Update tab buttons
            this.tabs.forEach((tab, i) => {
                tab.classList.toggle('active', i === index);
            });

            // Update tab panes
            this.panes.forEach((pane, i) => {
                pane.classList.toggle('active', i === index);
            });

            // Update indicators
            this.updateIndicators();
        }

        addTouchIndicators() {
            const tabHeader = this.container.querySelector('.tab-header');
            if (!tabHeader) return;

            const indicators = document.createElement('div');
            indicators.className = 'tab-indicators';
            indicators.innerHTML = this.tabs.map((_, i) => 
                `<span class="indicator ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`
            ).join('');

            tabHeader.appendChild(indicators);

            // Add click handlers for indicators
            indicators.addEventListener('click', (e) => {
                if (e.target.classList.contains('indicator')) {
                    const index = parseInt(e.target.dataset.index);
                    this.currentIndex = index;
                    this.switchToTab(index);
                }
            });
        }

        updateIndicators() {
            const indicators = this.container.querySelectorAll('.tab-indicators .indicator');
            indicators.forEach((indicator, i) => {
                indicator.classList.toggle('active', i === this.currentIndex);
            });
        }
    }

    // Mobile card carousel
    class MobileCardCarousel {
        constructor(container) {
            this.container = container;
            this.cards = container.querySelectorAll('.app-card, .spec-card');
            this.currentIndex = 0;
            this.cardWidth = 0;
            
            this.init();
        }

        init() {
            if (this.cards.length === 0) return;

            this.setupCarousel();
            this.addSwipeSupport();
            this.addIndicators();
        }

        setupCarousel() {
            this.container.style.overflow = 'hidden';
            this.container.style.position = 'relative';
            
            // Calculate card width
            const firstCard = this.cards[0];
            this.cardWidth = firstCard.offsetWidth + 16; // 16px for gap
        }

        addSwipeSupport() {
            new TouchGestures(this.container);
            this.container.addEventListener('swipeLeft', this.nextCard.bind(this));
            this.container.addEventListener('swipeRight', this.prevCard.bind(this));
        }

        nextCard() {
            if (this.currentIndex < this.cards.length - 1) {
                this.currentIndex++;
                this.updateCarousel();
            }
        }

        prevCard() {
            if (this.currentIndex > 0) {
                this.currentIndex--;
                this.updateCarousel();
            }
        }

        updateCarousel() {
            const translateX = -this.currentIndex * this.cardWidth;
            this.container.style.transform = `translateX(${translateX}px)`;
            this.updateIndicators();
        }

        addIndicators() {
            const indicators = document.createElement('div');
            indicators.className = 'carousel-indicators';
            indicators.innerHTML = this.cards.map((_, i) => 
                `<span class="indicator ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`
            ).join('');

            this.container.parentNode.appendChild(indicators);

            // Add click handlers
            indicators.addEventListener('click', (e) => {
                if (e.target.classList.contains('indicator')) {
                    this.currentIndex = parseInt(e.target.dataset.index);
                    this.updateCarousel();
                }
            });
        }

        updateIndicators() {
            const indicators = this.container.parentNode.querySelectorAll('.carousel-indicators .indicator');
            indicators.forEach((indicator, i) => {
                indicator.classList.toggle('active', i === this.currentIndex);
            });
        }
    }

    // Mobile optimizations initialization
    function initMobileOptimizations() {
        // Initialize touch gestures for tabbed sections
        const tabbedSections = document.querySelectorAll('.tabbed-section');
        tabbedSections.forEach(section => {
            new MobileTabNavigation(section);
        });

        // Initialize card carousels
        const cardContainers = document.querySelectorAll('.apps-grid, .specs-grid');
        cardContainers.forEach(container => {
            new MobileCardCarousel(container);
        });

        // Add mobile-specific classes
        if (window.innerWidth <= 768) {
            document.body.classList.add('mobile-device');
            
            // Add touch-friendly classes to buttons
            const buttons = document.querySelectorAll('.btn, button');
            buttons.forEach(btn => {
                if (btn.offsetHeight < 44) {
                    btn.classList.add('touch-friendly');
                }
            });
        }

        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                // Reinitialize carousels after orientation change
                const carousels = document.querySelectorAll('.apps-grid, .specs-grid');
                carousels.forEach(container => {
                    if (container.carousel) {
                        container.carousel.setupCarousel();
                    }
                });
            }, 100);
        });
    }

    // CSS for mobile optimizations
    const mobileStyles = `
        <style>
        /* Tab indicators */
        .tab-indicators {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: 1rem;
        }

        .tab-indicators .indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #ccc;
            cursor: pointer;
            transition: background 0.3s ease;
        }

        .tab-indicators .indicator.active {
            background: #007bff;
        }

        /* Carousel indicators */
        .carousel-indicators {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: 1rem;
        }

        .carousel-indicators .indicator {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #ccc;
            cursor: pointer;
            transition: background 0.3s ease;
        }

        .carousel-indicators .indicator.active {
            background: #007bff;
        }

        /* Touch-friendly buttons */
        .touch-friendly {
            min-height: 44px !important;
            min-width: 44px !important;
        }

        /* Mobile device specific styles */
        .mobile-device .btn, .mobile-device button {
            min-height: 44px;
            min-width: 44px;
        }

        /* Swipeable containers */
        .swipeable {
            touch-action: pan-x;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
        }

        /* Mobile-optimized cards */
        .mobile-card {
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            margin-bottom: 1rem;
            transition: transform 0.3s ease;
        }

        .mobile-card:active {
            transform: scale(0.98);
        }

        /* Mobile-optimized spacing */
        .mobile-spacing {
            padding: 1rem;
            margin: 0.5rem;
        }

        /* Mobile-optimized text */
        .mobile-text {
            font-size: 1rem;
            line-height: 1.5;
        }

        @media (max-width: 768px) {
            .tab-indicators, .carousel-indicators {
                display: flex;
            }
        }

        @media (min-width: 769px) {
            .tab-indicators, .carousel-indicators {
                display: none;
            }
        }
        </style>
    `;

    // Inject styles
    document.head.insertAdjacentHTML('beforeend', mobileStyles);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileOptimizations);
    } else {
        initMobileOptimizations();
    }

    // Export for global access
    window.MobileOptimizations = {
        TouchGestures,
        MobileTabNavigation,
        MobileCardCarousel,
        init: initMobileOptimizations
    };

})();
