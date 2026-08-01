# PassPlus Motorcycle HK Website

Bilingual marketing site for **PassPlus Motorcycle training Service** (Hong Kong).

## Features

- Homepage with services, pricing, selling points, audience, and WhatsApp / phone contact
- Dedicated **motorcycle licence process** visual page (aligned with Transport Department overview)
- Traditional Chinese / English language toggle
- Brand colours from the PassPlus logo (green + navy)

## Develop / Preview updates

First time:

```bash
git clone -b cursor/passplus-motorcycle-website-b70f https://github.com/passplusmotorcycle/passplus-website-build.git
cd passplus-website-build
npm install
npm run dev
```

Later updates (no need to re-download ZIP):

```bash
cd passplus-website-build
git pull origin cursor/passplus-motorcycle-website-b70f
npm run dev
```

Open http://localhost:5173/ and hard-refresh with `Ctrl + Shift + R`.


## Build

```bash
npm run build
npm run preview
```

## Contact placeholders to update

- Social links: Instagram, Facebook, and Threads are wired on the homepage contact section.
- Replace `public/hero-motorcycle.jpg` with your own training photos when ready.
