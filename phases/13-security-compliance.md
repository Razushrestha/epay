# §13 Security and compliance

- **Passwords:** argon2id; login rate limit + lockout; 2FA for sellers & staff
- **TLS** on all traffic; encryption at rest; field encryption for ID + bank details
- **No card data** on platform (hosted payment pages only)
- **KYC:** private bucket; short-lived links; every access logged
- **Staff RBAC;** all admin changes in audit log
- **Uploads:** type/size validation; remove photo location metadata; moderation
- **WAF/bot protection** at edge; dependency + secret scanning in CI; pre-launch security review
- **Privacy:** consent records; export/delete on request (Nepal law)

**Implementation:** `server/security/*`, migration `002`, `docs/12-security-and-compliance.md` (when disk allows), CI security workflow.
