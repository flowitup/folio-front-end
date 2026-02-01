# Construction Frontend

Next.js application with TypeScript and Tailwind CSS for the Construction Management System.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **UI Components**: Shadcn UI (Radix primitives)
- **Icons**: Lucide React
- **i18n**: next-intl (en, fr, vi)
- **Testing**: Vitest + React Testing Library
- **Linting**: ESLint 9

## Features

- JWT authentication with HTTP-only cookies
- Multi-language support (English, French, Vietnamese)
- Dark/Light/System theme modes with persistence
- Project workspace switching
- Responsive fintech-inspired UI

## Project Structure

```
src/
├── app/[locale]/
│   ├── (app)/              # Protected app routes
│   │   ├── layout.tsx      # Shell layout (Sidebar + Topbar)
│   │   ├── dashboard/      # Overview page
│   │   ├── projects/       # Projects page
│   │   └── settings/       # Settings page
│   ├── login/              # Login page
│   ├── unauthorized/       # 403 page
│   ├── globals.css         # Global styles + theme variables
│   └── layout.tsx          # Root layout (providers)
├── components/
│   ├── auth/               # LoginForm, ProtectedRoute
│   ├── layout/             # Sidebar, Topbar
│   ├── project/            # ProjectSelector
│   ├── ui/                 # Shadcn UI components
│   ├── language-switcher.tsx
│   └── theme-toggle.tsx
├── context/
│   ├── AuthContext.tsx     # Auth state provider
│   ├── AuthErrorBoundary.tsx
│   ├── ProjectContext.tsx  # Project state provider
│   └── ThemeContext.tsx    # Theme state provider
├── i18n/
│   ├── config.ts           # Locale definitions
│   ├── routing.ts          # next-intl routing config
│   ├── navigation.ts       # Localized Link/useRouter
│   └── request.ts          # Server request config
├── messages/               # Translation files (en, fr, vi)
├── lib/
│   ├── api/http.ts         # Typed fetch wrapper
│   ├── auth/               # Session, actions, types
│   ├── config/env.ts       # Environment config
│   └── utils.ts            # cn() utility
└── middleware.ts           # Route protection + i18n
```

## Getting Started

### Prerequisites

- Node.js 20 LTS
- npm

### Installation

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run test` | Run tests |
| `npm run lint` | ESLint check |
| `npm run type-check` | TypeScript check |

## UI Components (Shadcn)

Add new components:

```bash
npx shadcn@latest add <component>
```

Installed: button, input, label, select, card, badge, alert, dropdown-menu, separator

## Authentication

- **Server Actions**: `src/lib/auth/actions.ts` (login, logout, refresh)
- **Middleware**: Route protection + locale handling
- **Client Context**: `useAuth()` hook

Protected routes: `/(app)/*` require authentication.

## Internationalization

Locales: `en` (English), `fr` (French), `vi` (Vietnamese)

```typescript
import { useTranslations } from "next-intl";
const t = useTranslations("navigation");
t("dashboard"); // "Overview" | "Aperçu" | "Tổng quan"
```

## Theme

3 modes: Light, Dark, System (follows OS preference)

```typescript
import { useTheme } from "@/context/ThemeContext";
const { theme, resolvedTheme, setTheme } = useTheme();
```

## License

Proprietary - All rights reserved
