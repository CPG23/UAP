const fs = require('fs');
const { execFileSync } = require('child_process');

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');
const oldHtml = execFileSync('git', ['show', '8d63efa344001682eff96c67ad0887b8853bf4df^:index.html'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

function mustMatch(text, regex, label) {
  const match = text.match(regex);
  if (!match) throw new Error('Could not find ' + label);
  return match[0];
}

const oldAlienCss = mustMatch(oldHtml, /  \.alien-head \{[\s\S]*?^  \}\n\n  @keyframes alienGlow \{[\s\S]*?^  \}\n\n  @keyframes alienFloat \{[\s\S]*?^  \}\n/m, 'old alien CSS');
const oldLoadingBarCss = mustMatch(oldHtml, /  \.loading-bar \{[\s\S]*?^  \}\n\n  \.loading-bar::after \{[\s\S]*?^  \}\n\n  @keyframes loadingSlide \{[\s\S]*?^  \}\n/m, 'old loading bar CSS');
const oldImage = mustMatch(oldHtml, /<img class="alien-head"[\s\S]*?alt="Alien"\/>/, 'old alien image');

const replacementCss = oldAlienCss + oldLoadingBarCss + `
  .startup-title {
    margin: 0 0 8px;
    position: absolute;
    top: 28px;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Share Tech Mono', monospace;
    font-size: clamp(72px,18vw,120px);
    letter-spacing: 0;
    white-space: nowrap;
  }
  .startup-u { color: #fff; text-shadow: 0 0 25px rgba(255,255,255,.75); }
  .startup-a { color: var(--accent); text-shadow: 0 0 28px rgba(0,212,255,.85); }
  .startup-p { color: var(--accent2); text-shadow: 0 0 28px rgba(0,255,157,.78); }
  .startup-news { font-family: 'Rajdhani', sans-serif; font-size: .24em; color: var(--text); letter-spacing: 4px; line-height: 1; }
  .startup-byline { font-family:'Share Tech Mono',monospace; font-size:6px; color:var(--muted); letter-spacing:1.5px; opacity:.55; line-height:1; margin-top:2px; padding-left:4px; }
  .startup-panel-wrap { position:absolute; bottom:20px; left:0; right:0; display:flex; flex-direction:column; align-items:center; gap:12px; }
  .startup-panel { width:88%; max-width:480px; border:1px solid rgba(0,212,255,.35); padding:16px 22px; background:rgba(0,212,255,.05); font-family:'Share Tech Mono',monospace; }
  .startup-panel-label { font-size:11px; color:var(--accent); letter-spacing:4px; margin-bottom:8px; opacity:.8; }
  #loading-status { font-size:15px; color:var(--accent); letter-spacing:2px; min-height:20px; }
`;

html = html.replace(/  \.alien \{[\s\S]*?^  \}\n  @keyframes pulseAlien \{[\s\S]*?^  \}\n/m, replacementCss);

const oldLoadingBlock = /<div id="loading" aria-live="polite">[\s\S]*?<\/div>\n<header>/;
const newLoadingBlock = `<div id="loading" aria-live="polite">
  <h1 class="startup-title"><span class="startup-u">U</span><span class="startup-a">A</span><span class="startup-p">P</span><span style="display:inline-flex;flex-direction:column;align-items:flex-start;vertical-align:baseline"><span class="startup-news">NEWS</span><span class="startup-byline">by Chris Gehring</span></span></h1>
  ${oldImage}
  <div class="startup-panel-wrap">
    <div class="startup-panel">
      <div class="startup-panel-label">UAP-NEWS</div>
      <div id="loading-status">Suche...</div>
    </div>
    <div class="loading-bar"></div>
  </div>
</div>
<header>`;
html = html.replace(oldLoadingBlock, newLoadingBlock);

html = html.replace("function hideStart() {\n    if (loadingEl) loadingEl.classList.add('hidden');\n  }", "function hideStart() {\n    if (loadingEl) loadingEl.classList.add('hidden');\n  }\n  function setLoadingStatus(text) {\n    var status = document.getElementById('loading-status');\n    if (status) status.textContent = text;\n  }");
html = html.replace("if (metaEl) metaEl.textContent = 'Lade GitHub-Feed...';", "if (metaEl) metaEl.textContent = 'Lade GitHub-Feed...';\n    setLoadingStatus('Suche aktuelle UAP-News...');");
html = html.replace("render();\n        setMeta(data);", "render();\n        setMeta(data);\n        setLoadingStatus(articles.length + ' Themen gefunden');");
html = html.replace("setNotice('Der GitHub-Feed konnte gerade nicht geladen werden. Bitte aktualisieren.');", "setNotice('Der GitHub-Feed konnte gerade nicht geladen werden. Bitte aktualisieren.');\n        setLoadingStatus('Feed nicht erreichbar');");

if (!html.includes('class="alien-head"')) throw new Error('alien image was not restored');
if (!html.includes('startup-title')) throw new Error('startup title was not restored');
if (!html.includes('setLoadingStatus')) throw new Error('loading status helper missing');

fs.writeFileSync(file, html);
console.log('Restored original alien startup animation while keeping reliable feed app.');
