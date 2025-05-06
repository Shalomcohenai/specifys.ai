import { jsPDF } from './jspdf.min.js';

async function generateSpecificationFromProcessingJs() {
  try {
    console.log('Starting generateSpecificationFromProcessingJs');
    // Retrieve form data from localStorage
    const formData = JSON.parse(localStorage.getItem('formData')) || {};
    const idea = formData.idea || 'Not provided';
    const topic = formData.topic || 'Not specified';
    const platform = formData.platform || 'Not specified';
    console.log('Form data:', { idea, topic, platform });

    // Retrieve answers from localStorage
    const answers = JSON.parse(localStorage.getItem('processingAnswers')) || {};
    console.log('Answers:', answers);
    let details = '';
    const steps = [
      { name: 'User Workflow', question: 'Describe the typical workflow of a user using your app.' },
      { name: 'Design', question: 'What design elements are most important for your app?' },
      { name: 'Features', question: 'What key features do you want your app to have?' },
      { name: 'Target Audience', question: 'Who is your target audience?' },
      { name: 'Technical Requirements', question: 'What technical requirements does your app need?' },
      { name: 'Integrations', question: 'What integrations should your app support?', type: 'yesno' },
      { name: 'Monetization', question: 'How do you plan to monetize your app?', type: 'yesno' },
      { name: 'Notifications', question: 'What notifications should your app send?', type: 'yesno' },
      { name: 'Authentication', question: 'What authentication methods will your app use?', type: 'yesno' },
    ];

    steps.forEach((step, index) => {
      const response = answers[index] || 'Not provided';
      if (step.type === 'yesno') {
        const enabled = response.toLowerCase().includes('yes');
        details += `${step.question}: ${enabled ? 'Yes' : 'No'}\n`;
        if (enabled) {
          details += `${step.name}: ${response}\n`;
        }
      } else {
        details += `${step.name}: ${response}\n`;
      }
    });

    const fullPrompt = `You are a professional product manager and UX architect.

Your task is to generate a clear, structured **Application Specification Document** based on a short description of an app idea.

The output should follow this markdown structure:

# Application Specification Document

## General Information
**Topic**:  
**Platform**:  
**Title**:  
**General Idea**:  

## Problem Statement  
(Describe the main problem the app solves.)

## Core Features  
(Numbered list of the main features.)

## User Flow  
(Simple step-by-step flow from onboarding to final use.)

## Screens  
(List of all major screens.)

## UI Components per Screen  
### [Screen Name]  
- (UI elements for each screen)

## Navigation Map  
(Which screen links to which)

## Data Models  
1. **[Model Name]**  
- Fields: …

## API Requirements / Storage Logic  
(Brief explanation of backend needs, storage, and authentication.)

## Offline Mode
- What data is available offline and how it syncs when back online.

## User Scenarios  
1. **Scenario Name**  
- Description

## Visual Guidelines / Style Tokens  
(Colors, layout, icons, visual feel.)

## Design Guidelines  
(UX principles and interaction style.)

## Technical Requirements  
(Platform, tools, frameworks.)

## User Roles and Permissions  
(Who uses the app and what they can access.)

## Notifications  
(Types of notifications and when they appear.)

## Monetization Plan  
(Optional)

## Legal Requirements  
(Privacy and compliance)

## Roadmap & Phases  
1. Phase 1  
2. Phase 2  
3. Phase 3

## Appendix  
- (Wireframes, competitor insights, optional features)

Now, based on this structure, generate a full application specification document for the following app idea:

**App Idea Details:**
Topic: ${topic}
Platform: ${platform}
General Idea: ${idea}
Details:
${details}`;
    console.log('Full prompt:', fullPrompt);

    // Call the local server instead of the OpenAI API directly
    console.log('Making API call to local server: http://localhost:3000/generate-spec');
    const response = await fetch('https://worker1.shalom-cohen-111.workers.dev/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: fullPrompt }),
    });

    console.log('API response status:', response.status);
    const data = await response.json();
    console.log('API response data:', data);

    if (!response.ok) {
      throw new Error(`API Error: ${data.error?.message || 'Unknown error'}`);
    }

    // OpenAI response is processed by the server, so use the content directly
    const generatedContent = data || 'No specification generated';
    console.log('Generated content:', generatedContent);

    // Save to localStorage without generating PDF here
    console.log('Saving generated content to localStorage');
    localStorage.setItem('generatedContent', generatedContent);

    // Show confetti if available
    if (typeof confetti === 'function') {
      console.log('Triggering confetti');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    console.log('Redirecting to result.html immediately');
    window.location.href = 'result.html';
  } catch (err) {
    console.error('Error in generateSpecificationFromProcessingJs:', err.message);
    alert('Failed to generate specification: ' + err.message);
    const generateSpecButton = document.getElementById('generateSpecButton');
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (generateSpecButton) generateSpecButton.disabled = false;
    if (loadingSpinner) loadingSpinner.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('processing.js loaded, setting generateSpecificationOriginal');
  window.generateSpecificationOriginal = generateSpecificationFromProcessingJs;
});
