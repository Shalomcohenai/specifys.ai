// Processing page for V2 specification generation
// This file handles the user input collection and redirects to spec-raw.html

console.log('🚀 Processing V2 Simple - Starting...');

// Get form elements
const form = document.getElementById('specForm');
const submitBtn = document.getElementById('submitBtn');
const loadingDiv = document.getElementById('loading');

// Form validation
function validateForm() {
    const inputs = form.querySelectorAll('input[required], textarea[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            isValid = false;
            input.classList.add('error');
        } else {
            input.classList.remove('error');
        }
    });
    
    return isValid;
}

// Handle form submission
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!validateForm()) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating...';
    loadingDiv.style.display = 'block';
    
    try {
        // Collect answers
        const answers = {};
        const inputs = form.querySelectorAll('input, textarea');
        
        inputs.forEach((input, index) => {
            if (input.value.trim()) {
                answers[index] = input.value.trim();
            }
        });
        
        console.log('📝 Collected answers:', answers);
        
        // Store answers in localStorage for debugging
        localStorage.setItem('specAnswers', JSON.stringify(answers));
        
        // Redirect immediately to spec-viewer page where generation will happen
        setTimeout(() => {
            window.location.href = `/pages/spec-viewer.html?status=generating`;
        }, 500);
        
    } catch (error) {
        console.error('❌ Error processing form:', error);
        alert('Error processing form. Please try again.');
        
        // Reset form state
        submitBtn.disabled = false;
        submitBtn.textContent = 'Generate Specification';
        loadingDiv.style.display = 'none';
    }
});

// Add some basic styling for errors
const style = document.createElement('style');
style.textContent = `
    .error {
        border-color: #dc3545 !important;
        box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25) !important;
    }
    
    #loading {
        display: none;
        text-align: center;
        padding: 20px;
        background-color: #f8f9fa;
        border-radius: 8px;
        margin-top: 20px;
    }
    
    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 10px;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

console.log('✅ Processing V2 Simple - Ready!');
