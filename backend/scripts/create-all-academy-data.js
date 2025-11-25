// Script to create all Academy categories and guides
// Run with: node backend/scripts/create-all-academy-data.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize Firebase Admin
const { db } = require('../server/firebase-admin');

const categories = [
  {
    title: 'Security',
    icon: 'lock',
    description: 'Learn how modern apps stay secure without writing code.',
    guides: [
      { title: 'App Security Basics', level: 'Beginner' },
      { title: 'API Security', level: 'Intermediate' },
      { title: 'Authentication & Authorization', level: 'Intermediate' },
      { title: 'Database Security', level: 'Intermediate' },
      { title: 'Cloud Security (Cloudflare, WAF)', level: 'Advanced' },
      { title: 'Secure Storage & Secrets', level: 'Intermediate' },
      { title: 'OWASP for Non-Coders', level: 'Intermediate' },
      { title: 'Security Testing (conceptual)', level: 'Advanced' }
    ]
  },
  {
    title: 'App Structure',
    icon: 'layers',
    description: 'Understand how an AI-generated app is built behind the scenes.',
    guides: [
      { title: 'Frontend vs Backend', level: 'Beginner' },
      { title: 'Client–Server Model', level: 'Beginner' },
      { title: 'Architecture Basics (Monolith / Microservices)', level: 'Intermediate' },
      { title: 'What is a Database Layer', level: 'Beginner' },
      { title: 'What is a Service Layer', level: 'Intermediate' },
      { title: 'What is an API Layer', level: 'Intermediate' },
      { title: 'State (Client / Server)', level: 'Intermediate' },
      { title: 'Request–Response Lifecycle', level: 'Intermediate' }
    ]
  },
  {
    title: 'DevOps & Deployment',
    icon: 'cogs',
    description: 'Learn how apps are deployed and maintained in production.',
    guides: [
      { title: 'What DevOps Really Does', level: 'Beginner' },
      { title: 'CI/CD Basics', level: 'Intermediate' },
      { title: 'Environment Types (Dev/Stage/Prod)', level: 'Beginner' },
      { title: 'Monitoring & Logs', level: 'Intermediate' },
      { title: 'How Deployments Work', level: 'Intermediate' },
      { title: 'Versioning & Rollbacks', level: 'Intermediate' },
      { title: 'Cloud Providers Overview', level: 'Beginner' },
      { title: 'How Apps Scale', level: 'Advanced' }
    ]
  },
  {
    title: 'SEO & Growth',
    icon: 'chart-line-up',
    description: 'Master SEO and growth strategies for your app.',
    guides: [
      { title: 'SEO Basics', level: 'Beginner' },
      { title: 'How Search Engines Work', level: 'Beginner' },
      { title: 'Keyword Research', level: 'Beginner' },
      { title: 'Page Structure & Metadata', level: 'Beginner' },
      { title: 'Technical SEO', level: 'Intermediate' },
      { title: 'Page Speed & Performance', level: 'Intermediate' },
      { title: 'Content Clusters & Internal Linking', level: 'Intermediate' },
      { title: 'AI-Driven SEO Practices', level: 'Intermediate' }
    ]
  },
  {
    title: 'Prompt Engineering',
    icon: 'brain',
    description: 'Master the art of communicating with AI effectively.',
    guides: [
      { title: 'Prompt Basics', level: 'Beginner' },
      { title: 'Roles (System, User, Assistant)', level: 'Beginner' },
      { title: 'Multi-Step Prompt Thinking', level: 'Intermediate' },
      { title: 'Refining AI Output', level: 'Intermediate' },
      { title: 'Testing AI Responses', level: 'Intermediate' },
      { title: 'Avoiding Hallucinations', level: 'Intermediate' },
      { title: 'Understanding Model Limitations', level: 'Intermediate' },
      { title: 'Architecture Prompts (conceptual)', level: 'Advanced' }
    ]
  },
  {
    title: 'AI Feature Development',
    icon: 'robot',
    description: 'Learn how to work with AI to build features effectively.',
    guides: [
      { title: 'How AI Creates Code', level: 'Beginner' },
      { title: 'How to Describe a Feature Clearly', level: 'Beginner' },
      { title: 'Flow-Based Thinking', level: 'Intermediate' },
      { title: 'Feature Breakdown Structure', level: 'Intermediate' },
      { title: 'Testing Features with AI', level: 'Intermediate' },
      { title: 'Reviewing AI-Generated Code (conceptually)', level: 'Intermediate' },
      { title: 'How AI Builds Components', level: 'Intermediate' },
      { title: 'How AI Handles Errors', level: 'Intermediate' }
    ]
  },
  {
    title: 'Databases',
    icon: 'database',
    description: 'Understand how data is stored and managed in apps.',
    guides: [
      { title: 'What is a Database', level: 'Beginner' },
      { title: 'Tables, Columns, Rows (conceptual)', level: 'Beginner' },
      { title: 'Relations (1-1, 1-N, N-N)', level: 'Intermediate' },
      { title: 'Indexes (simple explanation)', level: 'Intermediate' },
      { title: 'Query Lifecycle', level: 'Intermediate' },
      { title: 'What is a Transaction', level: 'Intermediate' },
      { title: 'Database Errors (conceptual)', level: 'Intermediate' },
      { title: 'Backups & Restore', level: 'Intermediate' }
    ]
  },
  {
    title: 'Cloud & Hosting',
    icon: 'cloud',
    description: 'Learn about cloud infrastructure and hosting.',
    guides: [
      { title: 'What is the Cloud', level: 'Beginner' },
      { title: 'What is Serverless', level: 'Intermediate' },
      { title: 'CDNs Explained', level: 'Beginner' },
      { title: 'Edge Functions', level: 'Intermediate' },
      { title: 'Rate Limiting', level: 'Intermediate' },
      { title: 'Caching Basics', level: 'Beginner' },
      { title: 'DNS & Domains', level: 'Beginner' },
      { title: 'How Websites Load', level: 'Beginner' }
    ]
  },
  {
    title: 'API Design & Communication',
    icon: 'plug',
    description: 'Master API design and communication patterns.',
    guides: [
      { title: 'What is an API', level: 'Beginner' },
      { title: 'REST Basics', level: 'Beginner' },
      { title: 'Endpoints & Routes', level: 'Beginner' },
      { title: 'HTTP Methods (GET/POST/PATCH…)', level: 'Beginner' },
      { title: 'Errors & Status Codes', level: 'Intermediate' },
      { title: 'Request/Response Structure', level: 'Intermediate' },
      { title: 'Headers & Cookies', level: 'Intermediate' },
      { title: 'Webhooks (conceptual)', level: 'Intermediate' }
    ]
  },
  {
    title: 'UI/UX Foundations',
    icon: 'palette',
    description: 'Learn the fundamentals of user interface and experience design.',
    guides: [
      { title: 'Basic UX Principles', level: 'Beginner' },
      { title: 'Layout Systems', level: 'Beginner' },
      { title: 'User Flows', level: 'Beginner' },
      { title: 'Accessibility Basics', level: 'Beginner' },
      { title: 'Color & Typography', level: 'Beginner' },
      { title: 'Mobile vs Desktop UX', level: 'Beginner' },
      { title: 'Component Thinking', level: 'Intermediate' },
      { title: 'Reducing Cognitive Load', level: 'Intermediate' }
    ]
  },
  {
    title: 'Software Fundamentals (For Non-Coders)',
    icon: 'code',
    description: 'Essential software concepts explained for non-technical people.',
    guides: [
      { title: 'What is Code (conceptually)', level: 'Beginner' },
      { title: 'What is Version Control', level: 'Beginner' },
      { title: 'What is a Repository', level: 'Beginner' },
      { title: 'What is a Build', level: 'Beginner' },
      { title: 'What is a Package', level: 'Beginner' },
      { title: 'What is an Error', level: 'Beginner' },
      { title: 'What is Runtime vs Compile Time', level: 'Intermediate' },
      { title: 'What is a Library & Framework', level: 'Intermediate' }
    ]
  },
  {
    title: 'Data & Analytics',
    icon: 'chart-column',
    description: 'Understand how to measure and analyze app performance.',
    guides: [
      { title: 'What is Analytics', level: 'Beginner' },
      { title: 'Events & Tracking', level: 'Beginner' },
      { title: 'Funnels', level: 'Intermediate' },
      { title: 'User Behavior Analysis', level: 'Intermediate' },
      { title: 'Dashboards', level: 'Beginner' },
      { title: 'Conversion Basics', level: 'Beginner' },
      { title: 'Retention', level: 'Intermediate' },
      { title: 'Cohorts', level: 'Intermediate' }
    ]
  },
  {
    title: 'System Thinking',
    icon: 'sitemap',
    description: 'Learn to think systematically about complex technical systems.',
    guides: [
      { title: 'Breaking Problems into Parts', level: 'Beginner' },
      { title: 'Flows & Diagrams', level: 'Beginner' },
      { title: 'Understanding Dependencies', level: 'Intermediate' },
      { title: 'Inputs & Outputs', level: 'Beginner' },
      { title: 'Mapping Data Flow', level: 'Intermediate' },
      { title: 'Identifying Bottlenecks', level: 'Intermediate' },
      { title: 'How Systems Fail', level: 'Intermediate' },
      { title: 'Mental Models for Tech', level: 'Intermediate' }
    ]
  },
  {
    title: 'Automations',
    icon: 'wand-magic-sparkles',
    description: 'Learn how to automate workflows and processes.',
    guides: [
      { title: 'What is Automation', level: 'Beginner' },
      { title: 'Trigger → Action Logic', level: 'Beginner' },
      { title: 'Integrations', level: 'Intermediate' },
      { title: 'Connecting APIs', level: 'Intermediate' },
      { title: 'Webhooks in Automations', level: 'Intermediate' },
      { title: 'Error Handling', level: 'Intermediate' },
      { title: 'Scheduling', level: 'Beginner' },
      { title: 'Multi-Step Workflows', level: 'Intermediate' }
    ]
  },
  {
    title: 'Vibe Coding Essentials',
    icon: 'wand-magic-sparkles',
    description: 'Master the art of vibe coding - building apps with AI assistance.',
    guides: [
      { title: 'What is Vibe Coding', level: 'Beginner' },
      { title: 'The Role of the Vibe Developer', level: 'Beginner' },
      { title: 'How to Think in "AI-First" Architecture', level: 'Intermediate' },
      { title: 'Writing Efficient Feature Descriptions', level: 'Intermediate' },
      { title: 'How AI Builds Apps for You', level: 'Beginner' },
      { title: 'Reviewing What AI Creates', level: 'Intermediate' },
      { title: 'Communicating with AI Tools', level: 'Intermediate' },
      { title: 'Vibe Coding Pitfalls & Best Practices', level: 'Advanced' }
    ]
  }
];

