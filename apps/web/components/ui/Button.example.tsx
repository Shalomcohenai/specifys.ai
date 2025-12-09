/**
 * Simple Button Usage Examples
 * 
 * Basic usage examples for the Button component
 */

'use client';

import { Button } from './Button';

export function ButtonExample() {
  return (
    <div className="p-8 bg-bg-secondary min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-text-DEFAULT">Button Examples</h1>
      
      {/* Main button - as shown in image */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-text-DEFAULT">Main Button (Credits Display)</h2>
        <Button size="sm" variant="primary">
          Credits: 0
        </Button>
      </div>

      {/* Buy Now button */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-text-DEFAULT">Buy Now Button</h2>
        <Button size="md" variant="primary">
          Buy Now
        </Button>
      </div>

      {/* All sizes on gray background */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-text-DEFAULT">All Sizes (on gray background)</h2>
        <div className="flex flex-wrap items-center gap-4 bg-bg-secondary p-4 rounded-lg">
          <Button size="xs" variant="primary">Extra Small</Button>
          <Button size="sm" variant="primary">Small</Button>
          <Button size="md" variant="primary">Medium</Button>
          <Button size="lg" variant="primary">Large</Button>
          <Button size="xl" variant="primary">Extra Large</Button>
        </div>
      </div>

      {/* With different text */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-text-DEFAULT">Different Text Examples</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm" variant="primary">Start</Button>
          <Button size="sm" variant="primary">Next</Button>
          <Button size="sm" variant="primary">Generate</Button>
          <Button size="md" variant="primary">View Details</Button>
          <Button size="md" variant="primary">Explore Now</Button>
        </div>
      </div>
    </div>
  );
}
