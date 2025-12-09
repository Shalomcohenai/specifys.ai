'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/hooks/useAuth';
import { getPurchases, Purchase } from '@/lib/api/purchases';

export function PurchasesTab() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'one_time' | 'subscription'>('all');
  const [limit] = useState(50);

  useEffect(() => {
    if (user) {
      loadPurchases();
    }
  }, [user, filterType]);

  const loadPurchases = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getPurchases(limit);
      setPurchases(result.purchases || []);
    } catch (err: any) {
      console.error('Error loading purchases:', err);
      setError(err.message || 'Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  const filteredPurchases = purchases.filter((purchase) => {
    if (filterType === 'all') return true;
    return purchase.productType === filterType;
  });

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    
    try {
      // Handle Firestore Timestamp
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  const formatPrice = (total: number, currency: string = 'USD'): string => {
    const amount = total / 100; // Convert from cents
    const symbol = currency === 'USD' ? '$' : currency;
    return `${symbol}${amount.toFixed(2)}`;
  };

  const getTypeLabel = (type?: string): string => {
    switch (type) {
      case 'one_time':
        return 'One-Time Purchase';
      case 'subscription':
        return 'Subscription';
      default:
        return 'Purchase';
    }
  };

  const getTypeIcon = (type?: string): string => {
    switch (type) {
      case 'one_time':
        return 'fa-shopping-cart';
      case 'subscription':
        return 'fa-crown';
      default:
        return 'fa-receipt';
    }
  };


  if (loading) {
    return (
      <div className="tab-content">
        <i className="fa fa-spinner fa-spin"></i>
        <p>Loading purchases...</p>
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
            
            onClick={loadPurchases}
           
          >
            <i className="fa fa-refresh"></i> Retry
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content" id="purchases-content">
      <div className="content-header">
        <h2><i className="fa fa-shopping-bag"></i> Purchase History</h2>
      </div>
      <div className="content-body" id="purchases-data">
        {/* Filter Buttons */}
        <div>
            <Button
            
            onClick={() => setFilterType('all')}
          >
            All
          </Button>
          <Button
            
            onClick={() => setFilterType('one_time')}
          >
            <i className="fa fa-shopping-cart"></i> One-Time
          </Button>
          <Button
            
            onClick={() => setFilterType('subscription')}
          >
            <i className="fa fa-crown"></i> Subscriptions
            </Button>
        </div>

        {/* Purchases List */}
        {filteredPurchases.length === 0 ? (
          <div>
            <i className="fa fa-inbox"></i>
            <p>No purchases found</p>
          </div>
        ) : (
          <div className="purchases-list">
            {filteredPurchases.map((purchase) => (
              <div
                key={purchase.id}
                className="purchase-item hover:shadow-md transition-shadow"
              >
                <div>
                  <div
                  >
                    <i className={`fa ${getTypeIcon(purchase.productType)}`}></i>
                  </div>
                  <div>
                    <div>
                      {purchase.productName || getTypeLabel(purchase.productType)}
                    </div>
                    <div>
                      {formatDate(purchase.createdAt)}
                      {purchase.orderNumber && (
                        <span>
                          Order #{purchase.orderNumber}
                        </span>
                      )}
                      {purchase.testMode && (
                        <span>
                          Test
                        </span>
                      )}
                    </div>
                    {purchase.credits && purchase.productType === 'one_time' && (
                      <div>
                        <i className="fa fa-coins"></i>
                        {purchase.credits} credit{purchase.credits !== 1 ? 's' : ''} added
                      </div>
                    )}
                    {purchase.productType === 'subscription' && purchase.subscriptionStatus && (
                      <div>
                        Status: {purchase.subscriptionStatus}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div
                  >
                    {formatPrice(purchase.total, purchase.currency)}
                  </div>
                  <div
                  >
                    {purchase.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


