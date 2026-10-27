# Freshness Evaluator

A modern, interactive food freshness assessment application with multi-user evaluation capabilities, analytics dashboard, and real-time data visualization.

## Features

- **Interactive Dating-App Interface**: Swipe-based image evaluation system
- **Multi-User Support**: Multiple evaluators can assess the same dataset
- **Admin Dashboard**: Complete CRUD operations for folders and dataset items
- **Analytics Dashboard**: Real-time charts and statistics (classification distribution, evaluator performance, activity patterns)
- **Pagination**: Organized display of dataset images with pagination controls
- **Supabase Integration**: Cloud database sync for collaborative work
- **Duplicate Prevention**: Automatic detection and cleanup of duplicate folders
- **Export Options**: CSV and ZIP export for evaluator datasets
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts
- **Icons**: Lucide React
- **Database**: Supabase (optional)
- **Build Tool**: Vite
- **Animations**: Motion (Framer Motion)

## Prerequisites

- Node.js 18+ 
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/badboygamingph/freshness.git
   cd freshness
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional, for Supabase):
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

## Running Locally

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to:
   - Main app: `http://localhost:3000`
   - Admin portal: `http://localhost:3000/administrator`

## Building for Production

```bash
npm run build
```

The optimized production files will be in the `dist/` directory.

## Preview Production Build

```bash
npm run preview
```

## Deployment

### Vercel

This project is configured for Vercel deployment:

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Vercel will automatically detect the configuration and deploy

The `vercel.json` file includes:
- Build command: `npm run build`
- Output directory: `dist`
- Rewrites for SPA routing
- Security headers
- Asset caching strategy

### Other Platforms

The project can also be deployed to:
- Netlify
- GitHub Pages
- Any static hosting service

## Project Structure

```
freshness/
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── AdminAnalytics.tsx      # Analytics dashboard
│   │   ├── AdminDashboard.tsx      # Main admin interface
│   │   ├── AdminPortal.tsx         # Admin authentication
│   │   ├── DatingCardDeck.tsx      # Swipe interface
│   │   ├── Navbar.tsx              # Navigation
│   │   ├── OnboardingModal.tsx     # User onboarding
│   │   ├── HelpModal.tsx           # Help documentation
│   │   └── UserHistory.tsx         # User assessment history
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # Application entry point
│   └── index.css        # Global styles
├── .env.example         # Environment variables template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── vercel.json          # Vercel deployment configuration
```

## Admin Portal

Default admin credentials (can be changed in `src/utils/assessmentStorage.ts`):
- Username: `admin`
- Password: `admin123`

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
