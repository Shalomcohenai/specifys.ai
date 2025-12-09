'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { MermaidRenderer } from '@/components/diagrams/MermaidRenderer';

export default function WhyPage() {
  // Scroll animations removed - will be reimplemented with Tailwind
  useEffect(() => {
    // Placeholder for future animations
  }, []);

  return (
    <>
      <div>
        {/* Section 1: Title */}
        <section data-section="0">
          <h1>Why?</h1>
          <p>Because you can&apos;t build a business with a single prompt.</p>
          <div>
            <div>
              <div>
                <div>
                  <div>Base44</div>
                </div>
                <div>
                  <div>Lovable</div>
                </div>
                <div>
                  <div>v0</div>
                </div>
                <div>
                  <div>Cursor</div>
                </div>
                <div>
                  <div>Claude</div>
                </div>
                <div>
                  <div>GPT</div>
                </div>
              </div>
            </div>
            <div>
              <div>
                <div>
                  <h2>The Story Behind Specifys.ai</h2>
                  <p>I built Specifys.ai out of personal frustration.</p>
                  <p>
                    I noticed a recurring problem: tools jump straight into coding - before really understanding the full
                    scope of the idea.
                  </p>
                  <p>
                    That&apos;s when I realized what was missing: a planning phase. A way to describe the app, the user flow,
                    the features, and the logic - before writing any code.
                  </p>
                </div>
                <div>
                  <Link href="/">
                    Start Planning
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: The Problem */}
        <section data-section="1">
          <h2>The Promise That Falls Short</h2>
          <p>Every platform promises one prompt, but reality is different.</p>
          <div id="promptAnimationContainer">
            {/* Credit counters and prompts will be generated dynamically */}
          </div>
          <div>
            <div>
              <p>
                But here&apos;s what actually happens: You spend hours, sometimes days, tweaking prompts, fixing errors, and
                trying to get the AI to understand what you really want.
              </p>
              <p>
                The code comes out messy. Features don&apos;t connect. And when you want to add something new, everything
                breaks.
              </p>
              <div>
                <Link href="/">
                  Start Planning
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: The Right Way */}
        <section data-section="2">
          <h2>The Right Way to Build</h2>
          <p>Start with foundations, then build the structure.</p>
          <div>
            <div>
              <div>
                <div>
                  <div suppressHydrationWarning>
                    {`graph TD
    A[Data Structures] --> B[Functions]
    B --> C[Logic Flow]
    C --> D[UI Layout]`}
                  </div>
                </div>
                <div>
                  <table>
                    <thead>
                      <tr>
                        <th>Variable</th>
                        <th>Type</th>
                        <th>Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>users</td>
                        <td>Array</td>
                        <td>Store user data</td>
                      </tr>
                      <tr>
                        <td>products</td>
                        <td>Array</td>
                        <td>Store product info</td>
                      </tr>
                      <tr>
                        <td>currentUser</td>
                        <td>Object</td>
                        <td>Active user session</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div>
              <div>
                <p>Real development doesn&apos;t start with code. It starts with foundations.</p>
                <p>
                  First, you define your data structures - arrays, variables, the core information your app needs.
                </p>
                <p>
                  Then, you map out your functions - what each piece does, how they connect, the logic that makes
                  everything work.
                </p>
                <p>
                  Only after that foundation is solid do you build the layout - the UI that users actually see.
                </p>
                <div>
                  <Link href="/">
                    Start Planning
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Where Specifys.ai Steps In */}
        <section data-section="3">
          <h2>Where Specifys.ai Steps In</h2>
          <p>Specifys.ai doesn&apos;t generate code. It generates a plan.</p>
          <div>
            <div>
              <div>
                <div>
                  <div>Describe your application</div>
                  <div>
                    <span>Voice</span>
                    <div></div>
                    <span>Typing</span>
                  </div>
                </div>
                <div>
                  Describe the main idea of your application - including core features, target audience, and the problem it solves
                </div>
                <div>
                  <div>Type your answer here...</div>
                  <div>
                    <textarea placeholder="Start typing..."></textarea>
                  </div>
                  <div>
                    <button>Send</button>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div>
                <p>
                  We ask the right questions - about your users, your features, your data, your logic. We help you think
                  through the foundation before you write a single line of code.
                </p>
                <p>
                  The result? A clear specification that guides your development. A blueprint that makes sense. A plan you
                  can actually build on.
                </p>
                <div>
                  <Link href="/">
                    Start Planning
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: How It Works */}
        <section data-section="4">
          <h2>How It Works</h2>
          <p>Answer questions, get a comprehensive specification.</p>
          <div>
            <div>
              <div>
                <div>
                  <div>
                    <i className="fas fa-edit"></i>
                  </div>
                  <h4>Questions</h4>
                </div>
                <div>
                  <i className="fas fa-arrow-right"></i>
                </div>
                <div>
                  <div>
                    <i className="fas fa-file-alt"></i>
                  </div>
                  <h4>Specification</h4>
                </div>
                <div>
                  <i className="fas fa-arrow-right"></i>
                </div>
                <div>
                  <div>
                    <i className="fas fa-rocket"></i>
                  </div>
                  <h4>Application</h4>
                </div>
              </div>
            </div>
            <div>
              <div>
                <p>
                  Our AI analyzes your answers and generates a comprehensive specification - organized, structured, ready
                  to guide development.
                </p>
                <p>
                  You review, refine, and approve. Then you take that spec to any coding tool, any developer, any platform.
                  They know exactly what to build.
                </p>
                <div>
                  <Link href="/">
                    Start Planning
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: What You Get */}
        <section data-section="5">
          <h2>What You Get</h2>
          <p>A complete specification across all areas of your app.</p>
          <div>
            <div>
              <div>
                <i className="fas fa-book"></i>
              </div>
              <div>
                <h3>Overview</h3>
                <p>
                  Your app&apos;s story - Summary, Audience, Proposition, Features Overview, Journey Summary, Statement,
                  User Flow, Descriptions
                </p>
              </div>
            </div>
            <div>
              <div>
                <i className="fas fa-cog"></i>
              </div>
              <div>
                <h3>Technical</h3>
                <p>
                  The foundation - Tech Stack, Data Structures, API Endpoints, Functions. The blueprint that makes
                  everything work.
                </p>
              </div>
            </div>
            <div>
              <div>
                <i className="fas fa-chart-line"></i>
              </div>
              <div>
                <h3>Market Research</h3>
                <p>
                  Your competitive landscape - Competitors, Market Analysis, Opportunities. Who else is doing this, what
                  gaps exist.
                </p>
              </div>
            </div>
            <div>
              <div>
                <i className="fas fa-paint-brush"></i>
              </div>
              <div>
                <h3>Design & Branding</h3>
                <p>
                  Visual identity - Colors, Typography, Style Guidelines. The look and feel that matches your vision.
                </p>
              </div>
            </div>
            <div>
              <div>
                <i className="fas fa-sitemap"></i>
              </div>
              <div>
                <h3>Diagrams</h3>
                <p>
                  Visual maps - User Flows, System Architecture, Relationships. See how everything connects.
                </p>
              </div>
            </div>
            <div>
              <div>
                <i className="fas fa-terminal"></i>
              </div>
              <div>
                <h3>Prompts</h3>
                <p>
                  Ready-to-use prompts for coding tools. Take your spec and turn it into code with the right instructions.
                </p>
              </div>
            </div>
            <div>
              <div>
                <i className="fas fa-robot"></i>
              </div>
              <div>
                <h3>AI Chat</h3>
                <p>
                  Interactive AI assistant to refine your specification. Ask questions, get clarifications, improve your
                  plan.
                </p>
              </div>
            </div>
            <div>
              <div>
                <i className="fas fa-file-alt"></i>
              </div>
              <div>
                <h3>Export & Share</h3>
                <p>
                  Export your specification in multiple formats. Share with your team, developers, or stakeholders.
                </p>
              </div>
            </div>
          </div>
          <div>
            <Link href="/">
              Start Planning
            </Link>
          </div>
        </section>

        {/* Section 7: CTA */}
        <section data-section="6">
          <h2>Start Building the Right Way</h2>
          <p>Stop jumping into code. Start with a plan.</p>
          <div>
            <Link href="/">
              Start Planning
            </Link>
          </div>
        </section>
      </div>
      <MermaidRenderer />
    </>
  );
}

