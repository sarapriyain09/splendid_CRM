# CRM Shared Modules

This directory holds module boundaries for a single-codebase CRM architecture:

- common
- contacts
- companies
- activities
- tasks
- notes
- documents

These modules are intended to be reused by CRM, Sales, CallCRM, Marketing, Automation, and Analytics.

Rules:
- Keep one source of truth for each entity contract.
- Keep one database schema for all modules.
- Share query/service utilities from module folders rather than duplicating logic in routes.
- Avoid creating module-specific copies of contacts/companies/timeline components.
