import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Badge } from './Badge';
import { Button } from './Button';
import { FeatureList } from './FeatureList';
import { PriceDisplay } from './PriceDisplay';
import Link from 'next/link';

export interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingCardProps {
  title: string;
  description?: string;
  price: string;
  pricePeriod?: string;
  features: PricingFeature[];
  ctaText: string;
  ctaHref: string;
  badge?: string;
  highlightTop?: boolean; // פס הדגשה עליון
  className?: string;
}

export function PricingCard({
  title,
  description,
  price,
  pricePeriod,
  features,
  ctaText,
  ctaHref,
  badge,
  highlightTop = false,
  className,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        'relative',
        'bg-bg-primary',
        'rounded-lg',
        'border border-gray-light',
        'p-6',
        'shadow-sm',
        'flex flex-col',
        highlightTop && 'border-t-4 border-t-primary',
        className
      )}
    >
      {/* Badge */}
      {badge && (
        <div className="mb-4">
          <Badge>{badge}</Badge>
        </div>
      )}

      {/* Title */}
      <h3 className="font-heading text-text-DEFAULT font-bold text-xl mb-2">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-text-DEFAULT font-medium text-sm mb-4">{description}</p>
      )}

      {/* Price */}
      <div className="mb-6">
        <PriceDisplay price={price} period={pricePeriod} />
      </div>

      {/* Features */}
      <div className="flex-grow mb-6">
        <FeatureList features={features} />
      </div>

      {/* CTA Button */}
      <Button as={Link} href={ctaHref} size="md" variant="primary" className="w-full">
        {ctaText}
      </Button>
    </div>
  );
}

