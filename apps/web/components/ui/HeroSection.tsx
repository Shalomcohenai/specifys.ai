'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from './Button';
import { Card } from './Card';

export interface SpecCard {
  icon: ReactNode;
  title: string;
  description: string;
}

export interface HeroSectionProps {
  title: string;
  subtitle: string;
  startButtonText: string;
  onStartClick: () => void;
  specCards: SpecCard[];
  bottomLinks?: { text: string; href: string }[];
  className?: string;
}

export function HeroSection({
  title,
  subtitle,
  startButtonText,
  onStartClick,
  specCards,
  bottomLinks,
  className,
}: HeroSectionProps) {
  return (
    <section className={cn('relative min-h-screen flex items-center justify-center', className)}>
      {/* Vanta Background */}
      <div className="absolute inset-0 bg-hero-dark" id="vanta-net" aria-hidden="true"></div>

      {/* Hero Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex flex-col items-center text-center space-y-8">
          {/* Title */}
          <h1 className="font-heading text-white font-bold text-4xl md:text-5xl lg:text-6xl">
            {title}
          </h1>

          {/* Subtitle */}
          <p className="text-white font-medium text-lg md:text-xl max-w-2xl">
            {subtitle}
          </p>

          {/* Start Button */}
          <div>
            <Button
              onClick={onStartClick}
              size="lg"
              variant="primary"
            >
              <svg
                viewBox="0 0 512 512"
                height="1em"
                xmlns="http://www.w3.org/2000/svg"
                className="mr-2"
              >
                <path
                  d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm50.7-186.9L162.4 380.6c-19.4 7.5-38.5-11.6-31-31l55.5-144.3c3.3-8.5 9.9-15.1 18.4-18.4l144.3-55.5c19.4-7.5 38.5 11.6 31 31L325.1 306.7c-3.2 8.5-9.9 15.1-18.4 18.4zM288 256a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"
                  fill="white"
                />
              </svg>
              {startButtonText}
            </Button>
          </div>

          {/* Spec Cards Showcase */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-12 w-full max-w-6xl">
            {specCards.map((card, index) => (
              <Card key={index} className="bg-white/10 backdrop-blur-sm border-white/20">
                <div className="flex flex-col items-center text-center space-y-2 p-4">
                  <div className="text-white text-2xl mb-2">
                    {card.icon}
                  </div>
                  <h3 className="font-heading text-white font-bold text-sm">{card.title}</h3>
                  <p className="text-white/80 text-xs">{card.description}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Bottom Links */}
          {bottomLinks && bottomLinks.length > 0 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              {bottomLinks.map((link, index) => (
                <div key={index} className="flex items-center gap-4">
                  <Button
                    as="a"
                    href={link.href}
                    size="sm"
                    variant="primary"
                    className="text-white"
                  >
                    {link.text}
                  </Button>
                  {index < bottomLinks.length - 1 && (
                    <span className="text-white/60">•</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
