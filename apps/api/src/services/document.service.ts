import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const MAX_CONTEXT_CHARS = 12_000;

/**
 * Extract plain text from a file buffer based on its MIME type.
 * Supports PDF, DOCX, and plain text. Truncates output to ~12k characters
 * so it fits within LLM context windows alongside the system prompt.
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  let raw: string;

  if (mimeType === 'application/pdf') {
    const parse = typeof pdfParse === 'function' ? pdfParse : (pdfParse as any).default;
    const data = await parse(buffer);
    raw = data.text;
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    raw = result.value;
  } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    raw = buffer.toString('utf-8');
  } else {
    throw new Error(`Unsupported file type: ${mimeType}. Supported: PDF, DOCX, TXT.`);
  }

  // Normalize whitespace: collapse multiple newlines/spaces
  raw = raw.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();

  if (raw.length === 0) {
    throw new Error('The uploaded document appears to be empty or contains no extractable text.');
  }

  // Truncate to fit within LLM context limits
  if (raw.length > MAX_CONTEXT_CHARS) {
    raw = raw.substring(0, MAX_CONTEXT_CHARS) + '\n\n[... Document truncated for length ...]';
  }

  return raw;
}
