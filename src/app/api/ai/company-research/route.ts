import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { generateResearchAnswer } from '@/lib/openai';
import { INDUSTRY_OPTIONS } from '@/lib/industry-options';

interface ResearchBody {
  mode?: 'company' | 'contact';
  name?: string;
  website?: string;
  country?: string;
  question?: string;
  contactName?: string;
  jobTitle?: string;
}

interface ResearchFields {
  website?: string | null;
  industry?: string | null;
  country?: string | null;
  linkedin_url?: string | null;
  description?: string | null;
  job_title?: string | null;
  email?: string | null;
  company_name?: string | null;
}

function extractJsonBlock(text: string): Record<string, unknown> | null {
  // Try fenced code block first, then the first balanced object.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /^(n\/?a|unknown|none|not found|null)$/i.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as ResearchBody;
  const mode = body.mode === 'contact' ? 'contact' : 'company';
  const name = (body.name ?? '').trim();
  const contactName = (body.contactName ?? '').trim();
  const question = (body.question ?? '').trim();

  if (mode === 'contact') {
    if (!contactName && !question) {
      return NextResponse.json({ error: 'Provide a contact name or a question.' }, { status: 400 });
    }
  } else if (!name && !question) {
    return NextResponse.json({ error: 'Provide a company name or a question.' }, { status: 400 });
  }

  const systemPrompt = [
    'You are a B2B research assistant for a UK CRM.',
    'Use live web search to find accurate, current information.',
    'Never invent facts. If something cannot be verified, return null for that field.',
    'Prefer official company websites and LinkedIn pages as sources.',
  ].join(' ');

  const userPrompt = mode === 'contact'
    ? [
        contactName ? `Research this person: "${contactName}".` : 'Research the person referenced in the question below.',
        name ? `They work at: "${name}".` : '',
        body.jobTitle ? `Known job title: ${body.jobTitle}` : '',
        question ? `The user also asks: ${question}` : '',
        '',
        'Return your reply in two parts:',
        '1) A short, plain-text answer (3-6 sentences) summarising what you found.',
        '2) A JSON object (in a ```json code block) with these exact keys, using null when unknown:',
        '{',
        '  "job_title": string|null,      // their current role/title',
        '  "email": string|null,          // work email if publicly listed (do not guess)',
        '  "linkedin_url": string|null,   // their personal LinkedIn profile URL',
        '  "company_name": string|null,   // employer company name',
        '  "description": string|null     // one-sentence summary of the person',
        '}',
      ].filter(Boolean).join('\n')
    : [
        name ? `Research this company: "${name}".` : 'Research the company referenced in the question below.',
        body.website ? `Known website: ${body.website}` : '',
        body.country ? `Likely country: ${body.country}` : '',
        question ? `The user also asks: ${question}` : '',
        '',
        'Return your reply in two parts:',
        '1) A short, plain-text answer (3-6 sentences) addressing the user and summarising what you found.',
        '2) A JSON object (in a ```json code block) with these exact keys, using null when unknown:',
        '{',
        '  "website": string|null,        // official homepage URL',
        '  "industry": string|null,       // choose the closest match from the allowed list below',
        '  "country": string|null,        // headquarters country',
        '  "linkedin_url": string|null,   // LinkedIn company page URL',
        '  "description": string|null     // one-sentence description of what they do',
        '}',
        '',
        `Allowed industry values: ${INDUSTRY_OPTIONS.join(', ')}.`,
      ].filter(Boolean).join('\n');

  try {
    const { text, usedWebSearch } = await generateResearchAnswer(systemPrompt, userPrompt, { maxTokens: 1200 });

    const json = extractJsonBlock(text);
    const fields: ResearchFields = mode === 'contact'
      ? {
          job_title: cleanString(json?.job_title),
          email: cleanString(json?.email),
          linkedin_url: cleanString(json?.linkedin_url),
          company_name: cleanString(json?.company_name),
          description: cleanString(json?.description),
        }
      : {
          website: cleanString(json?.website),
          industry: cleanString(json?.industry),
          country: cleanString(json?.country),
          linkedin_url: cleanString(json?.linkedin_url),
          description: cleanString(json?.description),
        };

    // Strip the JSON block from the human-readable answer.
    const answer = text.replace(/```(?:json)?\s*[\s\S]*?```/i, '').trim() || text.trim();

    return NextResponse.json({ answer, fields, usedWebSearch });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Research failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
