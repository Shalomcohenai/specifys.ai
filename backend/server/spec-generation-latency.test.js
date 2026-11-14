/**
 * Latency changes for spec generation. No live OpenAI calls.
 * Run: node --test backend/server/spec-generation-latency.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const { mapWithConcurrency } = require('./async-pool');
const {
  applySpecCompletionLimits,
  getStageCallOptions
} = require('./spec-generation-call-options');
const {
  buildStageUserMessage,
  assembleFullPrompt,
  compactSpecContext,
  PROMPT_CONTEXT_CAPS
} = require('../../packages/spec-prompts/stages.cjs');
function loadSpecGenerationProgress() {
  // The viewer script is ESM because the repo root package.json sets "type": "module".
  // Node 18 CI cannot require() it. Evaluate the classic-script build instead.
  const filename = path.join(__dirname, '../../assets/js/features/spec-viewer/spec-generation-progress.js');
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.module = { exports: {} };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
  return sandbox.module.exports;
}

const { computeSpecGenerationProgress } = loadSpecGenerationProgress();
const { runPromptStages, PROMPT_STAGE_CONCURRENCY } = require('./prompts-stage-runner');

test('prompt stages use low reasoning and a smaller completion cap on gpt-5.6-luna', () => {
  const prompt = applySpecCompletionLimits({ model: 'gpt-5.6-luna' }, 'gpt-5.6-luna', getStageCallOptions('prompt-stage'));
  assert.equal(prompt.reasoning_effort, 'low');
  assert.equal(prompt.max_completion_tokens, 8192);
  assert.equal(prompt.max_tokens, undefined);

  const overview = applySpecCompletionLimits({ model: 'gpt-5.6-luna' }, 'gpt-5.6-luna', getStageCallOptions('overview'));
  assert.equal(overview.reasoning_effort, undefined);
  assert.equal(overview.max_completion_tokens, 16384);

  const repair = applySpecCompletionLimits({}, 'gpt-5.6-luna', getStageCallOptions('mermaid-repair'));
  assert.equal(repair.reasoning_effort, 'low');
  assert.equal(repair.max_completion_tokens, 4096);
});

test('minimal reasoning effort is never sent (gpt-5.6-luna returns 400)', () => {
  const body = applySpecCompletionLimits({}, 'gpt-5.6-luna', { reasoningEffort: 'minimal', maxCompletionTokens: 1024 });
  assert.equal(body.reasoning_effort, undefined);
  assert.equal(body.max_completion_tokens, 1024);
});

test('non reasoning models keep max_tokens and omit reasoning_effort', () => {
  const body = applySpecCompletionLimits({}, 'gpt-4o', getStageCallOptions('prompt-stage'));
  assert.equal(body.max_tokens, 8192);
  assert.equal(body.max_completion_tokens, undefined);
  assert.equal(body.reasoning_effort, undefined);
});

test('default spec model id is still gpt-5.6-luna', () => {
  const src = fs.readFileSync(path.join(__dirname, 'spec-thread-manager.js'), 'utf8');
  assert.match(src, /const model = configuredModel \|\| 'gpt-5\.6-luna'/);
  assert.equal(src.includes('gpt-6'), false);
});

test('prompt context is compacted and capped, and parallel stages get a pipeline outline', () => {
  const pretty = JSON.stringify({ technical: { techStack: { frontend: 'React' }, tail: 'keep-me' } }, null, 2);
  const compact = compactSpecContext(pretty, 100000);
  assert.equal(compact.includes('\n  '), false);
  assert.equal(compact.includes('keep-me'), true);

  const huge = `{"technical":"${'x'.repeat(PROMPT_CONTEXT_CAPS.technical + 5000)}","tail":"ENDMARK"}`;
  const sliced = compactSpecContext(huge, PROMPT_CONTEXT_CAPS.technical);
  assert.ok(sliced.length <= PROMPT_CONTEXT_CAPS.technical);
  assert.equal(sliced.includes('…[truncated]…'), true);
  assert.equal(sliced.includes('ENDMARK'), true);

  const parallel = buildStageUserMessage(4, '{}', '{}', '{}', []);
  assert.equal(parallel.includes('STAGE 4'), true);
  assert.equal(parallel.includes('PIPELINE'), true);
  assert.equal(parallel.includes('PREVIOUS STAGES CONTEXT'), false);

  const sequential = buildStageUserMessage(2, '{}', '{}', '{}', ['stage one body']);
  assert.equal(sequential.includes('PREVIOUS STAGES CONTEXT'), true);
});

test('assembled prompt keeps real stage numbers when a stage is missing', () => {
  const full = assembleFullPrompt([
    { stageNumber: 1, content: 'setup body' },
    { stageNumber: 10, content: 'deploy body' }
  ], '{}', '{}');
  assert.equal(full.includes('STAGE 1: PROJECT SETUP'), true);
  assert.equal(full.includes('STAGE 10: DEPLOYMENT'), true);
  assert.equal(full.includes('STAGE 2:'), false);
  assert.equal(full.includes('setup body'), true);
  assert.equal(full.includes('deploy body'), true);
});

test('prompt stages run with bounded concurrency and stay in stage order', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const threadManager = {
    async runStage(_threadId, stage, userMessage) {
      assert.equal(stage, 'prompt-stage');
      const match = userMessage.match(/STAGE (\d+)/);
      const stageNum = Number(match[1]);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, stageNum === 1 ? 60 : 5));
      inFlight -= 1;
      return { prompts: { fullPrompt: `body-${stageNum}` } };
    }
  };

  const stages = await runPromptStages(threadManager, 'chat-completions', {
    overview: '{}',
    technical: '{}',
    design: '{}',
    specId: 's1',
    concurrency: PROMPT_STAGE_CONCURRENCY
  });

  assert.equal(maxInFlight > 1, true);
  assert.equal(maxInFlight <= PROMPT_STAGE_CONCURRENCY, true);
  assert.deepEqual(stages.map((s) => s.stageNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(stages[0].content, 'body-1');
  assert.equal(stages[9].content, 'body-10');
});

test('mapWithConcurrency preserves order', async () => {
  const values = await mapWithConcurrency([3, 1, 2], 2, async (n) => {
    await new Promise((resolve) => setTimeout(resolve, n * 10));
    return n * 10;
  });
  assert.deepEqual(values, [30, 10, 20]);
});

test('prompts generating does not start at 97 percent', () => {
  const now = Date.parse('2026-11-14T22:00:00Z');
  const spec = {
    updatedAt: new Date(now).toISOString(),
    status: {
      overview: 'ready',
      technical: 'ready',
      market: 'ready',
      design: 'ready',
      architecture: 'ready',
      visibility: 'ready',
      prompts: 'generating'
    }
  };
  const atStart = computeSpecGenerationProgress(spec, now);
  const halfway = computeSpecGenerationProgress(spec, now + 45000);
  const done = computeSpecGenerationProgress({
    ...spec,
    status: { ...spec.status, prompts: 'ready' }
  }, now + 45000);

  assert.equal(atStart.percent < 80, true);
  assert.equal(atStart.percent === 97, false);
  assert.equal(halfway.percent > atStart.percent, true);
  assert.equal(halfway.percent < 100, true);
  assert.equal(done.percent, 100);
  assert.equal(done.allDone, true);
});

test('generateAllSpecs overlaps independent sections and still gates prompts', async () => {
  const svc = require('./spec-generation-service-v2');
  const original = {
    generateSection: svc.generateSection,
    generateArchitecture: svc.generateArchitecture,
    generateVisibility: svc.generateVisibility,
    generatePrompts: svc.generatePrompts
  };
  let sectionInFlight = 0;
  let maxSections = 0;
  let waveB = 0;
  let maxWaveB = 0;
  svc.generateSection = async (_id, stage) => {
    sectionInFlight += 1;
    maxSections = Math.max(maxSections, sectionInFlight);
    await new Promise((resolve) => setTimeout(resolve, 30));
    sectionInFlight -= 1;
    return `${stage}-content`;
  };
  svc.generateArchitecture = async () => {
    waveB += 1;
    maxWaveB = Math.max(maxWaveB, waveB);
    await new Promise((resolve) => setTimeout(resolve, 30));
    waveB -= 1;
    return 'architecture-markdown';
  };
  svc.generateVisibility = async () => {
    waveB += 1;
    maxWaveB = Math.max(maxWaveB, waveB);
    await new Promise((resolve) => setTimeout(resolve, 30));
    waveB -= 1;
    return '{"visibility":true}';
  };
  let promptsCalled = false;
  svc.generatePrompts = async () => {
    promptsCalled = true;
    return '{"generated":true}';
  };

  try {
    const result = await svc.generateAllSpecs('spec-latency', '{"overview":{}}', []);
    assert.equal(maxSections, 3);
    assert.equal(maxWaveB, 2);
    assert.equal(promptsCalled, true);
    assert.equal(result.technical, 'technical-content');
    assert.equal(result.architecture, 'architecture-markdown');
    assert.equal(result.visibility, '{"visibility":true}');
    assert.equal(result.prompts, '{"generated":true}');
  } finally {
    Object.assign(svc, original);
  }
});

test('backup poll waits for prompts instead of stopping after design', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../../assets/js/features/spec-viewer/modules/DataService.js'),
    'utf8'
  );
  assert.match(
    src,
    /advancedAllDone = \['technical', 'market', 'design', 'architecture', 'visibility', 'prompts'\]/
  );
});
