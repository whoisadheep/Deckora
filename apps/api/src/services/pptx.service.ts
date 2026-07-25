import PptxGenJS from 'pptxgenjs';
import { renderIconToPng, renderTopicIcon } from './icon.service.js';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

export interface SlideData {
  section?: string;
  layout: string;
  kicker?: string;
  title: string;
  subtitle?: string;
  footerText?: string;
  bullets?: any[];
  slideIcon?: string;
  userImage?: string;
  mermaid?: string;
  speakerNotes?: string;
}

// ── Premium Brand Palette (matching Claude's) ────────────────────────
const C = {
  darkBrown:   '3D322A',
  warmBrown:   '5C4A3A',
  rustOrange:  'C05A35',
  lightOrange: 'D4784B',
  cream:       'F5F0EB',
  cardBg:      'EDE5DC',
  cardBorder:  'D8CFC5',
  cardDarkBg:  '4A3C32', // For dark mode cards
  textDark:    '2D241E',
  textMuted:   '7A6E63',
  textLight:   'E0D6CC',
  white:       'FFFFFF',
  accentGold:  'B8915A',
};

export type ThemePalette = typeof C;

export const THEMES: Record<string, ThemePalette> = {
  default: C,
  ocean: { darkBrown: '1B2A47', warmBrown: '2B4365', rustOrange: '4B89D4', lightOrange: '7AB0E6', cream: 'F0F4F8', cardBg: 'E1E8F0', cardBorder: 'C2D1E0', cardDarkBg: '2B4365', textDark: '1A2639', textMuted: '64748B', textLight: 'E2E8F0', white: 'FFFFFF', accentGold: '38BDF8' },
  forest: { darkBrown: '2D3A2C', warmBrown: '4A5D48', rustOrange: '6A8D68', lightOrange: '8AB088', cream: 'F2F5F1', cardBg: 'E5EBE3', cardBorder: 'C8D6C6', cardDarkBg: '4A5D48', textDark: '1F291E', textMuted: '6B7B69', textLight: 'E3EBE2', white: 'FFFFFF', accentGold: 'D4AF37' }
};

function getSectionAccentColor(section: string | undefined, palette: ThemePalette): string {
  if (!section) return palette.rustOrange;
  const accents = [palette.rustOrange, palette.accentGold, palette.lightOrange];
  let hash = 0;
  for (let i = 0; i < section.length; i++) {
    hash = section.charCodeAt(i) + ((hash << 5) - hash);
  }
  return accents[Math.abs(hash) % accents.length] || palette.rustOrange;
}

// ── Contextual Footer ────────────────────────────────────────────────
function addFooter(slide: PptxGenJS.Slide, text: string | undefined, dark: boolean, palette: ThemePalette) {
  if (text) {
    slide.addText(text, {
      x: 0.8, y: 7.0, w: 10, h: 0.3,
      fontSize: 10, color: dark ? palette.textMuted : palette.cardBorder,
      fontFace: 'Georgia', italic: true,
      valign: 'bottom',
    });
  }
}

