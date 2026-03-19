#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const sentencesPath = arg('sentences', 'sentences.txt');
const wordsPath = arg('words', '../1_转录/subtitles_words.json');
const outputPath = arg('output', 'semantic_deep_analysis.json');

const sentenceLines = fs.readFileSync(sentencesPath, 'utf8').split('\n').filter(Boolean);
const allWords = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
const actualWords = allWords.filter(w => !w.isGap && !w.isSpeakerLabel);

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s，。！？、：；“”"'（）()《》【】\[\]…,.!?;:]+/g, '');
}

function fmt(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function bigrams(str) {
  const out = new Set();
  for (let i = 0; i < str.length - 1; i++) out.add(str.slice(i, i + 2));
  return out;
}

function dice(a, b) {
  if (!a || !b) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return (2 * hit) / (A.size + B.size);
}

const sentences = sentenceLines.map(line => {
  const parts = line.split('|');
  const idx = Number(parts[0]);
  const [startIdx, endIdx] = parts[1].split('-').map(Number);
  const speaker = parts[2] || '';
  const text = parts.slice(3).join('|') || '';
  const startTime = actualWords[startIdx] ? actualWords[startIdx].start : 0;
  const endTime = actualWords[endIdx] ? actualWords[endIdx].end : startTime;
  return { idx, startIdx, endIdx, startTime, endTime, speaker, text, norm: normalize(text) };
});

const RX = {
  preShow: /(这里是|听众朋友们|欢迎来到|今天我们邀请到|简单介绍一下|向大家问好|一档)/,
  techDebug: /(麦克风|耳机|收音|录音|录制|信号|网络|卡(了|顿)?|声音.*(有点|不对|太小)|听得见|没录上)/,
  production: /(这段.*(剪|删)|后期|回头剪|先暂停|重来|补录|开场白|收尾|这期|上一题|你先说|我先说|再说一遍)/,
  privacy: /(别剪|不要播|隐私|敏感|同事|真实姓名|手机号|微信|住址|公司名字|医院名字|身份信息)/,
  weakRel: /(k\s*t\s*v|塔罗|看牌|星座|房价|天气|哈尔滨|苏州)/i,
  fillerOnly: /^(嗯+|呃+|啊+|对+|是的|然后|就是|那个|所以|好的|好吧|行|行吧|哈哈+)[。！!？?，,、\s]*$/,
};

const reasons = {
  pre_show: '开场寒暄/节目介绍，信息重复于正式内容',
  tech_debug: '技术调试或收音问题，成片通常删除',
  production_talk: '录制/剪辑过程讨论，不面向听众',
  privacy: '可能包含敏感信息，建议删除',
  repeated_content: '与前文高度重复，保留信息更完整的一次',
  redundant_viewpoint: '观点重复表达，信息增量较低',
  over_detail: '细节展开过长，可压缩到1-2句',
  low_density: '口头填充或低信息密度过渡',
  weak_relevance: '与主线相关性较弱，可酌情精简',
};

const marks = new Map(); // idx -> {action,type,reason}

function mark(idx, action, type) {
  const prev = marks.get(idx);
  const rank = { delete: 2, suggest_delete: 1, keep: 0 };
  if (!prev || rank[action] > rank[prev.action]) {
    marks.set(idx, { action, type, reason: reasons[type] || '' });
  }
}

for (const s of sentences) {
  const txt = s.text;
  const n = s.norm;
  if (!n) continue;

  // pre-show: first ~2.5 minutes intro-ish content
  if (s.startTime < 150 && (RX.preShow.test(txt) || s.idx < 10)) {
    mark(s.idx, 'delete', 'pre_show');
    continue;
  }

  if (RX.techDebug.test(txt)) { mark(s.idx, 'delete', 'tech_debug'); continue; }
  if (RX.production.test(txt)) { mark(s.idx, 'delete', 'production_talk'); continue; }
  if (RX.privacy.test(txt)) { mark(s.idx, 'delete', 'privacy'); continue; }

  if (RX.fillerOnly.test(txt) || n.length <= 3) {
    mark(s.idx, 'suggest_delete', 'low_density');
    continue;
  }

  const commaCount = (txt.match(/[，、,]/g) || []).length;
  if (txt.length >= 45 && commaCount >= 3) {
    mark(s.idx, 'suggest_delete', 'over_detail');
    continue;
  }

  if (RX.weakRel.test(txt) && s.startTime > 120) {
    mark(s.idx, 'suggest_delete', 'weak_relevance');
  }
}

// repeated/redundant detection in local window
for (let i = 1; i < sentences.length; i++) {
  const cur = sentences[i];
  if (cur.norm.length < 10) continue;
  let best = 0;
  for (let j = Math.max(0, i - 10); j < i; j++) {
    const prev = sentences[j];
    if (prev.norm.length < 10) continue;
    const sim = dice(cur.norm, prev.norm);
    if (sim > best) best = sim;
  }
  if (best >= 0.83) {
    mark(cur.idx, 'delete', 'repeated_content');
  } else if (best >= 0.72) {
    mark(cur.idx, 'suggest_delete', 'redundant_viewpoint');
  }
}

// build sentence entries
const sentenceEntries = sentences.map(s => {
  const m = marks.get(s.idx);
  if (!m) return { sentenceIdx: s.idx, speaker: s.speaker, action: 'keep' };
  return {
    sentenceIdx: s.idx,
    speaker: s.speaker,
    action: m.action,
    type: m.type,
    reason: m.reason,
  };
});

// blocks from contiguous same action+type
const nonKeep = sentenceEntries.filter(s => s.action !== 'keep').sort((a, b) => a.sentenceIdx - b.sentenceIdx);
const blocks = [];
let cur = null;
let id = 1;
for (const x of nonKeep) {
  if (!cur) {
    cur = { id: id++, range: [x.sentenceIdx, x.sentenceIdx], type: x.type, action: x.action, reason: x.reason };
    continue;
  }
  if (x.sentenceIdx <= cur.range[1] + 1 && x.type === cur.type && x.action === cur.action) {
    cur.range[1] = x.sentenceIdx;
  } else {
    blocks.push(cur);
    cur = { id: id++, range: [x.sentenceIdx, x.sentenceIdx], type: x.type, action: x.action, reason: x.reason };
  }
}
if (cur) blocks.push(cur);

const sentByIdx = new Map(sentences.map(s => [s.idx, s]));
for (const b of blocks) {
  const s0 = sentByIdx.get(b.range[0]);
  const s1 = sentByIdx.get(b.range[1]);
  const d = (s1?.endTime || 0) - (s0?.startTime || 0);
  b.duration = fmt(d);
  if (b.action === 'suggest_delete') b.confidence = 'suggested';
}

// attach blockId to sentence entries
const blockBySentence = new Map();
for (const b of blocks) {
  for (let i = b.range[0]; i <= b.range[1]; i++) blockBySentence.set(i, b);
}
for (const s of sentenceEntries) {
  const b = blockBySentence.get(s.sentenceIdx);
  if (b && s.action !== 'keep') s.blockId = b.id;
}

const delCount = sentenceEntries.filter(s => s.action === 'delete').length;
const sugCount = sentenceEntries.filter(s => s.action === 'suggest_delete').length;
const total = sentenceEntries.length;
const totalDur = sentences.length ? sentences[sentences.length - 1].endTime : 0;

const out = {
  version: '5.0',
  analysisType: 'two_level',
  totalDuration: `${fmt(totalDur)} (${Math.round(totalDur / 60)}min)`,
  targetDuration: 'review_based',
  blocks,
  sentences: sentenceEntries,
  summary: {
    totalSentences: total,
    deleteSentences: delCount,
    suggestDeleteSentences: sugCount,
    keepSentences: total - delCount - sugCount,
    deleteBlocks: blocks.length,
    totalDeleteDuration: fmt(0),
    deleteRatio: `${((delCount / Math.max(1, total)) * 100).toFixed(1)}%`,
  },
};

fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));
console.log(`✅ semantic analysis written: ${outputPath}`);
console.log(`   delete=${delCount}, suggest=${sugCount}, blocks=${blocks.length}`);
