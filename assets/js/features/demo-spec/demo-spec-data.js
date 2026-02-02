// ============================================
// Demo Spec Data - Hardcoded specification data
// ============================================
// This file contains all the hardcoded demo specification data
// extracted from the old demo-spec.html page

const demoSpecData = {
    title: "Taskify Pro - Smart Task Management Platform",
    overview: {
        applicationSummary: {
            paragraphs: [
                "Taskify Pro is an intelligent, AI-powered task management platform that revolutionizes productivity for modern professionals and teams. Unlike traditional to-do applications that simply list tasks, Taskify Pro serves as a comprehensive productivity intelligence system that learns, adapts, and optimizes workflows in real-time. The platform represents the culmination of over 10,000 hours of user research, design thinking, and technological innovation, addressing the fundamental challenges that professionals face in today's fast-paced, multi-project work environment.",
                "The platform specifically targets busy professionals, team managers, entrepreneurs, executives, and creative individuals who regularly juggle 10-50 concurrent tasks across multiple projects. These users experience common pain points: constant context switching that reduces cognitive efficiency, unclear priority management leading to missed critical deadlines, lack of visibility into actual time expenditure, coordination challenges when managing distributed teams, and the overwhelming sense of always playing catch-up despite working long hours.",
                "Built with enterprise-grade technology and security standards, Taskify Pro delivers enterprise-level capabilities in an accessible, consumer-friendly package. The platform offers seamless cross-platform synchronization across Web, iOS, Android, Windows, macOS, and Linux environments with offline-first architecture ensuring uninterrupted access. Real-time collaboration features include live cursors, activity streams, instant notifications, conflict resolution algorithms, and intelligent permission systems that scale from individual users to enterprises with thousands of team members.",
                "What truly distinguishes Taskify Pro is its proprietary AI-powered decision engine that transcends simple task tracking. The system understands not just what you're doing, but why it matters, when it's optimal to execute, and how it fits into your broader productivity patterns. The AI analyzes historical work patterns, energy levels throughout the day, meeting schedules, project dependencies, and even factors like commute times and work-life balance preferences to suggest the most impactful work at the optimal times.",
                "The platform integrates deeply with over 50+ productivity tools and services including Slack, GitHub, Google Calendar, Microsoft Teams, Zoom, Notion, Jira, Trello, Asana, Gmail, Outlook, Salesforce, and many others. These aren't superficial integrations - they provide bi-directional sync, context-aware task creation from emails and messages, automatic calendar conflict resolution, and intelligent data aggregation that creates a unified productivity ecosystem without forcing users to abandon their existing workflows.",
                "Taskify Pro goes beyond task management to provide comprehensive productivity analytics and coaching. The platform tracks time expenditure patterns, identifies bottlenecks in workflows, measures productivity metrics, provides weekly insights reports, suggests workflow optimizations, and even warns users about signs of burnout or inefficient task distribution. This data-driven approach helps users understand their work habits deeply and continuously improve their productivity systems.",
                "Security and privacy are foundational to the platform. Taskify Pro implements end-to-end encryption for all task data, offers on-premise deployment options for enterprises with strict compliance requirements, provides granular permission systems, audit logs for all actions, data residency controls, and exceeds SOC 2, GDPR, and HIPAA compliance standards. Individual users can trust that their personal productivity data remains private, while enterprises can confidently deploy the platform across their entire organization."
            ]
        },
        coreFeatures: [
            "AI-powered task prioritization that analyzes deadlines, importance scores, dependencies, and your personal productivity patterns to suggest the optimal order of tasks",
            "Smart calendar integration with automatic deadline reminders that learn your meeting cadence and suggest blocks of focused work time",
            "Collaborative boards for team projects with real-time updates, live cursors, activity streams, and smart conflict resolution for multi-user editing",
            "Intelligent task suggestions based on past work patterns, time of day energy levels, and predictive analytics that understand when you do your best work",
            "Customizable workflows and automation rules that eliminate repetitive task management with triggers, conditions, and multi-step actions",
            "Advanced time tracking with automatic categorization and productivity analytics that show you where your time actually goes",
            "Cross-platform synchronization (Web, iOS, Android, Desktop) with offline-first architecture ensuring you're never without access to your tasks",
            "Natural language processing for task creation - just type 'call John about the project tomorrow at 3pm' and it creates the task with all metadata",
            "Smart template library with hundreds of project templates for common workflows like software development, marketing campaigns, event planning, and more",
            "Integration with 50+ productivity tools including Slack, GitHub, Google Calendar, Microsoft Teams, Zoom, Notion, Jira, Trello, Asana, and more with bi-directional sync",
            "AI-powered email integration that automatically creates tasks from emails based on content analysis and sender importance",
            "Personal productivity coach that provides weekly insights, identifies time drains, and suggests improvements to your workflow",
            "Energy-based scheduling that matches high-energy tasks to your peak performance hours based on historical data",
            "Context-aware task grouping that automatically organizes related tasks and suggests batch processing opportunities",
            "Advanced reporting and analytics dashboard showing completion rates, time estimates vs actual, team velocity, and productivity trends over time"
        ],
        uniqueValueProposition: "Taskify Pro is the only task management platform that uses advanced AI to genuinely understand your work style, energy patterns, and cognitive load. It doesn't just organize your tasks - it acts as a productivity partner that proactively suggests the most impactful work at optimal times, helps you avoid burnout through intelligent task distribution, and learns from your successes to continuously improve your workflow. While competitors focus on features, Taskify Pro focuses on outcomes: helping you accomplish more meaningful work in less time while maintaining mental clarity and work-life balance.",
        targetAudience: {
            primary: "Busy professionals (age 28-50), team managers, executives, and high-achieving individuals in tech, consulting, finance, creative agencies, and service industries who regularly manage 10+ concurrent projects and need to stay organized without adding management overhead",
            characteristics: "Tech-savvy early adopters who value efficiency and automation, overwhelmed by task overload and context switching, strategic thinkers who appreciate data-driven insights, professionals who seek work-life balance",
            painPoints: [
                "Task overload leading to constant stress and missed deadlines",
                "Inability to determine what actually matters vs. what feels urgent",
                "Team coordination challenges causing communication gaps and duplicate work",
                "Context switching between multiple projects leading to reduced productivity",
                "No visibility into where time is actually spent",
                "Difficulty maintaining work-life balance with boundaries"
            ]
        },
        problemStatement: "Modern professionals and teams are drowning in tasks. Traditional to-do lists fail to help users identify what truly matters, leading to missed deadlines, constant stress, and decreased productivity. There's no intelligent system that adapts to individual work patterns.",
        businessModel: "Taskify Pro operates on a freemium SaaS (Software-as-a-Service) model with three primary revenue streams: subscription plans for individuals and teams, enterprise licenses with custom deployment options, and strategic partnerships with productivity tool ecosystems. The free tier provides basic task management for individual users while paid tiers unlock advanced AI features, unlimited projects, team collaboration, and enterprise-grade security. Enterprise customers receive white-label options, SSO integration, dedicated support, SLA guarantees, and on-premise deployment for organizations with strict compliance requirements.",
        competitiveAdvantage: "Taskify Pro's competitive advantage lies in its proprietary AI decision engine that learns and adapts to individual work patterns. Unlike competitors who provide static task lists or simple rule-based automation, Taskify Pro uses advanced machine learning to understand context, predict bottlenecks, optimize task distribution, and continuously improve user productivity. The platform's energy-based scheduling, predictive analytics, and comprehensive integration ecosystem create a moat that cannot be easily replicated by feature-focused competitors.",
        successMetrics: {
            userEngagement: "Daily active users spend average of 35 minutes in platform, complete 85% of high-priority tasks on time, reduce task overload by 40% within first month",
            productivityImprovement: "Users report 28% increase in meaningful work accomplished, 35% reduction in context switching, and 50% decrease in missed deadlines",
            businessMetrics: "Target 50,000 paying users in Year 1, $5M ARR by Year 2, 90% net revenue retention rate, enterprise segment representing 60% of revenue by Year 3"
        },
        screenDescriptions: {
            screens: [
                {
                    name: "Dashboard",
                    description: "Main productivity dashboard showing task overview, AI-suggested priorities, energy-based scheduling recommendations, and quick access to all active projects.",
                    uiComponents: ["Task list with priority indicators", "AI suggestion panel", "Calendar integration widget", "Productivity metrics cards", "Quick action buttons"]
                },
                {
                    name: "Task Detail View",
                    description: "Comprehensive task view with all metadata, subtasks, dependencies, time tracking, comments, and AI-powered suggestions for optimal completion time.",
                    uiComponents: ["Task title and description editor", "Priority and deadline selectors", "Subtasks checklist", "Dependency graph", "Time tracking timer", "Comments section", "AI suggestions panel"]
                },
                {
                    name: "Project Board",
                    description: "Kanban-style project board with real-time collaboration, live cursors, activity streams, and smart task grouping based on AI analysis.",
                    uiComponents: ["Drag-and-drop columns", "Task cards with preview", "Live collaboration indicators", "Filter and sort controls", "Bulk action toolbar", "Activity feed sidebar"]
                },
                {
                    name: "Analytics Dashboard",
                    description: "Productivity analytics showing time expenditure patterns, completion rates, productivity trends, and personalized insights from AI coaching.",
                    uiComponents: ["Time distribution charts", "Productivity trend graphs", "Completion rate metrics", "Energy level heatmap", "Weekly insights report", "Export options"]
                },
                {
                    name: "Settings & Preferences",
                    description: "User preferences and settings including AI behavior customization, integration configurations, notification preferences, and account management.",
                    uiComponents: ["AI behavior sliders", "Integration toggle switches", "Notification preferences", "Theme and layout options", "Account settings", "Team management"]
                }
            ],
            navigationStructure: "Bottom navigation on mobile with Dashboard, Projects, Analytics, and Profile tabs. Side navigation on desktop with collapsible sections. Deep linking supports direct navigation to specific tasks, projects, or analytics views."
        }
    },
    technical: {
        technologyStackHighlights: [
            {
                title: "Frontend Layer",
                icon: "fa-laptop",
                description: "Taskify Pro delivers a responsive productivity workspace that keeps live boards, AI insights, and analytics dashboards synchronized across every client.",
                points: [
                    "Component-driven UI mirrors the same hierarchy users see in the Overview and Analytics sections, turning product specs into living interfaces.",
                    "Offline-first caching guarantees that mobile professionals can triage tasks during flights and sync automatically once reconnected.",
                    "Accessibility patterns keep power features—live collaboration cursors, AI prompts, weekly reports—usable for every persona highlighted in the spec."
                ]
            },
            {
                title: "Backend Services",
                icon: "fa-cogs",
                description: "Domain-driven services coordinate the AI decision engine, collaboration logic, and notification flows described throughout the specification.",
                points: [
                    "Task, analytics, and coaching services each expose APIs that map directly to the core features and success metrics promised to users.",
                    "Event queues keep AI prioritization and burnout alerts responsive even when collaboration surges during team sprints.",
                    "Shared contracts across services ensure every touchpoint—from email ingestion to weekly summaries—uses consistent business language."
                ]
            },
            {
                title: "API Gateway & Routing",
                icon: "fa-sitemap",
                description: "The gateway provides a single entry point for web, mobile, and partner integrations, enforcing policies that uphold the product promises in this spec.",
                points: [
                    "Context-aware routing prioritizes real-time channels so shared boards and presence indicators stay instantaneous.",
                    "Version pinning allows gradual rollout of new AI behaviors without disrupting existing enterprise workflows.",
                    "Centralized documentation matches the detailed API list below, giving customer teams one canonical contract."
                ]
            },
            {
                title: "Authentication & Authorization",
                icon: "fa-lock",
                description: "Identity controls reflect Taskify Pro's dual audience—individual creators and regulated enterprises—ensuring the right access for every scenario.",
                points: [
                    "Flexible sign-in options support fast onboarding for busy professionals while honoring enterprise SSO requirements.",
                    "Multi-factor enforcement protects sensitive actions highlighted in collaboration and AI coaching flows.",
                    "Granular RBAC mirrors the spec's team structures—owners, admins, members, viewers—with auditable history for compliance."
                ]
            },
            {
                title: "Data Layer",
                icon: "fa-database",
                description: "Purpose-built stores capture the rich telemetry, timelines, and insights that power Taskify Pro's coaching narrative.",
                points: [
                    "PostgreSQL anchors the mission-critical entities the spec references—tasks, projects, permissions, billing tiers.",
                    "Document storage preserves evolving productivity signals that feed the personal coaching and energy modeling features.",
                    "Search and time-series engines fuel the instant lookup, timeline analytics, and trend charts showcased in the overview."
                ]
            },
            {
                title: "DevOps & Infrastructure",
                icon: "fa-wrench",
                description: "Infrastructure automation guarantees that every environment—from staging AI experiments to production—matches the reliability promises in this spec.",
                points: [
                    "Immutable builds keep AI models, coaching jobs, and notification services reproducible across regions.",
                    "Infrastructure-as-code captures networking, secrets, and monitoring so enterprise customers can review and trust the stack.",
                    "Autoscaling policies ensure collaboration features stay responsive during product launches and onboarding waves."
                ]
            },
            {
                title: "CI/CD Pipeline",
                icon: "fa-code-fork",
                description: "Continuous delivery lets the product team ship AI improvements and workflow tweaks at the cadence implied by the roadmap.",
                points: [
                    "Automated quality gates protect critical promises like conflict-free collaboration and accurate insights.",
                    "Preview environments render the full spec—dashboards, AI suggestions, pricing flows—so stakeholders can validate narratives quickly.",
                    "Progressive delivery keeps availability high while experimenting with new coaching or analytics models."
                ]
            },
            {
                title: "Observability & Monitoring",
                icon: "fa-eye",
                description: "Observability couples technical telemetry with business KPIs to validate the success metrics outlined earlier in the spec.",
                points: [
                    "Productivity KPIs—on-time completion, focus sessions, AI adoption—flow into dashboards alongside system health.",
                    "Error tracking links regressions directly to releases, safeguarding the seamless collaboration experience users expect.",
                    "Distributed traces tie together AI inference, notification delivery, and UI rendering to diagnose issues end-to-end."
                ]
            },
            {
                title: "Security Controls",
                icon: "fa-shield",
                description: "Layered security upholds the compliance guarantees and data-residency commitments promised to enterprise buyers.",
                points: [
                    "Always-on encryption and secure session management protect the sensitive productivity data Taskify Pro aggregates.",
                    "Managed secrets, key rotation, and tamper-proof logs underpin the audit trails cited in the business model.",
                    "Continuous compliance checks keep SOC 2, GDPR, and HIPAA assertions current for large customer deals."
                ]
            },
            {
                title: "Scalability & Performance Engineering",
                icon: "fa-rocket",
                description: "Performance work guarantees that solo creators and global enterprises both experience the fast, calm workflows described in the overview.",
                points: [
                    "Horizontal scaling absorbs collaboration spikes during team war rooms without delaying AI recommendations.",
                    "Global caching keeps weekly insights, dashboards, and templates responsive for remote teams.",
                    "Resilience drills validate that burn-down charts, reminders, and alerts remain available even during infrastructure incidents."
                ]
            }
        ],
        techStack: {
            frontend: {
                framework: "React 18 (Latest stable) - Component-based UI library with hooks, context API, and concurrent rendering features",
                language: "TypeScript 5.5 - Strict type checking for compile-time error detection and better IDE support",
                ssr: "Next.js 14 - Server-side rendering, static site generation, API routes, and image optimization",
                styling: "Tailwind CSS 3.4 - Utility-first CSS framework with custom design tokens and dark mode support",
                stateManagement: "React Query 5 - Server state management with caching, synchronization, and background updates",
                animations: "Framer Motion 11 - Declarative animations with gesture support and layout animations",
                charts: "Recharts 2.10 - Composable charting library built on D3 for analytics dashboards",
                forms: "React Hook Form 7.55 - Performant form library with validation schema support (Zod integration)",
                routing: "Next.js App Router 14 - File-based routing with layouts, loading states, and error boundaries"
            },
            backend: {
                runtime: "Node.js 20 LTS - Latest Long Term Support version with improved performance and security",
                framework: "Express.js 4.21 - Minimal web framework with middleware ecosystem",
                language: "TypeScript 5.5 - Backend type safety matching frontend for consistency",
                caching: "Redis 7.3 - In-memory data store for session management, rate limiting, and distributed locks",
                queues: "Bull 5.0 - Redis-based job queue system for async processing and task scheduling",
                logging: "Winston 3.11 - Structured logging with multiple transports (console, file, remote services)",
                validation: "Joi 17.13 - Schema-based validation library for request/response validation",
                orm: "Prisma 5.11 - Type-safe database ORM with migrations and query builder",
                apidoc: "Swagger/OpenAPI 3.1 - API documentation with interactive testing interface"
            },
            database: {
                primary: "PostgreSQL 15 - Advanced open-source relational database with JSONB support, full-text search, and ACID compliance",
                documents: "MongoDB Atlas 7.1 - Managed NoSQL database for flexible schema requirements and horizontal scaling",
                search: "Elasticsearch 8.15 - Distributed search and analytics engine for full-text search across all content",
                timeseries: "TimescaleDB 2.14 - PostgreSQL extension for time-series data storage and analytics",
                connection: "Connection pooling via PgBouncer and Redis for optimal resource utilization"
            },
            aiService: {
                provider: "OpenAI GPT-4 Turbo API - Latest multimodal AI model with 128k context window",
                fineTuning: "Custom fine-tuned models for task prioritization using LORA adapters and reinforcement learning",
                nlp: "Natural language processing for task creation, intent recognition, and sentiment analysis",
                fallback: "Ollama local LLM for offline capabilities and reduced API costs",
                embedding: "OpenAI text-embedding-3 for semantic search and similarity matching"
            },
            authentication: {
                framework: "NextAuth.js v5 - Authentication library with session management",
                providers: "OAuth 2.0 with Google, Microsoft, GitHub, Apple for social login",
                tokens: "JWT tokens with refresh mechanism and secure cookie storage",
                security: "2FA via TOTP (Time-based One-Time Password) using RFC 6238 standard",
                passwordless: "Magic link authentication with time-limited tokens and email verification",
                sessions: "Database-backed sessions with automatic cleanup and security best practices"
            },
            realtime: {
                protocol: "WebSocket with Socket.io v4 for bidirectional real-time communication",
                scaling: "Redis Adapter for horizontal scaling across multiple server instances",
                features: "Presence tracking, live cursors, activity streams, and typing indicators",
                conflicts: "Operational Transformation (OT) for real-time collaborative editing without conflicts",
                fallback: "Automatic reconnection with exponential backoff and message queue for offline support"
            },
            storage: {
                object: "AWS S3 - Scalable object storage with versioning and lifecycle policies",
                cdn: "CloudFront CDN for global content delivery with automatic compression and caching",
                images: "Image optimization service using Sharp for resizing, format conversion (WebP, AVIF)",
                backups: "Automated backups to AWS Glacier for compliance and disaster recovery",
                caching: "Multi-layer caching strategy (CDN → Edge → Application → Database)"
            },
            infrastructure: {
                containers: "Docker 24 for application containerization and consistent deployments",
                orchestration: "Kubernetes on AWS EKS for container management, auto-scaling, and service discovery",
                cicd: "GitHub Actions for automated testing, building, and deployment pipelines",
                iac: "Terraform for infrastructure as code with version control and environment management",
                monitoring: "Datadog for APM, infrastructure monitoring, and log aggregation",
                errors: "Sentry for error tracking, performance monitoring, and release management",
                logging: "Structured logging with centralized log management and alerting"
            }
        },
        architectureOverview: "Enterprise-grade microservices architecture with API Gateway pattern ensuring scalability and maintainability. Backend services communicate via REST APIs with OpenAPI documentation and use RabbitMQ message queues for async processing. Real-time updates are handled through WebSocket connections with automatic reconnection and offline queue. AI service runs as separate containerized microservice with dedicated GPU resources, request queuing, and rate limiting. Database connections are pooled with read replicas for performance. Each service is independently deployable with its own CI/CD pipeline, auto-scaling policies, and health checks.",
        databaseSchema: {
            description: "Hybrid multi-database architecture using PostgreSQL for transactional relational data with strict schema enforcement, MongoDB for flexible document storage of user preferences and metadata, Elasticsearch for blazing-fast full-text search across all task content, and TimescaleDB for storing time-series analytics data like productivity metrics and completion rates over time",
            tables: [
                {
                    name: "users",
                    columns: ["id (UUID, PK), email (VARCHAR unique), name (VARCHAR), avatar_url (VARCHAR), timezone (VARCHAR), preferences (JSONB), subscription_tier (ENUM), created_at (TIMESTAMP), updated_at (TIMESTAMP), last_active (TIMESTAMP)"]
                },
                {
                    name: "tasks",
                    columns: ["id (UUID, PK), user_id (UUID FK), project_id (UUID FK nullable), title (VARCHAR), description (TEXT), status (ENUM: pending,in_progress,completed,archived), priority (INT 1-10), energy_required (INT 1-5), due_date (TIMESTAMP), completed_at (TIMESTAMP), estimated_time (INT minutes), actual_time (INT minutes), tags (TEXT[]), created_at (TIMESTAMP), updated_at (TIMESTAMP)"]
                },
                {
                    name: "projects",
                    columns: ["id (UUID, PK), name (VARCHAR), description (TEXT), owner_id (UUID FK), visibility (ENUM: private,team,public), color (VARCHAR), icon (VARCHAR), team_id (UUID FK nullable), archived (BOOLEAN), created_at (TIMESTAMP), updated_at (TIMESTAMP)"]
                },
                {
                    name: "teams",
                    columns: ["id (UUID, PK), name (VARCHAR), description (TEXT), owner_id (UUID FK), settings (JSONB), created_at (TIMESTAMP), updated_at (TIMESTAMP)"]
                },
                {
                    name: "team_members",
                    columns: ["id (UUID, PK), team_id (UUID FK), user_id (UUID FK), role (ENUM: owner,admin,member,viewer), permissions (JSONB), joined_at (TIMESTAMP)"]
                },
                {
                    name: "integrations",
                    columns: ["id (UUID, PK), user_id (UUID FK), service (VARCHAR), credentials (JSONB encrypted), enabled (BOOLEAN), last_sync (TIMESTAMP), created_at (TIMESTAMP)"]
                }
            ]
        },
        apiEndpoints: [
            { method: "POST", path: "/api/v1/tasks", description: "Create a new task with optional AI-suggested priority and due date" },
            { method: "GET", path: "/api/v1/tasks", description: "Get all tasks with advanced filtering, pagination, and sorting options" },
            { method: "GET", path: "/api/v1/tasks/:id", description: "Get detailed information about a specific task including analytics" },
            { method: "PUT", path: "/api/v1/tasks/:id", description: "Update a task with optimistic locking to prevent conflicts" },
            { method: "DELETE", path: "/api/v1/tasks/:id", description: "Soft delete a task with archive option" },
            { method: "GET", path: "/api/v1/ai/suggestions", description: "Get AI task prioritization suggestions based on current workload and historical patterns" },
            { method: "POST", path: "/api/v1/ai/analyze-workload", description: "Analyze user workload and suggest time distribution optimizations" },
            { method: "GET", path: "/api/v1/projects", description: "Get all projects with nested task counts and progress metrics" },
            { method: "GET", path: "/api/v1/analytics/productivity", description: "Get productivity analytics and trends over time" },
            { method: "POST", path: "/api/v1/integrations/:service/sync", description: "Trigger manual sync with external service integration" }
        ]
    },
    market: {
        charts: {
            marketGrowth: {
                title: "Task Management Software Market Growth (2024-2030)",
                data: [6.76, 7.85, 9.12, 10.64, 12.41, 13.45, 14.6]
            },
            competitorComparison: {
                title: "Market Share Comparison",
                data: { "Asana": 20, "Monday.com": 15, "Notion": 12, "Other": 53 }
            },
            userSegmentation: {
                title: "Target User Segments",
                data: { "Individual Professionals": 45, "Small Teams": 30, "Mid-market": 20, "Enterprise": 5 }
            },
            searchTrends: {
                title: "Google Trends - Task Management Keywords (Last 6 Months)",
                data: {
                    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                    datasets: [
                        {
                            label: "Task Management",
                            data: [85, 92, 88, 95, 100, 98],
                            borderColor: '#6366F1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)'
                        },
                        {
                            label: "Productivity Tools",
                            data: [72, 78, 82, 88, 92, 95],
                            borderColor: '#10B981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)'
                        },
                        {
                            label: "To-Do List Apps",
                            data: [95, 88, 90, 85, 92, 96],
                            borderColor: '#8B5CF6',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)'
                        },
                        {
                            label: "Project Management",
                            data: [78, 85, 91, 88, 95, 100],
                            borderColor: '#F59E0B',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)'
                        }
                    ]
                }
            },
            keywordDemand: {
                title: "Search Volume Trends - Productivity Keywords",
                keywords: [
                    { term: "task management software", searches: 135000 },
                    { term: "productivity apps", searches: 246000 },
                    { term: "ai task assistant", searches: 189000 },
                    { term: "smart to-do app", searches: 167000 },
                    { term: "team task tracking", searches: 112000 }
                ]
            }
        },
        marketSize: "The global task management software market is valued at $6.76 billion in 2024 and is projected to reach $14.6 billion by 2030, growing at a CAGR of 14.2%. This explosive growth is driven by increasing remote work adoption, digital transformation initiatives, and the critical need for productivity tools that can handle distributed teams and complex workflows. The market is experiencing a shift from basic task tracking to intelligent, AI-powered solutions that provide actionable insights and automation.",
        targetCustomers: "Our addressable market consists of approximately 500 million knowledge workers globally, with 150 million located in our primary target markets (United States, Canada, United Kingdom, European Union, Australia). These professionals are increasingly seeking AI-powered solutions that can adapt to their work style rather than forcing them into rigid workflows. Market research shows that 67% of knowledge workers use 3 or more productivity apps daily, creating demand for unified platforms.",
        marketTrends: [
            "Remote and hybrid work models driving 40% year-over-year growth in task management tool adoption",
            "AI integration becoming table stakes - 85% of buyers expect AI features in productivity tools by 2025",
            "Individual contributors now making purchase decisions for team tools, shifting from top-down procurement",
            "Demand for privacy-first solutions with on-premise deployment options growing 60% annually",
            "Mobile-first usage patterns - 70% of task management happens on mobile devices during commutes and breaks"
        ],
        competitiveLandscape: [
            {
                competitor: "Asana",
                advantages: "Large feature set, strong brand recognition, established market presence",
                disadvantages: "Steep learning curve, expensive for small teams, cluttered interface",
                marketPosition: "Market leader, 20% market share, focused on enterprise customers"
            },
            {
                competitor: "Monday.com",
                advantages: "Highly customizable, great for teams, excellent visual project management",
                disadvantages: "Complex setup, high pricing, overwhelming for individual users",
                marketPosition: "Strong in mid-market, 15% market share, growth-focused"
            },
            {
                competitor: "Notion",
                advantages: "All-in-one workspace, good for documentation, flexible structure",
                disadvantages: "Not specialized for task management, slower performance, learning curve",
                marketPosition: "Rapidly growing, 12% market share, popular with creators"
            }
        ],
        pricingStrategy: {
            recommendations: "Freemium model with paid tiers to maximize user acquisition while monetizing power users",
            pricing: [
                { plan: "Free", price: "$0", features: ["Up to 5 projects", "Basic AI suggestions", "Mobile apps"], target: "Individual users" },
                { plan: "Pro", price: "$12/user/month", features: ["Unlimited projects", "Advanced AI", "Priority support", "Integrations"], target: "Small teams" },
                { plan: "Business", price: "$24/user/month", features: ["Everything in Pro", "Team analytics", "Advanced permissions", "Custom workflows"], target: "Medium teams" },
                { plan: "Enterprise", price: "Custom", features: ["Everything in Business", "SSO", "Dedicated support", "SLA"], target: "Large organizations" }
            ]
        },
        marketOpportunity: "While competitors focus on teams and enterprises, there's a $2.4 billion opportunity in the AI-first individual productivity space, with Taskify Pro positioning as the intelligent alternative for professionals."
    },
    design: {
        designPhilosophy: "Taskify Pro follows a philosophy of 'invisible intelligence' - where AI capabilities feel natural and unobtrusive. The interface is clean, minimal, and intelligent, designed to reduce cognitive load while maximizing productivity. Every UI element is purposefully placed to guide users toward their most important work without creating anxiety or overwhelm. The design language emphasizes clarity, trust, and empowerment, using progressive disclosure to reveal features when needed rather than cluttering the interface with options.",
        
        brandIdentity: {
            mission: "Empowering professionals to achieve more with less stress through intelligent task management.",
            personality: "Professional yet approachable, intelligent without being arrogant, efficient without sacrificing humanity",
            voice: "Supportive, proactive, confident but never pushy. We speak in terms of outcomes and possibilities, never lecturing.",
            values: ["User autonomy (you control the AI, not the other way around)", "Transparency (we explain why we make suggestions)", "Balance (productivity without burnout)", "Trust (your data is yours, always)"]
        },
        
        colorPalette: {
            primary: "#6366F1 (Indigo) - Trust, professionalism, focus",
            secondary: "#8B5CF6 (Purple) - Creativity, innovation, intelligence",
            accent: "#10B981 (Green) - Success, progress, completion",
            warning: "#F59E0B (Amber) - Attention, caution, important tasks",
            error: "#EF4444 (Red) - Urgent, overdue, critical deadlines",
            background: "#FFFFFF (White) - Clean, fresh start, clarity",
            surface: "#F9FAFB (Light Gray) - Subtle separation, depth",
            text: "#1F2937 (Dark Gray) - Readability, professionalism",
            textSecondary: "#6B7280 (Medium Gray) - Hierarchy, supporting info"
        },
        
        typography: {
            fontFamily: "Inter, system-ui, sans-serif",
            heading: "Inter, Bold, 24-32px for major sections, creates clear hierarchy",
            subheading: "Inter, SemiBold, 18-20px for subsections and card titles",
            body: "Inter, Regular, 16px for all content text, optimized for readability",
            caption: "Inter, Medium, 14px for metadata, timestamps, labels",
            code: "Monaco, 'Courier New', monospace for technical content",
            lineHeight: "1.8 for body text, 1.4 for headings"
        },
        
        spacingSystem: {
            base: "4px grid system",
            small: "8px - internal padding",
            medium: "16px - component gaps",
            large: "24px - section spacing",
            xlarge: "40px - major section breaks"
        },
        
        components: [
            "Task cards with drag-and-drop reordering and priority indicators",
            "AI suggestion bubbles that appear contextually with smart animations",
            "Progress bars with smooth animations showing completion rates",
            "Timeline view with adjustable zoom levels",
            "Calendar integration with color-coded task density visualization",
            "Dashboard widgets that adapt to user productivity patterns",
            "Smart notifications that respect focus time and meeting schedules",
            "Search interface with natural language processing",
            "Filter chips for quick task organization",
            "Empty states with helpful onboarding tips"
        ],
        
        uiPrinciples: [
            "Progressive disclosure - show complexity only when needed",
            "Feedback loops - immediate confirmation for user actions",
            "Error prevention - suggest solutions before users make mistakes",
            "Accessibility first - WCAG 2.1 AA compliant throughout",
            "Mobile-first responsive design",
            "Gesture support for mobile users",
            "Keyboard shortcuts for power users"
        ],
        
        designTokens: {
            borderRadius: "8px for cards, 12px for containers, 20px for modals",
            shadows: "Subtle elevation system: 0-4-8-16-24px blur with varying opacity",
            transitions: "200-300ms ease-in-out for interactive elements",
            gridSystem: "12-column responsive grid with 24px gutters",
            breakpoints: "Mobile: 320-768px, Tablet: 768-1024px, Desktop: 1024px+"
        },
        
        brandAssets: {
            logo: "Gradient logo with 'Taskify Pro' wordmark in Inter Bold",
            colors: "Full color palette documentation available in brand guidelines",
            icons: "Custom icon set with 150+ icons matching brand aesthetic",
            illustrations: "Minimalist line art style for onboarding and empty states"
        },
        
        appIcon: {
            design: "Circular gradient background from indigo (#6366F1) to purple (#8B5CF6) with a stylized checkmark incorporating the letters 'TP'",
            variations: "Available in standard and rounded-square formats for different platforms"
        }
    },
    diagrams: {
        diagrams: [
            {
                name: "Database Schema - Core Entities",
                description: "Complete database schema showing relationships between users, tasks, projects, and teams",
                mermaidCode: `erDiagram
    USERS ||--o{ TASKS : creates
    USERS ||--o{ PROJECTS : owns
    USERS ||--o{ TEAMS : member_of
    USERS ||--o{ INTEGRATIONS : uses
    
    PROJECTS ||--o{ TASKS : contains
    PROJECTS }o--|| TEAMS : belongs_to
    
    TASKS }o--o{ TAGS : tagged_with
    TASKS ||--o{ COMMENTS : has
    TASKS ||--o{ TIME_ENTRIES : tracks
    
    TEAMS ||--o{ TEAM_MEMBERS : contains
    TEAM_MEMBERS }o--|| USERS : "is user"
    
    USERS {
        uuid id PK
        string email UK
        string name
        jsonb preferences
        enum subscription_tier
        timestamp created_at
    }
    
    TASKS {
        uuid id PK
        uuid user_id FK
        uuid project_id FK
        string title
        text description
        enum status
        int priority
        timestamp due_date
        int estimated_time
        int actual_time
    }
    
    PROJECTS {
        uuid id PK
        uuid owner_id FK
        string name
        text description
        enum visibility
        boolean archived
    }
    
    TEAMS {
        uuid id PK
        uuid owner_id FK
        string name
        jsonb settings
    }`
            },
            {
                name: "System Architecture - Microservices Overview",
                description: "Complete high-level system architecture showing all microservices, databases, and external integrations",
                mermaidCode: `graph TB
    A[Web/Mobile/Desktop Clients]
    B[API Gateway with Load Balancer]
    C[Authentication Service]
    D[Task Management Service]
    E[AI Processing Service]
    F[Analytics Service]
    G[Notification Service]
    
    H[(PostgreSQL Primary)]
    I[(PostgreSQL Replica)]
    J[(MongoDB Atlas)]
    K[(Elasticsearch)]
    L[(Redis Cache)]
    
    M[AWS S3 Storage]
    N[RabbitMQ Message Queue]
    
    A --> B
    B --> C
    B --> D
    B --> E
    B --> F
    
    D --> H
    D --> L
    D --> N
    D --> J
    
    E --> L
    E --> I
    E --> K
    
    D --> M
    E --> M
    
    F --> J
    G --> N
    N --> G`
            },
            {
                name: "Complete Task Creation Flow",
                description: "Detailed user journey from task creation through AI analysis to completion tracking",
                mermaidCode: `flowchart TD
    A([User Opens Taskify])
    B[Dashboard View]
    C{Click Create Task}
    
    D[User Input Task]
    
    E[AI NLP Processing]
    F[Extract Intent]
    G[Check Work Patterns]
    H[Analyze Workload]
    
    I[AI Suggestions]
    
    J{User Decision}
    
    K[Accept]
    L[Modify]
    M[Reject]
    
    N[Save to Database]
    O[Update Cache]
    P[Schedule Reminders]
    
    Q[Optimize Order]
    R[Show Dashboard]
    S[Send Notifications]
    
    T([Task Created])
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    I --> J
    J -->|Accept| K
    J -->|Modify| L
    J -->|Reject| M
    K --> N
    L --> N
    M --> N
    N --> O
    O --> P
    P --> Q
    Q --> R
    R --> S
    S --> T`
            },
            {
                name: "AI Task Prioritization Algorithm",
                description: "Detailed flow of how AI determines task priority and suggests optimal scheduling",
                mermaidCode: `flowchart LR
    A[New Task]
    
    B[Analyze Content]
    
    C[Check Workload]
    D[Check Deadlines]
    E[Check Energy]
    F[Check Deps]
    
    G[Score Priority]
    
    H[Assess Time]
    I[Assess Energy]
    J[Assess Urgency]
    
    K[Suggest Schedule]
    
    L[Update Order]
    M[Notify User]
    
    N[Display Dashboard]
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    
    G --> H
    G --> I
    G --> J
    
    H --> K
    I --> K
    J --> K
    
    K --> L
    L --> M
    M --> N`
            },
            {
                name: "Real-time Collaboration Flow",
                description: "How multiple users collaborate on tasks with real-time sync and conflict resolution",
                mermaidCode: `sequenceDiagram
    participant U1 as User1
    participant U2 as User2
    participant GW as Gateway
    participant TS as TaskService
    participant DB as Database
    participant RD as Redis
    
    U1->>GW: Update Task
    GW->>TS: Process
    TS->>DB: Save
    TS->>RD: Publish
    RD-->>U1: ACK
    RD-->>U2: Update
    
    U2->>GW: Update Task
    GW->>TS: Process
    TS->>DB: Check Lock
    DB-->>TS: Conflict
    
    TS->>U2: Request Merge
    U2-->>GW: Merge
    GW->>TS: Save
    TS->>DB: Final Save
    TS->>RD: Broadcast
    
    RD-->>U1: Final
    RD-->>U2: Final`
            }
        ]
    },
    charts: {
        marketGrowth: {
            title: "Task Management Software Market Growth (2024-2030)",
            data: [6.76, 7.85, 9.12, 10.64, 12.41, 13.45, 14.6]
        },
        competitorComparison: {
            title: "Market Share Comparison",
            data: { "Asana": 20, "Monday.com": 15, "Notion": 12, "Other": 53 }
        },
        userSegmentation: {
            title: "Target User Segments",
            data: { "Individual Professionals": 45, "Small Teams": 30, "Mid-market": 20, "Enterprise": 5 }
        },
        searchTrends: {
            title: "Google Trends - Task Management Keywords (Last 6 Months)",
            data: {
                labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                datasets: [
                    {
                        label: "Task Management",
                        data: [85, 92, 88, 95, 100, 98],
                        borderColor: '#6366F1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)'
                    },
                    {
                        label: "Productivity Tools",
                        data: [72, 78, 82, 88, 92, 95],
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)'
                    },
                    {
                        label: "To-Do List Apps",
                        data: [95, 88, 90, 85, 92, 96],
                        borderColor: '#8B5CF6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)'
                    },
                    {
                        label: "Project Management",
                        data: [78, 85, 91, 88, 95, 100],
                        borderColor: '#F59E0B',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)'
                    }
                ]
            }
        },
        keywordDemand: {
            title: "Search Volume Trends - Productivity Keywords",
            keywords: [
                { term: "task management software", searches: 135000 },
                { term: "productivity apps", searches: 246000 },
                { term: "ai task assistant", searches: 189000 },
                { term: "smart to-do app", searches: 167000 },
                { term: "team task tracking", searches: 112000 }
            ]
        }
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.demoSpecData = demoSpecData;
}
