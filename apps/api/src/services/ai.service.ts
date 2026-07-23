import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const nvidiaClient = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
});

const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ── Zod schema matching the documented JSON contract ───────────────────
const ShapeSchema = z.object({
  type: z.enum(['rect', 'triangle', 'ellipse', 'roundRect', 'line']),
  x: z.number(), // 0-100 relative to drawing box
  y: z.number(), // 0-100 relative to drawing box
  w: z.number(), // 0-100 relative width
  h: z.number(), // 0-100 relative height
  color: z.string(), // Hex without #, e.g., C05A35
});

const DrawingSchema = z.object({
  shapes: z.array(ShapeSchema),
});

const BulletSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  drawing: DrawingSchema.optional(),
});

const SlideSchema = z.object({
  layout: z.enum(['hero', 'cards_light', 'cards_dark', 'rows', 'split_graphic', 'diagram']),
  kicker: z.string().optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  footerText: z.string().optional(),
  bullets: z.array(BulletSchema).optional(),
  drawing: DrawingSchema.optional(),
  speakerNotes: z.string().optional(),
});

const OutlineSchema = z.object({
  slides: z.array(SlideSchema),
});

export type Outline = z.infer<typeof OutlineSchema>;

// ── Robust JSON extraction ─────────────────────────────────────────────
function extractJson(raw: string): string {
  const match =
    raw.match(/```json\s*([\s\S]*?)```/) ??
    raw.match(/```\s*([\s\S]*?)```/);
  return (match?.[1] ?? raw).trim();
}

// ── Prompt builder ─────────────────────────────────────────────────────
function buildPrompt(topic: string, fixInstruction?: string): string {
  let prompt = `
You are an expert presentation designer crafting high-end, editorial-quality presentations.
Create a well-structured presentation outline about: "${topic}".
The presentation should be between 8 to 10 slides.

Rules:
1. Return ONLY a valid JSON object matching the schema below. No markdown formatting, no code blocks, no intro/outro text.
2. Use mixed-case, elegant phrasing for titles (e.g., "Traditional Houses of Bengal", not "TRADITIONAL HOUSES OF BENGAL").
3. Vary the slide layouts to create a beautiful visual rhythm. Use a mix of:
   - 'hero': For the opening title slide. Include a 'kicker' (e.g., "B. ARCH — STUDY") and 'footerText' (e.g., "A study of...").
   - 'cards_light': Light cream background with 2-4 cards. Great for concepts.
   - 'cards_dark': Dark brown background with 2-4 cards. Great for contrast and key pillars.
   - 'rows': Clean white background with a vertical list of rows. Great for features or sequential points.
   - 'diagram': Left side large custom drawing, right side text (title + bullets). Great for explaining physical structures, layouts, or architectures.
4. Alternate between 'cards_light', 'cards_dark', and 'rows' to keep pacing engaging. Use 'diagram' or 'split_graphic' for deep dives.
5. Provide a contextual 'footerText' for slides where relevant (e.g., "Geography · Climate · Material availability").
6. The VERY LAST SLIDE must be a 'Conclusion' or 'Summary'. Include at least 3 strong points.
7. For custom geometric drawings: Instead of 'icon', you can provide a 'drawing' object. Use a 100x100 relative grid coordinate system where (x=0, y=0) is top-left.
   - Shapes allowed: 'rect', 'triangle', 'ellipse', 'roundRect', 'line'.
   - Available Brand Colors (hex without #): '3D322A' (Dark Brown), '5C4A3A' (Warm Brown), 'C05A35' (Rust Orange), 'D4784B' (Light Orange), 'EDE5DC' (Light Beige).
   - CRITICAL: Do not just draw a single basic shape! You must build DETAILED, COMPOSITE diagrams using 5-20 shapes.
   - Example (Floor plan): Use multiple 'rect' shapes (e.g., walls/rooms in Dark Brown) surrounding a central 'rect' (courtyard in Light Beige), with 'line' shapes for doors/paths.
   - Example (Architecture): Use overlapping 'triangle' shapes for roofs, 'rect' for pillars, and 'ellipse' for domes. Combine colors to create depth.
   - Use 'drawing' on individual bullets for 'cards_light' / 'cards_dark' to represent structures (like roof shapes).
   - Use 'drawing' on the slide level for 'diagram' or 'split_graphic' layouts to construct large complex graphics.

JSON Schema:
{
  "slides": [
    {
      "layout": "hero" | "cards_light" | "cards_dark" | "rows" | "split_graphic",
      "kicker": "Optional small top text",
      "title": "Slide Title",
      "subtitle": "Optional subtitle",
      "footerText": "Optional subtle bottom text",
      "bullets": [
        {
          "title": "Bullet Title",
          "description": "Optional description",
          "icon": "Optional icon keyword",
          "drawing": {
            "shapes": [
              { "type": "rect", "x": 10, "y": 10, "w": 80, "h": 50, "color": "C05A35" }
            ]
          }
        }
      ],
      "drawing": {
        "shapes": [
          { "type": "triangle", "x": 20, "y": 10, "w": 60, "h": 40, "color": "5C4A3A" }
        ]
      },
      "speakerNotes": "Optional notes"
    }
  ]
}

Ensure the output is raw JSON, strictly matching this schema.
`;

  if (fixInstruction) {
    prompt += `\n\nIMPORTANT: Your previous response failed validation with this error:\n${fixInstruction}\n\nPlease fix the JSON and resend. Return ONLY the corrected raw JSON.`;
  }

  return prompt;
}

// ── Core AI call ───────────────────────────────────────────────────────
async function callAI(prompt: string, modelChoice: string = 'nvidia'): Promise<string> {
  if (modelChoice === 'gemini') {
    const model = geminiClient.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.7 } 
    });
    const result = await model.generateContent(prompt);
    const content = result.response.text();
    if (!content) throw new Error('No content received from Gemini');
    return content;
  } else {
    const modelName = process.env.NVIDIA_MODEL_NAME || 'meta/llama-3.1-70b-instruct';
    const response = await nvidiaClient.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from AI');
    }
    return content;
  }
}

// ── Public function ────────────────────────────────────────────────────
export async function generatePresentationOutline(topic: string, modelChoice: string = 'nvidia'): Promise<Outline> {
  const prompt = buildPrompt(topic);

  try {
    // First attempt
    const raw = await callAI(prompt, modelChoice);
    const jsonStr = extractJson(raw);
    const parsed = JSON.parse(jsonStr);
    const result = OutlineSchema.safeParse(parsed);

    if (result.success) {
      return result.data;
    }

    // Validation failed — retry once with the error message
    const errorMsg = result.error.issues
      .map((iss) => `  - ${iss.path.join('.')}: ${iss.message}`)
      .join('\n');
    console.warn(`[AI] First attempt failed Zod validation:\n${errorMsg}\nRetrying...`);

    const retryPrompt = buildPrompt(topic, errorMsg);
    const retryRaw = await callAI(retryPrompt, modelChoice);
    const retryJsonStr = extractJson(retryRaw);
    const retryParsed = JSON.parse(retryJsonStr);
    const retryResult = OutlineSchema.safeParse(retryParsed);

    if (retryResult.success) {
      return retryResult.data;
    }

    // Both attempts failed — throw with details
    const retryErrorMsg = retryResult.error.issues
      .map((iss) => `  - ${iss.path.join('.')}: ${iss.message}`)
      .join('\n');
    throw new Error(`Outline validation failed after retry:\n${retryErrorMsg}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Outline validation failed')) {
      throw error;
    }
    console.error('Error generating presentation outline:', error);
    throw new Error('Failed to generate presentation outline');
  }
}