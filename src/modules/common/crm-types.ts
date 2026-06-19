export type EntityRef = {
  id: string | number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | number | null;
  updatedBy?: string | number | null;
};

export type ContactStatus = 'Active' | 'Inactive' | 'Prospect' | 'Customer' | 'Supplier' | 'Partner';
export type CompanyStatus = 'Active' | 'Inactive' | 'Prospect' | 'Customer' | 'Supplier' | 'Partner';

export type ActivityType = 'Call' | 'Email' | 'Meeting' | 'Visit' | 'Task' | 'Note';
export type ActivityStatus = 'Open' | 'Completed' | 'Cancelled';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Open' | 'In Progress' | 'Completed' | 'Cancelled';

export type DocumentCategory = 'Contracts' | 'Invoices' | 'Proposals' | 'Images' | 'Reports' | 'Other';

export interface CrmContact extends EntityRef {
  firstName: string;
  lastName?: string | null;
  displayName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  companyId?: string | number | null;
  email?: string | null;
  mobile?: string | null;
  phone?: string | null;
  website?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  county?: string | null;
  country?: string | null;
  postCode?: string | null;
  linkedInUrl?: string | null;
  ownerId?: string | number | null;
  status: ContactStatus;
  description?: string | null;
  tags?: string[];
}

export interface CrmCompany extends EntityRef {
  name: string;
  industry?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  postCode?: string | null;
  annualRevenue?: number | null;
  employeeCount?: number | null;
  linkedInUrl?: string | null;
  ownerId?: string | number | null;
  tags?: string[];
  status: CompanyStatus;
  description?: string | null;
}

export interface CrmActivity extends EntityRef {
  type: ActivityType;
  subject?: string | null;
  description?: string | null;
  date: string;
  duration?: number | null;
  contactId?: string | number | null;
  companyId?: string | number | null;
  ownerId?: string | number | null;
  status: ActivityStatus;
}

export interface CrmTask extends EntityRef {
  title: string;
  description?: string | null;
  priority: TaskPriority;
  dueDate?: string | null;
  startDate?: string | null;
  status: TaskStatus;
  assignedUserId?: string | number | null;
  contactId?: string | number | null;
  companyId?: string | number | null;
  reminderDate?: string | null;
}

export interface CrmNote extends EntityRef {
  title?: string | null;
  content: string;
  contactId?: string | number | null;
  companyId?: string | number | null;
  tags?: string[];
  pinned?: boolean;
}

export interface CrmDocument extends EntityRef {
  name: string;
  category: DocumentCategory;
  description?: string | null;
  fileName: string;
  fileSize?: number | null;
  mimeType?: string | null;
  version?: number;
  contactId?: string | number | null;
  companyId?: string | number | null;
  uploadedBy?: string | number | null;
  tags?: string[];
}

export type TimelineItemType = 'activity' | 'task' | 'note' | 'document';

export interface TimelineItem {
  id: string | number;
  type: TimelineItemType;
  title: string;
  description?: string | null;
  happenedAt: string;
  contactId?: string | number | null;
  companyId?: string | number | null;
}
