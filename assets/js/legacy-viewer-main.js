// Legacy Viewer Main JavaScript
let mermaidInitialized = false;

function waitForLibraries() {
    return new Promise((resolve) => {
        const checkLibraries = () => {
            if (typeof mermaid !== 'undefined' && typeof marked !== 'undefined') {
                if (!mermaidInitialized) {
                    mermaid.initialize({ 
                        startOnLoad: false,
                        theme: 'default'
                    });
                    mermaidInitialized = true;
                }
                resolve();
            } else {
                setTimeout(checkLibraries, 100);
            }
        };
        checkLibraries();
    });
}

async function loadDemoContent() {
    try {
        await waitForLibraries();
        
        const urlParams = new URLSearchParams(window.location.search);
        const specId = urlParams.get('id');
        
        if (!specId) {
            showError('specificationContent', 'No specification ID provided');
            return;
        }
        
        const user = firebase.auth().currentUser;
        if (!user) {
            showError('specificationContent', 'Authentication required to view specifications');
            return;
        }
        
        const doc = await firebase.firestore().collection('specs').doc(specId).get();
        
        if (!doc.exists) {
            showError('specificationContent', 'Specification not found');
            return;
        }
        
        const specData = doc.data();
        
        if (specData.userId !== user.uid) {
            showError('specificationContent', 'You do not have permission to view this specification');
            return;
        }
        
        let content = '';
        
        if (specData.content) {
            content = specData.content;
        } else if (specData.overview) {
            content = JSON.stringify(specData.overview, null, 2);
        } else {
            content = JSON.stringify(specData, null, 2);
        }
        
        displayContent('specificationContent', content);
        document.title = `${specData.title || 'Legacy Specification'} - Specifys.ai`;
        
    } catch (error) {
        showError('specificationContent', 'Failed to load specification: ' + error.message);
    }
}

function displayContent(containerId, content) {
    const container = document.getElementById(containerId);
    
    if (!content) {
        showError(containerId, 'No content available');
        return;
    }
    
    const htmlContent = marked.parse(content);
    const contentDiv = document.createElement('div');
    contentDiv.className = 'demo-content';
    contentDiv.innerHTML = htmlContent;
    
    container.innerHTML = '';
    container.appendChild(contentDiv);
    
    const mermaidElements = contentDiv.querySelectorAll('.mermaid, pre code');
    mermaidElements.forEach((element) => {
        const text = element.textContent.trim();
        if (text.startsWith('flowchart') || text.startsWith('graph') || text.startsWith('sequenceDiagram') || 
            text.startsWith('classDiagram') || text.startsWith('stateDiagram') || text.startsWith('erDiagram') ||
            text.startsWith('journey') || text.startsWith('gantt') || text.startsWith('pie') || text.startsWith('gitgraph')) {
            
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.textContent = text;
            
            if (element.tagName === 'CODE' && element.parentNode.tagName === 'PRE') {
                element.parentNode.replaceWith(mermaidDiv);
            } else {
                element.replaceWith(mermaidDiv);
            }
        }
    });
    
    if (typeof mermaid !== 'undefined' && mermaidInitialized) {
        mermaid.init(undefined, contentDiv.querySelectorAll('.mermaid'));
    }
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="loading-content">
            <i class="fas fa-exclamation-triangle"></i>
            ${message}
        </div>
    `;
}

function updateAuthUI(user) {
    const authButtons = document.getElementById('auth-buttons');
    if (!authButtons) return;
    
    if (user) {
        const displayName = user.displayName || user.email.split('@')[0];
        const firstLetter = displayName.charAt(0).toUpperCase();
        
        authButtons.innerHTML = `
            <a href="/pages/profile.html" class="user-info no-underline">
                <div class="user-avatar">${firstLetter}</div>
                <span>${displayName}</span>
            </a>
        `;
    } else {
        authButtons.innerHTML = `
            <button class="auth-btn" onclick="window.location.href='/pages/auth.html'">Log in/Sign up</button>
        `;
    }
}

// Initialize when libraries are loaded
document.addEventListener('DOMContentLoaded', function() {
    window.LibraryLoader.loadLibraries(['mermaid', 'marked']).then(function() {
        // Libraries loaded for legacy viewer
        // Wait for libraries before initializing
        if (typeof loadDemoContent === 'function') {
            loadDemoContent();
        }
    }).catch(function(error) {
        // Failed to load libraries
    });
});

// Auth state change handler
auth.onAuthStateChanged((user) => {
    updateAuthUI(user);
    if (user) {
        loadDemoContent();
    }
});
