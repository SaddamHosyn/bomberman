/**
 * @fileoverview Bomberman DOM - UI Demo (Nickname + Waiting Room)
 * @author Chan
 */

import { createApp } from './mini-framework/App.js';
import { createElement } from './mini-framework/VirtualDom.js';
import { GameState } from './gameState.js';
import { NicknameScreen } from './components/NicknameScreen.js';
import { WaitingRoom } from './components/WaitingRoom.js';

// Initialize game state (demo mode)
const gameState = new GameState();

// Create the main app
const app = createApp('#app');

/**
 * Main render function - decides which screen to show
 */
function renderApp() {
    const state = app.getState();
    console.log('renderApp called with currentScreen:', state.currentScreen);

    switch (state.currentScreen) {
        case 'nickname':
            return NicknameScreen(state, handleJoinGame);
        
        case 'waiting':
            return WaitingRoom({
                ...state,
                onSendMessage: handleSendMessage,
                onLeaveRoom: handleLeaveRoom
            });
        
        case 'game':
            // TODO: Implement game screen
            return createElement('div', {
                style: {
                    textAlign: 'center',
                    padding: '50px'
                }
            },
                createElement('h1', {}, 'Game Starting...'),
                createElement('p', {}, 'Game implementation coming soon!'),
                createElement('button', {
                    onclick: handleLeaveRoom,
                    style: {
                        marginTop: '20px',
                        padding: '10px 20px'
                    }
                }, 'Back to Lobby')
            );
        
        default:
            return NicknameScreen(state, handleJoinGame);
    }
}
/**
 * Handle joining the game with a nickname (demo simulation)
 */
function handleJoinGame(nickname) {
    console.log('handleJoinGame called with:', nickname);
    
    if (!nickname || nickname.trim().length < 2) {
        app.setState({
            error: 'Nickname must be at least 2 characters long'
        });
        return;
    }

    if (nickname.trim().length > 20) {
        app.setState({
            error: 'Nickname must be less than 20 characters'
        });
        return;
    }

    // Clear any previous errors
    app.setState({
        error: null
    });

    // Connect to real WebSocket server - CHANGED: No more simulation
    gameState.connectAndJoinGame(nickname.trim());
}

/**
 * Handle sending a chat message (demo simulation)
 */
function handleSendMessage(message) {

    gameState.sendChatMessage(message);
  
}

/**
 * Handle leaving the waiting room
 */
function handleLeaveRoom() {
    gameState.leaveGame();
}

// Set up app state listeners
gameState.subscribe((newState) => {
    app.setState(newState);
});

// Initialize the app
app.setRenderFunction(renderApp)
    .addRoute('/', () => {
        app.setState({ currentScreen: 'nickname' });
    })
    .addRoute('/waiting', () => {
        // This route will be handled by the game state
    })
    .init();





// Initial app state
app.setState({
    currentScreen: 'nickname',
    nickname: '',
    players: [],
    messages: [],
    waitingTimer: null,
    gameTimer: null,
    error: null,
    chatError: null,
    isJoining: false,
    isConnected: false
});

// Export for debugging
window.gameApp = {
    app,
    gameState
};
