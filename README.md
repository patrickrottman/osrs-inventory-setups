# Inventory Setups

A modern web app for OSRS players to share their gear setups. Copy loadouts directly from RuneLite's Inventory Setups plugin and share them with the community. Perfect for sharing boss strategies, raid setups, skilling outfits, and more.

## Overview

This project aims to make sharing OSRS gear setups as seamless as possible. Instead of taking screenshots or manually recreating setups, players can directly copy their setup from RuneLite and share it with the community. Other players can then import these setups back into RuneLite with a single click.

### Key Features
- **Direct RuneLite Integration**
  - Copy setups directly from RuneLite's Inventory Setups plugin
  - Import shared setups back into RuneLite
  - Preserves all item filters and additional inventory items

- **Rich Filtering & Search**
  - Filter by categories and tags
  - Search by setup name or description
  - Sort by date, likes, or views
  - Personal loadouts view

- **User Features**
  - Google authentication
  - Like and save favorite setups
  - Public/private loadout options
  - Dark/light theme support

- **Modern UI/UX**
  - Clean, responsive Material design
  - Real-time stats and updates
  - Mobile-friendly interface
  - Intuitive drag-and-drop interface

## Tech Stack

### Frontend
- Angular 16
- Angular Material UI
- Firebase SDK v9
- RxJS for state management
- SCSS with modern CSS features

### Backend & Services
- Firebase
  - Authentication with Google
  - Firestore for data storage
  - Security rules for data protection
  - Analytics integration
  - Real-time updates
- reCAPTCHA v3 for spam prevention

## Development

### Prerequisites
- Node.js 16+
- npm 8+
- Angular CLI (`npm install -g @angular/cli`)
- Firebase CLI (`npm install -g firebase-tools`)

### Getting Started
```bash
# Clone the repo
git clone https://github.com/yourusername/inventory-setups.git
cd inventory-setups

# Install dependencies
npm install

# Start development server
npm start
```

The dev server will run at `http://localhost:4200` by default.

### Environment Setup
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Google Authentication
3. Create a Firestore database
4. Set up reCAPTCHA v3
5. Configure environment files:
   ```typescript
   // src/environments/environment.ts
   export const environment = {
     production: false,
     firebase: {
       // Your Firebase config
     },
     recaptcha: {
       siteKey: 'your-recaptcha-site-key'
     }
   };
   ```

### Project Structure
```
src/
├── app/
│   ├── core/           # Services, guards, interceptors
│   ├── features/       # Feature modules (loadouts, inventory)
│   ├── shared/         # Shared components, models, pipes
│   └── app.module.ts
├── assets/            # Images, icons, etc.
├── environments/      # Environment configs
└── styles/           # Global styles, themes
```

## Deployment
```bash
# Build production bundle
npm run build

# Deploy to Firebase
firebase deploy
```

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Guidelines
- Follow the Angular style guide
- Write clear commit messages
- Add tests for new features
- Update documentation as needed

## License
This project is MIT licensed.

## Acknowledgments
- [Inventory Setups Plugin](https://github.com/dillydill123/inventory-setups) - For the amazing Inventory Setups plugin
- [RuneLite](https://runelite.net/) - For the launcher itself <3
- [OSRS Wiki](https://oldschool.runescape.wiki/) - Item data and images
- The OSRS community for feedback and suggestions
