export const CRM_DAILY_ACTIVITIES: string[] = [
  '5 LinkedIn connections',
  '2 Follow-up messages',
  '1 Upwork proposal',
  '15 min CRM improvement',
  'Respond to LinkedIn/Upwork messages',
];

export const CRM_WEEKLY_ACTIVITIES: string[] = [
  'Publish 1 LinkedIn post',
  'Publish 1 YouTube video',
  'Apply to 5 Upwork projects',
  '1 CRM demo or feedback session',
  'Review product roadmap',
  'Publish 1 blog article',
];

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildWeeklyTaskPlan(startDate: string = new Date().toISOString().slice(0, 10)) {
  const start = new Date(`${startDate}T00:00:00`);

  const plan: Array<{ title: string; due_date: string; category: 'daily' | 'weekly' }> = [];

  for (let day = 0; day < 7; day += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + day);
    const dueDate = toIsoDate(date);

    for (const activity of CRM_DAILY_ACTIVITIES) {
      plan.push({
        title: `[CRM 90-Day] ${activity}`,
        due_date: dueDate,
        category: 'daily',
      });
    }
  }

  for (let i = 0; i < CRM_WEEKLY_ACTIVITIES.length; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    plan.push({
      title: `[CRM 90-Day] ${CRM_WEEKLY_ACTIVITIES[i]}`,
      due_date: toIsoDate(date),
      category: 'weekly',
    });
  }

  return plan;
}
