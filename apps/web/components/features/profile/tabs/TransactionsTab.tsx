'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/hooks/useAuth';
import { getTransactions, Transaction } from '@/lib/api/credits';

export function TransactionsTab() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'grant' | 'consume' | 'refund'>('all');
  const [limit] = useState(50);

  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user, filterType]);

  const loadTransactions = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getTransactions(undefined, limit);
      setTransactions(result.transactions || []);
    } catch (err: any) {
      console.error('Error loading transactions:', err);
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filterType === 'all') return true;
    return tx.type === filterType;
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

  const formatAmount = (amount: number, type: string): string => {
    if (type === 'grant' || type === 'refund') {
      return `+${amount}`;
    }
    return `${amount}`;
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'grant':
        return 'Credit Added';
      case 'consume':
        return 'Credit Used';
      case 'refund':
        return 'Credit Refunded';
      default:
        return type;
    }
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'grant':
        return 'fa-plus-circle';
      case 'consume':
        return 'fa-minus-circle';
      case 'refund':
        return 'fa-undo';
      default:
        return 'fa-circle';
    }
  };


  if (loading) {
    return (
      <div className="tab-content">
        <i className="fa fa-spinner fa-spin"></i>
        <p>Loading transactions...</p>
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
            
            onClick={loadTransactions}
           
          >
            <i className="fa fa-refresh"></i> Retry
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content" id="transactions-content">
      <div className="content-header">
        <h2><i className="fa fa-history"></i> Credit Transactions</h2>
      </div>
      <div className="content-body" id="transactions-data">
        {/* Filter Buttons */}
        <div>
          <Button
            
            onClick={() => setFilterType('all')}
          >
            All
          </Button>
          <Button
            
            onClick={() => setFilterType('grant')}
          >
            <i className="fa fa-plus"></i> Added
          </Button>
          <Button
            
            onClick={() => setFilterType('consume')}
          >
            <i className="fa fa-minus"></i> Used
          </Button>
          <Button
            
            onClick={() => setFilterType('refund')}
          >
            <i className="fa fa-undo"></i> Refunded
          </Button>
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div>
            <i className="fa fa-inbox"></i>
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="transactions-list">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="transaction-item hover:shadow-md transition-shadow"
              >
                <div>
                  <div
                  >
                    <i className={`fa ${getTypeIcon(tx.type)}`}></i>
                  </div>
                  <div>
                    <div>
                      {getTypeLabel(tx.type)}
                    </div>
                    <div>
                      {formatDate(tx.timestamp)}
                      {tx.metadata?.creditType && (
                        <span>
                          {tx.metadata.creditType}
                        </span>
                      )}
                      {tx.metadata?.reason && (
                        <div>
                          {tx.metadata.reason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <div
                  >
                    {formatAmount(tx.amount, tx.type)}
                  </div>
                  {tx.metadata?.remaining !== undefined && tx.metadata.remaining !== null && (
                    <div>
                      Remaining: {tx.metadata.remaining}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



