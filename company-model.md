# Company Model

This document describes the expected schema for company data in the Peviitor ecosystem.

## Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| id | Yes | string | CIF/CUI as string |
| company | Yes | string | Official company name |
| brand | No | string | Marketing brand name |
| group | No | string | Corporate group |
| status | No | string | `activ`, `suspendat`, `inactiv`, `radiat` |
| location | No | array | Office locations |
| website | No | array | Company website URLs |
| career | No | array | Career page URLs |
| lastScraped | No | string | Last scrape timestamp |
| scraperFile | No | string | Link to scraper source |

## Example

```json
{
  "id": "18850101",
  "company": "GARMIN CLUJ SRL",
  "brand": "GARMIN",
  "status": "activ",
  "location": ["Cluj-Napoca"],
  "website": ["https://www.garmin.com/"],
  "career": ["https://careers.garmin.com/"]
}
```