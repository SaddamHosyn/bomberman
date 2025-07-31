/**
 * @fileoverview Waiting Room Component for Bomberman DOM
 * @author Chan
 */

import { createElement } from '../mini-framework/VirtualDom.js';

/**
 * Render the waiting room screen
 */
export function WaitingRoom(props) {
    const { onSendMessage, ...state } = props;
    
    return createElement('div', { className: 'waiting-room fade-in' },
        // Room header
        createElement('div', { className: 'room-header' },
            createElement('h1', { className: 'room-title' }, 'Waiting Room'),
            createElement('div', { className: 'player-counter' }, 
                `Players: ${state.players.length}/${state.maxPlayers}`
            ),
            renderTimerDisplay(state)
        ),
        
        // Room content (players + chat)
        createElement('div', { className: 'room-content' },
            // Players section
            createElement('div', { className: 'players-section' },
                createElement('h3', { className: 'players-title' }, 'Players'),
                renderPlayersList(state.players, state.playerId),
                renderGameStatus(state)
            ),
            
            // Chat section
            createElement('div', { className: 'chat-section' },
                createElement('h3', { className: 'chat-title' }, 'Group Chat'),
                renderChatMessages(state.messages),
                renderChatInput(state, onSendMessage)
            )
        ),
        
      
    );
}

/**
 * Render timer display
 */
/**
 * Render timer display - UPDATED: Match backend timer logic
 */
/**
 * Render timer display - ENHANCED with debugging
 */


