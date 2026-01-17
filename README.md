# Construction Frontend

Next.js application with TypeScript and Tailwind CSS for the Construction Management System.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Linting**: ESLint

## Project Structure

```
src/
├── app/
│   ├── (app)/              # App routes with shell layout
│   │   ├── layout.tsx      # Shell layout (Sidebar + Topbar)
│   │   ├── dashboard/      # Dashboard page
│   │   ├── projects/       # Projects page
│   │   └── settings/       # Settings page
│   ├── globals.css         # Global styles
│   └── layout.tsx          # Root layout
├── components/
│   └── layout/
│       ├── Sidebar.tsx     # Navigation sidebar
│       └── Topbar.tsx      # Top navigation bar
└── lib/
    ├── api/
    │   └── http.ts         # Typed fetch wrapper
    └── config/
        └── env.ts          # Environment configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm

### Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env.local
```

3. Edit `.env.local` with your configuration:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
```

### Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

Create a production build:

```bash
npm run build
```

### Production

Start the production server:

```bash
npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Backend API base URL |

## API Client

The project includes a typed fetch wrapper (`src/lib/api/http.ts`) for making API requests:

```typescript
import { api } from "@/lib/api/http";

// GET request
const data = await api.get<ProjectList>("/projects");

// POST request
const result = await api.post<Project, CreateProjectDto>("/projects", { name: "New Project" });
```

## License

Proprietary - All rights reserved
