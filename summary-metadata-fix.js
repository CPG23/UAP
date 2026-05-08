(function(){
  function clean(s){ return (s || '').replace(/\s+/g, ' ').trim(); }

  function rewriteFallback(text){
    var raw = clean(text);
    if (!/(full article text could not be reliably extracted|summary is limited to verified feed metadata|the feed lists an article|this item tracks a |publisher text could not be safely extracted)/i.test(raw)) return '';

    var source = 'the listed source';
    var date = '';
    var title = '';
    var terms = '';
    var related = '';

    var m = raw.match(/This item tracks a (.+?) report dated ([0-9-]+)\. The listed headline (?:centers|focuses) on: "(.+?)"\./i);
    if (m) {
      source = clean(m[1]);
      date = clean(m[2]);
      title = clean(m[3]);
    }
    if (!title) {
      m = raw.match(/The feed lists an article from (.+?) dated ([0-9-]+)\. The title says: "(.+?)"\./i);
      if (m) {
        source = clean(m[1]);
        date = clean(m[2]);
        title = clean(m[3]);
      }
    }
    m = raw.match(/connects the topic with (.+?)(?:, based| based|\.)/i);
    if (m) terms = clean(m[1]);
    m = raw.match(/Related feed headlines (?:in the same topic cluster )?mention: "?(.+?)"?\./i);
    if (m) related = clean(m[1]).replace(/"; "/g, '; ');

    var out = [];
    if (title) {
      out.push(source + (date ? ' lists a UAP-related report dated ' + date : ' lists a UAP-related report') + ' under the headline "' + title + '".');
      out.push('The headline is treated as the source claim, and UAP News does not add details that are not present in the available feed metadata.');
    } else {
      out.push('This UAP-related item is summarized from the available feed metadata.');
      out.push('UAP News does not add extra claims when the publisher text is not safely available.');
    }
    if (terms) out.push('The topic is connected with ' + terms + ' in the feed metadata.');
    if (related) out.push('Related headlines in the same topic cluster mention: ' + related + '.');
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
