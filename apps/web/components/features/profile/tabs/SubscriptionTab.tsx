'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/hooks/useAuth';
import { getSubscription, cancelSubscription, Subscription } from '@/lib/api/subscription';
import { showNotification } from '@/components/features/spec-viewer/Notification';

export function SubscriptionTab() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  useEffect(() => {
    if (user) {
      loadSubscription();
    }
  }, [user]);

  const loadSubscription = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const sub = await getSubscription();
      setSubscription(sub);
    } catch (err: any) {
      console.error('Error loading subscription:', err);
      setError(err.message || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (cancelAtPeriodEnd = true) => {
    if (!user || !subscription || cancelling) return;

    const confirmMessage = cancelAtPeriodEnd
      ? 'Are you sure you want to cancel your subscription? It will remain active until the end of the current billing period.'
      : 'Are you sure you want to cancel your subscription immediately? You will lose access to Pro features right away.';

    if (!confirm(confirmMessage)) return;

    setCancelling(true);
    try {
      await cancelSubscription(cancelAtPeriodEnd);
      showNotification(
        cancelAtPeriodEnd
          ? 'Subscription will be cancelled at the end of the billing period.'
          : 'Subscription cancelled successfully.',
        'success'
      );
      // Reload subscription
      await loadSubscription();
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      showNotification(err.message || 'Failed to cancel subscription', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    
    try {
      // Handle Firestore Timestamp
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return 'Invalid date';
    }
  };


  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'cancelled':
        return 'Cancelled';
      case 'expired':
        return 'Expired';
      case 'payment_failed':
        return 'Payment Failed';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="tab-content">
        <i className="fa fa-spinner fa-spin"></i>
        <p>Loading subscription...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tab-content">
        <div className="error-message">
          <i className="fa fa-exclamation-circle"></i>
          <p>{error}</p>
            <Button
            
            onClick={loadSubscription}
           
          >
            <i className="fa fa-refresh"></i> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="tab-content" id="subscription-content">
        <div className="content-header">
          <h2><i className="fa fa-crown"></i> Pro Subscription</h2>
        </div>
        <div className="content-body" id="subscription-data">
          <div>
            <i className="fa fa-crown"></i>
            <h3>No Active Subscription</h3>
            <p>
              You don't have an active Pro subscription. Upgrade to Pro to get unlimited specifications and advanced features.
            </p>
            <Button as="a" href="/pricing" >
              <i className="fa fa-arrow-up"></i> Upgrade to Pro
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isActive = subscription.status === 'active';
  const isCancelled = subscription.status === 'cancelled';
  const willCancelAtPeriodEnd = subscription.cancel_at_period_end === true;

  return (
    <div className="tab-content" id="subscription-content">
      <div className="content-header">
        <h2><i className="fa fa-crown"></i> Pro Subscription</h2>
      </div>
      <div className="content-body" id="subscription-data">
        {/* Subscription Status Card */}
        <div
        >
          <div>
            <div>
              <h3>Subscription Status</h3>
              <div>
                <span
                >
                  {getStatusLabel(subscription.status)}
                </span>
                {willCancelAtPeriodEnd && (
                  <span>
                    (Cancels at period end)
                  </span>
                )}
              </div>
            </div>
            {isActive && (
              <div>
                {!willCancelAtPeriodEnd ? (
                  <Button
                    
                    onClick={() => handleCancel(true)}
                    disabled={cancelling}
                  >
                    {cancelling ? (
                      <>
                        <i className="fa fa-spinner fa-spin"></i> Cancelling...
                      </>
                    ) : (
                      <>
                        <i className="fa fa-times"></i> Cancel Subscription
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    
                    onClick={() => handleCancel(false)}
                    disabled={reactivating}
                  >
                    {reactivating ? (
                      <>
                        <i className="fa fa-spinner fa-spin"></i> Reactivating...
                      </>
                    ) : (
                      <>
                        <i className="fa fa-check"></i> Reactivate
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Subscription Details */}
          <div>
            {subscription.billing_interval && (
              <div>
                <label>
                  Billing Period
                </label>
                <div>
                  {subscription.billing_interval === 'month' ? 'Monthly' : 'Yearly'}
                </div>
              </div>
            )}

            {subscription.current_period_end && (
              <div>
                <label>
                  {willCancelAtPeriodEnd ? 'Cancels On' : 'Next Billing Date'}
                </label>
                <div>
                  {formatDate(subscription.current_period_end)}
                </div>
              </div>
            )}

            {subscription.last_order_total && subscription.currency && (
              <div>
                <label>
                  Last Payment
                </label>
                <div>
                  {subscription.currency === 'USD' ? '$' : subscription.currency}{(subscription.last_order_total / 100).toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {willCancelAtPeriodEnd && subscription.current_period_end && (
            <div
            >
              <i className="fa fa-info-circle"></i>
              Your subscription will be cancelled on {formatDate(subscription.current_period_end)}. You will continue to have access to Pro features until then.
            </div>
          )}
        </div>

        {/* Subscription Info */}
        <div
        >
          <h4>
            <i className="fa fa-info-circle"></i>
            Pro Subscription Benefits
          </h4>
          <ul>
            <li>Unlimited specifications</li>
            <li>Edit specifications</li>
            <li>Advanced features</li>
            <li>Priority support</li>
          </ul>
        </div>
      </div>
    </div>
  );
}



