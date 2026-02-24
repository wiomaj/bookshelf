# 📚 My Bookshelf

A personal bookshelf app to track books you've read — and books sitting on your shelf waiting to be read. Built as a mobile-first PWA with cover art, ratings, notes, barcode scanning, and a cozy reading mode.

---

## Features

### 📖 Read & To Read tabs
The home screen has two tabs:
- **Read** — books you've finished, grouped by year with month, rating, and notes
- **To Read** — books you own but haven't read yet, with optional "when did you get it?" date

### 🔍 Smart book search
Start typing a title and get live suggestions from **Open Library** and **Google Books** — cover art, author, and metadata auto-filled instantly.

### 📷 ISBN barcode scanner
Tap the camera icon next to the title field to open a fullscreen scanner. Point at a book's barcode and the app looks up the title, author, and cover automatically — no typing needed.

### 🖼️ Grid & List view
Switch between a visual grid of cover art and a compact list layout on the Read tab. Your preference is saved automatically.

### 📄 Rich book detail page
Each book has a dedicated detail view showing:
- Your personal rating, notes, and read date
- **Released** date and **Genre** (auto-fetched from Google Books)
- **About the book** — synopsis from public APIs

### 🔥 Cozy mode
Enable Cozy mode in Settings to transform the app into a warm reading nook — animated fireplace, amber background, and orange accent color throughout.

### 🌍 5 languages
Full UI translation in English, German, French, Spanish, and Polish — switchable from Settings.

### 🔐 Authentication
Secure sign-up and login via **Supabase Auth**. Each user's bookshelf is private and synced to the cloud.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 15](https://nextjs.org) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Auth & Database | [Supabase](https://supabase.com) |
| Barcode scanning | [@zxing/browser](https://github.com/zxing-js/browser) |
| Book data | [Open Library API](https://openlibrary.org/developers/api) + [Google Books API](https://developers.google.com/books) |
| Deployment | [Vercel](https://vercel.com) |

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment variables

Create a `.env.local` file with your Supabase project credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database migration

Run this in your Supabase SQL editor to set up the `books` table with status support:

```sql
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'read'
  CHECK (status IN ('read', 'to_read'));
```

---

## Adding a read book

1. Tap **+** on the home screen (Read tab)
2. Start typing the title — or tap the camera icon to scan the barcode
3. Select a suggestion or fill in the fields manually
4. Set your rating, when you read it, and any notes
5. Tap **Add book**

## Adding a to-read book

1. Switch to the **To Read** tab
2. Tap **+** or the CTA button
3. Enter the title (with search or barcode scan), author, and optionally when you got it
4. Tap **Add to reading list**
5. When you've read it, open the book and tap **Mark as Read** to move it to your shelf
