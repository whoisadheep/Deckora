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
const BulletSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
});

const SlideSchema = z.object({
  layout: z.enum(['hero', 'cards_light', 'cards_dark', 'rows', 'split_graphic', 'diagram']),
  kicker: z.string().optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  footerText: z.string().optional(),
  bullets: z.array(BulletSchema).optional(),
  slideIcon: z.string().optional(),
  mermaid: z.string().optional(),
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
7. For icons and diagrams:
   - On individual bullets, provide a descriptive 'icon' keyword (e.g. 'building', 'tree', 'sun', 'chart').
   - For 'diagram' and 'split_graphic' slides, you MUST provide a 'mermaid' string containing valid Mermaid.js code.
   - CRITICAL MERMAID RULES:
     1. Use literal newline characters (\\n) to separate statements. Do NOT put everything on one line.
     2. ALWAYS wrap node text in quotes to prevent syntax errors: e.g. A["Node Text (Info)"]
     3. Stick to simple 'graph TD', 'mindmap', or 'pie'. Avoid 'gitGraph' as it is highly prone to syntax errors.
     4. Do not wrap in markdown code blocks, just raw mermaid syntax in the JSON string.
   - If 'mermaid' is provided, you do not need 'slideIcon'. Use 'slideIcon' only as a fallback.

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
          "icon": "Optional icon keyword"
        }
      ],
      "slideIcon": "Optional icon keyword for the whole slide",
      "mermaid": "graph TD\\n  A[Start] --> B[End]",
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
      model: 'gemini-flash-lite-latest',
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

// ── Pre-process AI output to fix common issues ────────────────────────
function sanitizeOutline(parsed: any): any {
  return parsed;
}

// ── Public function ────────────────────────────────────────────────────
export async function generatePresentationOutline(topic: string, modelChoice: string = 'nvidia'): Promise<Outline> {
  const prompt = buildPrompt(topic);

  try {
    // First attempt
    const raw = await callAI(prompt, modelChoice);
    const jsonStr = extractJson(raw);
    const parsed = JSON.parse(jsonStr);
    const sanitized = sanitizeOutline(parsed);
    const result = OutlineSchema.safeParse(sanitized);

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
    const retrySanitized = sanitizeOutline(retryParsed);
    const retryResult = OutlineSchema.safeParse(retrySanitized);

    if (retryResult.success) {
      return retryResult.data;
    }

    // Both attempts failed — throw with details
    const retryErrorMsg = retryResult.error.issues
      .map((iss) => `  - ${iss.path.join('.')}: ${iss.message}`)
      .join('\n');
    throw new Error(`Outline validation failed after retry:\n${retryErrorMsg}`);
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    throw new Error(`Failed to generate presentation outline: ${error?.message || String(error)}`);
  }
}