/**
 * Button Component Examples
 * 
 * This file demonstrates all button sizes and variants
 * Based on the design: square buttons with slightly rounded corners,
 * bright orange color, small bold text
 */

import Link from 'next/link';
import { Button } from './Button';

export function ButtonExamples() {
  return (
    <div className="p-8 bg-bg-secondary space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-text-DEFAULT">Button Sizes</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="xs">Credits: 0</Button>
          <Button size="sm">Buy Now</Button>
          <Button size="md">Click Me</Button>
          <Button size="lg">Large Button</Button>
          <Button size="xl">Extra Large</Button>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-text-DEFAULT">Button Variants</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-text-DEFAULT">All Sizes - Primary Variant</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="xs" variant="primary">XS</Button>
          <Button size="sm" variant="primary">SM</Button>
          <Button size="md" variant="primary">MD</Button>
          <Button size="lg" variant="primary">LG</Button>
          <Button size="xl" variant="primary">XL</Button>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-text-DEFAULT">Disabled States</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm" disabled>Disabled</Button>
          <Button size="md" disabled>Disabled</Button>
          <Button size="lg" disabled>Disabled</Button>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 text-text-DEFAULT">As Link</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button as="a" href="/pricing" size="md">Link Button</Button>
          <Button as={Link} href="/about" size="md">Next Link</Button>
        </div>
      </div>
    </div>
  );
}


