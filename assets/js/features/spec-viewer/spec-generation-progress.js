/**
 * Spec-generation progress. Weights follow wall-clock share after the pipeline
 * runs independent sections together. A stage that is "generating" eases from
 * a small start toward 92% of its weight. It does not jump to half credit,
 * which used to pin Prompts at 97% for the entire prompt run.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) root.SpecGenerationProgress = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const SPEC_PROGRESS_STAGES = [
    { key: 'overview', weight: 10, label: 'Overview', expectedMs: 50000 },
    { key: 'technical', weight: 12, label: 'Technical Specification', expectedMs: 55000 },
    { key: 'market', weight: 10, label: 'Market Research', expectedMs: 50000 },
    { key: 'design', weight: 10, label: 'Design & Branding', expectedMs: 50000 },
    { key: 'architecture', weight: 12, label: 'Architecture', expectedMs: 60000 },
    { key: 'visibility', weight: 8, label: 'GEO & SEO', expectedMs: 45000 },
    { key: 'prompts', weight: 38, label: 'Prompts', expectedMs: 90000 }
  ];

  function updatedAtMs(spec) {
    const raw = spec?.updatedAt;
    if (!raw) return null;
    if (typeof raw.toDate === 'function') {
      const d = raw.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null;
    }
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.getTime();
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const parsed = Date.parse(raw);
      return Number.isNaN(parsed) ? null : parsed;
    }
    if (typeof raw === 'object' && typeof raw.seconds === 'number') {
      return raw.seconds * 1000;
    }
    return null;
  }

  function generatingFraction(ageMs, expectedMs) {
    const expected = expectedMs > 0 ? expectedMs : 45000;
    const t = Math.max(0, Math.min((ageMs || 0) / expected, 1));
    const eased = 1 - Math.pow(1 - t, 2);
    return 0.08 + eased * 0.84;
  }

  function computeSpecGenerationProgress(spec, now = Date.now()) {
    const status = spec?.status || {};
    let earned = 0;
    let totalWeight = 0;
    let currentStage = null;
    let completed = 0;
    const updated = updatedAtMs(spec);
    const ageMs = updated == null ? 0 : Math.max(0, now - updated);

    for (const stage of SPEC_PROGRESS_STAGES) {
      totalWeight += stage.weight;
      const s = status[stage.key];
      if (s === 'ready' || s === 'error') {
        earned += stage.weight;
        completed += 1;
      } else if (s === 'generating') {
        earned += stage.weight * generatingFraction(ageMs, stage.expectedMs);
        if (!currentStage) currentStage = stage;
      }
    }

    if (!currentStage) {
      currentStage = SPEC_PROGRESS_STAGES.find((stage) => {
        const st = status[stage.key];
        return st !== 'ready' && st !== 'error';
      }) || SPEC_PROGRESS_STAGES[SPEC_PROGRESS_STAGES.length - 1];
    }

    const percent = totalWeight > 0
      ? Math.max(0, Math.min(100, Math.round((earned / totalWeight) * 100)))
      : 0;

    return {
      percent,
      currentStage,
      completed,
      total: SPEC_PROGRESS_STAGES.length,
      allDone: SPEC_PROGRESS_STAGES.every((stage) => {
        const st = status[stage.key];
        return st === 'ready' || st === 'error';
      })
    };
  }

  return {
    SPEC_PROGRESS_STAGES,
    computeSpecGenerationProgress,
    generatingFraction
  };
});
