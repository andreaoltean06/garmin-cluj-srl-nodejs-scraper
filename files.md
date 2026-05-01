# Files Description

This document describes the purpose of each file in the repository.

## Root Files

| File | Description |
|------|-------------|
| `index.js` | Main scraper entry point - orchestrates the scraping workflow |
| `company.js` | Company validation via ANAF API |
| `demoanaf.js` | ANAF API integration module |
| `solr.js` | Solr database operations (query, upsert, delete) |
| `company.json` | Cached company data from ANAF |
| `package.json` | Node.js project configuration |
| `.gitignore` | Git ignore rules |
| `.npmrc` | NPM configuration |
| `README.md` | Project documentation |
| `LICENSE` | MIT License |
| `CONTRIBUTING.md` | Contribution guidelines |
| `SECURITY.md` | Security policy |
| `CHANGELOG.md` | Version changelog |
| `company-model.md` | Company data schema |
| `job-model.md` | Job data schema |
| `files.md` | This file - file descriptions |

## Directories

| Directory | Description |
|-----------|-------------|
| `.github/workflows/` | GitHub Actions workflows |
| `tests/` | Test suite (unit, integration, e2e) |
| `docs/` | Additional documentation |