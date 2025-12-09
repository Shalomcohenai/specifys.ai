'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div>
      <main>
        <div>
          <h1>404 - Page Not Found</h1>
          <p>The page you are looking for does not exist.</p>
          <div>
            <Link href="/">
              Back to Homepage
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

