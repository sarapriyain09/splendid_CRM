export type UserRole = 'admin' | 'user';
export type LeadStatus = 'new' | 'qualified' | 'rejected';
export type LeadStage =
  | 'prospect'
  | 'lead'
  | 'contacted'
  | 'meeting_scheduled'
  | 'requirements'
  | 'proposal_sent'
  | 'negotiation'
  | 'won'
  | 'lost';
export type LeadSource =
  | 'companies_house'
  | 'website'
  | 'whatsapp'
  | 'linkedin'
  | 'referral'
  | 'google'
  | 'other';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Lead {
  id: number;
  company_name: string;
  company_number: string | null;
  sic_code: string | null;
  sic_label: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  location: string | null;
  incorporated: string | null;
  postcode: string | null;
  status: LeadStatus;
  stage: LeadStage;
  source: LeadSource;
  score: number;
  lead_score: number;
  assigned_to: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contacted_at: string | null;
  outreach_email: string | null;
  sms_sent_at: string | null;
  sms_message: string | null;
  created_by: number | null;
}

export interface Contact {
  id: number;
  lead_id: number;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  is_primary: boolean | number;
  created_at: string;
}

export interface Note {
  id: number;
  lead_id: number;
  user_id: number;
  body: string;
  content: string | null;
  user_name: string | null;
  created_at: string;
}

export interface Task {
  id: number;
  lead_id: number | null;
  user_id: number;
  title: string;
  due_at: string | null;
  done: boolean | number;
  created_at: string;
}

export interface Quote {
  id: number;
  quote_number: string;
  lead_id: number | null;
  customer: string | null;
  customer_name: string | null;
  address: string | null;
  email: string | null;
  status: QuoteStatus;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  terms: string | null;
  notes: string | null;
  expires_at: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: number;
  quote_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
}

export type QuoteDetail = Quote & {
  items: QuoteItem[];
};

export const PIPELINE_STAGES: { key: LeadStage; label: string }[] = [
  { key: 'prospect', label: 'Prospect' },
  { key: 'lead', label: 'Lead' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'proposal_sent', label: 'Proposal Sent' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

export const LEAD_SOURCES: { key: LeadSource; label: string }[] = [
  { key: 'companies_house', label: 'Companies House' },
  { key: 'website', label: 'Website' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'referral', label: 'Referral' },
  { key: 'google', label: 'Google' },
  { key: 'other', label: 'Other' },
];

export const PRODUCTS: string[] = [
  'Web Design',
  'Web Development',
  'SEO',
  'Social Media Marketing',
  'Email Marketing',
  'Content Writing',
  'Graphic Design',
  'Logo Design',
  'Branding',
  'Consulting',
];
