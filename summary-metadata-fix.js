(function(){
  function clean(s){ return (s || '').replace(/\s+/g, ' ').trim(); }

  function rewriteFallback(text){
    var raw = clean(text);
    if (!/full article text could not be reliably extracted/i.test(raw)) return '';
    var m = raw.match(/^The feed lists an article from (.+?) dated ([0-9-]+)\. The title says: "(.+?)"\.(?: The feed connects this item with: (.+?)\.)? The topic is currently tracked from (.+?)\. The full article text could not be reliably extracted, so no extra claims were added\.$/i);
    if (!m) return raw.replace(/The full article text could not be reliably extracted, so no extra claims were added\.?/i, 'The summary stays limited to verified feed details, so no unsupported details are added.');
    var source = clean(m[1]);
    var date = clean(m[2]);
    var title = clean(m[3]);
    var terms = clean(m[4]);
    var sourceCount = clean(m[5]);
    var out = [];
    out.push('This item tracks a ' + source + ' report dated ' + date + '.');
    out.push('The listed headline focuses on: "' + title + '".');
    if (terms) out.push('The scanner connects the topic with ' + terms + ', based on the headline and available feed text.');
    out.push('The topic is currently represented by ' + sourceCount + ' in the feed.');
    out.push('When the publisher text is not safely accessible, the summary stays limited to verified feed details and avoids unsupported claims.');
    return out.join(' ');
  }

  function fixNode(node){
    if (!node || node.nodeType !== 1) return;
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    var textNode;
    while ((textNode = walker.nextNode())) {
      var replacement = rewriteFallback(textNode.nodeValue);
      if (replacement && replacement !== textNode.nodeValue) textNode.nodeValue = replacement;
    }
  }

  function run(){ fixNode(document.body); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  new MutationObserver(function(records){
    records.forEach(function(record){
      record.addedNodes && record.addedNodes.forEach(fixNode);
      if (record.type === 'characterData' && record.target) {
        var replacement = rewriteFallback(record.target.nodeValue);
        if (replacement && replacement !== record.target.nodeValue) record.target.nodeValue = replacement;
      }
    });
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
