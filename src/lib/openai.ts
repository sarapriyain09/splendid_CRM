import fs from 'fs';
import path from 'path';

type ChatRole = 'system' | 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

function readEnvKeyFromFile(key: string): string {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return '';

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eq = line.indexOf('=');
      if (eq <= 0) continue;

      const k = line.slice(0, eq).trim();
      if (k !== key) continue;

      const v = line.slice(eq + 1).trim();
      return v.replace(/^['"]|['"]$/g, '');
    }
  } catch {
    // Ignore file read errors and rely on runtime envs.
  }

  return '';
}

export async function generateChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<string> {
  const apiKey = ((process.env.OPENAI_API_KEY ?? '').trim() || readEnvKeyFromFile('OPENAI_API_KEY')).trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const model = (options.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini').trim();
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 900;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as ChatCompletionResponse;

  if (!res.ok) {
    const err = data?.error?.message || `OpenAI request failed with status ${res.status}.`;
    throw new Error(err);
  }

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('OpenAI returned an empty response.');
  }

  return text;
}

interface ResearchOptions {
  model?: string;
  maxTokens?: number;
}

interface ResponsesApiResult {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
}

function getApiKey(): string {
  return ((process.env.OPENAI_API_KEY ?? '').trim() || readEnvKeyFromFile('OPENAI_API_KEY')).trim();
}

/**
 * Generate an answer using the OpenAI Responses API with the live web_search tool.
 * Falls back to a standard chat completion (no live web access) if the
 * Responses API or web search tool is unavailable.
 */
export async function generateResearchAnswer(
  systemPrompt: string,
  userPrompt: string,
  options: ResearchOptions = {}
): Promise<{ text: string; usedWebSearch: boolean }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const model = (options.model ?? process.env.OPENAI_RESEARCH_MODEL ?? 'gpt-4o-mini').trim();
  const maxTokens = options.maxTokens ?? 1200;

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions: systemPrompt,
        input: userPrompt,
        tools: [{ type: 'web_search_preview' }],
        max_output_tokens: maxTokens,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as ResponsesApiResult;
    if (res.ok) {
      const text = extractResponsesText(data);
      if (text) return { text, usedWebSearch: true };
    }
    // Non-OK or empty: fall through to chat completion fallback.
  } catch {
    // Network/tool error: fall through to chat completion fallback.
  }

  const fallback = await generateChatCompletion(
    [
      { role: 'system', content: `${systemPrompt}\n(Note: live web search is unavailable; answer from general knowledge and clearly flag anything uncertain.)` },
      { role: 'user', content: userPrompt },
    ],
    { model: 'gpt-4o-mini', maxTokens }
  );
  return { text: fallback, usedWebSearch: false };
}

function extractResponsesText(data: ResponsesApiResult): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }
  if (Array.isArray(data.output)) {
    const parts: string[] = [];
    for (const item of data.output) {
      if (item?.type === 'message' && Array.isArray(item.content)) {
        for (const c of item.content) {
          if ((c?.type === 'output_text' || c?.type === 'text') && typeof c.text === 'string') {
            parts.push(c.text);
          }
        }
      }
    }
    return parts.join('\n').trim();
  }
  return '';
}

