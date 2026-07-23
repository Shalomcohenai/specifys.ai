/**
 * Demo Spec Formatter — legacy helpers retained for backward compatibility.
 *
 * The live demo page (`demo-spec-main.js`) renders NEW enriched specs via
 * Spec Viewer Enriched* modules. These format* functions remain available if
 * older bookmarks or scripts call them with legacy shapes (applicationSummary).
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function isEnrichedOverview(data) {
  return !!(data && (data.ideaSummary || data.shortTitle || data.personas || data.coreFeaturesOverview));
}

function formatOverview(data) {
  if (!data) return '';
  if (isEnrichedOverview(data)) {
    let html = '<div class="content-section">';
    if (data.shortTitle) html += `<h2>${escapeHtml(data.shortTitle)}</h2>`;
    if (data.ideaSummary) {
      html += '<h3><i class="fa fa-clipboard"></i> Idea summary</h3>';
      html += `<p>${escapeHtml(data.ideaSummary)}</p>`;
    }
    if (data.problemStatement) {
      html += '<h3>Problem</h3><p>' + escapeHtml(data.problemStatement) + '</p>';
    }
    if (data.valueProposition) {
      html += '<h3>Value proposition</h3><p>' + escapeHtml(data.valueProposition) + '</p>';
    }
    if (Array.isArray(data.coreFeaturesOverview)) {
      html += '<h3>Core features</h3><ul>';
      data.coreFeaturesOverview.forEach((f) => {
        html += `<li>${escapeHtml(f)}</li>`;
      });
      html += '</ul>';
    }
    html += '</div>';
    return html;
  }

  // Legacy Taskify-era shape (kept for old user/demo payloads only)
  let html = '';
  if (data.applicationSummary && data.applicationSummary.paragraphs) {
    html += '<div class="content-section">';
    html += '<h3><i class="fa fa-clipboard"></i> Application Summary</h3>';
    const paragraphsToShow = Math.ceil(data.applicationSummary.paragraphs.length / 2);
    data.applicationSummary.paragraphs.slice(0, paragraphsToShow).forEach((p) => {
      html += `<p>${p}</p>`;
    });
    html += '</div>';
  }
  if (data.coreFeatures && Array.isArray(data.coreFeatures)) {
    html += '<div class="content-section"><h3><i class="fa fa-star"></i> Core Features</h3><ul>';
    data.coreFeatures.forEach((feature) => {
      html += `<li>${feature}</li>`;
    });
    html += '</ul></div>';
  }
  if (data.uniqueValueProposition) {
    html += '<div class="content-section"><h3><i class="fa fa-lightbulb-o"></i> Unique Value Proposition</h3>';
    html += `<p>${data.uniqueValueProposition}</p></div>`;
  }
  return html;
}

function formatTechnical(data) {
  if (!data) return '';
  if (data.techStack && data.architectureOverview) {
    let html = '<div class="content-section"><h3>Stack</h3><ul>';
    Object.entries(data.techStack).forEach(([k, v]) => {
      if (v) html += `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`;
    });
    html += '</ul>';
    if (data.architectureOverview.narrative) {
      html += `<h3>Architecture</h3><p>${escapeHtml(data.architectureOverview.narrative)}</p>`;
    }
    html += '</div>';
    return html;
  }
  return '<div class="content-section"><p>Technical content unavailable.</p></div>';
}

function formatMarket(data) {
  if (!data) return '';
  if (data.industryOverview || data.swotAnalysis) {
    let html = '<div class="content-section">';
    if (data.industryOverview?.trends) {
      html += `<h3>Industry</h3><p>${escapeHtml(data.industryOverview.trends)}</p>`;
    }
    if (data.positioningOnePager) {
      html += `<h3>Positioning</h3><p>${escapeHtml(data.positioningOnePager)}</p>`;
    }
    html += '</div>';
    return html;
  }
  return '<div class="content-section"><p>Market content unavailable.</p></div>';
}

function formatDesign(data) {
  if (!data) return '';
  const colors = data.visualStyleGuide?.colors;
  if (colors) {
    let html = '<div class="content-section"><h3>Colors</h3><ul>';
    Object.entries(colors).forEach(([k, v]) => {
      if (v) html += `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`;
    });
    html += '</ul></div>';
    return html;
  }
  return '<div class="content-section"><p>Design content unavailable.</p></div>';
}

function formatPrompts(prompts) {
  const full = (prompts && prompts.fullPrompt) || (typeof window !== 'undefined' && window.demoSpecData?.prompts?.fullPrompt) || '';
  if (full) {
    if (typeof window !== 'undefined') window.fullPromptText = full;
    return `<div class="content-section"><h3>Full prompt</h3><pre class="prompt-code"><code>${escapeHtml(full)}</code></pre></div>`;
  }
  return '<div class="content-section"><p>Prompts unavailable.</p></div>';
}

function formatExport() {
  return `<div class="content-section"><h3>Export</h3>
    <p>Export is available on your own generated specs from the Spec Viewer.</p>
    <p><a href="/?autoStart=true">Generate your spec</a></p></div>`;
}

function initializeChatUI() {
  const el = document.getElementById('chat');
  if (!el) return;
  el.innerHTML = `<div class="content-section"><h3>Chat with AI</h3>
    <p>Chat is available for logged-in users on their own specifications.
    <a href="/pages/auth.html">Log in</a> or <a href="/?autoStart=true">start free</a>.</p></div>`;
}

function renderComplexityScore() {
  return '';
}

if (typeof window !== 'undefined') {
  window.formatOverview = formatOverview;
  window.renderComplexityScore = renderComplexityScore;
  window.formatTechnical = formatTechnical;
  window.formatMarket = formatMarket;
  window.formatDesign = formatDesign;
  window.formatPrompts = formatPrompts;
  window.formatExport = formatExport;
  window.initializeChatUI = initializeChatUI;
  window.copyPromptToClipboard = function () {
    if (window.fullPromptText) {
      navigator.clipboard.writeText(window.fullPromptText);
    }
  };
}
