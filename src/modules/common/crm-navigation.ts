export const CRM_NAVIGATION = [
  { href: '/companies', label: 'Accounts' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/activities', label: 'Activities' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/notes', label: 'Notes' },
  { href: '/documents', label: 'Documents' },
] as const;

export const CONTACT_DETAIL_TABS = [
  'Overview',
  'Activities',
  'Tasks',
  'Notes',
  'Documents',
  'Related Companies',
  'Call History',
  'Campaign History',
  'Sales Opportunities',
  'Quotes',
  'Timeline',
] as const;

export const COMPANY_DETAIL_TABS = [
  'Overview',
  'Contacts',
  'Activities',
  'Tasks',
  'Notes',
  'Documents',
  'Sales Opportunities',
  'Campaign History',
  'Call History',
  'Timeline',
] as const;
