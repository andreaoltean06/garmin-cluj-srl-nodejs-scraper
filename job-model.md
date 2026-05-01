# Job Model

This document describes the expected schema for job data in the Peviitor ecosystem.

## Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| url | Yes | string | Job posting URL |
| title | Yes | string | Job title |
| company | Yes | string | Company name (uppercase) |
| cif | Yes | string | Company CIF/CUI |
| location | No | array | Job locations (Romanian cities) |
| tags | No | array | Job tags/skills |
| workmode | No | string | `remote`, `on-site`, or `hybrid` |
| date | Yes | string | ISO timestamp |
| status | Yes | string | `scraped` |

## Example

```json
{
  "url": "https://apply.workable.com/garmin-cluj/j/B85E733B19/",
  "title": "Android Software Engineer | Explore Team",
  "company": "GARMIN CLUJ SRL",
  "cif": "18850101",
  "location": ["Cluj-Napoca"],
  "tags": ["android", "java", "mobile"],
  "workmode": "on-site",
  "date": "2026-05-01T18:00:00.000Z",
  "status": "scraped"
}
```