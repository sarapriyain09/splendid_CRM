export type OutreachChannel = 'email' | 'sms';

export const OUTREACH_VERTICALS = ['crm', 'digital', 'software', 'ai_automation', 'engineering', 'iot'] as const;
export type OutreachVertical = (typeof OUTREACH_VERTICALS)[number];

export interface LeadTemplateContext {
  company_name: string;
  location?: string | null;
  sic_label?: string | null;
  notes?: string | null;
}

export interface OutreachTemplate {
  channel: OutreachChannel;
  vertical: string;
  subject: string | null;
  message: string;
}

export function normalizeVertical(vertical: string | null | undefined): OutreachVertical {
  const value = (vertical ?? '').trim();
  if (OUTREACH_VERTICALS.includes(value as OutreachVertical)) {
    return value as OutreachVertical;
  }
  return 'digital';
}

export function renderTemplate(text: string, context: LeadTemplateContext): string {
  return text
    .replaceAll('{{company_name}}', context.company_name || 'there')
    .replaceAll('{{location}}', context.location ?? '')
    .replaceAll('{{sic_label}}', context.sic_label ?? '')
    .replaceAll('{{notes}}', context.notes ?? '');
}

export function renderOutreachTemplate(template: OutreachTemplate, context: LeadTemplateContext) {
  return {
    subject: template.subject ? renderTemplate(template.subject, context) : null,
    message: renderTemplate(template.message, context),
  };
}
