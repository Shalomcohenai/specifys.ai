/**
 * Stage-based generation status.
 * A section counts only when it is finished (ready or error).
 * The section that is still running does not add a partial percent.
 */
(function (root) {
  var STAGES = [
    { key: 'overview', label: 'Overview', detail: 'Problem, audience, features, and user flow.' },
    { key: 'technical', label: 'Technical', detail: 'Stack, data model, and API.' },
    { key: 'market', label: 'Market research', detail: 'Competitors and positioning.' },
    { key: 'design', label: 'Design', detail: 'Screens and visual direction.' },
    { key: 'architecture', label: 'Architecture', detail: 'How the system fits together.' },
    { key: 'visibility', label: 'GEO and SEO', detail: 'How people and search can find it.' },
    { key: 'prompts', label: 'Prompts', detail: 'Build steps for an AI coding tool. This step often takes several minutes.' }
  ];

  var EXPECTATION = 'A full spec usually takes 8 to 10 minutes. Overview is the short step. Prompts is usually the long one.';
  var BACKGROUND = 'You can leave this page. Generation continues in the background, and we email you when it is ready.';

  function compute(spec) {
    var status = (spec && spec.status) || {};
    var completed = 0;
    var current = null;
    var failed = null;

    STAGES.forEach(function (stage) {
      var state = status[stage.key];
      if (state === 'ready' || state === 'error') {
        completed += 1;
        if (state === 'error' && !failed) failed = stage;
      } else if (!current) {
        current = stage;
      }
    });

    var allDone = completed === STAGES.length && !failed;
    var active = failed || current || STAGES[STAGES.length - 1];
    var activeStatus = status[active.key];
    var sectionNumber = allDone ? STAGES.length : Math.min(completed + (failed ? 0 : 1), STAGES.length);
    var headline;

    if (allDone) {
      headline = 'All ' + STAGES.length + ' sections are ready.';
    } else if (failed) {
      headline = failed.label + ' needs attention. Retry that section. Section ' + sectionNumber + ' of ' + STAGES.length + '.';
    } else if (activeStatus === 'generating') {
      headline = 'Generating ' + active.label + '. Section ' + sectionNumber + ' of ' + STAGES.length + '.';
    } else {
      headline = 'Next: ' + active.label + '. Section ' + sectionNumber + ' of ' + STAGES.length + '.';
    }

    return {
      percent: allDone ? 100 : Math.round((completed / STAGES.length) * 100),
      completed: completed,
      total: STAGES.length,
      allDone: allDone,
      currentStage: active,
      headline: headline,
      detail: allDone ? 'You can open any section.' : active.detail,
      expectation: allDone ? '' : EXPECTATION,
      background: allDone ? '' : BACKGROUND
    };
  }

  root.SpecGenerationProgress = {
    STAGES: STAGES,
    compute: compute
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
