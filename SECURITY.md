# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please send an email to the maintainers.

Please do NOT open a public GitHub issue for security vulnerabilities.

## Data Handling

- No personal data is stored by this scraper
- Company data is fetched from public ANAF API
- Job data is public information from Garmin careers page
- Solr credentials are stored in GitHub Secrets

## Environment Variables

- `SOLR_AUTH` - Solr authentication credentials (stored in GitHub Secrets)
- `.env` file is excluded from git via .gitignore