# Edendale Sports Projects NPC - Frontend

A modern React TypeScript frontend application for the Edendale Sports Projects NPC sports field booking system.

## 🏟️ Features

- **Modern UI**: Built with React 18 and TypeScript for type safety
- **Responsive Design**: Fully responsive design using Tailwind CSS
- **Authentication**: Secure JWT-based authentication system
- **Booking Management**: Create, modify, cancel bookings with hourly costing (R400/h)
- **Field Management**: Admin can create/edit/activate/deactivate fields
- **Slot Blocking**: Maintenance/event slot blocking per field/date/hour
- **Admin Dashboard**: KPIs, recent bookings, revenue timeline
- **Real-time Updates**: Live booking status updates
- **Mobile Friendly**: Optimized for mobile and tablet devices

## 🚀 Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Query for server state
- **Routing**: React Router DOM
- **Forms**: React Hook Form
- **Icons**: Lucide React
- **Notifications**: React Hot Toast
- **Date Handling**: date-fns

## 📁 Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── auth/            # Authentication components
│   ├── layout/          # Layout components (Header, Footer, etc.)
│   └── ui/              # Basic UI components (Button, Input, etc.)
├── contexts/            # React contexts (Auth, etc.)
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries and configurations
├── pages/              # Page components
│   ├── auth/           # Authentication pages
│   ├── bookings/       # Booking related pages
│   ├── dashboard/      # Dashboard pages
│   └── admin/          # Admin pages
├── services/           # API service functions
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## 🛠️ Setup and Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd edendalesportsprojectnpc
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   VITE_API_BASE_URL=https://ndosiautomation.co.za/EDENDALESPORTSPROJECTNPC
   ```

4. **Start development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🏗️ Build and Deployment

### Development Build
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

## 🌐 API Integration

The frontend integrates with the Edendale Sports Projects NPC backend API:

- **Base URL**: `https://ndosiautomation.co.za/EDENDALESPORTSPROJECTNPC`
- **Documentation**: Available at `/swagger-ui.html`
- **Authentication**: JWT Bearer tokens
- **API Proxy**: Configured in Vite for development

### Key API Endpoints

- `POST /auth/login` - User authentication
- `POST /auth/register` - User registration  
- `GET /fields` - Get available fields
- `POST /bookings` - Create new booking (auto cost R400/h unless field rate differs)
- `PUT /bookings/{id}` - Update booking (reschedule)
- `DELETE /bookings/{id}` - Cancel booking
- `POST /admin/block-slot` / `POST /admin/unblock-slot` - Maintenance/event management
- `GET /reports/revenue` - Revenue breakdown & payment methods
- `GET /reports/analytics` - Booking analytics (peak hours, trends)

## 🎨 UI Components

### Core Components

- **Button**: Flexible button component with variants
- **LoadingSpinner**: Loading indicators
- **Layout**: Main application layout with header/footer
- **ProtectedRoute**: Route protection based on authentication

### Page Components

- **HomePage**: Landing page with features showcase
- **LoginPage**: User authentication
- **DashboardPage**: User dashboard with booking overview
- **BookingsPage**: Booking management interface
- **AdminDashboard**: Administrative functions

## 🔐 Authentication Flow

1. **Login**: User enters credentials → JWT tokens stored
2. **Token Refresh**: Automatic token refresh on expiry
3. **Route Protection**: Protected routes check authentication
4. **Logout**: Tokens cleared from storage

## 📱 Responsive Design

The application is fully responsive with:
- Mobile-first design approach
- Tailwind CSS responsive utilities
- Touch-friendly interfaces
- Optimized layouts for all screen sizes

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm run build
# Upload dist/ folder to Netlify
```

### Traditional Hosting
```bash
npm run build
# Upload dist/ folder to your web server
```

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `/api` |

## 📖 Development Guide

### Adding New Pages
1. Create component in appropriate `pages/` subdirectory
2. Add route in `App.tsx`
3. Update navigation in `Header.tsx`

### API Integration
1. Add types to `types/index.ts`
2. Create service functions in `services/`
3. Use React Query hooks in components

### Styling Guidelines
- Use Tailwind CSS utility classes
- Follow component-based styling
- Maintain consistent spacing and colors
- Use responsive design patterns

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, please contact:
- Email: support@edendalesports.co.za
- Phone: +27 (0)31 123 4567

## 📋 Roadmap

- [x] Enhanced booking calendar interface
- [x] Payment integration (PayFast)
- [ ] Real-time notifications
- [ ] Mobile app version
- [ ] Advanced reporting dashboard
- [ ] Multi-language support

---
*Last updated: November 2025 - PayFast payment integration configured*