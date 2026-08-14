function resolveSubscriptionActivityAction(subscriptionStatus, metadata = {}) {
  const explicit = metadata.action || metadata.activityAction;
  if (explicit === 'renewed' || explicit === 'activated' || explicit === 'cancelled') {
    return explicit;
  }

  if (metadata.cancelAtPeriodEnd) {
    return 'cancelled';
  }

  const status = String(subscriptionStatus || '').trim().toLowerCase();
  if (status === 'renewed') return 'renewed';
  if (status === 'active' || status === 'paid' || status === 'on_trial') return 'activated';
  return 'cancelled';
}

function buildSubscriptionActivityTitle(subscriptionType, action) {
  const typeLabel = subscriptionType || 'Unknown';
  if (action === 'renewed') return `Subscription renewed · ${typeLabel}`;
  if (action === 'cancelled') return `Subscription cancelled · ${typeLabel}`;
  return `Subscription activated · ${typeLabel}`;
}

function periodKeyFromMetadata(metadata = {}) {
  const raw = metadata.periodKey || metadata.renewsAt || metadata.currentPeriodEnd || null;
  if (!raw) return new Date().toISOString().slice(0, 10);
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

module.exports = {
  resolveSubscriptionActivityAction,
  buildSubscriptionActivityTitle,
  periodKeyFromMetadata
};
