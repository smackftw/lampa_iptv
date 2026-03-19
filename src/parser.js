function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // keep 32-bit
  }
  return Math.abs(hash).toString(36);
}

export function parseM3U(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const channels = [];
  const groupSet = new Set();
  let playlistEpgUrl = null;

  if (lines[0] && lines[0].startsWith('#EXTM3U')) {
    const m = lines[0].match(/tvg-url="([^"]+)"/);
    if (m) playlistEpgUrl = m[1];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('#EXTINF:')) continue;

    const urlLine = lines[i + 1];
    if (!urlLine || urlLine.startsWith('#')) continue;

    const tvgId = (line.match(/tvg-id="([^"]*)"/)    || ['', ''])[1];
    const name  = (line.match(/,(.+)$/)               || ['', 'Unknown'])[1].trim();
    const logo  = (line.match(/tvg-logo="([^"]*)"/)   || ['', ''])[1];
    const group = (line.match(/group-title="([^"]*)"/)|| ['', 'Other'])[1];

    groupSet.add(group);
    const id = tvgId || djb2(name + urlLine);
    channels.push({ id, name, url: urlLine, logo, group, tvgId });
  }

  return { channels, groups: [...groupSet], playlistEpgUrl };
}

export async function fetchM3U(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`M3U fetch failed: HTTP ${response.status}`);
  const text = await response.text();
  return parseM3U(text);
}
