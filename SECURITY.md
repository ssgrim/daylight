Security Policy
===============

This repository contains guidance on security controls, responsible
disclosure, and developer best practices for the Daylight project.

Security controls (developer checklist):

- Secrets management: Do not commit secrets to repo. Use environment variables
  and a secrets manager for production credentials.
- Authentication: Enforce strong password policies and multi-factor
  authentication for admin accounts.
- Transport: Use TLS for all network traffic in production services.
- Data encryption: Encrypt sensitive data at rest and in transit.
- Logging and monitoring: Centralized logs, alerting for suspicious access.
- Least privilege: Grant minimal permissions to services and runtime roles.
- Dependency management: Pin critical dependencies and run automated
  vulnerability scans (Dependabot, Snyk, or similar).

Breach notification and response:

1. Contain: disable affected keys and isolate affected services.
2. Assess: determine scope and impact of breach.
3. Notify: contact affected users and regulatory authorities within 72
   hours when required by GDPR.
4. Remediate: patch vulnerabilities and restore services securely.

Responsible disclosure
---------------------
If you discover a security vulnerability, contact: security@yourdomain.example
Provide reproduction steps, affected components, and suggested mitigations.
