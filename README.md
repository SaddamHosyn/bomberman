# Bomberman DOM - UI Demo

A UI demonstration for a multiplayer Bomberman game built with DOM manipulation using a custom mini-framework. This demo shows the nickname input and waiting room interface.

## Features

- **Nickname Input**: Players enter their nickname to join the game
- **Waiting Room**: Demo UI showing players waiting for others to join (2-4 players)
- **Group Chat**: Functional chat interface with demo responses
- **Smart Timers**: 
  - 20-second wait for more players when 2+ players are present
  - 10-second countdown when room is full or wait time expires
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Custom mini-framework with Virtual DOM (ONLY)
- **No Backend**: Pure UI demo with simulated player interactions  
- **Styling**: Pure CSS with modern design

**NO EXTERNAL FRAMEWORKS OR LIBRARIES USED** - Only the custom mini-framework and pure JavaScript!

## Project Structure

```
bomberman-dom/
├── mini-framework/          # Custom framework
│   ├── App.js              # Main app class
│   ├── VirtualDom.js       # Virtual DOM implementation
│   ├── StateManager.js     # State management
│   ├── Routing.js          # Client-side routing
│   └── TodoDomUpdater.js   # DOM update utilities
├── components/             # UI Components
│   ├── NicknameScreen.js   # Nickname input screen
│   └── WaitingRoom.js      # Waiting room with chat
├── main.js                 # Frontend entry point
├── gameState.js           # Game state management (demo mode)
├── styles.css             # Application styles
├── dev-server.js          # Development HTTP server
└── index.html             # Main HTML file
```

## Installation & Setup

1. **Clone or navigate to the project directory**
   ```bash
   cd bomberman-dom
   ```

2. **No installation needed!** - Pure JavaScript with no external dependencies

3. **Start the development server**
   ```bash
   node dev-server.js
   ```

4. **Open the demo**
   - Navigate to `http://localhost:3000` in your browser
   - Enter a nickname and explore the waiting room UI
   - Chat messages will receive simulated responses

## Demo Flow

1. **Nickname Screen**: Enter a unique nickname (2-20 characters)
2. **Waiting Room**: 
   - See simulated players joining over time
   - Test the chat functionality with demo responses
   - Watch the timer logic in action as more "players" join

## Mini-Framework Usage

This demo showcases the custom mini-framework with:

- **Virtual DOM**: Efficient DOM updates with `createElement()` and `updateDom()`
- **State Management**: Centralized state with automatic UI updates
- **Component System**: Reusable UI components
- **Event Handling**: Declarative event binding
- **Routing**: Hash-based client-side routing

### Example Component:

```javascript
import { createElement } from './mini-framework/VirtualDom.js';

export function MyComponent(state, onAction) {
    return createElement('div', { className: 'my-component' },
        createElement('h1', {}, 'Hello World'),
        createElement('button', {
            onclick: () => onAction('clicked')
        }, 'Click Me')
    );
}
```

## UI Demo Features

- Simulated multiplayer experience
- Working chat with bot responses  
- Timer logic demonstration
- Responsive design showcase
- State management example

**This is a UI-only demonstration.** The actual game logic (board, movement, bombs) would be built on top of this foundation.
