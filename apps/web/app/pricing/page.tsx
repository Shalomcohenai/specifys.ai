'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createCheckout } from '@/lib/api/checkout';
import {
  loadLemonSqueezySDK,
  openCheckoutOverlay,
  getLemonProductsConfig,
  LemonProductsConfig
} from '@/lib/lemon-squeezy';
import { Container } from '@/components/ui/Container';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PricingCard, PricingFeature } from '@/components/ui/PricingCard';
import { ToggleButton } from '@/components/ui/ToggleButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusIcon } from '@/components/ui/StatusIcon';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { cn } from '@/lib/utils/cn';

type BillingPeriod = 'monthly' | 'yearly';
type AlertType = 'success' | 'error' | 'info';

export default function PricingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [alert, setAlert] = useState<{ message: string; type: AlertType } | null>(null);
  const [loadingButtons, setLoadingButtons] = useState<Set<string>>(new Set());
  const [productsConfig, setProductsConfig] = useState<LemonProductsConfig | null>(null);

  useEffect(() => {
    // Load products config
    getLemonProductsConfig()
      .then(setProductsConfig)
      .catch((error) => {
        console.error('Error loading products config:', error);
      });

    // Handle checkout redirect
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');
    const product = params.get('product');
    const reason = params.get('reason');
    const message = params.get('message');

    if (checkoutStatus === 'success') {
      setAlert({
        message: product
          ? `Purchase successful! Thank you for your purchase.`
          : 'Purchase successful!',
        type: 'success'
      });
      // Clean URL
      const newParams = new URLSearchParams(params);
      newParams.delete('checkout');
      newParams.delete('product');
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${newParams.toString() ? `?${newParams.toString()}` : ''}`
      );
    } else if (checkoutStatus === 'cancel') {
      setAlert({
        message: 'Checkout was cancelled.',
        type: 'info'
      });
      const newParams = new URLSearchParams(params);
      newParams.delete('checkout');
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${newParams.toString() ? `?${newParams.toString()}` : ''}`
      );
    }

    if (reason || message) {
      const alertType = reason === 'insufficient_credits' ? 'error' : 'info';
      setAlert({
        message: message || 'Please choose a plan to continue.',
        type: alertType
      });
      const newParams = new URLSearchParams(params);
      newParams.delete('reason');
      newParams.delete('message');
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${newParams.toString() ? `?${newParams.toString()}` : ''}`
      );
    }
  }, []);

  const showAlert = (message: string, type: AlertType = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const hideAlert = () => {
    setAlert(null);
  };

  const setButtonLoading = (productKey: string, isLoading: boolean) => {
    setLoadingButtons((prev) => {
      const next = new Set(prev);
      if (isLoading) {
        next.add(productKey);
      } else {
        next.delete(productKey);
      }
      return next;
    });
  };

  const purchaseSpec = async (productKey: string) => {
    if (!user) {
      showAlert('Please log in to purchase.', 'info');
      router.push('/auth');
      return;
    }

    setButtonLoading(productKey, true);

    try {
      if (!productsConfig) {
        const config = await getLemonProductsConfig();
        setProductsConfig(config);
        if (!config.products[productKey]) {
          throw new Error('Selected product is not available. Please try again later.');
        }
      } else if (!productsConfig.products[productKey]) {
        throw new Error('Selected product is not available. Please try again later.');
      }

      const result = await createCheckout({
        productKey,
        successPath: '/pricing',
        successQuery: { product: productKey }
      });

      if (!result.checkoutUrl) {
        throw new Error('Checkout URL missing from server response');
      }

      await openCheckoutOverlay(result.checkoutUrl, {
        onOpen: () => {
          setButtonLoading(productKey, false);
        },
        onSuccess: () => {
          showAlert('Purchase successful! You will be redirected shortly.', 'success');
        }
      });
    } catch (error: any) {
      console.error('Purchase error:', error);
      setButtonLoading(productKey, false);
      showAlert(error.message || 'Error initiating purchase. Please try again.', 'error');
    }
  };

  const switchBilling = (period: BillingPeriod) => {
    setBillingPeriod(period);
  };

  const isButtonLoading = (productKey: string) => loadingButtons.has(productKey);
  // Buttons should be clickable even if user is not logged in (will redirect to auth)
  const isButtonDisabled = authLoading;

  // Features for each plan
  const singleSpecFeatures: PricingFeature[] = [
    { text: '1 Specification', included: true },
    { text: 'Full Spec Details', included: true },
    { text: 'Tools Map Access', included: true },
    { text: 'Full Prompts Export for App Building', included: true },
    { text: 'Export Specifications', included: true },
    { text: 'Edit Specifications', included: false },
  ];

  const threePackFeatures: PricingFeature[] = [
    { text: '3 Specifications', included: true },
    { text: 'Full Spec Details', included: true },
    { text: 'Tools Map Access', included: true },
    { text: 'Full Prompts Export for App Building', included: true },
    { text: 'Export Specifications', included: true },
    { text: 'Edit Specifications', included: false },
  ];

  const proFeatures: PricingFeature[] = [
    { text: 'Unlimited Specifications', included: true },
    { text: 'Edit & Customize Specs', included: true },
    { text: 'All Tools & Features', included: true },
    { text: 'Full Prompts Export for App Building', included: true },
    { text: 'Export Specifications', included: true },
    { text: 'Mockup Generation', included: true },
    { text: 'Priority Support', included: true },
  ];

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Alert */}
      {alert && (
        <div
          className={cn(
            'fixed top-20 left-1/2 transform -translate-x-1/2 z-50',
            'px-6 py-4 rounded-lg shadow-lg',
            'flex items-center gap-4',
            alert.type === 'success' && 'bg-success text-white',
            alert.type === 'error' && 'bg-danger text-white',
            alert.type === 'info' && 'bg-info text-white'
          )}
        >
          <span>{alert.message}</span>
          <button
            onClick={hideAlert}
            className="ml-4 text-white hover:opacity-75"
            aria-label="Close alert"
          >
            ×
          </button>
        </div>
      )}

      {/* Hero Section */}
      <section className="py-16 bg-bg-primary">
        <Container>
          <SectionHeader
            title="Build Smart with Specifys.ai"
            subtitle="Choose the perfect plan for your app development needs"
            className="mb-4"
          />
          <p className="text-center text-text-DEFAULT font-medium text-sm">
            Single specs, packs, or unlimited Pro subscriptions - choose what works for you
          </p>
        </Container>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 bg-bg-primary">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Single Spec */}
            <Card className="relative p-6 flex flex-col border-2 border-primary">
              <h3 className="font-heading text-primary font-bold text-2xl mb-2">Single Spec</h3>
              <p className="text-text-DEFAULT font-medium text-sm mb-6">One additional specification</p>
              
              {/* Features */}
              <div className="flex-grow mb-6">
                <ul className="space-y-3">
                  {singleSpecFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <StatusIcon status={feature.included ? 'check' : 'cross'} />
                      <span
                        className={cn(
                          'text-sm',
                          feature.included ? 'text-text-DEFAULT' : 'text-text-muted'
                        )}
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Price */}
              <div className="mb-6">
                <PriceDisplay price="4.90" period="one-time" size="lg" />
              </div>

              {/* Button */}
              <Button
                onClick={() => purchaseSpec('single_spec')}
                disabled={isButtonDisabled || isButtonLoading('single_spec')}
                size="md"
                variant="primary"
                className="w-full"
              >
                {isButtonLoading('single_spec') ? 'Loading...' : 'Buy Now'}
              </Button>
            </Card>

            {/* 3-Pack */}
            <Card className="relative p-6 flex flex-col border-2 border-primary">
              {/* Badge - positioned at top right corner */}
              <div className="absolute -top-3 right-4 z-10">
                <Badge>BEST VALUE</Badge>
              </div>

              <h3 className="font-heading text-primary font-bold text-2xl mb-2">3-Pack</h3>
              <p className="text-text-DEFAULT font-medium text-sm mb-6">Three specifications at a discount</p>
              
              {/* Features */}
              <div className="flex-grow mb-6">
                <ul className="space-y-3">
                  {threePackFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <StatusIcon status={feature.included ? 'check' : 'cross'} />
                      <span
                        className={cn(
                          'text-sm',
                          feature.included ? 'text-text-DEFAULT' : 'text-text-muted'
                        )}
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Price */}
              <div className="mb-6">
                <PriceDisplay price="9.90" period="one-time" size="lg" />
              </div>

              {/* Button */}
              <Button
                onClick={() => purchaseSpec('three_pack')}
                disabled={isButtonDisabled || isButtonLoading('three_pack')}
                size="md"
                variant="primary"
                className="w-full"
              >
                {isButtonLoading('three_pack') ? 'Loading...' : 'Buy Now'}
              </Button>
            </Card>

            {/* Pro Subscription */}
            <Card className="relative p-6 flex flex-col border-2 border-primary">
              {/* Badge - positioned at top right corner */}
              <div className="absolute -top-3 right-4 z-10">
                <Badge>PRO</Badge>
              </div>

              <h3 className="font-heading text-primary font-bold text-2xl mb-2">Pro</h3>
              <p className="text-text-DEFAULT font-medium text-sm mb-6">Unlimited specifications with editing</p>

              {/* Billing Toggle */}
              <div className="mb-6 flex justify-center">
                <ToggleButton
                  options={[
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'yearly', label: 'Yearly' }
                  ]}
                  value={billingPeriod}
                  onChange={(value) => switchBilling(value as BillingPeriod)}
                />
              </div>

              {/* Features */}
              <div className="flex-grow mb-6">
                <ul className="space-y-3">
                  {proFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <StatusIcon status={feature.included ? 'check' : 'cross'} />
                      <span
                        className={cn(
                          'text-sm',
                          feature.included ? 'text-text-DEFAULT' : 'text-text-muted'
                        )}
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Price */}
              <div className="mb-6">
                {billingPeriod === 'monthly' ? (
                  <PriceDisplay price="29.90" period="per month" size="lg" />
                ) : (
                  <>
                    <PriceDisplay price="299.90" period="per year" size="lg" />
                    <div className="text-center text-text-DEFAULT font-medium text-sm mt-2">
                      Save $58.30/year
                    </div>
                  </>
                )}
              </div>

              {/* Button */}
              <Button
                onClick={() => purchaseSpec(billingPeriod === 'monthly' ? 'pro_monthly' : 'pro_yearly')}
                disabled={isButtonDisabled || isButtonLoading(billingPeriod === 'monthly' ? 'pro_monthly' : 'pro_yearly')}
                size="md"
                variant="primary"
                className="w-full"
              >
                {isButtonLoading(billingPeriod === 'monthly' ? 'pro_monthly' : 'pro_yearly')
                  ? 'Loading...'
                  : 'Subscribe Now'}
              </Button>
            </Card>
          </div>
        </Container>
      </section>
    </div>
  );
}
