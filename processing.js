// API key should be loaded securely (e.g., from environment variable in production)
const API_KEY = 'your-api-key-here'; // Replace with your actual API key

async function processIdea(details) {
    // Construct the prompt with the new structure
    const prompt = `
You are a professional software engineer and project manager with extensive experience in building scalable applications. Your task is to generate a detailed and actionable **Development Plan Document** for developers, based on the user's app idea and technical preferences. The output should be highly technical, structured, and tailored for a development team, focusing on guiding the development process with clear steps, tools, and methodologies. Do not include market analysis or general industry information, as this document is solely for development purposes.

### Instructions
- Use the user's answers to the following questions to create the document. If the user does not answer a question, use a standard or reasonable solution that aligns with industry best practices and the app idea.
- Ensure each section is detailed with 3-5 sentences, providing specific technical recommendations (e.g., tools, frameworks, protocols).
- Include practical examples where relevant (e.g., code snippets, API endpoints, Git commands).
- Format the output using simple headings without markdown symbols like ##.

### Development Plan Document

App Overview  
(Summarize the app idea and its purpose based on the user's input, focusing on the technical goal in 3-5 sentences.)

Technical Requirements  
(List the recommended tech stack, including preferred programming languages, frameworks, and tools for frontend, backend, and database. Specify versions if relevant, e.g., React 18, Node.js 16.)

Development Methodology  
(Describe the recommended development methodology, e.g., Agile with two-week sprints, and include specific practices like daily stand-ups or Kanban boards.)

Core Features Implementation  
(Numbered list of the 3-5 core features, each with a technical implementation plan, e.g., "Feature 1: User login - Use JWT for authentication, store tokens in localStorage.")

User Workflow with System Interactions  
(Outline the typical user workflow with 5-7 steps, focusing on system interactions, e.g., "Step 1: User opens app - Frontend sends GET /home request to backend.")

Key Features Development  
(Numbered list of the 3-5 most important features, each with a technical approach, e.g., "Feature 1: Real-time chat - Implement WebSocket with Socket.io.")

Data Architecture  
(Describe the data architecture, including database type, schema, and caching strategy, e.g., "Use PostgreSQL with a User table: id (serial), email (varchar).")

API Design  
(List 5-7 API endpoints with their purpose, inputs, and outputs, e.g., "POST /users - Creates a new user, Input: {email, password}, Output: {userId}.")

Integration Strategy  
(Detail how to integrate with external services, if applicable, e.g., "Use Stripe API for payments with REST calls.")

Security Implementation  
(Describe security protocols and tools, e.g., "Implement HTTPS, use OAuth for authentication, encrypt sensitive data with AES-256.")

Notification System  
(Describe the notification system implementation, e.g., "Use Firebase Cloud Messaging for push notifications, triggered by backend events.")

Scalability Strategy  
(Explain scalability approaches, e.g., "Use AWS Elastic Load Balancer to distribute traffic, implement microservices for future growth.")

Performance Optimization  
(List performance optimization techniques, e.g., "Use lazy loading for images, implement a CDN with Cloudflare.")

Error Management  
(Describe error handling strategies, e.g., "Use try-catch for API calls, log errors with Sentry, display user-friendly messages.")

Testing Framework  
(Detail the testing approach, e.g., "Write unit tests with Jest, perform load testing with JMeter.")

Development Workflow  
(Provide a step-by-step workflow for development, e.g., "1. Set up Git repository, 2. Create main and develop branches with GitFlow, 3. Write unit tests before coding features.")

Deployment Strategy  
(Describe the deployment process, e.g., "Deploy to AWS EC2, use GitHub Actions for CI/CD, monitor with Prometheus.")

### User Input
App Idea: ${details.idea}
Topic: ${details.topic}
Platform: ${details.platform}
Details from Questions:
- Q1: What is the basic purpose of your app, and what problem does it solve? ${details.q1 || 'Not provided'}
  - Additional Details: ${details.q1_details || 'None'}
- Q2: How will users interact with your app in a typical scenario (e.g., from opening the app to completing a task)? ${details.q2 || 'Not provided'}
  - Additional Details: ${details.q2_details || 'None'}
- Q3: What are the 3-5 most important features your app must have? ${details.q3 || 'Not provided'}
  - Additional Details: ${details.q3_details || 'None'}
- Q4: What programming languages or frameworks would you prefer for the app’s core functionality? ${details.q4 || 'Not provided'}
  - Additional Details: ${details.q4_details || 'None'}
- Q5: Which development methodology will you use (e.g., Agile, Waterfall, Scrum)? ${details.q5 || 'Not provided'}
  - Additional Details: ${details.q5_details || 'None'}
- Q6: What tech stack or tools do you prefer (e.g., frontend, backend, database)? ${details.q6 || 'Not provided'}
  - Additional Details: ${details.q6_details || 'None'}
- Q7: How will you design the data architecture (e.g., relational database, NoSQL, caching)? ${details.q7 || 'Not provided'}
  - Additional Details: ${details.q7_details || 'None'}
- Q8: What APIs or external services will you integrate, and how? ${details.q8 || 'Not provided'}
  - Additional Details: ${details.q8_details || 'None'}
- Q9: What security protocols or tools will you implement (e.g., OAuth, HTTPS, firewall)? ${details.q9 || 'Not provided'}
  - Additional Details: ${details.q9_details || 'None'}
- Q10: What notification system will you implement (e.g., WebSocket, email server)? ${details.q10 || 'Not provided'}
  - Additional Details: ${details.q10_details || 'None'}
- Q11: What scalability strategy will you use (e.g., load balancing, microservices)? ${details.q11 || 'Not provided'}
  - Additional Details: ${details.q11_details || 'None'}
- Q12: What performance optimization techniques will you apply (e.g., lazy loading, CDN)? ${details.q12 || 'Not provided'}
  - Additional Details: ${details.q12_details || 'None'}
- Q13: What error management strategy will you use (e.g., try-catch, logging)? ${details.q13 || 'Not provided'}
  - Additional Details: ${details.q13_details || 'None'}
- Q14: What testing framework or approach will you use (e.g., Jest, Selenium)? ${details.q14 || 'Not provided'}
  - Additional Details: ${details.q14_details || 'None'}
- Q15: What deployment strategy will you use (e.g., cloud provider, CI/CD tools)? ${details.q15 || 'Not provided'}
  - Additional Details: ${details.q15_details || 'None'}
`;

    try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'grok',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 4000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const result = data.choices[0].message.content;

        // Save the result to localStorage
        localStorage.setItem('apiResult', result);

        // Redirect to result page
        window.location.href = 'result.html';
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while processing your idea. Please try again.');
    }
}