'use client';

import { Button } from '@/components/ui/Button';

function AboutPageClient() {
  const handleStartClick = () => {
    if (typeof window !== 'undefined' && (window as any).trackCTA) {
      (window as any).trackCTA('Start Building', 'about_page');
    }
  };

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">About Us</h1>
        <h2 className="text-2xl font-semibold mb-4">The Story Behind Specifys.ai</h2>
        <p className="mb-4">I built Specifys.ai out of personal frustration.</p>
        <p className="mb-4">
          As someone who loves building and experimenting with AI tools, I tried to create an app idea using ChatGPT.
          But I quickly noticed a recurring problem: the AI would jump straight into coding — before it really understood
          the full scope of the idea.
        </p>
        <p className="mb-4">It felt like building a house by immediately laying bricks without a blueprint.</p>
        <p className="mb-4">
          Whenever I wanted to add new features later — like user authentication or admin roles — it felt like patchwork
          on top of an unstable base. The result was always messy, hard to maintain, and far from my original vision.
        </p>
        <p className="mb-4">
          That&apos;s when I realized what was missing: a specification phase. A way to describe the vibe of the app, the
          user flow, the features, and the logic — before writing any code.
        </p>
        <p className="mb-4">
          So I built Specifys.ai — a lightweight tool that asks the right questions and generates a clear, structured spec
          document using AI. The goal is simple: To help creators and developers start smarter, not faster.
        </p>
        <p className="mb-4">
          Specifys is based on the principles of Vibe Coding — a mindset that prioritizes clarity, flow, and intention
          before code.
        </p>
        <p className="mb-4">
          I built this tool entirely on my own using AI — no backend, no user data stored. It&apos;s designed to be fast,
          simple, and focused on one thing: helping you turn your idea into a clean plan you can actually build on.
        </p>
        <div className="flex justify-center mt-8">
          <Button
            as="a"
            href="/"
            aria-label="Start building your app specification now"
            onClick={handleStartClick}
          >
            Start Building Your App Now
          </Button>
        </div>
      </div>
    </>
  );
}

export { AboutPageClient };
export default AboutPageClient;
