// Vanta.NET Animation - Loaded asynchronously after page load to avoid blocking
(function(){
  'use strict';
  
  // Check if we should load Vanta at all (skip on mobile/reduced motion)
  var isMobile = /Mobi|Android/i.test(navigator.userAgent);
  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  if (isMobile || prefersReduced) {
    // Don't load Vanta on mobile or if user prefers reduced motion
    return;
  }
  
  // Variables for Vanta instance
  var vantaInstance = null;
  var retryCount = 0;
  var maxRetries = 20; // Reduced from 50 - faster timeout
  var resizeTimeout = null;
  var vantaStartTime = null;
  var fadeInTimeout = null;
  var scriptsLoaded = false;
  
  function ensureHeroSectionDimensions() {
    var heroSection = document.querySelector('.hero-section');
    if (!heroSection) return false;
    
    var height = heroSection.offsetHeight;
    var width = heroSection.offsetWidth;
    var computedStyle = window.getComputedStyle(heroSection);
    var minHeight = parseInt(computedStyle.minHeight) || 0;
    
    if (height < 200 || width < 200) {
      if (minHeight > 0 && height < minHeight) {
        heroSection.style.height = minHeight + 'px';
        height = heroSection.offsetHeight;
      }
    }
    
    return height >= 200 && width >= 200;
  }
  
  function showVantaWithFadeIn() {
    var vantaElement = document.getElementById('vanta-net');
    if (vantaElement) {
      var elapsed = Date.now() - vantaStartTime;
      var remaining = Math.max(0, 1000 - elapsed);
      
      fadeInTimeout = setTimeout(function() {
        vantaElement.classList.add('visible');
      }, remaining);
    }
  }
  
  function startVantaNet() {
    if (!scriptsLoaded) {
      // Scripts not loaded yet, retry
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(startVantaNet, 200);
      }
      return;
    }
    
    try {
      var vantaElement = document.getElementById('vanta-net');
      var heroSection = document.querySelector('.hero-section');
      
      if (!vantaElement || !heroSection) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(startVantaNet, 200);
        }
        return;
      }
      
      if (!ensureHeroSectionDimensions()) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(startVantaNet, 200);
        }
        return;
      }
      
      var heroHeight = heroSection.offsetHeight;
      var heroWidth = heroSection.offsetWidth;
      
      vantaElement.style.width = heroWidth + 'px';
      vantaElement.style.height = heroHeight + 'px';
      
      setTimeout(function() {
        var finalHeight = heroSection.offsetHeight;
        var finalWidth = heroSection.offsetWidth;
        
        if (finalHeight < 200 || finalWidth < 200) {
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(startVantaNet, 200);
          }
          return;
        }
        
        if (!vantaStartTime) {
          vantaStartTime = Date.now();
        }
        
        try {
          if (typeof VANTA !== 'undefined' && VANTA.NET) {
            vantaInstance = VANTA.NET({
              el: "#vanta-net",
              mouseControls: true,
              touchControls: true,
              gyroControls: false,
              minHeight: 200.00,
              minWidth: 200.00,
              scale: 1.00,
              scaleMobile: 1.00,
              color: 0xf5f5f5,
              backgroundColor: 0x333333,
              points: 6.00,
              maxDistance: 31.00,
              spacing: 18.00
            });
            
            if (vantaInstance && typeof vantaInstance.resize === 'function') {
              setTimeout(function() {
                vantaInstance.resize();
                showVantaWithFadeIn();
              }, 100);
            } else {
              showVantaWithFadeIn();
            }
          }
        } catch (e) {
          // Vanta.NET initialization error
        }
      }, 50);
    } catch (e) { 
      // Vanta.NET error
    }
  }
  
  function handleResize() {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    resizeTimeout = setTimeout(function() {
      if (vantaInstance && typeof vantaInstance.resize === 'function') {
        var heroSection = document.querySelector('.hero-section');
        var vantaElement = document.getElementById('vanta-net');
        if (heroSection && vantaElement) {
          var heroHeight = heroSection.offsetHeight;
          var heroWidth = heroSection.offsetWidth;
          vantaElement.style.width = heroWidth + 'px';
          vantaElement.style.height = heroHeight + 'px';
          vantaInstance.resize();
        }
      }
    }, 250);
  }
  
  // Load Vanta scripts asynchronously AFTER page load
  function loadVantaScripts() {
    return new Promise(function(resolve, reject) {
      // Load Three.js first
      var threeScript = document.createElement('script');
      threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
      threeScript.async = true;
      threeScript.crossOrigin = 'anonymous';
      
      threeScript.onload = function() {
        // Three.js loaded, now load Vanta
        var vantaScript = document.createElement('script');
        vantaScript.src = 'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.net.min.js';
        vantaScript.async = true;
        vantaScript.crossOrigin = 'anonymous';
        
        vantaScript.onload = function() {
          scriptsLoaded = true;
          resolve();
        };
        
        vantaScript.onerror = function() {
          reject(new Error('Vanta script failed to load'));
        };
        
        document.head.appendChild(vantaScript);
      };
      
      threeScript.onerror = function() {
        reject(new Error('Three.js script failed to load'));
      };
      
      document.head.appendChild(threeScript);
    });
  }
  
  // Load Vanta only when hero section is visible or after user interaction
  var vantaLoaded = false;
  
  function loadVantaOnDemand() {
    if (vantaLoaded) return;
    vantaLoaded = true;
    
    loadVantaScripts().then(function() {
      setTimeout(function() {
        startVantaNet();
      }, 500);
    }).catch(function() {
      // Vanta failed to load
    });
  }
  
  // Load when hero section is visible
  var heroSection = document.querySelector('.hero-section');
  if (heroSection) {
    var observer = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) {
        loadVantaOnDemand();
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    
    observer.observe(heroSection);
  }
  
  // Fallback: Load after 2 seconds if user hasn't scrolled (reduced from 5s for faster loading)
  setTimeout(function() {
    if (!vantaLoaded && document.visibilityState === 'visible') {
      loadVantaOnDemand();
    }
  }, 2000);
  
  // Also load on user interaction
  var interactionEvents = ['click', 'scroll', 'touchstart', 'keydown'];
  var interactionHappened = false;
  interactionEvents.forEach(function(event) {
    document.addEventListener(event, function() {
      if (!interactionHappened && heroSection) {
        interactionHappened = true;
        loadVantaOnDemand();
      }
    }, { once: true });
  });
  
  // Add resize listener
  window.addEventListener('resize', handleResize);
})();