function renderTimerDisplay(state) {
/**
 * Render timer display - ENHANCED debugging
 */
function renderTimerDisplay(state) {
    console.log('🎯 RENDER TIMER CALLED WITH:');
    console.log('  waitingTimer:', state.waitingTimer);
    console.log('  gameTimer:', state.gameTimer); 
    console.log('  players.length:', state.players.length);
    console.log('  players:', state.players);
    
    if (state.gameTimer !== null && state.gameTimer > 0) {
        console.log('✅ SHOWING GAME TIMER:', state.gameTimer);
        return createElement('div', { 
            className: 'timer',
            style: { 
                fontSize: '24px', 
                fontWeight: 'bold', 
                color: '#ffffff',
                textAlign: 'center',
                padding: '15px',
                background: 'linear-gradient(45deg, #e74c3c, #c0392b)',
                border: '3px solid #e74c3c',
                borderRadius: '10px',
                margin: '15px 0',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
            }
        },
            `🎮 GAME STARTING IN ${state.gameTimer} SECONDS!`
        );
    } else if (state.waitingTimer !== null && state.waitingTimer > 0) {
        console.log('✅ SHOWING WAITING TIMER:', state.waitingTimer);
        return createElement('div', { 
            className: 'timer',
            style: { 
                fontSize: '20px', 
                fontWeight: 'bold', 
                color: '#ffffff',
                textAlign: 'center',
                padding: '12px',
                background: 'linear-gradient(45deg, #f39c12, #e67e22)',
                border: '3px solid #f39c12',
                borderRadius: '8px',
                margin: '10px 0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }
        },
            `⏳ WAITING FOR MORE PLAYERS... ${state.waitingTimer}s REMAINING`
        );
    } else if (state.players.length < state.minPlayers) {
        console.log('✅ SHOWING: Need more players');
        return createElement('div', { className: 'timer' },
            `Waiting for ${state.minPlayers - state.players.length} more player(s)...`
        );
    } else if (state.players.length >= state.minPlayers && state.players.length < state.maxPlayers) {
        console.log('✅ SHOWING: Waiting for timer to start');
        return createElement('div', { className: 'timer' },
            'Waiting for timer to start...'
        );
    } else {
        console.log('✅ SHOWING: Ready to start');
        return createElement('div', { className: 'timer' },
            'Ready to start!'
        );
    }
}







    // ENHANCED DEBUG: Log everything about timer state
    console.log('🔍 TIMER DISPLAY DEBUG:', {
        gameTimer: state.gameTimer,
        waitingTimer: state.waitingTimer,
        playersLength: state.players.length,
        minPlayers: state.minPlayers,
        maxPlayers: state.maxPlayers,
        currentScreen: state.currentScreen
    });
    
    // Game start countdown (red, urgent)
    if (state.gameTimer !== null && state.gameTimer > 0) {
        console.log('✅ SHOWING GAME TIMER:', state.gameTimer);
        return createElement('div', { 
            className: 'timer',
            style: { 
                fontSize: '24px', 
                fontWeight: 'bold', 
                color: '#ffffff',
                textAlign: 'center',
                padding: '15px',
                background: 'linear-gradient(45deg, #e74c3c, #c0392b)',
                border: '3px solid #e74c3c',
                borderRadius: '10px',
                margin: '15px 0',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                animation: 'pulse 1s infinite'
            }
        },
            `🎮 GAME STARTING IN ${state.gameTimer} SECONDS!`
        );
    }






 // Wait timer countdown (orange, waiting)
    else if (state.waitingTimer !== null && state.waitingTimer > 0) {
        console.log('✅ SHOWING WAITING TIMER:', state.waitingTimer);
        return createElement('div', { 
            className: 'timer',
            style: { 
                fontSize: '20px', 
                fontWeight: 'bold', 
                color: '#ffffff',
                textAlign: 'center',
                padding: '12px',
                background: 'linear-gradient(45deg, #f39c12, #e67e22)',
                border: '3px solid #f39c12',
                borderRadius: '8px',
                margin: '10px 0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }
        },
            `⏳ WAITING FOR MORE PLAYERS... ${state.waitingTimer}s REMAINING`
        );
    } 
    // Not enough players
    else if (state.players.length < state.minPlayers) {
        console.log('✅ SHOWING: Need more players');
        return createElement('div', { 
            className: 'timer',
            style: { fontSize: '16px', color: '#7f8c8d', textAlign: 'center', padding: '8px' }
        },
            `Waiting for ${state.minPlayers - state.players.length} more player(s)...`
        );
    }
    
    
    
    
    
      // Enough players, waiting for timer
    else if (state.players.length >= state.minPlayers && state.players.length < state.maxPlayers) {
        console.log('✅ SHOWING: Waiting for timer to start');
        return createElement('div', { 
            className: 'timer',
            style: { fontSize: '16px', color: '#27ae60', textAlign: 'center', padding: '8px' }
        },
            'Waiting for timer to start...'
        );
    }
    
    
    
    
    
    
     // Ready to start
    else {
        console.log('✅ SHOWING: Ready to start');
        return createElement('div', { 
            className: 'timer',
            style: { fontSize: '16px', color: '#27ae60', textAlign: 'center', padding: '8px' }
        },
            'Ready to start!'
        );
    }
}


/**
 * Render the list of players
 */
function renderPlayersList(players, currentPlayerId) {
    if (!players || players.length === 0) {
        return createElement('p', { 
            style: { 
                textAlign: 'center', 
                opacity: '0.7' 
            } 
        }, 'No players yet...');
    }
    
    return createElement('ul', { className: 'players-list' },
        players.map((player, index) => 
            createElement('li', { 
                className: 'player-item',
                key: player.id || index
            },
                createElement('div', { className: 'player-avatar' }, 
                    player.nickname.charAt(0).toUpperCase()
                ),
                createElement('span', { className: 'player-name' }, 
                    player.nickname
                ),
                createElement('span', { className: 'player-status' },
                    player.id === currentPlayerId ? ' (You)' : ' Ready'
                )
            )
        )
    );
}

/**
 * Render game status messages
 */
function renderGameStatus(state) {
    const playerCount = state.players.length;
    
    if (playerCount >= state.maxPlayers) {
        return createElement('div', { className: 'status-message status-success' },
            'Room is full! Game will start soon.'
        );
    } else if (playerCount >= state.minPlayers) {
        return createElement('div', { className: 'status-message status-info' },
            'Enough players to start! Waiting for more or timer...'
        );
    } else {
        return createElement('div', { className: 'status-message status-warning' },
            `Need ${state.minPlayers - playerCount} more player(s) to start.`
        );
    }
}

/**
 * Render chat messages
 */
function renderChatMessages(messages) {
    const messagesContainer = createElement('div', { className: 'chat-messages' },
        messages.length === 0 ? 
            createElement('p', { 
                style: { 
                    textAlign: 'center', 
                    opacity: '0.7' 
                } 
            }, 'No messages yet. Say hello!') :
            messages.map((message, index) => 
                createElement('div', { 
                    className: 'chat-message',
                    key: message.id || index
                },
                    createElement('div', { className: 'message-author' }, 
                        message.author
                    ),
                    createElement('div', { className: 'message-text' }, 
                        message.text
                    ),
                    createElement('div', { className: 'message-time' }, 
                        formatTime(message.timestamp)
                    )
                )
            )
    );
    
    // Auto-scroll to bottom (we'll handle this with a side effect)
    setTimeout(() => {
        const messagesEl = document.querySelector('.chat-messages');
        if (messagesEl) {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
    }, 0);
    
    return messagesContainer;
}

/**
 * Render chat input
 */
function renderChatInput(state, onSendMessage) {
    const handleSubmit = (e) => {
        e.preventDefault();
        const form = e.target;
        const input = form.querySelector('.chat-input');
        const message = input.value.trim();
        
        if (message) {
            onSendMessage(message);
            input.value = ''; // Clear input after sending
        }
    };
    
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const form = e.target.closest('form');
            if (form) {
                form.dispatchEvent(new Event('submit'));
            }
        }
    };
    
    return createElement('div', {},
        // Chat error message
        state.chatError && createElement('div', { 
            className: 'status-message status-warning',
            style: { marginBottom: '10px', fontSize: '0.9rem' }
        }, state.chatError),
        
        // Chat input form
        createElement('form', { 
            className: 'chat-input-container',
            onsubmit: handleSubmit
        },
            createElement('input', {
                type: 'text',
                className: 'chat-input',
                placeholder: 'Type a message...',
                maxLength: 200,
                onkeypress: handleKeyPress
            }),
            createElement('button', {
                type: 'submit',
                className: 'send-button'
            }, 'Send')
        )
    );
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    
    // If it's today, just show time
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } else {
        // If it's another day, show date and time
        return date.toLocaleString([], { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}
