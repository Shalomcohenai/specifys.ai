/**
 * Firestore sync for specQueue-driven generation (same behavior as POST /api/specs/:id/generate-all).
 */

const { db, admin } = require('./firebase-admin');
const specEvents = require('./spec-events');
const { logger } = require('./logger');

/**
 * Register spec.update / spec.complete / spec.error listeners for one specId.
 * Call before specQueue.add to avoid missing early events.
 *
 * @param {object} opts
 * @param {string} opts.specId
 * @param {string} opts.requestId
 * @param {() => void} [opts.onGenerationComplete] - e.g. schedule OpenAI upload (skipped for pipeline canary inside upload fn)
 */
function attachSpecQueueFirestoreListeners({ specId, requestId, onGenerationComplete }) {
  const updateListener = (event) => {
    if (event.specId === specId) {
      const updateData = {
        [`status.${event.stage}`]: event.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (event.status === 'ready' && event.content) {
        updateData[event.stage] = event.content;
      }
      updateData.generationVersion = 'v2';

      db.collection('specs').doc(specId).update(updateData).catch((err) => {
        logger.error({ requestId, specId, stage: event.stage, error: err.message }, '[spec-queue-listeners] Failed to update spec in Firestore');
      });
    }
  };

  const completeListener = async (event) => {
    if (event.specId !== specId) return;
    specEvents.removeListener('spec.update', updateListener);
    specEvents.removeListener('spec.complete', completeListener);
    specEvents.removeListener('spec.error', errorListener);

    if (typeof onGenerationComplete === 'function') {
      try {
        onGenerationComplete();
      } catch (e) {
        logger.warn({ requestId, specId, error: e.message }, '[spec-queue-listeners] onGenerationComplete failed');
      }
    }
  };

  const errorListener = (event) => {
    if (event.specId === specId) {
      logger.error({ requestId, specId, stage: event.stage, error: event.error }, '[spec-queue-listeners] Spec generation error');
      db.collection('specs').doc(specId).update({
        [`status.${event.stage}`]: 'error',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }).catch((err) => {
        logger.error({ requestId, specId, stage: event.stage, error: err.message }, '[spec-queue-listeners] Failed to update spec error status in Firestore');
      });
    }
  };

  specEvents.on('spec.update', updateListener);
  specEvents.on('spec.complete', completeListener);
  specEvents.on('spec.error', errorListener);
}

module.exports = { attachSpecQueueFirestoreListeners };
