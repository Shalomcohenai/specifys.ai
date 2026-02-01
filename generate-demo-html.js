const fs = require('fs');
const path = require('path');

// Read demo-spec-data.js and extract the data
const dataPath = path.join(__dirname, 'assets/js/features/demo-spec/demo-spec-data.js');
let dataContent = fs.readFileSync(dataPath, 'utf8');
// Remove the const declaration and window assignment
dataContent = dataContent.replace(/^const demoSpecData = /, 'const demoSpecData = ');
eval(dataContent);

// Read demo-spec-formatter.js
const formatterPath = path.join(__dirname, 'assets/js/features/demo-spec/demo-spec-formatter.js');
const formatterContent = fs.readFileSync(formatterPath, 'utf8');
eval(formatterContent);

// Generate HTML for each section
const overviewHtml = formatOverview(demoSpecData.overview);
const technicalHtml = formatTechnical(demoSpecData.technical);
const marketHtml = formatMarket(demoSpecData.market);
const designHtml = formatDesign(demoSpecData.design);
const promptsHtml = formatPrompts();

// Generate diagrams HTML
let diagramsHtml = '';
if (demoSpecData.diagrams && demoSpecData.diagrams.diagrams) {
  demoSpecData.diagrams.diagrams.forEach((diagram, index) => {
    diagramsHtml += `<div class="diagram-section-container">`;
    diagramsHtml += `<h3 class="diagram-section-title"><i class="fa fa-project-diagram" aria-hidden="true"></i> ${diagram.name || 'Diagram'}</h3>`;
    if (diagram.description) {
      diagramsHtml += `<p class="diagram-section-description">${diagram.description}</p>`;
    }
    diagramsHtml += `<div class="diagram-container">`;
    const mermaidCode = (diagram.mermaidCode || diagram.code || '').trim();
    diagramsHtml += `<div class="mermaid" id="mermaid-diagram-${index}">${mermaidCode}</div>`;
    diagramsHtml += `</div></div>`;
  });
}

// Write to a file
const output = {
  overview: overviewHtml,
  technical: technicalHtml,
  market: marketHtml,
  design: designHtml,
  diagrams: diagramsHtml,
  prompts: promptsHtml
};

fs.writeFileSync('/tmp/demo-html-output.json', JSON.stringify(output, null, 2));
console.log('HTML generated successfully!');

