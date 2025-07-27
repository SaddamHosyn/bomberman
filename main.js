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
    console.log('renderApp called with currentScreen:', state.currentScreen); // Debug log
    
    switch (state.currentScreen) {
        case 'nickname':
            console.log('Rendering nickname screen'); // Debug log
            return NicknameScreen(state, handleJoinGame);
        case 'waiting':
            console.log('Rendering waiting room'); // Debug log
            return WaitingRoom({
                ...state,
                onSendMessage: handleSendMessage,
                onLeaveRoom: handleLeaveRoom
            });
        default:
            console.log('Rendering default (nickname) screen'); // Debug log
            return NicknameScreen(state, handleJoinGame);
    }
}

/**
 * Handle joining the game with a nickname (demo simulation)
 */
function handleJoinGame(nickname) {
    console.log('handleJoinGame called with:', nickname); // Debug log
    
    if (!nickname || nickname.trim().length < 2) {
        console.log('Nickname too short'); // Debug log
        app.setState({
            error: 'Nickname must be at least 2 characters long'
        });
        return;
    }
    
    if (nickname.trim().length > 20) {
        console.log('Nickname too long'); // Debug log
        app.setState({
            error: 'Nickname must be less than 20 characters'
        });
        return;
    }
    
    console.log('Setting joining state'); // Debug log
    // Clear any previous errors and show joining state
    app.setState({
        error: null,
        isJoining: true
    });
    
    // Simulate network delay then join
    setTimeout(() => {
        console.log('Calling simulateJoinGame'); // Debug log
        gameState.simulateJoinGame(nickname.trim());
        console.log('simulateJoinGame completed'); // Debug log
    }, 1000);
}

/**
 * Handle sending a chat message (demo simulation)
 */
function handleSendMessage(message) {
    if (!message || message.trim().length === 0) {
        return;
    }
    
    if (message.trim().length > 200) {
        app.setState({
            chatError: 'Message is too long (max 200 characters)'
        });
        return;
    }
    
    gameState.simulateSendMessage(message.trim());
}

/**
 * Handle leaving the waiting room
 */
function handleLeaveRoom() {
    gameState.resetToNickname();
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
