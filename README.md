# PassPlus Motorcycle HK Website

Bilingual marketing site for **PassPlus Motorcycle training Service** (Hong Kong).

## Live site

**https://passplusmotorcyclehk.com**

## Features

- Homepage with services, pricing, selling points, audience, and WhatsApp / phone contact
- Dedicated **motorcycle licence process** visual page (aligned with Transport Department overview)
- Traditional Chinese / English language toggle
- Brand colours from the PassPlus logo (green + navy)

## Develop / Preview

```bash
git clone https://github.com/passplusmotorcycle/passplus-website-build.git
cd passplus-website-build
npm install
npm run dev
```

Open http://localhost:5173/ and hard-refresh with `Ctrl + Shift + R`.

Later updates:

```bash
git pull origin main
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Custom domain (Namecheap)

Domain: `passplusmotorcyclehk.com`

In Namecheap → Advanced DNS, set:

| Type | Host | Value |
|------|------|-------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `passplusmotorcycle.github.io.` |

Then in GitHub → Settings → Pages → Custom domain: `passplusmotorcyclehk.com` → Save → enable **Enforce HTTPS**.

See `UPDATE.md` for Chinese step-by-step instructions.

## Notes

- Social links: Instagram, Facebook, and Threads are wired on the homepage contact section.
- Replace `public/hero-motorcycle.jpg` with your own training photos when ready.
