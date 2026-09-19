# Dependency audit — 2026-09-19

This review covers the root package and the retained `backend/` rollback workspace. Dependency manifests and the lockfile changed; production schema, production data, application queries, and deployment state did not.

## Result

Before remediation, `npm audit --json` reported 14 affected package nodes: 5 high and 9 moderate. After remediation, both the full and `--omit=dev` audits report 5 nodes: 4 high and 1 moderate. These are dependency-graph counts, not independent exploitable paths; all remaining nodes belong to Prisma's CLI/configuration dependency chain.

Applied remediation:

- Multer `2.2.0 -> 2.4.0` in the retained backend workspace.
- Express `4.22.2 -> 4.22.3` in both manifests, plus a scoped `body-parser -> qs@^6.16.0` override.
- Vitest and `@vitest/mocker` `4.1.10 -> 4.1.11`.
- DOMPurify `3.4.12 -> 3.4.15` through jsPDF's compatible optional dependency range.

## Triage

| Dependency path | Severity | Exposure in this repository | Recommended action |
|---|---:|---|---|
| `backend -> multer@2.4.0` | Cleared | Internet-facing only on the retained Express/Render upload route. The unified Vercel upload handler does not use Multer. | Keep upload type/size behavior in the legacy smoke-test checklist. |
| `express/body-parser -> qs@6.16.0` | Cleared | Query/body parsing applies to the retained Express service. | Keep the scoped override until body-parser natively permits the patched qs range. |
| `jspdf -> dompurify@3.4.15` | Cleared | Browser PDF export dependency. | Retest PDF exports after future jsPDF updates. |
| `vitest -> @vitest/mocker@4.1.11` | Cleared | Development/test server only; not part of the production application runtime. | Keep test tooling off public interfaces. |
| `prisma@7.10.0 -> @prisma/config -> deepmerge-ts@7.1.5` | High | Prisma CLI/configuration path. Application requests use generated Prisma Client and do not merge attacker-controlled recursive configuration graphs. | Track a stable Prisma release that adopts `deepmerge-ts@8`; avoid an untested major-version override. |
| `prisma@7.10.0 -> mysql2@3.15.3` | High/moderate | Prisma CLI transitive dependency. This project connects to PostgreSQL, not MySQL, so the vulnerable MySQL protocol paths are not exercised by the application. | Track a stable Prisma release that updates mysql2. Do not switch to the Prisma 8 release candidate solely to clear the audit. |

`@prisma/client` appears in the production-only audit because its optional peer relationship pulls the installed Prisma CLI chain into npm's graph. This does not make the MySQL driver an application database path.

## Residual action

Track the next stable Prisma release that updates both `deepmerge-ts` and `mysql2`. Do not force `deepmerge-ts@8`, override Prisma's exact `mysql2` pin, or adopt the Prisma 8 release candidate solely to reduce the audit count. The application uses PostgreSQL, so the MySQL protocol advisories are not on its database path; the recursive-merge advisory is confined to Prisma configuration and requires recursive object graphs.

For every dependency batch, run `npm run lint`, `npm test`, `npm run build`, and `npm run build:legacy-backend`; exercise legacy upload behavior after changing Multer. Re-run both full and `--omit=dev` audits and record any accepted residual risk.

## Advisory references

- [Multer crafted multipart field-name denial of service](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm)
- [qs attacker-controlled `isBuffer` denial of service](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g)
- [Vitest mock redirect arbitrary file read](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)
- [DOMPurify detached-subtree XSS](https://github.com/advisories/GHSA-55q2-fjhq-7xh7)
- [deepmerge-ts recursive graph stack exhaustion](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
- [mysql2 cleartext credential downgrade](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr)
- [mysql2 compressed-protocol decompression bomb](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3)
