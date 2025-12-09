'use client';

import Link from 'next/link';

export default function HowPage() {
  const handleTrackClick = (action: string, category: string, label: string) => {
    if (typeof window !== 'undefined' && (window as any).trackButtonClick) {
      (window as any).trackButtonClick(action, category, label);
    }
  };

  const handleToolUsage = (tool: string, source: string) => {
    if (typeof window !== 'undefined' && (window as any).trackToolUsage) {
      (window as any).trackToolUsage(tool, source);
    }
  };

  return (
    <>
      <p className="how-intro">
        Specifys.ai guides you from an initial idea to a production-ready specification with a structured, collaborative
        workflow and AI support at every step.
      </p>

      <section className="process-flow" aria-label="Specification process overview">
        <div className="process-step">
          <div className="step-icon" aria-hidden="true">
            <i className="fas fa-clipboard-list"></i>
          </div>
          <h3>1. Fill the Brief</h3>
          <p>Capture your product goals, target users, and must-have features through a focused questionnaire.</p>
        </div>
        <div className="process-connector" aria-hidden="true">
          <span className="connector-line"></span>
          <i className="fas fa-angle-right"></i>
          <span className="connector-line"></span>
        </div>
        <div className="process-step">
          <div className="step-icon" aria-hidden="true">
            <i className="fas fa-file-alt"></i>
          </div>
          <h3>2. Approve the Overview</h3>
          <p>Review the automatically generated overview, iterate with feedback, and align on scope before deep dives.</p>
        </div>
        <div className="process-connector" aria-hidden="true">
          <span className="connector-line"></span>
          <i className="fas fa-angle-right"></i>
          <span className="connector-line"></span>
        </div>
        <div className="process-step">
          <div className="step-icon" aria-hidden="true">
            <i className="fas fa-box-open"></i>
          </div>
          <h3>3. Get Your Spec Package</h3>
          <p>Receive a production-ready specification bundle with technical notes, UX flows, and supporting documentation.</p>
        </div>
      </section>

      <div className="tracks-container">
        <div className="track-card">
          <h2>Non-Programmers</h2>
          <p>
            Perfect when you need a developer-ready spec without touching code. Capture requirements in plain English and
            let AI handle the structure.
          </p>
          <ul>
            <li>Answer a guided brief that translates ideas into actionable requirements.</li>
            <li>See AI-powered suggestions that fill gaps before you approve the overview.</li>
            <li>Generate UX flows, user stories, and delivery notes tailored for handoff.</li>
            <li>Export the full spec package to share with teams or collaborators.</li>
          </ul>
          <Link
            href="/"
            className="btn"
            aria-label="Start creating your app specification"
            onClick={() => handleTrackClick('Start Non-Programmers Track', 'How It Works', 'track_card')}
          >
            Start Non-Programmers Track
          </Link>
        </div>
        <div className="track-card">
          <h2>Entrepreneurs</h2>
          <p>
            Ideal for validating concepts with investors, partners, or internal stakeholders through data-backed
            deliverables.
          </p>
          <ul>
            <li>Map your audience, positioning, and monetization strategy with targeted prompts.</li>
            <li>Leverage AI to benchmark competitors and surface whitespace opportunities.</li>
            <li>Review an executive overview before unlocking the full research report.</li>
            <li>Download pitch-ready documents that align product, market, and roadmap.</li>
          </ul>
          <Link
            href="/"
            className="btn"
            aria-label="Start researching your app idea"
            onClick={() => handleTrackClick('Start Entrepreneurs Track', 'How It Works', 'track_card')}
          >
            Start Entrepreneurs Track
          </Link>
        </div>
      </div>

      {/* Available Tools Section */}
      <div className="tools-section">
        <h2>Available Tools</h2>
        <p>
          Explore our powerful collection of AI-driven tools designed to support every aspect of your app development
          journey.
        </p>

        <div className="tools-grid">
          {/* Vibe Coding Tools Map */}
          <div className="tool-card tools-map">
            <div className="tool-icon tools-map-icon">
              <i className="fas fa-map-marked-alt"></i>
            </div>
            <h3>Vibe Coding Tools Map</h3>
            <p>Navigate through our comprehensive map of AI-powered development tools.</p>
            <ul>
              <li>
                <i className="fas fa-check"></i>
                Curated collection of 100+ AI development tools
              </li>
              <li>
                <i className="fas fa-check"></i>
                Interactive filtering by category and features
              </li>
              <li>
                <i className="fas fa-check"></i>
                Detailed tool comparisons and recommendations
              </li>
            </ul>
            <Link
              href="/tools/map/vibe-coding-tools-map"
              className="btn"
              onClick={() => handleToolUsage('Vibe Coding Tools Map', 'explore_from_how')}
            >
              Explore Tools Map
            </Link>
          </div>

          {/* AI Tool Finder */}
          <div className="tool-card tool-finder">
            <div className="tool-icon tool-finder-icon">
              <i className="fas fa-search-plus"></i>
            </div>
            <h3>AI Tool Finder</h3>
            <p>Our intelligent tool recommendation system analyzes your project requirements.</p>
            <ul>
              <li>
                <i className="fas fa-check"></i>
                Personalized tool recommendations
              </li>
              <li>
                <i className="fas fa-check"></i>
                Skill level and project type matching
              </li>
              <li>
                <i className="fas fa-check"></i>
                Direct integration with recommended tools
              </li>
            </ul>
            <Link
              href="/tool-picker"
              className="btn"
              onClick={() => handleToolUsage('Tool Finder', 'find_from_how')}
            >
              Find Your Tools
            </Link>
          </div>

          {/* Specification Generator */}
          <div className="tool-card spec-generator">
            <div className="tool-icon spec-generator-icon">
              <i className="fas fa-dollar-sign"></i>
            </div>
            <h3>Smart Specification Generator</h3>
            <p>Transform your app ideas into comprehensive, developer-ready specifications.</p>
            <ul>
              <li>
                <i className="fas fa-check"></i>
                Interactive questionnaire system
              </li>
              <li>
                <i className="fas fa-check"></i>
                Technical and business requirement analysis
              </li>
              <li>
                <i className="fas fa-check"></i>
                Export to multiple formats (PDF, JSON, Markdown)
              </li>
            </ul>
            <Link
              href="/"
              className="btn"
              onClick={() => handleTrackClick('Generate Specification', 'Tools', 'how_page')}
            >
              Generate Specification
            </Link>
          </div>

          {/* Market Research Analyzer */}
          <div className="tool-card market-research">
            <div className="tool-icon market-research-icon">
              <i className="fas fa-chart-line"></i>
            </div>
            <h3>Market Research Analyzer</h3>
            <p>Conduct comprehensive market research and competitive analysis.</p>
            <ul>
              <li>
                <i className="fas fa-check"></i>
                Competitive landscape analysis
              </li>
              <li>
                <i className="fas fa-check"></i>
                Target audience identification
              </li>
              <li>
                <i className="fas fa-check"></i>
                Investment-ready market reports
              </li>
            </ul>
            <Link
              href="/tools/processing-market"
              className="btn"
              onClick={() => handleTrackClick('Analyze Market', 'Tools', 'how_page')}
            >
              Analyze Market
            </Link>
          </div>
        </div>
      </div>

    </>
  );
}
