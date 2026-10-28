# Security and private reporting

This is a public static portfolio. There is no application login, database or server-side secret store. Files sent to the browser and source committed to the public repository are public.

For a suspected credential exposure, private-media leak or exploitable issue, contact the owner through the email action on the portfolio's Contact panel. Include a concise description, affected URL or commit and minimal reproduction. Do not attach live credentials, restricted originals or personal account data to a public GitHub issue. No response-time guarantee is published.

Keep credentials in the local credential manager, never in source, build metadata or deployment logs. The release process needs ordinary repository write access; it does not require adding tokens to project configuration. Report a suspected leaked credential privately and revoke it with its provider; deleting a file from the latest commit does not remove it from Git history.

Review the actual `dist/client` output before publishing. Restricted media must be sanitized before entering `public/`; hiding a link or case is not an access control. Domain changes should preserve unrelated DNS and email records and be checked with HTTPS before the domain is announced as live.

Only the current maintained source on `main` is considered for fixes. Older deployment commits are retained for release history and rollback, not as separate supported versions.
