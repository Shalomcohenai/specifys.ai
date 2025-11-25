// Script to create sample Academy data
// Run with: node backend/scripts/create-academy-sample-data.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize Firebase Admin
const { db } = require('../server/firebase-admin');

async function createSampleData() {
  try {
    console.log('Creating sample Academy data...');

    // Create Security category
    const securityCategoryRef = await db.collection('academy_categories').add({
      title: 'Security',
      icon: 'lock',
      description: 'Learn how modern apps stay secure without writing code.',
      createdAt: new Date().toISOString()
    });
    console.log('Created Security category:', securityCategoryRef.id);

    // Create App Structure category
    const appStructureCategoryRef = await db.collection('academy_categories').add({
      title: 'App Structure',
      icon: 'layers',
      description: 'Understand how an AI-generated app is built behind the scenes.',
      createdAt: new Date().toISOString()
    });
    console.log('Created App Structure category:', appStructureCategoryRef.id);

    // Create sample guide in Security category
    const securityGuideRef = await db.collection('academy_guides').add({
      category: securityCategoryRef.id,
      title: 'Understanding Backend vs Frontend (For Vibe Coders)',
      level: 'Beginner',
      whatYouLearn: [
        'What happens behind the scenes when a user clicks a button',
        'How frontend and backend communicate',
        'What logic lives where'
      ],
      content: `
        <h2>Introduction</h2>
        <p>When you're building apps with AI tools like Specifys.ai, it helps to understand the basic structure of how apps work. Even if you're not writing code yourself, knowing the difference between frontend and backend will help you communicate better with AI tools and understand what's happening behind the scenes.</p>
        
        <p>This guide is designed for "vibe coders" - people who want to build apps without diving deep into technical details. We'll explain everything in simple terms.</p>
        
        <h2>What is the Frontend?</h2>
        <p>The frontend is everything the user sees and interacts with. Think of it as the "face" of your app - it's what users experience directly when they open your app in their browser or on their phone.</p>
        
        <p>This includes:</p>
        <ul>
          <li><strong>User Interface (UI):</strong> The buttons you click, forms you fill out, menus you navigate</li>
          <li><strong>Visual Design:</strong> The colors, fonts, spacing, and overall look and feel</li>
          <li><strong>User Experience (UX):</strong> How users interact with your app - the flow from one screen to another</li>
          <li><strong>Client-Side Logic:</strong> Simple validations, animations, and immediate feedback</li>
        </ul>
        
        <p>When you use Specifys.ai to generate a spec, the frontend is what you see in your browser - the forms, buttons, and the generated specification document.</p>
        
        <h2>What is the Backend?</h2>
        <p>The backend is the "brain" of your app. Users never see it directly, but it's working behind the scenes to make everything function. It's like the engine of a car - you don't see it, but without it, nothing works.</p>
        
        <p>The backend handles:</p>
        <ul>
          <li><strong>Business Logic:</strong> Complex calculations, decision-making, and rules that govern how your app works</li>
          <li><strong>Database Operations:</strong> Storing user data, retrieving information, managing relationships between data</li>
          <li><strong>Authentication & Security:</strong> Verifying who users are, protecting sensitive data, managing permissions</li>
          <li><strong>API Endpoints:</strong> Specific URLs that the frontend can call to request data or perform actions</li>
          <li><strong>Third-Party Integrations:</strong> Connecting to external services like payment processors, email services, etc.</li>
        </ul>
        
        <p>In Specifys.ai, the backend is what processes your input, generates the specification using AI, stores your specs, and manages your account.</p>
        
        <h2>How They Work Together</h2>
        <p>Here's a simple example of how frontend and backend work together:</p>
        
        <ol>
          <li><strong>User Action:</strong> You click a "Generate Spec" button on the frontend</li>
          <li><strong>Request Sent:</strong> The frontend sends a request to the backend API (like a waiter taking your order)</li>
          <li><strong>Backend Processing:</strong> The backend receives your request, validates it, processes it (maybe calls an AI service), and stores the result</li>
          <li><strong>Response Sent:</strong> The backend sends back a response with the generated spec (like the waiter bringing your food)</li>
          <li><strong>Frontend Update:</strong> The frontend receives the response and updates what you see on screen</li>
        </ol>
        
        <p>This all happens in milliseconds, so it feels instant to you!</p>
        
        <h2>Real-World Analogy</h2>
        <p>Think of a restaurant:</p>
        <ul>
          <li><strong>Frontend = Dining Room:</strong> Where you sit, see the menu, place your order, and receive your food</li>
          <li><strong>Backend = Kitchen:</strong> Where the chefs prepare your food, manage inventory, and coordinate everything</li>
        </ul>
        <p>You interact with the dining room (frontend), but the real work happens in the kitchen (backend).</p>
        
        <h2>Why This Matters for Vibe Coders</h2>
        <p>Understanding this separation helps you:</p>
        <ul>
          <li><strong>Communicate Better:</strong> When describing your app idea, you can specify what users see (frontend) vs. what happens behind the scenes (backend)</li>
          <li><strong>Make Better Decisions:</strong> You'll understand why some features take longer to build (they require backend work)</li>
          <li><strong>Use AI Tools More Effectively:</strong> You can ask AI tools to generate frontend components or backend logic separately</li>
          <li><strong>Plan Your App:</strong> You can think about your app in two parts - what users experience and what makes it work</li>
        </ul>
        
        <h2>Common Frontend Technologies</h2>
        <p>You might hear these terms when building apps:</p>
        <ul>
          <li><strong>HTML:</strong> The structure of your pages (like the skeleton)</li>
          <li><strong>CSS:</strong> The styling and design (like the clothes and makeup)</li>
          <li><strong>JavaScript:</strong> The interactivity (like the ability to move and respond)</li>
          <li><strong>React/Vue/Angular:</strong> Modern frameworks that make building frontends easier</li>
        </ul>
        
        <h2>Common Backend Technologies</h2>
        <p>Backend technologies you might encounter:</p>
        <ul>
          <li><strong>Node.js/Python/Java:</strong> Programming languages used to write backend logic</li>
          <li><strong>Databases:</strong> Systems that store data (like Firebase, PostgreSQL, MongoDB)</li>
          <li><strong>APIs:</strong> The endpoints that frontend calls to get data or perform actions</li>
          <li><strong>Cloud Services:</strong> Services like Firebase, AWS, or Google Cloud that host your backend</li>
        </ul>
        
        <h2>Conclusion</h2>
        <p>Remember: Frontend = what users see and interact with. Backend = the logic and data that make everything work. They work together seamlessly to create the apps you use every day.</p>
        
        <p>As a vibe coder, you don't need to master these technologies, but understanding this basic concept will make you a better app planner and help you communicate your ideas more effectively!</p>
      `,
      summary: 'Frontend = what user sees. Backend = logic + data. They work together to create a complete app experience.',
      questions: [
        {
          q: 'What is the backend mainly responsible for?',
          answers: ['Design', 'Business logic & data', 'Animations', 'Colors'],
          correctIndex: 1
        },
        {
          q: 'Which layer talks to the database?',
          answers: ['Frontend', 'Backend', 'CSS', 'Icons'],
          correctIndex: 1
        }
      ],
      createdAt: new Date().toISOString()
    });
    console.log('Created Security guide:', securityGuideRef.id);

    // Create sample guide in App Structure category
    const appStructureGuideRef = await db.collection('academy_guides').add({
      category: appStructureCategoryRef.id,
      title: 'Understanding API Endpoints',
      level: 'Intermediate',
      whatYouLearn: [
        'What API endpoints are and why they matter',
        'How frontend and backend communicate through APIs',
        'Common API patterns you\'ll encounter'
      ],
      content: `
        <h2>What is an API?</h2>
        <p>API stands for <strong>Application Programming Interface</strong>. Think of it as a contract or a menu between the frontend and backend that defines how they can communicate.</p>
        
        <p>Just like a restaurant menu tells you what dishes are available and how to order them, an API tells your frontend what data and actions are available and how to request them.</p>
        
        <h2>What are Endpoints?</h2>
        <p>An endpoint is a specific URL that the frontend can call to request data or perform an action. Each endpoint is like a specific dish on the menu - it has a name, ingredients (parameters), and returns a specific result.</p>
        
        <p>Here are some common examples:</p>
        <ul>
          <li><code>GET /api/users</code> - Get a list of users (like asking for the menu)</li>
          <li><code>POST /api/login</code> - Log in a user (like placing an order)</li>
          <li><code>PUT /api/profile</code> - Update user profile (like modifying your order)</li>
          <li><code>DELETE /api/specs/123</code> - Delete a specific spec (like canceling an order)</li>
        </ul>
        
        <h2>HTTP Methods Explained</h2>
        <p>You'll notice words like GET, POST, PUT, DELETE - these are HTTP methods that tell the backend what kind of action you want to perform:</p>
        <ul>
          <li><strong>GET:</strong> "Give me information" - retrieving data without changing anything</li>
          <li><strong>POST:</strong> "Create something new" - like creating a new user account or spec</li>
          <li><strong>PUT:</strong> "Update something" - modifying existing data</li>
          <li><strong>DELETE:</strong> "Remove something" - deleting data</li>
        </ul>
        
        <h2>How It Works: Step by Step</h2>
        <p>Let's trace through a real example - when you view your specs in Specifys.ai:</p>
        
        <ol>
          <li><strong>User Action:</strong> You click "My Specs" in the frontend</li>
          <li><strong>Frontend Request:</strong> The frontend makes a GET request to <code>/api/specs</code></li>
          <li><strong>Backend Processing:</strong> The backend receives the request, checks if you're logged in, queries the database for your specs</li>
          <li><strong>Backend Response:</strong> The backend sends back a JSON response with your specs data:
            <pre><code>{
  "specs": [
    { "id": "123", "title": "My App", "createdAt": "2025-01-01" },
    { "id": "456", "title": "Another App", "createdAt": "2025-01-02" }
  ]
}</code></pre>
          </li>
          <li><strong>Frontend Update:</strong> The frontend receives this data and displays it as a list of specs on your screen</li>
        </ol>
        
        <h2>JSON Format</h2>
        <p>API responses are usually in JSON (JavaScript Object Notation) format. It's a way to structure data that both humans and computers can read. Think of it like a well-organized spreadsheet:</p>
        
        <pre><code>{
  "name": "John Doe",
  "email": "john@example.com",
  "specs": [
    { "title": "My App", "status": "draft" },
    { "title": "Another App", "status": "published" }
  ]
}</code></pre>
        
        <h2>Why APIs Matter</h2>
        <p>APIs are crucial because they:</p>
        <ul>
          <li><strong>Separate Concerns:</strong> Frontend and backend can be developed independently</li>
          <li><strong>Enable Reusability:</strong> The same API can be used by web apps, mobile apps, or other services</li>
          <li><strong>Provide Security:</strong> Backend can control what data is exposed and who can access it</li>
          <li><strong>Allow Scaling:</strong> Backend can be upgraded or changed without breaking the frontend</li>
        </ul>
        
        <h2>Real-World API Examples</h2>
        <p>You use APIs every day without realizing it:</p>
        <ul>
          <li><strong>Weather Apps:</strong> They call weather APIs to get current conditions</li>
          <li><strong>Social Media:</strong> When you scroll your feed, the app calls APIs to load new posts</li>
          <li><strong>Maps:</strong> Google Maps uses APIs to get location data and directions</li>
          <li><strong>Specifys.ai:</strong> When you generate a spec, the frontend calls backend APIs that use AI services</li>
        </ul>
        
        <h2>API Authentication</h2>
        <p>Many APIs require authentication - proving who you are. This is usually done with:</p>
        <ul>
          <li><strong>API Keys:</strong> A secret code that identifies your app</li>
          <li><strong>Tokens:</strong> Temporary credentials (like a day pass) that expire after a while</li>
          <li><strong>OAuth:</strong> A secure way to let users log in with their existing accounts (like "Sign in with Google")</li>
        </ul>
        
        <p>In Specifys.ai, when you log in, you get a token that proves you're authenticated. Every API request includes this token so the backend knows it's really you.</p>
        
        <h2>Common API Patterns</h2>
        <p>Most APIs follow similar patterns:</p>
        <ul>
          <li><strong>RESTful APIs:</strong> Use standard HTTP methods and URLs (most common)</li>
          <li><strong>GraphQL:</strong> A newer approach that lets you request exactly the data you need</li>
          <li><strong>WebSockets:</strong> For real-time communication (like chat apps)</li>
        </ul>
        
        <h2>Error Handling</h2>
        <p>APIs can return errors, and good APIs tell you what went wrong:</p>
        <ul>
          <li><strong>400 Bad Request:</strong> You sent invalid data</li>
          <li><strong>401 Unauthorized:</strong> You need to log in</li>
          <li><strong>403 Forbidden:</strong> You're logged in but don't have permission</li>
          <li><strong>404 Not Found:</strong> The resource doesn't exist</li>
          <li><strong>500 Server Error:</strong> Something went wrong on the backend</li>
        </ul>
        
        <h2>Conclusion</h2>
        <p>APIs are the communication layer that makes modern apps possible. They allow frontend and backend to work together seamlessly, even when they're built with different technologies or hosted in different places.</p>
        
        <p>As a vibe coder, you don't need to build APIs yourself, but understanding how they work will help you:</p>
        <ul>
          <li>Understand why some features take time to implement</li>
          <li>Communicate better with developers or AI tools</li>
          <li>Plan your app's features more effectively</li>
          <li>Understand error messages when something goes wrong</li>
        </ul>
        
        <p>Remember: APIs are like waiters in a restaurant - they take your order (request), bring it to the kitchen (backend), and bring back your food (response). Simple, but essential!</p>
      `,
      summary: 'APIs are the communication layer between frontend and backend. Endpoints are specific URLs that define what actions can be performed.',
      questions: [
        {
          q: 'What does API stand for?',
          answers: ['Application Programming Interface', 'Automated Process Integration', 'Advanced Protocol Interface', 'Application Process Interface'],
          correctIndex: 0
        },
        {
          q: 'What format do API responses typically use?',
          answers: ['HTML', 'JSON', 'CSS', 'JavaScript'],
          correctIndex: 1
        }
      ],
      createdAt: new Date().toISOString()
    });
    console.log('Created App Structure guide:', appStructureGuideRef.id);

    console.log('\n✅ Sample data created successfully!');
    console.log('\nCategories created:');
    console.log('- Security:', securityCategoryRef.id);
    console.log('- App Structure:', appStructureCategoryRef.id);
    console.log('\nGuides created:');
    console.log('- Security guide:', securityGuideRef.id);
    console.log('- App Structure guide:', appStructureGuideRef.id);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating sample data:', error);
    process.exit(1);
  }
}

createSampleData();

