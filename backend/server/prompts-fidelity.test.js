/**
 * Fidelity helpers — verify generated specs reflect user requirements.
 * Run: node backend/server/prompts-fidelity.test.js
 */

const { formatUserRequirements, PROMPTS } = require('../../packages/spec-prompts/index.cjs');
const { buildStageUserMessage, TOTAL_STAGES } = require('../../packages/spec-prompts/stages.cjs');

function assertSpecFidelity(specData, answers) {
  const issues = [];
  const userBlock = (answers && answers[0]) || '';
  if (!userBlock) {
    return { ok: true, issues: [] };
  }

  const pageMatches = userBlock.match(/Pages:\s*([\s\S]*?)(?:\n\n|$)/i);
  if (pageMatches) {
    const pageLines = pageMatches[1].split('\n').filter((l) => /^\d+\./.test(l.trim()));
    const overviewStr = typeof specData.overview === 'string' ? specData.overview : JSON.stringify(specData.overview || '');
    pageLines.forEach((line) => {
      const name = line.replace(/^\d+\.\s*/, '').split(' - ')[0].trim();
      if (name && !overviewStr.includes(name)) {
        issues.push(`overview missing user page: ${name}`);
      }
    });
  }

  const featureMatches = userBlock.match(/Features:\s*([\s\S]*?)(?:\n\n|$)/i);
  if (featureMatches) {
    const featureLines = featureMatches[1].split('\n').filter((l) => /^\d+\./.test(l.trim()));
    const overviewStr = typeof specData.overview === 'string' ? specData.overview : JSON.stringify(specData.overview || '');
    featureLines.forEach((line) => {
      const name = line.replace(/^\d+\.\s*/, '').trim();
      if (name && !overviewStr.toLowerCase().includes(name.toLowerCase().slice(0, Math.min(12, name.length)))) {
        issues.push(`overview missing user feature: ${name}`);
      }
    });
  }

  if (specData.prompts) {
    let promptsObj = specData.prompts;
    if (typeof promptsObj === 'string') {
      try {
        promptsObj = JSON.parse(promptsObj);
      } catch (_) {
        issues.push('prompts is not valid JSON');
      }
    }
    const fp = promptsObj?.fullPrompt || '';
    if (fp.length < 500) {
      issues.push(`prompts.fullPrompt too short (${fp.length} chars)`);
    }
    if (fp.startsWith('Build the product end-to-end using the following specifications')) {
      issues.push('prompts.fullPrompt is legacy JSON dump format');
    }
  }

  return { ok: issues.length === 0, issues };
}

function runUnitTests() {
  const failures = [];

  const block = formatUserRequirements(['App Description: Test\n\nPages:\n1. Home', '', '']);
  if (!block.includes('USER REQUIREMENTS')) failures.push('formatUserRequirements missing header');
  if (!block.includes('Pages:')) failures.push('formatUserRequirements missing pages');

  const overviewPrompt = PROMPTS.overview(['App Description: X\n\nPages:\n1. Home', '', '']);
  if (!overviewPrompt.includes('MUST')) failures.push('overview prompt missing MUST rules');
  if (!overviewPrompt.includes('inferredItems')) failures.push('overview prompt missing inferredItems');
  if (overviewPrompt.includes('complete to minimum 5 screens')) failures.push('overview still has old minimum screens rule');

  const stageMsg = buildStageUserMessage(1, '{}', '{}', '{}', []);
  if (!stageMsg.includes('STAGE 1')) failures.push('buildStageUserMessage missing stage number');
  if (TOTAL_STAGES !== 10) failures.push('TOTAL_STAGES should be 10');

  const fidelityPass = assertSpecFidelity(
    {
      overview: JSON.stringify({ overview: { screenDescriptions: { screens: [{ name: 'Dashboard' }] } } }),
      prompts: JSON.stringify({ fullPrompt: 'x'.repeat(600) })
    },
    ['App Description: X\n\nPages:\n1. Dashboard', '', '']
  );
  if (!fidelityPass.ok) failures.push('assertSpecFidelity should pass when user pages present');

  const fidelityFail = assertSpecFidelity(
    {
      overview: JSON.stringify({ overview: { screenDescriptions: { screens: [{ name: 'Other' }] } } }),
      prompts: JSON.stringify({ fullPrompt: 'x'.repeat(600) })
    },
    ['App Description: X\n\nPages:\n1. Dashboard', '', '']
  );
  if (fidelityFail.ok) failures.push('assertSpecFidelity should fail when user page missing');

  if (failures.length > 0) {
    console.error('FAILURES:\n', failures.join('\n'));
    process.exit(1);
  }
  console.log('prompts-fidelity: all unit checks passed');
}

if (require.main === module) {
  runUnitTests();
}

module.exports = { assertSpecFidelity, runUnitTests };
