import React from 'react';
import ReactDOMServer from 'react-dom/server';
import sharp from 'sharp';

// ── Icon imports from react-icons ──────────────────────────────────────
import {
  FaRobot, FaBrain, FaHeartbeat, FaShieldAlt, FaLightbulb,
  FaChartLine, FaGlobeAmericas, FaCogs, FaUsers, FaLeaf,
  FaGraduationCap, FaRocket, FaMicroscope, FaLock, FaCloud,
  FaDatabase, FaCode, FaHandshake, FaBalanceScale, FaStar,
  FaBullseye, FaSearch, FaBookOpen, FaIndustry, FaTrophy,
  FaMoneyBillWave, FaHospital, FaCar, FaFilm, FaMusic,
  FaPalette, FaAtom, FaDna, FaNetworkWired, FaMobileAlt,
  FaBolt, FaComments, FaMap, FaHistory, FaEye,
} from 'react-icons/fa';

// ── Keyword → Icon mapping ─────────────────────────────────────────────
// Keys are lowercase keywords that get matched against card titles.
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  // AI & Tech
  'ai': FaRobot, 'artificial intelligence': FaRobot, 'robot': FaRobot, 'automation': FaRobot,
  'machine learning': FaBrain, 'brain': FaBrain, 'neural': FaBrain, 'deep learning': FaBrain, 'intelligence': FaBrain,
  'data': FaDatabase, 'database': FaDatabase, 'big data': FaDatabase, 'storage': FaDatabase,
  'cloud': FaCloud, 'saas': FaCloud, 'computing': FaCloud,
  'code': FaCode, 'software': FaCode, 'programming': FaCode, 'developer': FaCode,
  'network': FaNetworkWired, 'internet': FaNetworkWired, 'connectivity': FaNetworkWired, 'iot': FaNetworkWired,
  'mobile': FaMobileAlt, 'phone': FaMobileAlt, 'app': FaMobileAlt,
  'technology': FaCogs, 'engineering': FaCogs, 'system': FaCogs, 'infrastructure': FaCogs,
  'algorithm': FaCogs, 'process': FaCogs,

  // Science & Research
  'science': FaAtom, 'physics': FaAtom, 'chemistry': FaAtom, 'atom': FaAtom,
  'research': FaMicroscope, 'experiment': FaMicroscope, 'lab': FaMicroscope, 'study': FaMicroscope,
  'biology': FaDna, 'genetic': FaDna, 'dna': FaDna, 'genome': FaDna,

  // Business & Economy
  'business': FaChartLine, 'market': FaChartLine, 'growth': FaChartLine, 'trend': FaChartLine, 'economic': FaChartLine,
  'finance': FaMoneyBillWave, 'money': FaMoneyBillWave, 'investment': FaMoneyBillWave, 'cost': FaMoneyBillWave,
  'industry': FaIndustry, 'manufacturing': FaIndustry, 'production': FaIndustry,
  'strategy': FaBullseye, 'goal': FaBullseye, 'target': FaBullseye, 'objective': FaBullseye,
  'innovation': FaRocket, 'launch': FaRocket, 'startup': FaRocket, 'future': FaRocket, 'breakthrough': FaRocket,
  'partnership': FaHandshake, 'collaboration': FaHandshake, 'team': FaHandshake, 'cooperat': FaHandshake,

  // Health & Wellbeing
  'health': FaHeartbeat, 'medical': FaHeartbeat, 'wellness': FaHeartbeat, 'fitness': FaHeartbeat,
  'hospital': FaHospital, 'clinic': FaHospital, 'patient': FaHospital, 'doctor': FaHospital,
  'medicine': FaHospital, 'personalized medicine': FaHospital,

  // Society & Culture
  'education': FaGraduationCap, 'learning': FaGraduationCap, 'school': FaGraduationCap, 'training': FaGraduationCap, 'university': FaGraduationCap,
  'global': FaGlobeAmericas, 'world': FaGlobeAmericas, 'international': FaGlobeAmericas, 'geography': FaGlobeAmericas,
  'people': FaUsers, 'social': FaUsers, 'community': FaUsers, 'population': FaUsers, 'society': FaUsers,
  'environment': FaLeaf, 'green': FaLeaf, 'sustainable': FaLeaf, 'climate': FaLeaf, 'nature': FaLeaf, 'ecology': FaLeaf,
  'law': FaBalanceScale, 'justice': FaBalanceScale, 'regulation': FaBalanceScale, 'policy': FaBalanceScale, 'ethic': FaBalanceScale, 'governance': FaBalanceScale,
  'communication': FaComments, 'language': FaComments, 'nlp': FaComments, 'chat': FaComments, 'virtual assistant': FaComments,

  // Security
  'security': FaShieldAlt, 'defense': FaShieldAlt, 'military': FaShieldAlt, 'protect': FaShieldAlt, 'safe': FaShieldAlt,
  'privacy': FaLock, 'encryption': FaLock, 'cyber': FaLock, 'hack': FaLock,

  // Transport & Media
  'transport': FaCar, 'vehicle': FaCar, 'autonomous': FaCar, 'driving': FaCar, 'car': FaCar,
  'film': FaFilm, 'movie': FaFilm, 'cinema': FaFilm, 'entertainment': FaFilm, 'video': FaFilm,
  'music': FaMusic, 'audio': FaMusic, 'sound': FaMusic,
  'art': FaPalette, 'design': FaPalette, 'creative': FaPalette, 'visual': FaPalette,

  // Misc
  'idea': FaLightbulb, 'insight': FaLightbulb, 'solution': FaLightbulb, 'tip': FaLightbulb, 'key': FaLightbulb,
  'discover': FaSearch, 'search': FaSearch, 'explore': FaSearch, 'find': FaSearch, 'analysis': FaSearch, 'analyze': FaSearch,
  'history': FaHistory, 'origin': FaHistory, 'past': FaHistory, 'ancient': FaHistory, 'heritage': FaHistory,
  'book': FaBookOpen, 'literature': FaBookOpen, 'knowledge': FaBookOpen, 'document': FaBookOpen,
  'award': FaTrophy, 'achievement': FaTrophy, 'success': FaTrophy, 'win': FaTrophy, 'best': FaTrophy,
  'vision': FaEye, 'overview': FaEye, 'perspective': FaEye, 'observation': FaEye, 'monitor': FaEye,
  'energy': FaBolt, 'power': FaBolt, 'electric': FaBolt, 'lightning': FaBolt,
  'map': FaMap, 'roadmap': FaMap, 'journey': FaMap, 'path': FaMap, 'route': FaMap,
  'star': FaStar, 'highlight': FaStar, 'feature': FaStar, 'quality': FaStar,
  'predict': FaChartLine, 'forecast': FaChartLine, 'predictive': FaChartLine, 'maintenance': FaCogs,
  'challenge': FaShieldAlt, 'risk': FaShieldAlt, 'threat': FaShieldAlt,
  'conclusion': FaStar, 'summary': FaStar, 'takeaway': FaStar, 'recap': FaStar,
  'introduction': FaBookOpen, 'welcome': FaBookOpen, 'about': FaBookOpen,
  'application': FaMobileAlt, 'use case': FaMobileAlt,
};

