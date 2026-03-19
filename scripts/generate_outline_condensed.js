#!/usr/bin/env node
const fs = require('fs');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const sentencesPath = arg('sentences', 'sentences.txt');
const wordsPath = arg('words', '../1_转录/subtitles_words.json');
const semanticPath = arg('semantic', 'semantic_deep_analysis.json');
const outputPath = arg('output', 'outline_condensed.md');

const lines = fs.readFileSync(sentencesPath, 'utf8').split('\n').filter(Boolean);
const allWords = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
const actualWords = allWords.filter(w => !w.isGap && !w.isSpeakerLabel);
const semantic = fs.existsSync(semanticPath) ? JSON.parse(fs.readFileSync(semanticPath, 'utf8')) : null;

function timeFmt(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}

const sentences = lines.map(line => {
  const parts = line.split('|');
  const idx = Number(parts[0]);
  const [startIdx, endIdx] = parts[1].split('-').map(Number);
  const speaker = parts[2] || '';
  const text = parts.slice(3).join('|') || '';
  const startTime = actualWords[startIdx] ? actualWords[startIdx].start : 0;
  const endTime = actualWords[endIdx] ? actualWords[endIdx].end : startTime;
  return { idx, speaker, text, startTime, endTime };
});

const questionLike = /(？|\?|你.*(觉得|怎么看|为什么|如何|会不会|有没有)|能.*(介绍|讲讲|说说)|聊聊|是什么|怎么)/;
const anchors = [0];
for (const s of sentences) {
  if (s.speaker === 'ceci' && questionLike.test(s.text) && s.text.length >= 8) {
    const last = anchors[anchors.length - 1];
    if (s.idx - last >= 40) anchors.push(s.idx);
  }
}
if (anchors[anchors.length - 1] !== sentences.length - 1) anchors.push(sentences.length - 1);

// limit section count
const maxSections = 12;
let useAnchors = anchors;
if (anchors.length - 1 > maxSections) {
  const step = (anchors.length - 1) / maxSections;
  useAnchors = [anchors[0]];
  for (let i = 1; i < maxSections; i++) useAnchors.push(anchors[Math.floor(i * step)]);
  useAnchors.push(anchors[anchors.length - 1]);
}

const actionByIdx = new Map();
if (semantic?.sentences) {
  for (const s of semantic.sentences) actionByIdx.set(s.sentenceIdx, s);
}

function pickKeyLines(range, preferSpeaker, n = 3) {
  const cands = sentences
    .filter(s => s.idx >= range[0] && s.idx <= range[1])
    .filter(s => s.text.length >= 14)
    .filter(s => !/^(嗯+|呃+|啊+|对+|是的|然后|就是|那个|所以)[。！!？?，,、\s]*$/.test(s.text))
    .sort((a, b) => {
      const sa = (a.speaker === preferSpeaker ? 20 : 0) + Math.min(a.text.length, 60);
      const sb = (b.speaker === preferSpeaker ? 20 : 0) + Math.min(b.text.length, 60);
      return sb - sa;
    });
  const out = [];
  const seen = new Set();
  for (const c of cands) {
    const key = c.text.slice(0, 20);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= n) break;
  }
  return out;
}

let md = '# 第八期UU合集 - 大纲凝练\n\n';
md += '> 用途：先看结构，再针对性在审查页定位删改。\n\n';

for (let i = 0; i < useAnchors.length - 1; i++) {
  const startIdx = useAnchors[i];
  const endIdx = useAnchors[i + 1] - 1;
  const start = sentences[startIdx];
  const end = sentences[Math.max(startIdx, endIdx)] || start;
  const titleSource = start?.text || `段落 ${i + 1}`;
  const title = titleSource.length > 28 ? `${titleSource.slice(0, 28)}...` : titleSource;

  const lines = pickKeyLines([startIdx, endIdx], 'UU', 3);
  const segSentences = sentences.filter(s => s.idx >= startIdx && s.idx <= endIdx);
  let del = 0, sug = 0;
  const byType = {};
  for (const s of segSentences) {
    const m = actionByIdx.get(s.idx);
    if (!m) continue;
    if (m.action === 'delete') del++;
    if (m.action === 'suggest_delete') sug++;
    if (m.type) byType[m.type] = (byType[m.type] || 0) + 1;
  }
  const typeSummary = Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}:${v}`).join(' / ') || '无';

  md += `## ${i + 1}. [${timeFmt(start.startTime)} - ${timeFmt(end.endTime)}] ${title}\n`;
  if (lines.length) {
    md += '- 核心内容：\n';
    for (const l of lines) md += `  - ${l.speaker}: ${l.text}\n`;
  }
  md += `- 可优先审查：delete ${del}句, suggest ${sug}句（类型：${typeSummary}）\n\n`;
}

fs.writeFileSync(outputPath, md);
console.log(`✅ outline written: ${outputPath}`);
