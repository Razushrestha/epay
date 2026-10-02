# Milestone 1 — End of month 1

**Proposal deliverable:** Approved requirements & UI/UX; architecture & DB design; environments & CI; **user accounts, KYC, category catalog working**.

## Week 1–2

- [ ] Requirements workshop; sign-off on §4 Included scope
- [ ] UI/UX wireframes: home, listing detail, bid panel, checkout shell, admin shell
- [ ] Repo layout (`apps/api`, `web`, `worker`, `realtime`) or interim Node API
- [ ] Docker Compose / PGLite; migration `001` identity + catalog
- [ ] CI: lint, build, audit (security workflow)
- [ ] Client: decision-maker, staging access (§17 week 2)

## Week 3–4

### Identity (§4.1)

- [ ] POST register / login (argon2id, rate limit, lockout)
- [ ] Email/phone OTP (`verification_codes`)
- [ ] Google OAuth (`social_accounts`)
- [ ] 2FA TOTP enroll/confirm (`two_factor`) — required path for staff
- [ ] Password reset flow
- [ ] Sessions: `auth_sessions`, list/revoke devices
- [ ] Profiles, addresses, business profile
- [ ] Consent records (`user_consents`) for privacy policy version

### KYC (§4.1)

- [ ] Upload ID docs → private storage + encrypted doc number
- [ ] Admin queue: approve/reject with reason
- [ ] Access via short-lived URL + `kyc_access_logs`

### Catalog (§4.2)

- [ ] Category CRUD (tree, slug, commission_bp, flags)
- [ ] Category attributes + values (item specifics builder)
- [ ] Conditions, brands, restricted_rules
- [ ] Public API: list categories, category by slug

### Demo acceptance

- [ ] Register seller → submit KYC → admin approves
- [ ] Browse category tree on storefront
- [ ] Staging demo + written milestone sign-off (5 working days)

**Maps to cost package B (partial):** Identity, KYC, catalog — NPR 1,50,000 share of scope.
