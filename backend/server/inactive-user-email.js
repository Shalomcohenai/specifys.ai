/**
 * Inactive user "We Miss You" email eligibility helpers.
 * Up to 3 emails at 30 / 60 / 90 days since lastActive; counter resets on sign-in.
 */

const INACTIVE_EMAIL_MAX_COUNT = 3;
const INACTIVE_EMAIL_DAYS_PER_MILESTONE = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse lastActive (or createdAt fallback) from a user document.
 * @returns {Date|null}
 */
function parseUserLastActive(userData) {
  if (!userData) return null;

  let lastActive = null;
  if (userData.lastActive) {
    if (userData.lastActive.toDate) {
      lastActive = userData.lastActive.toDate();
    } else if (userData.lastActive instanceof Date) {
      lastActive = userData.lastActive;
    } else {
      lastActive = new Date(userData.lastActive);
    }
  } else if (userData.createdAt) {
    if (userData.createdAt.toDate) {
      lastActive = userData.createdAt.toDate();
    } else {
      lastActive = new Date(userData.createdAt);
    }
  }

  if (!lastActive || Number.isNaN(lastActive.getTime())) {
    return null;
  }
  return lastActive;
}

/**
 * Emails already sent in the current inactivity cycle (0–3).
 * Migrates legacy inactiveEmailSent === true to count 1.
 */
function getInactiveEmailCount(userData) {
  if (typeof userData.inactiveEmailCount === 'number' && !Number.isNaN(userData.inactiveEmailCount)) {
    return Math.min(INACTIVE_EMAIL_MAX_COUNT, Math.max(0, Math.floor(userData.inactiveEmailCount)));
  }
  if (userData.inactiveEmailSent === true) {
    return 1;
  }
  return 0;
}

/**
 * How many 30-day milestones the user has reached (capped at 3).
 */
function computeInactiveEmailMilestones(daysSinceActive) {
  if (daysSinceActive < INACTIVE_EMAIL_DAYS_PER_MILESTONE) {
    return 0;
  }
  return Math.min(
    INACTIVE_EMAIL_MAX_COUNT,
    Math.floor(daysSinceActive / INACTIVE_EMAIL_DAYS_PER_MILESTONE)
  );
}

function daysSinceDate(referenceDate, now = new Date()) {
  return Math.floor((now.getTime() - referenceDate.getTime()) / MS_PER_DAY);
}

/**
 * Whether to send the next reminder today (at most one per daily run).
 */
function shouldSendInactiveReminder(daysSinceActive, inactiveEmailCount) {
  const milestonesReached = computeInactiveEmailMilestones(daysSinceActive);
  return milestonesReached > inactiveEmailCount && inactiveEmailCount < INACTIVE_EMAIL_MAX_COUNT;
}

module.exports = {
  INACTIVE_EMAIL_MAX_COUNT,
  INACTIVE_EMAIL_DAYS_PER_MILESTONE,
  MS_PER_DAY,
  parseUserLastActive,
  getInactiveEmailCount,
  computeInactiveEmailMilestones,
  daysSinceDate,
  shouldSendInactiveReminder
};
