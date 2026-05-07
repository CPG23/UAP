const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), '.github/workflows/daily-scan.yml');
let yml = fs.readFileSync(file, 'utf8');

const afterNew = `          new_articles = [a for a in grouped_notif_pool if a['id'] not in notified_ids]
          print(f'Notification: {len(notif_pool)} articles, {len(grouped_notif_pool)} topics, {len(new_articles)} new')`;
const afterNewPatched = `          new_articles = [a for a in grouped_notif_pool if a['id'] not in notified_ids]
          display_articles = (new_articles[:10] or grouped_notif_pool[:10] or grouped_sum_arts[:10])
          print(f'Notification: {len(notif_pool)} articles, {len(grouped_notif_pool)} topics, {len(new_articles)} new')
          print(f'App feed topics: {len(display_articles)}')`;
if (yml.includes(afterNew) && !yml.includes('display_articles = (new_articles[:10]')) {
  yml = yml.replace(afterNew, afterNewPatched);
}

yml = yml.replace(`for a in new_articles[:10]`, `for a in display_articles`);
yml = yml.replace(`print(f'latest-news.json: {len(new_articles[:10])} notification topics, {len(summaries_map)} summary keys')`, `print(f'latest-news.json: {len(display_articles)} app topics, {len(summaries_map)} summary keys')`);

if (!yml.includes('display_articles = (new_articles[:10] or grouped_notif_pool[:10] or grouped_sum_arts[:10])')) {
  throw new Error('display_articles patch missing');
}
if (yml.includes('for a in new_articles[:10]')) {
  throw new Error('old new_articles app feed loop still present');
}
fs.writeFileSync(file, yml);
console.log('Patched daily scan to keep app feed populated.');