function generateGuideContent(title, level) {
  const whatYouLearn = [
    `Understanding ${title}`,
    `Practical applications of ${title}`,
    `Common patterns and best practices`
  ];

  const content = `
    <h2>Introduction</h2>
    <p>Welcome to our guide on ${title}. This guide is designed for vibe coders - people who want to understand how modern apps work without diving deep into technical implementation details.</p>
    
    <h2>What is ${title}?</h2>
    <p>${title} is an important concept in modern app development. Understanding it will help you communicate better with AI tools and plan your apps more effectively.</p>
    
    <h2>Key Concepts</h2>
    <p>In this guide, we'll cover the essential concepts you need to know about ${title}, explained in simple terms without requiring coding knowledge.</p>
    
    <h2>Practical Applications</h2>
    <p>We'll also explore how ${title} applies to real-world app development and how you can use this knowledge when working with AI tools like Specifys.ai.</p>
    
    <h2>Conclusion</h2>
    <p>By the end of this guide, you'll have a solid understanding of ${title} and how it fits into the bigger picture of app development.</p>
  `;

  const summary = `Learn the fundamentals of ${title} and how it applies to modern app development.`;

  const questions = [
    {
      q: `What is the main purpose of ${title}?`,
      answers: [
        'To improve app performance',
        'To enhance user experience',
        'To manage app structure',
        'All of the above'
      ],
      correctIndex: 3
    },
    {
      q: `Why is understanding ${title} important for vibe coders?`,
      answers: [
        'It helps communicate with AI tools',
        'It improves app planning',
        'It enables better decision-making',
        'All of the above'
      ],
      correctIndex: 3
    }
  ];

  return { whatYouLearn, content, summary, questions };
}