const FALLBACK_ICON = FaLightbulb;

/**
 * Resolve a react-icons component for a given text string.
 * Checks explicit `iconHint` first, then scans the title for keyword matches.
 */
function resolveIcon(title: string, iconHint?: string): React.ComponentType<any> {
  const lower = (iconHint ?? '').toLowerCase();
  if (lower && ICON_MAP[lower]) return ICON_MAP[lower]!;

  const titleLower = title.toLowerCase();

  // Try longest keywords first so "machine learning" matches before "learning"
  const sortedKeys = Object.keys(ICON_MAP).sort((a, b) => b.length - a.length);
  for (const keyword of sortedKeys) {
    if (titleLower.includes(keyword)) {
      return ICON_MAP[keyword]!;
    }
  }

  return FALLBACK_ICON;
}

/**
 * Render a react-icons icon to a PNG buffer (base64 data URI) at the given size.
 * The icon is rendered as white on a transparent background by default.
 */
const iconCache = new Map<string, string>();

export async function renderIconToPng(
  title: string,
  opts: { size?: number; color?: string; iconHint?: string } = {},
): Promise<string> {
  const { size = 256, color = '#FFFFFF', iconHint } = opts;

  const IconComponent = resolveIcon(title, iconHint);
  
  // Cache key based on icon function name and options
  const cacheKey = `${IconComponent.name}_${size}_${color}`;
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  // Render React element to SVG string
  const svgMarkup = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { size, color, style: { display: 'block' } }),
  );

  // Wrap in a proper SVG document if needed (react-icons renders <svg> directly)
  const svgDoc = svgMarkup.includes('<svg')
    ? svgMarkup
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${svgMarkup}</svg>`;

  // Rasterize with sharp — with a 5 second timeout to prevent hangs
  const rasterize = sharp(Buffer.from(svgDoc))
    .resize(size, size)
    .png()
    .toBuffer();

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Icon render timed out')), 5000)
  );

  const pngBuf = await Promise.race([rasterize, timeout]);
  const b64 = `image/png;base64,${pngBuf.toString('base64')}`;
  
  iconCache.set(cacheKey, b64);
  return b64;
}

/**
 * Convenience: render an icon for a "topic" or "section" heading.
 * Uses a larger size and the specified color (defaults to rustOrange).
 */
export async function renderTopicIcon(
  title: string,
  opts: { size?: number; color?: string; iconHint?: string } = {},
): Promise<string> {
  return renderIconToPng(title, { size: opts.size ?? 128, color: opts.color ?? '#FFFFFF', iconHint: opts.iconHint });
}
