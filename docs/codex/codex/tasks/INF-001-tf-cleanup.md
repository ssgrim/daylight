# INF-001 — Terraform variables and IAM perms cleanup

## Goal
Parameterize region and stage, and grant DynamoDB access to Lambda role (read/write for trips table).

## Steps
1) Add `stage` variable and tag resources with it.
2) Attach an inline policy on the Lambda role for `dynamodb:*Item` restricted to trips table ARN.
3) Output API routes and table name clearly.

## Acceptance Criteria
- TF plan shows proper IAM policy attachments.
- Outputs include readable API base URL and table name.