// ── Text measurement helpers ─────────────────────────────────────────
function estimateLines(text: string, fontSizePt: number, widthInches: number): number {
  const charWidthPt = fontSizePt * 0.55;
  const boxWidthPt = widthInches * 72;
  const charsPerLine = Math.max(1, Math.floor(boxWidthPt / charWidthPt));
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

function estimateTextHeight(text: string, fontSizePt: number, widthInches: number, lineSpacing = 1.3): number {
  const lines = estimateLines(text, fontSizePt, widthInches);
  return lines * (fontSizePt / 72) * lineSpacing;
}

// ── Mermaid Renderer ───────────────────────────────────────────────────
async function renderMermaidToPng(mermaidCode: string): Promise<string> {
  // Strip markdown codeblocks (```mermaid ... ```) often added by AI
  let code = mermaidCode.trim();
  if (code.startsWith('```mermaid')) {
    code = code.substring(10);
  } else if (code.startsWith('```')) {
    code = code.substring(3);
  }
  if (code.endsWith('```')) {
    code = code.substring(0, code.length - 3);
  }
  code = code.trim();

  // We wrap the code in the JSON format mermaid.ink expects
  const state = {
    code: code,
    mermaid: {
      theme: 'base',
      themeVariables: {
        primaryColor: '#EDE5DC',
        primaryTextColor: '#2D241E',
        primaryBorderColor: '#C05A35',
        lineColor: '#C05A35',
        secondaryColor: '#D8CFC5',
        tertiaryColor: '#F5F0EB',
        fontFamily: 'Arial',
      }
    }
  };
  
  // mermaid.ink uses base64 encoding of the JSON state object
  const b64 = Buffer.from(JSON.stringify(state)).toString('base64');
  const url = `https://mermaid.ink/img/${b64}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'no text');
    console.error(`Failed to fetch mermaid image: ${res.status} ${res.statusText}. URL: ${url}, Body: ${errorText}`);
    throw new Error('Failed to fetch mermaid image');
  }
  
  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  return `image/png;base64,${buffer.toString('base64')}`;
}

// ── Main entry point ──────────────────────────────────────────────────
export async function generatePptx(
  slides: SlideData[], 
  uploadedImages: any[] = [],
  onProgress?: (step: number, message: string, currentSlide?: number, totalSlides?: number) => void,
  options?: { theme?: string }
): Promise<Buffer> {
  const themeName = options?.theme || 'default';
  const palette: ThemePalette = THEMES[themeName] || C;
  onProgress?.(2, 'Generating layouts...');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 × 7.5 inches

  onProgress?.(3, 'Rendering icons and diagrams...');
  for (let idx = 0; idx < slides.length; idx++) {
    const data = slides[idx];
    if (!data) continue;

    const slide = pptx.addSlide();
    if (data.speakerNotes) slide.addNotes(data.speakerNotes);

    try {
      console.log(`  Rendering slide ${idx + 1}/${slides.length}: ${data.layout} - "${data.title?.substring(0, 40)}"`);
      onProgress?.(3, `Rendering slide ${idx + 1} of ${slides.length}`, idx + 1, slides.length);
      if (data.layout === 'hero') {
        await renderHeroSlide(slide, pptx, data, uploadedImages, palette);
      } else if (data.layout === 'cards_light') {
        await renderCardSlide(slide, pptx, data, false, palette);
      } else if (data.layout === 'cards_dark') {
        await renderCardSlide(slide, pptx, data, true, palette);
      } else if (data.layout === 'rows') {
        await renderRowsSlide(slide, pptx, data, palette);
      } else if (data.layout === 'split_graphic') {
        await renderSplitGraphicSlide(slide, pptx, data, uploadedImages, palette);
      } else if (data.layout === 'diagram') {
        await renderDiagramSlide(slide, pptx, data, uploadedImages, palette);
      } else {
        // Fallback
        await renderCardSlide(slide, pptx, data, false, palette);
      }
    } catch (slideErr: any) {
      console.error(`  ✗ Error rendering slide ${idx + 1} (${data.layout}): ${slideErr.message}`);
      // Add a fallback error slide so the file still generates
      slide.addText(`Error rendering: ${data.title}`, {
        x: 1, y: 3, w: 11, h: 1.5,
        fontSize: 24, color: palette.rustOrange, fontFace: 'Georgia',
      });
    }
  }

  onProgress?.(4, 'Building PPTX file...');
  console.log('  Finalizing PPTX...');
  const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
  console.log(`  ✓ PPTX generated (${(buffer.length / 1024).toFixed(0)} KB)`);
  return buffer;
}

// ═══════════════════════════════════════════════════════════════════════
// 1. HERO SLIDE
// ═══════════════════════════════════════════════════════════════════════
async function renderHeroSlide(slide: PptxGenJS.Slide, pptx: PptxGenJS, data: SlideData, uploadedImages: any[], palette: ThemePalette) {
  slide.background = { color: palette.darkBrown };
  
  // Render user image if provided, otherwise default triangle
  let renderedImage = false;
  if (data.userImage) {
    const matchedImg = uploadedImages.find(img => img.originalname === data.userImage);
    if (matchedImg) {
      const base64Data = `data:${matchedImg.mimetype};base64,${matchedImg.buffer.toString('base64')}`;
      slide.addImage({
        data: base64Data,
        x: 7.5, y: 1.0, w: 5.5, h: 5.5,
        sizing: { type: 'contain', w: 5.5, h: 5.5 }
      });
      renderedImage = true;
    }
  }

  if (!renderedImage) {
    slide.addShape(pptx.ShapeType.triangle, {
      x: 8.5, y: 3.8, w: 6, h: 5,
      fill: { color: palette.rustOrange },
    });
  }

  if (data.kicker) {
    slide.addText(data.kicker.toUpperCase(), {
      x: 1.0, y: 1.8, w: 9, h: 0.3,
      fontSize: 12, bold: true, color: palette.rustOrange,
      fontFace: 'Arial', charSpacing: 3,
    });
  }

  slide.addText(data.title, { // No toUpperCase
    x: 1.0, y: 2.2, w: 9, h: 2.5,
    fontSize: 48, bold: true, color: palette.white,
    fontFace: 'Georgia', lineSpacingMultiple: 1.1,
    valign: 'top',
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 1.0, y: 5.0, w: 8, h: 1.0,
      fontSize: 20, color: palette.textLight,
      fontFace: 'Arial', italic: true,
      valign: 'top',
    });
  }

  addFooter(slide, data.footerText, true, palette); // true = dark bg mode for footer (uses textMuted instead of cardBorder)
}

// ═══════════════════════════════════════════════════════════════════════
// 2. CARDS SLIDE (Light & Dark mode)
// ═══════════════════════════════════════════════════════════════════════
async function renderCardSlide(slide: PptxGenJS.Slide, pptx: PptxGenJS, data: SlideData, isDark: boolean, palette: ThemePalette) {
  slide.background = { color: isDark ? palette.darkBrown : palette.cream };

  const titleColor = isDark ? palette.white : palette.textDark;
  const subColor = isDark ? palette.textLight : palette.textMuted;
  const cardBgColor = isDark ? palette.cardDarkBg : palette.cardBg;
  const cardTitleColor = isDark ? palette.white : palette.textDark;
  const cardDescColor = isDark ? palette.textLight : palette.textMuted;

  slide.addText(data.title, {
    x: 0.8, y: 0.6, w: 11, h: 0.8,
    fontSize: 32, bold: true, color: titleColor,
    fontFace: 'Georgia',
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.8, y: 1.4, w: 11, h: 0.5,
      fontSize: 16, color: subColor,
      fontFace: 'Arial', italic: true,
    });
  }

  if (!data.bullets || data.bullets.length === 0) return;

  const numCards = Math.min(data.bullets.length, 4);
  const gap = 0.4;
  const totalWidth = 11.5;
  const totalGap = gap * (numCards - 1);
  const cardW = (totalWidth - totalGap) / numCards;
  const startX = (13.33 - (cardW * numCards + totalGap)) / 2;
  const cardY = 2.2;

  // Render icons (White)
  const iconPromises = data.bullets.slice(0, numCards).map((bullet: any) => {
    const title = typeof bullet === 'string' ? bullet : (bullet.title || '');
    const hint = bullet.icon || undefined;
    return renderIconToPng(title, { size: 128, color: '#FFFFFF', iconHint: hint }).catch(() => null);
  });
  const icons = await Promise.all(iconPromises);

  for (let i = 0; i < numCards; i++) {
    const bullet = data.bullets[i];
    const x = startX + i * (cardW + gap);

    let cardTitle = '';
    let cardDesc = '';
    if (typeof bullet === 'string') {
      cardTitle = bullet;
    } else if (bullet?.title) {
      cardTitle = bullet.title;
      cardDesc = bullet.description || '';
    } else {
      cardTitle = JSON.stringify(bullet);
    }

    // Dynamic height
    const innerW = cardW - 0.6;
    const iconAreaH = 1.4;
    const titleH = 0.8;
    let descFontSize = 13;
    let descH = 1.5;

    if (cardDesc) {
      descH = estimateTextHeight(cardDesc, descFontSize, innerW, 1.3);
      if (descH > 2.2) {
        descFontSize = 11;
        descH = estimateTextHeight(cardDesc, descFontSize, innerW, 1.3);
      }
      descH = Math.min(descH, 2.5);
      descH = Math.max(descH, 1.0);
    }

    const cardH = iconAreaH + titleH + descH + 0.5;
    const clampedCardH = Math.max(4.0, Math.min(cardH, 4.8));

    // Card background
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y: cardY, w: cardW, h: clampedCardH,
      fill: { color: cardBgColor }, rectRadius: 0.12,
    });

    const circleSize = 0.9;
    const circleX = x + (cardW / 2) - (circleSize / 2);
    const circleY = cardY + 0.4;
    slide.addShape(pptx.ShapeType.ellipse, {
      x: circleX, y: circleY, w: circleSize, h: circleSize,
      fill: { color: getSectionAccentColor(data.section, palette) },
    });

    // Icon Image (white)
    const iconSize = 0.5;
    const iconX = x + (cardW / 2) - (iconSize / 2);
    const iconY = circleY + (circleSize - iconSize) / 2;

    if (icons[i]) {
      slide.addImage({ data: icons[i] as string, x: iconX, y: iconY, w: iconSize, h: iconSize });
    }

    // Title
    slide.addText(cardTitle, {
      x: x + 0.3, y: circleY + circleSize + 0.2,
      w: innerW, h: titleH,
      fontSize: 18, bold: true, color: cardTitleColor,
      fontFace: 'Georgia', align: 'center', valign: 'top',
    });

    // Description
    if (cardDesc) {
      slide.addText(cardDesc, {
        x: x + 0.3, y: circleY + circleSize + 0.2 + titleH,
        w: innerW, h: descH,
        fontSize: descFontSize, color: cardDescColor,
        fontFace: 'Arial', align: 'center', valign: 'top',
        lineSpacingMultiple: 1.3,
      });
    }
  }

  addFooter(slide, data.footerText, isDark, palette);
}

// ═══════════════════════════════════════════════════════════════════════
// 3. ROWS SLIDE
// ═══════════════════════════════════════════════════════════════════════
async function renderRowsSlide(slide: PptxGenJS.Slide, pptx: PptxGenJS, data: SlideData, palette: ThemePalette) {
  slide.background = { color: palette.white };

  slide.addText(data.title, {
    x: 0.8, y: 0.6, w: 11, h: 0.8,
    fontSize: 32, bold: true, color: palette.textDark,
    fontFace: 'Georgia',
  });
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.8, y: 1.4, w: 11, h: 0.5,
      fontSize: 16, color: palette.textMuted,
      fontFace: 'Arial', italic: true,
    });
  }

  if (!data.bullets || data.bullets.length === 0) return;

  const numRows = Math.min(data.bullets.length, data.footerText ? 4 : 5);
  const startY = 2.2;
  const rowH = 0.9;
  const gapY = 0.1;

  const iconPromises = data.bullets.slice(0, numRows).map((bullet: any) => {
    const title = typeof bullet === 'string' ? bullet : (bullet.title || '');
    const hint = bullet.icon || undefined;
    return renderIconToPng(title, { size: 128, color: '#FFFFFF', iconHint: hint }).catch(() => null);
  });
  const icons = await Promise.all(iconPromises);

  for (let i = 0; i < numRows; i++) {
    const bullet = data.bullets[i];
    const y = startY + i * (rowH + gapY);

    let rowTitle = '';
    let rowDesc = '';
    if (typeof bullet === 'string') {
      rowTitle = bullet;
    } else if (bullet?.title) {
      rowTitle = bullet.title;
      rowDesc = bullet.description || '';
    }

    // Divider line
    slide.addShape(pptx.ShapeType.line, {
      x: 0.8, y: y, w: 11.5, h: 0,
      line: { color: palette.cardBorder, width: 1 },
    });

    // Icon Circle
    const circleSize = 0.6;
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 0.8, y: y + 0.15, w: circleSize, h: circleSize,
      fill: { color: getSectionAccentColor(data.section, palette) }, // or alternate colors, e.g. a green if matching Claude but let's stick to rust
    });

    // Icon
    if (icons[i]) {
      const iconSize = 0.35;
      slide.addImage({
        data: icons[i]!,
        x: 0.8 + (circleSize - iconSize) / 2,
        y: y + 0.15 + (circleSize - iconSize) / 2,
        w: iconSize, h: iconSize
      });
    }

    // Row Title
    slide.addText(rowTitle, {
      x: 1.7, y: y + 0.15, w: 3.5, h: circleSize,
      fontSize: 16, bold: true, color: palette.textDark,
      fontFace: 'Georgia', valign: 'middle',
    });

    // Row Description
    if (rowDesc) {
      slide.addText(rowDesc, {
        x: 5.5, y: y + 0.15, w: 6.8, h: circleSize,
        fontSize: 14, color: palette.textMuted,
        fontFace: 'Arial', valign: 'middle',
      });
    }
  }

  // Final divider
  slide.addShape(pptx.ShapeType.line, {
    x: 0.8, y: startY + numRows * (rowH + gapY), w: 11.5, h: 0,
    line: { color: palette.cardBorder, width: 1 },
  });

  addFooter(slide, data.footerText, false, palette);
}

// ═══════════════════════════════════════════════════════════════════════
// 4. SPLIT GRAPHIC SLIDE
// ═══════════════════════════════════════════════════════════════════════
async function renderSplitGraphicSlide(slide: PptxGenJS.Slide, pptx: PptxGenJS, data: SlideData, uploadedImages: any[], palette: ThemePalette) {
  slide.background = { color: palette.white };

  // Left text
  slide.addText(data.title, {
    x: 0.8, y: 1.0, w: 5.5, h: 1.0,
    fontSize: 32, bold: true, color: palette.textDark,
    fontFace: 'Georgia', valign: 'top',
  });

  let textY = 2.0;
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.8, y: 2.0, w: 5.5, h: 0.8,
      fontSize: 18, color: palette.textMuted,
      fontFace: 'Arial', italic: true, valign: 'top',
    });
    textY = 2.8;
  }

  if (data.bullets && data.bullets.length > 0) {
    const bulletItems = data.bullets.flatMap((b: any) => {
      const title = typeof b === 'string' ? b : (b.title || '');
      const desc = b.description ? b.description : '';
      const arr = [];
      arr.push({
        text: title,
        options: {
          bullet: { code: '25CF', color: getSectionAccentColor(data.section, palette) } as any,
          fontSize: 14, bold: true, color: palette.textDark, fontFace: 'Arial',
          paraSpaceBefore: 10, breakLine: true
        }
      });
      if (desc) {
        arr.push({
          text: desc,
          options: {
            fontSize: 13, color: palette.textMuted, fontFace: 'Arial',
            paraSpaceBefore: 4, breakLine: true
          }
        });
      }
      return arr;
    });
    slide.addText(bulletItems, {
      x: 0.8, y: textY, w: 5.5, h: 6.8 - textY, valign: 'top'
    });
  }

  // Right graphic box (large rounded rect)
  const boxX = 6.8;
  const boxY = 1.0;
  const boxW = 5.8;
  const boxH = 5.5;

  slide.addShape(pptx.ShapeType.roundRect, {
    x: boxX, y: boxY, w: boxW, h: boxH,
    fill: { color: palette.darkBrown }, rectRadius: 0.05,
  });

  try {
    let imageData: string = '';
    let isMermaid = false;
    let isUserImage = false;
    
    if (data.userImage) {
      const matchedImg = uploadedImages.find(img => img.originalname === data.userImage);
      if (matchedImg) {
        imageData = `data:${matchedImg.mimetype};base64,${matchedImg.buffer.toString('base64')}`;
        isUserImage = true;
      }
    }

    if (!isUserImage) {
      if (data.mermaid) {
        try {
          imageData = await renderMermaidToPng(data.mermaid);
          isMermaid = true;
        } catch (e) {
          console.warn('Mermaid render failed, falling back to icon', e);
          imageData = await renderIconToPng(data.title, { size: 512, color: '#FFFFFF', iconHint: data.slideIcon || data.bullets?.[0]?.icon });
        }
      } else {
        imageData = await renderIconToPng(data.title, { size: 512, color: '#FFFFFF', iconHint: data.slideIcon || data.bullets?.[0]?.icon });
      }
    }

    // @ts-ignore - assigned in branches
    if (isMermaid || isUserImage) {
      slide.addImage({
        data: imageData,
        x: boxX + 0.4, y: boxY + 0.25, w: boxW - 0.8, h: boxH - 0.5,
        sizing: { type: 'contain', w: boxW - 0.8, h: boxH - 0.5 }
      });
    } else {
      const iconSize = 2.5;
      slide.addImage({
        data: imageData,
        x: boxX + (boxW - iconSize) / 2,
        y: boxY + (boxH - iconSize) / 2 - 0.5,
        w: iconSize, h: iconSize
      });
      slide.addText(data.title, { // No toUpperCase
        x: boxX, y: boxY + (boxH - iconSize) / 2 + iconSize,
        w: boxW, h: 1.0,
        fontSize: 14, bold: true, color: getSectionAccentColor(data.section, palette),
        fontFace: 'Arial', charSpacing: 3, align: 'center',
      });
    }
  } catch { /* ignore */ }

  addFooter(slide, data.footerText, false, palette);
}

// ═══════════════════════════════════════════════════════════════════════
// 5. DIAGRAM SLIDE
// ═══════════════════════════════════════════════════════════════════════
async function renderDiagramSlide(slide: PptxGenJS.Slide, pptx: PptxGenJS, data: SlideData, uploadedImages: any[], palette: ThemePalette) {
  slide.background = { color: palette.cream };

  // Diagram on left
  const boxX = 0.8;
  const boxY = 1.0;
  const boxW = 5.8;
  const boxH = 5.5;

  slide.addShape(pptx.ShapeType.roundRect, {
    x: boxX, y: boxY, w: boxW, h: boxH,
    fill: { color: palette.cardBg }, rectRadius: 0.05,
    line: { color: palette.cardBorder, width: 1 }
  });

  try {
    let imageData: string = '';
    let isMermaid = false;
    let isUserImage = false;
    
    if (data.userImage) {
      const matchedImg = uploadedImages.find(img => img.originalname === data.userImage);
      if (matchedImg) {
        imageData = `data:${matchedImg.mimetype};base64,${matchedImg.buffer.toString('base64')}`;
        isUserImage = true;
      }
    }

    if (!isUserImage) {
      if (data.mermaid) {
        try {
          imageData = await renderMermaidToPng(data.mermaid);
          isMermaid = true;
        } catch (e) {
          console.warn('Mermaid render failed, falling back to icon', e);
          imageData = await renderIconToPng(data.title, { size: 512, color: `#${getSectionAccentColor(data.section, palette)}`, iconHint: data.slideIcon || data.bullets?.[0]?.icon });
        }
      } else {
        imageData = await renderIconToPng(data.title, { size: 512, color: `#${getSectionAccentColor(data.section, palette)}`, iconHint: data.slideIcon || data.bullets?.[0]?.icon });
      }
    }

    // @ts-ignore - assigned in branches
    if (isMermaid || isUserImage) {
      slide.addImage({
        data: imageData,
        x: boxX + 0.4, y: boxY + 0.25, w: boxW - 0.8, h: boxH - 0.5,
        sizing: { type: 'contain', w: boxW - 0.8, h: boxH - 0.5 }
      });
    } else {
      const iconSize = 3.0;
      slide.addImage({
        data: imageData,
        x: boxX + (boxW - iconSize) / 2,
        y: boxY + (boxH - iconSize) / 2,
        w: iconSize, h: iconSize
      });
    }
  } catch { /* ignore */ }

  // Text on right
  const textX = 7.0;
  slide.addText(data.title, {
    x: textX, y: 1.0, w: 5.5, h: 1.0,
    fontSize: 32, bold: true, color: palette.textDark,
    fontFace: 'Georgia', valign: 'top',
  });

  let textY = 2.0;
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: textX, y: 2.0, w: 5.5, h: 0.8,
      fontSize: 18, color: palette.textMuted,
      fontFace: 'Arial', italic: true, valign: 'top',
    });
    textY = 2.8;
  }

  if (data.bullets && data.bullets.length > 0) {
    const bulletItems = data.bullets.flatMap((b: any, index: number) => {
      const title = typeof b === 'string' ? b : (b.title || '');
      const desc = b.description ? b.description : '';
      const arr = [];
      arr.push({
        text: `${index + 1}    ${title}`,
        options: {
          fontSize: 14, bold: true, color: palette.textDark, fontFace: 'Arial',
          paraSpaceBefore: 10, breakLine: true
        }
      });
      if (desc) {
        arr.push({
          text: desc,
          options: {
            fontSize: 13, color: palette.textDark, fontFace: 'Arial',
            paraSpaceBefore: 4, breakLine: true
          }
        });
      }
      return arr;
    });
    slide.addText(bulletItems, {
      x: textX, y: textY, w: 5.5, h: 6.8 - textY, valign: 'top'
    });
  }

  addFooter(slide, data.footerText, false, palette);
}

