# Inventory Setups

A modern web app for OSRS players to share their gear setups. Copy loadouts directly from RuneLite's Inventory Setups plugin and share them with the community. Perfect for sharing boss strategies, raid setups, skilling outfits, and more.

![Dark Theme Preview](docs/dark-theme.png)

## Overview

This project aims to make sharing OSRS gear setups as seamless as possible. Instead of taking screenshots or manually recreating setups, players can directly copy their setup from RuneLite and share it with the community. Other players can then import these setups back into RuneLite with a single click.

### Key Features
- **Direct RuneLite Integration**
  - Copy setups directly from RuneLite's Inventory Setups plugin
  - Import shared setups back into RuneLite
  - Preserves all item filters and additional inventory items

- **Rich Filtering & Search**
  - Filter by boss/skill categories
  - Search by setup name or description
  - Tag-based filtering (Bossing, Slayer, Raids, etc.)
  - Sort by likes or date

- **User Features**
  - Google authentication
  - Like and save favorite setups
  - View your created loadouts
  - Dark/light theme support

- **Modern UI/UX**
  - Clean, responsive Material design
  - Familiar OSRS-style inventory layout
  - Additional item filters section for potions, runes, etc.
  - Mobile-first approach

## Tech Stack

### Frontend
- Angular 16
- Angular Material UI
- SCSS with modern CSS features
- Responsive design with Flexbox/Grid

### Backend & Services
- Firebase
  - Authentication with Google
  - Firestore for data storage
  - Security rules for data protection
  - Hosting
- reCAPTCHA v3 for spam prevention

## Development

### Prerequisites
- Node.js 16+
- npm 8+
- Angular CLI (`npm install -g @angular/cli`)

### Getting Started
```bash
# Clone the repo
git clone https://github.com/yourusername/inventory-setups.git
cd inventory-setups

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

The dev server will run at `http://localhost:4200` by default.

### Environment Setup
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Google Authentication
   - Add authorized domains
   - Configure OAuth consent screen
3. Create a Firestore database
   - Start in production mode
   - Choose a nearby location
4. Set up reCAPTCHA v3
   - Get your site key from Google reCAPTCHA admin
5. Configure environment files:
   ```bash
   cp src/environments/environment.template.ts src/environments/environment.ts
   ```
6. Add your Firebase and reCAPTCHA config to `environment.ts`
7. Deploy Firestore security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Project Structure
```
src/
├── app/
│   ├── core/           # Singleton services, header/footer
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

# Deploy to Firebase Hosting
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
This project is MIT licensed - see the [LICENSE](LICENSE) file for details.

## Acknowledgments
- [RuneLite](https://runelite.net/) - For the amazing Inventory Setups plugin
- [OSRS Wiki](https://oldschool.runescape.wiki/) - Item data and images
- The OSRS community for feedback and suggestions
