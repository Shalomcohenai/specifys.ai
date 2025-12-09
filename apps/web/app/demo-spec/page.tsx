'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DemoSpecPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to spec-viewer with a demo spec ID
    // Using the hardcoded demo spec ID from backend (chat-routes.ts)
    // This is a public spec that can be viewed without authentication
    const demoSpecId = 'iAzaUwtSW3qvcW87lICL';
    router.push(`/spec-viewer?id=${demoSpecId}`);
  }, [router]);

  return null;
}
