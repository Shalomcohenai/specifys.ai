import type { Metadata } from 'next';
import { AboutPageClient } from './AboutPageClient';

export const metadata: Metadata = {
  title: 'About Us - Specifys.ai',
  description: 'Learn about Specifys.ai, our mission, and the story behind our AI-driven app specification platform.',
  keywords: 'AI development tools, app specification generator, no-code platform, AI-powered planning, vibe coding, AI app builder, specification generator, market research tool, app planning tool, development tools, AI tools',
  authors: [{ name: 'Specifys.ai' }],
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  openGraph: {
    siteName: 'Specifys.ai',
    title: 'About Us',
    description: 'Learn about Specifys.ai, our mission, and the story behind our AI-driven app specification platform.',
    type: 'website',
    url: 'https://specifys-ai.com/about',
    images: [
      {
        url: 'https://specifys-ai.com/assets/images/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@specifysai',
    creator: '@specifysai',
    title: 'About Us',
    description: 'Learn about Specifys.ai, our mission, and the story behind our AI-driven app specification platform.',
    images: ['https://specifys-ai.com/assets/images/og-image.png'],
  },
  alternates: {
    canonical: 'https://specifys-ai.com/about',
  },
};

export default function AboutPage() {
  return <AboutPageClient />;
}