async function createAllData() {
  try {
    console.log('🚀 Creating all Academy categories and guides...\n');

    // First, delete existing data (optional - comment out if you want to keep existing)
    console.log('⚠️  Note: This will create new categories. Existing ones will remain.\n');

    const createdCategories = [];
    const createdGuides = [];

    for (const categoryData of categories) {
      console.log(`📁 Creating category: ${categoryData.title}...`);
      
      // Check if category already exists
      const existingCategories = await db.collection('academy_categories')
        .where('title', '==', categoryData.title)
        .get();

      let categoryRef;
      if (!existingCategories.empty) {
        console.log(`   ⚠️  Category "${categoryData.title}" already exists, skipping...`);
        categoryRef = { id: existingCategories.docs[0].id };
      } else {
        categoryRef = await db.collection('academy_categories').add({
          title: categoryData.title,
          icon: categoryData.icon,
          description: categoryData.description,
          createdAt: new Date().toISOString()
        });
        console.log(`   ✅ Created category: ${categoryData.title} (${categoryRef.id})`);
      }

      createdCategories.push({ id: categoryRef.id, title: categoryData.title });

      // Create guides for this category
      for (const guideData of categoryData.guides) {
        // Check if guide already exists
        const existingGuides = await db.collection('academy_guides')
          .where('category', '==', categoryRef.id)
          .where('title', '==', guideData.title)
          .get();

        if (!existingGuides.empty) {
          console.log(`   ⚠️  Guide "${guideData.title}" already exists, skipping...`);
          continue;
        }

        const guideContent = generateGuideContent(guideData.title, guideData.level);
        
        const guideRef = await db.collection('academy_guides').add({
          category: categoryRef.id,
          title: guideData.title,
          level: guideData.level,
          whatYouLearn: guideContent.whatYouLearn,
          content: guideContent.content.trim(),
          summary: guideContent.summary,
          questions: guideContent.questions,
          createdAt: new Date().toISOString()
        });

        createdGuides.push({ 
          category: categoryData.title, 
          title: guideData.title, 
          id: guideRef.id 
        });
        console.log(`   📄 Created guide: ${guideData.title} (${guideData.level})`);
      }
      
      console.log('');
    }

    console.log('\n✅ All data created successfully!\n');
    console.log(`📊 Summary:`);
    console.log(`   - Categories: ${createdCategories.length}`);
    console.log(`   - Guides: ${createdGuides.length}\n`);
    
    console.log('📋 Categories created:');
    createdCategories.forEach((cat, idx) => {
      console.log(`   ${idx + 1}. ${cat.title} (${cat.id})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating data:', error);
    process.exit(1);
  }
}

createAllData();

