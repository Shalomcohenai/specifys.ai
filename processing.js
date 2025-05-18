async function generateSpecificationFromProcessingJs() {
  try {
    console.log('Starting generateSpecificationFromProcessingJs');
    const formData = JSON.parse(localStorage.getItem('formData')) || {};
    const idea = formData.idea || 'Not provided';
    const topic = formData.topic || 'Not specified';
    const platform = formData.platform || 'Not specified';
    console.log('Form data:', { idea, topic, platform });

    const answers = JSON.parse(localStorage.getItem('processingAnswers')) || {};
    console.log('Answers:', answers);

    const userInput = `
      1. App Purpose: ${answers[0] || 'Not provided'}
      2. User Workflow: ${answers[1] || 'Not provided'}
      3. Development Preferences: ${answers[2] || 'Not provided'}
      4. Technologies: ${answers[3] || 'Not provided'}
      5. Data Information: ${answers[4] || 'Not provided'}
    `;

    const fullPrompt = `
You are a senior software architect, tech lead, and documentation specialist. Your job is to turn incomplete or rough app ideas into detailed and comprehensive software architecture plans, proactively filling in gaps where the user input is missing or vague. Follow a professional tone and assume standard best practices where relevant.

Output a structured **Architecture Planning Document** in plain text. Each section MUST start on a new line with a clear title followed by a colon (e.g., "App Purpose:") and must appear in the exact order listed below. DO NOT skip any section. DO NOT use Markdown headers.

If user input is missing or incomplete, make educated assumptions based on typical apps of this type. Avoid placeholders like "TBD". Provide complete, usable, high-quality output suitable for immediate use by developers.

Sections to include (in exact order):

- App Purpose: Provide a concise description of the app's goal and at least 5 core features. Include one measurable success metric (e.g., "users will complete 80% of tasks within 30 days"). Focus only on features based on the user input or logical extensions.

- User Workflow: Describe a detailed step-by-step user journey. Include edge cases, alternate flows (e.g., offline mode), and an ASCII flowchart to visualize logic and branches.

- Development Preferences: Specify development methodologies (e.g., Agile, Scrum), environments (e.g., VS Code, Docker), tools (e.g., GitHub, Jira), CI/CD pipeline, and coding conventions.

- Technical Stack: List all languages, frameworks, libraries, services, and at least 3 API or third-party integrations (e.g., Firebase, Stripe, OpenAI). Justify every tech choice (e.g., "React for reusable UI and community support") and specify compatibility versions (e.g., "Node.js 18+").

- Data Architecture: Must include:
  1. **Mermaid.js ERD** with at least 3 entities, proper attributes with data types, primary/foreign keys labeled as PK_ / FK_.
  2. Description of the data flow, caching (e.g., Redis, with time-to-live), performance considerations, and database optimization techniques (e.g., indexes, denormalization).
  3. If user data is missing, suggest logical entities based on the app's purpose.

- File Structure: Include a detailed folder and file hierarchy (in ASCII tree format). Describe the purpose of each folder. Define at least 5 key variables (name, type, purpose) and explain how they relate. Suggest 5+ utility functions with input/output.

- State Management Strategy: Explain how application state is handled (e.g., local state, global store, client-server sync). If applicable, mention tools like Redux, Riverpod, Zustand – or explain custom strategies. Address persistence, consistency, and rollback strategies.

- API Design: List expected API endpoints (name, method, inputs, outputs), authentication requirements, and error handling. If using REST, GraphQL, or gRPC, explain reasoning.

- Security: Define protocols (e.g., HTTPS, OAuth2), password handling (e.g., bcrypt, Argon2), threat models (e.g., XSS, SQL injection), and prevention strategies.

- Notification System: Describe what triggers notifications, what type (push, email, in-app), scheduling logic, and tools used (e.g., Firebase Cloud Messaging, cron jobs).

- Testing Strategy: Explain test types (unit, integration, e2e), tools (e.g., Jest, Cypress), test coverage goals, and CI test integration. Include example scenarios.

- Deployment Strategy: Explain environment setup, hosting solution (e.g., Vercel, AWS), deployment flow (e.g., build → test → release), and rollback plans.

- Version Control & Workflow: Recommend Git branching strategy (e.g., Git Flow, trunk-based), commit conventions, pull request process, and review rules.

- Accessibility & Internationalization: Mention how to handle screen reader support, color contrast, tab ordering, and multilingual content (e.g., using JSON translation files).

- Bash Script: Provide a bash script that sets up the suggested file structure with correct folders and starter files.

- Additional Notes: Add any recommendations, technical caveats, potential risks, or ideas that could help developers build the app better.

Your response should be fully detailed and use the **maximum token length possible**. Expand deeply on every section. If the response is cut off, continue from where you left off without summarizing. Include ALL sections regardless of how minimal the user input is.

### User Input
${userInput}
`;


    console.log('Full prompt constructed:', fullPrompt);
    console.log('Prompt length (characters):', fullPrompt.length);
    console.log('Sending request with prompt:', fullPrompt);
    const response = await fetch('https://worker1.shalom-cohen-111.workers.dev', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: fullPrompt }),
    });

    console.log('API response status received:', response.status);
    const data = await response.json();
    console.log('API response data received:', data);

    if (!response.ok) {
      throw new Error(`API Error: ${data.error || 'Unknown error'}`);
    }

    const generatedContent = data.specification || 'No specification generated';
    console.log('Generated content extracted:', generatedContent);

    console.log('Saving generated content to localStorage');
    localStorage.setItem('generatedContent', generatedContent);

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