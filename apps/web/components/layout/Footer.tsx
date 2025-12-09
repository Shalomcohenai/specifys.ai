'use client';

import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { SocialIcons } from '@/components/ui/SocialIcons';
import { ScrollToTop } from '@/components/ui/ScrollToTop';

const handleContactClick = (e: React.MouseEvent) => {
  e.preventDefault();
  const event = new CustomEvent('open-contact-modal');
  window.dispatchEvent(event);
};

const navigationLinks = [
  { href: '/how', label: 'How It Works' },
  { href: '/about', label: 'About Us' },
  { href: '/why', label: 'Why?' },
  { href: '/blog', label: 'Blog' },
  { href: '/articles', label: 'Articles' },
  { href: '/academy', label: 'Academy' },
  { href: '/tools/map/vibe-coding-tools-map', label: 'Vibe Coding Tools Map' },
  { href: '/tool-picker', label: 'Tool Finder' },
  { href: '#contact', label: 'Contact Us' },
];

const socialIcons = [
  {
    href: 'https://www.linkedin.com/company/specifys-ai/',
    label: 'Follow us on LinkedIn',
    icon: <i className="fab fa-linkedin-in text-lg"></i>,
  },
  {
    href: 'https://www.facebook.com/profile.php?id=61576402600129&locale=he_IL',
    label: 'Follow us on Facebook',
    icon: <i className="fab fa-facebook-f text-lg"></i>,
  },
  {
    href: 'mailto:specifysai@gmail.com',
    label: 'Send us an email',
    icon: <i className="fas fa-envelope text-lg"></i>,
  },
  {
    href: 'https://www.producthunt.com/products/specifys-ai',
    label: 'Check us out on Product Hunt',
    icon: <i className="fab fa-product-hunt text-lg"></i>,
  },
];

export default function Footer() {
  return (
    <>
      <footer className="bg-bg-primary border-t border-gray-light py-6">
        <Container>
          {/* Top Row: Navigation Links + Social Icons */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 mb-4">
            {/* Navigation Links */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-4">
              {navigationLinks.map((link) => (
                <div key={link.href} className="flex items-center">
                  {link.href === '#contact' ? (
                    <button
                      onClick={handleContactClick}
                      aria-label={link.label}
                      className="font-sans text-text-DEFAULT text-sm font-normal hover:text-primary transition-colors no-underline bg-transparent border-0 cursor-pointer p-0"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <Link
                      href={link.href}
                      aria-label={link.label}
                      className="font-sans text-text-DEFAULT text-sm font-normal hover:text-primary transition-colors no-underline"
                    >
                      {link.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* Separator */}
            <div className="hidden md:block w-px h-4 bg-text-DEFAULT opacity-30 mx-2" />

            {/* Social Icons */}
            <SocialIcons icons={socialIcons} />
          </div>

          {/* Bottom Row: Copyright */}
          <div className="text-center pt-2">
            <p className="font-sans text-text-DEFAULT text-xs font-normal text-text-secondary">
              © 2025 specifys.ai. All rights reserved.
            </p>
          </div>
        </Container>
      </footer>

      {/* Scroll to Top Button */}
      <ScrollToTop />
    </>
  );
}
