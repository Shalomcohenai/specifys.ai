'use client';

import { Header } from './Header';
import Footer from './Footer';
import { ContactModal } from '../features/contact/ContactModal';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <>
      <Header />
      <main id="main-content" className="main-content">
        {children}
      </main>
      <Footer />
      <ContactModal />
    </>
  );
}