// ═══════════════════════════════════════════════════════════════════════
// QA RENDER STEP (dev-only)
// ═══════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'fs';

export async function runQA(buffer: Buffer): Promise<string[]> {
  try {
    const qaDir = path.resolve(__dirname, '../../.qa-output');
    if (!existsSync(qaDir)) mkdirSync(qaDir, { recursive: true });

    const timestamp = Date.now();
    const pptxPath = path.join(qaDir, `qa_${timestamp}.pptx`);
    writeFileSync(pptxPath, buffer);
    console.log(`[QA] PPTX written to: ${pptxPath}`);

    try {
      execSync(`soffice --headless --convert-to pdf --outdir "${qaDir}" "${pptxPath}"`, {
        timeout: 30000,
        stdio: 'pipe',
      });
      const pdfPath = pptxPath.replace('.pptx', '.pdf');
      console.log(`[QA] PDF written to: ${pdfPath}`);

      try {
        const jpegPrefix = path.join(qaDir, `qa_${timestamp}`);
        execSync(`pdftoppm -jpeg -r 150 "${pdfPath}" "${jpegPrefix}"`, {
          timeout: 30000,
          stdio: 'pipe',
        });
        console.log(`[QA] JPEGs written to: ${jpegPrefix}-*.jpg`);
        
        const files = readdirSync(qaDir).filter(f => f.startsWith(`qa_${timestamp}-`) && f.endsWith('.jpg')).sort();
        const base64Images = files.map(file => {
          const filePath = path.join(qaDir, file);
          const data = readFileSync(filePath);
          return `data:image/jpeg;base64,${data.toString('base64')}`;
        });
        return base64Images;
      } catch (e) {
        console.warn('[QA] pdftoppm not found or failed', e);
        return [];
      }
    } catch (e) {
      console.warn('[QA] LibreOffice (soffice) not found or failed', e);
      return [];
    }
  } catch (err) {
    console.warn('[QA] QA render step failed:', err);
    return [];
  }
}