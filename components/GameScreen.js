/**
 * @fileoverview Game Screen Component for Bomberman DOM
 * @author Chan
 * 
 * Renders the main game board where players can move, place bombs, and interact
 * Based on classic Bomberman game mechanics with real-time multiplayer
 */

import { createElement } from '../mini-framework/VirtualDom.js';

/**
 * Main game component that renders the game board and UI
 */
export function GameScreen({ state, onMove, onPlaceBomb, onBackToMenu }) {
    // Add demo game state if none provided
    const gameState = ensureGameState(state);
    
    return createElement('div', { 
        className: 'game-screen',
        key: 'game-screen-v2' // Force complete refresh
    },
        // Game header with just title and status (NO PLAYER STATS)
        renderGameHeader(gameState),
        
        // Main game area
        createElement('div', { className: 'game-area' },
            // Game board
            renderGameBoard(gameState, onMove, onPlaceBomb),
            
            // Game sidebar with stats and mini-map (PLAYER STATS HERE)
            renderGameSidebar(gameState)
        ),
        
        // Game controls help
        renderGameControls(),
        
        // Win popup modal (overlay style)
        gameState.gameStatus === 'finished' ? renderWinModal(gameState, onBackToMenu) : null,
        
        // Win notification banner (floating at top)
        gameState.gameStatus === 'finished' ? renderWinBanner(gameState, onBackToMenu) : null
    );
}

/**
 * Ensure we have a valid game state with all required properties
 */
function ensureGameState(state) {
    const defaultGameMap = {
        width: 15,
        height: 13,
        walls: generateDefaultWalls(),
        blocks: generateDefaultBlocks()
    };
    
    const defaultPlayer = {
        id: 1,
        name: state.nickname || 'Player',
        lives: 3,
        bombCount: 1,
        flameRange: 1,
        position: { x: 1, y: 1 },
        alive: true
    };
    
    // Ensure all players have valid positions
    const validPlayers = (state.players || []).map(player => ({
        ...player,
        position: player.position || { x: 1, y: 1 },
        alive: player.alive !== undefined ? player.alive : true,
        lives: player.lives || 3,
        bombCount: player.bombCount || 1,
        flameRange: player.flameRange || 1
    }));
    
    return {
        gameStatus: state.gameStatus || 'in_progress',
        gameMap: state.gameMap || defaultGameMap,
        players: validPlayers.length > 0 ? validPlayers : [defaultPlayer],
        bombs: state.bombs || [],
        flames: state.flames || [],
        powerUps: state.powerUps || [],
        currentPlayer: state.currentPlayer || defaultPlayer,
        winner: state.winner || null,
        gameTimer: state.gameTimer || null,
        countdown: state.countdown || null,
        timeLeft: state.timeLeft || null,
        timerPhase: state.timerPhase || null,
        nickname: state.nickname || 'Player'
    };
}

/**
 * Generate default walls for demo
 */
function generateDefaultWalls() {
    const walls = [];
    for (let y = 0; y < 13; y++) {
        for (let x = 0; x < 15; x++) {
            // Outer border walls
            if (y === 0 || y === 12 || x === 0 || x === 14) {
                walls.push({ position: { x, y } });
            }
            // Inner grid walls (classic Bomberman pattern)
            else if (x % 2 === 0 && y % 2 === 0) {
                walls.push({ position: { x, y } });
            }
        }
    }
    return walls;
}

/**
 * Generate default blocks for demo
 */
function generateDefaultBlocks() {
    const blocks = [];
    const positions = [
        { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 2 },
        { x: 5, y: 3 }, { x: 7, y: 5 }, { x: 9, y: 7 },
        { x: 11, y: 9 }, { x: 13, y: 11 }
    ];
    
    positions.forEach(pos => {
        blocks.push({ 
            position: pos, 
            destroyed: false,
            hiddenPowerUp: null
        });
    });
    
    return blocks;
}

/**
 * Render win modal popup
 */
function renderWinModal(state, onBackToMenu) {
    const winner = state.winner;
    const winnerName = winner ? (winner.name || winner.nickname || 'Unknown Player') : 'Draw';
    
    return createElement('div', { className: 'win-modal-overlay' },
        createElement('div', { className: 'win-modal' },
            createElement('div', { className: 'win-modal-content' },
                createElement('h1', { className: 'win-title' }, '🎉 GAME OVER! 🎉'),
                createElement('div', { className: 'win-message' },
                    winner ? `${winnerName} Wins!` : 'It\'s a Draw!'
                ),
                createElement('button', {
                    className: 'back-to-menu-btn',
                    onclick: onBackToMenu
                }, '🔄 Play Again')
            )
        )
    );
}

/**
 * Render win banner - floating notification at top of screen
 */
function renderWinBanner(state, onBackToMenu) {
    const winner = state.winner;
    const winnerName = winner ? (winner.name || winner.nickname || 'Unknown Player') : 'Nobody';
    
    
        createElement('div', { 
            style: { marginBottom: '15px', fontSize: '1.4rem' }
        }, `🎉 ${winnerName} Wins! 🎉`),
        
        createElement('button', {
            style: {
                background: '#ff6b6b',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '1rem'
            },
            onclick: () => {
                // Restart the game by going back to menu and then rejoining
                onBackToMenu();
            }
        }, '🔄 Play Again');
    }

/**
 * Render game header with just title and status
 */
function renderGameHeader(state) {
    return createElement('div', { 
        className: 'game-header',
        key: 'header-no-players' // Force refresh without players
    },
        createElement('div', { className: 'game-title' },
            createElement('h2', {}, 'BOMBERMAN'),
            createElement('div', { className: 'game-status' }, 
                (state.gameStatus === 'countdown' || state.timerPhase === 'countdown') ? `Starting in ${state.countdown || state.timeLeft || '?'}...` : 
                (state.gameStatus === 'in_progress' || state.currentScreen === 'game') ? 'GAME IN PROGRESS' :
                (state.gameStatus === 'finished') ? `Game Over - Winner: ${state.winner?.name || 'Draw'}` : 'Waiting...'
            )
        )
    );
}


/**
 * Render the main game board
 */
function renderGameBoard(state, onMove, onPlaceBomb) {
    const { gameMap, players = [], bombs = [], flames = [], powerUps = [] } = state;
    
    if (!gameMap) {
        return createElement('div', { className: 'game-board loading' },
            createElement('div', { className: 'loading-message' }, '🎮 Loading game...')
        );
    }
    
    // Auto-focus the container to capture keyboard events
    setTimeout(() => {
        const container = document.querySelector('.game-board-container');
        if (container) {
            container.focus();
        }
    }, 50);
    
    return createElement('div', { 
        className: 'game-board-container',
        tabindex: '0',
        // Ultra-stable key that never changes
        key: 'game-container-stable',
        onkeydown: (e) => {
            handleKeyDown(e, onMove, onPlaceBomb);
        },
        onclick: () => {
            // Focus the container when clicked to ensure keyboard events work
            document.querySelector('.game-board-container').focus();
        }
    },
        createElement('div', { 
            className: 'game-board',
            // Ultra-stable board key that never changes
            key: 'game-board-stable',
            style: {
                gridTemplateColumns: `repeat(${gameMap.width || 15}, 1fr)`,
                gridTemplateRows: `repeat(${gameMap.height || 13}, 1fr)`
            }
        },
            // Render all board cells without stateVersion
            ...renderBoardCells(gameMap, players, bombs, flames, powerUps)
        )
    );
}

/**
 * Render all cells in the game board
 */
function renderBoardCells(gameMap, players, bombs, flames, powerUps) {
    const cells = [];
    
    for (let y = 0; y < gameMap.height; y++) {
        for (let x = 0; x < gameMap.width; x++) {
            cells.push(renderCell(x, y, gameMap, players, bombs, flames, powerUps));
        }
    }
    
    return cells;
}

/**
 * Render a single cell on the game board - OPTIMIZED for no ghosting
 */
function renderCell(x, y, gameMap, players, bombs, flames, powerUps) {
    // Find what's actually at this position first
    const playersHere = (players || []).filter(p => 
        p && p.position && 
        typeof p.position.x === 'number' && typeof p.position.y === 'number' &&
        p.position.x === x && p.position.y === y && p.alive
    );
    
    const bomb = (bombs || []).find(b => 
        b && b.position && 
        typeof b.position.x === 'number' && typeof b.position.y === 'number' &&
        b.position.x === x && b.position.y === y &&
        b.timer > 0  // Only include bombs that haven't exploded yet
    );
    const flame = (flames || []).find(f => 
        f && f.position && 
        typeof f.position.x === 'number' && typeof f.position.y === 'number' &&
        f.position.x === x && f.position.y === y
    );
    const powerUp = (powerUps || []).find(p => 
        p && p.position && 
        typeof p.position.x === 'number' && typeof p.position.y === 'number' &&
        p.position.x === x && p.position.y === y
    );
    
    // Ultra-simple, completely stable key
    const cellKey = `cell-${x}-${y}`;
    
    let cellClass = 'game-cell';
    
    // IMPORTANT: Only render ONE item per cell in priority order
    // Priority: Player > Bomb > Flame > Power-up > Block > Wall > Empty
    
    // Check for players FIRST (highest priority) - using playersHere from above
    if (playersHere && playersHere.length > 0) {
        const player = playersHere[0]; // Only render first player if multiple
        if (player && player.id) {
            const playerNumber = getPlayerNumber(player.id, players || []);
            
            return createElement('div', {
                key: cellKey,
                className: `${cellClass} has-player`,
                'data-x': x,
                'data-y': y
            }, createElement('div', { 
                className: `player player-${playerNumber}`,
                style: { color: getPlayerColor(playerNumber) }
            }, getPlayerEmoji(playerNumber)));
        }
    }
    
    // Check for bomb (second priority) - using bomb from above
    if (bomb) {
        return createElement('div', {
            key: cellKey,
            className: `${cellClass} has-bomb`,
            'data-x': x,
            'data-y': y
        }, createElement('div', { 
            className: `bomb ${bomb.timer <= 10 ? 'exploding' : ''}` // Show exploding animation in last 10 ticks (0.2 seconds)
        }, '💣'));
    }
    
    // Check for flame (third priority) - using flame from above
    if (flame) {
        return createElement('div', {
            key: cellKey,
            className: `${cellClass} has-flame`,
            'data-x': x,
            'data-y': y
        }, createElement('div', { className: 'flame' }, '🔥'));
    }
    
    // Check for power-up (fourth priority) - using powerUp from above
    if (powerUp) {
        return createElement('div', {
            key: cellKey,
            className: `${cellClass} has-powerup`,
            'data-x': x,
            'data-y': y
        }, createElement('div', { className: 'power-up' }, getPowerUpEmoji(powerUp.type)));
    }
    
    // Check for walls (fifth priority)
    const wall = gameMap.walls?.find(w => w && w.position && w.position.x === x && w.position.y === y);
    if (wall) {
        cellClass += ' wall';
        return createElement('div', {
            key: cellKey,
            className: cellClass,
            'data-x': x,
            'data-y': y
        }, createElement('div', { className: 'wall-block' }, '🧱'));
    }
    
    // Check for blocks (sixth priority)
    const block = gameMap.blocks?.find(b => 
        b && b.position && b.position.x === x && b.position.y === y && !b.destroyed
    );
    if (block) {
        cellClass += ' block';
        return createElement('div', {
            key: cellKey,
            className: cellClass,
            'data-x': x,
            'data-y': y
        }, createElement('div', { className: 'destructible-block' }, '📦'));
    }
    
    // Empty cell (lowest priority)
    return createElement('div', {
        key: cellKey,
        className: cellClass,
        'data-x': x,
        'data-y': y
    });
}

/**
 * Render game sidebar with ultra-minimal layers
 */
function renderGameSidebar(state) {
    // Create a compact player info string
    const playersInfo = state.players.map(player => {
        const isCurrentPlayer = player.id === state.currentPlayer?.id;
        const playerNumber = getPlayerNumber(player.id, state.players);
        const aliveStatus = player.alive ? '' : ' [DEAD]';
        const currentMark = isCurrentPlayer ? ' ★' : '';
        
        return `${getPlayerEmoji(playerNumber)} ${player.name || player.nickname || 'Unknown'}${currentMark}${aliveStatus} | ❤️${player.lives || 3}  | 💣${player.bombCount || 1} | 🔥${player.flameRange || 1}`;
    }).join('\n');

    return createElement('div', { 
        className: 'game-sidebar',
        key: 'sidebar-ultra-minimal'
    },
        // Players header and info as direct children
        createElement('h4', {}, '👥 Players'),
        createElement('div', { 
            className: 'players-compact',
            style: {
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '8px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                whiteSpace: 'pre-line',
                borderLeft: '3px solid #ffd93d'
            }
        }, playersInfo),
        
        // Mini-map
        createElement('h4', {}, '🗺️ Mini Map'),
        renderMiniMap(state),
        
        // Power-ups
        createElement('h4', {}, '⚡ Power-ups'),
        createElement('div', {}, '👟 Speed Up'),
        createElement('div', {}, '🔥 Flame Up'),
        createElement('div', {}, '💣 Bomb Up')
    );
}

/**
 * Render mini-map
 */
function renderMiniMap(state) {
    if (!state.gameMap) {
        return createElement('div', { className: 'mini-map loading' }, '⏳');
    }
    
    return createElement('div', { 
        className: 'mini-map',
        style: {
            gridTemplateColumns: `repeat(${state.gameMap.width}, 1fr)`,
            gridTemplateRows: `repeat(${state.gameMap.height}, 1fr)`
        }
    },
        ...renderMiniMapCells(state)
    );
}

/**
 * Render mini-map cells
 */
function renderMiniMapCells(state) {
    const cells = [];
    const { gameMap, players } = state;
    
    for (let y = 0; y < gameMap.height; y++) {
        for (let x = 0; x < gameMap.width; x++) {
            let cellClass = 'mini-cell';
            
            // Check for walls
            if (gameMap.walls?.find(w => w && w.position && w.position.x === x && w.position.y === y)) {
                cellClass += ' mini-wall';
            }
            
            // Check for blocks
            if (gameMap.blocks?.find(b => 
                b && b.position && b.position.x === x && b.position.y === y && !b.destroyed
            )) {
                cellClass += ' mini-block';
            }
            
            // Check for players
            const player = players?.find(p => 
                p && p.position && p.position.x === x && p.position.y === y && p.alive
            );
            if (player) {
                cellClass += ` mini-player mini-player-${player.id}`;
            }
            
            cells.push(
                createElement('div', {
                    key: `mini-${x}-${y}`,
                    className: cellClass
                })
            );
        }
    }
    
    return cells;
}

/**
 * Render game controls help
 */
function renderGameControls() {
    return createElement('div', { className: 'game-controls-help' },
        createElement('h4', {}, '🎮 Controls'),
        createElement('div', { className: 'controls-grid' },
            createElement('div', { className: 'control-item' }, 
                createElement('kbd', {}, 'W A S D'), 
                createElement('span', {}, 'Move')
            ),
            createElement('div', { className: 'control-item' }, 
                createElement('kbd', {}, 'Shift + WASD'), 
                createElement('span', {}, 'Precise Move (1 step)')
            ),
            createElement('div', { className: 'control-item' }, 
                createElement('kbd', {}, 'SPACE'), 
                createElement('span', {}, 'Place Bomb')
            ),
        )
    );
}

/**
 * Handle keyboard input for player movement and actions
 */
function handleKeyDown(event, onMove, onPlaceBomb) {
    // Prevent default browser behavior
    event.preventDefault();
    
    const key = event.key.toLowerCase();
    const preciseMove = event.shiftKey; // Shift key enables precise movement (1 step at a time)
    
    switch (key) {
        case 'w':
        case 'arrowup':
            onMove && onMove('up', preciseMove);
            break;
        case 's':
        case 'arrowdown':
            onMove && onMove('down', preciseMove);
            break;
        case 'a':
        case 'arrowleft':
            onMove && onMove('left', preciseMove);
            break;
        case 'd':
        case 'arrowright':
            onMove && onMove('right', preciseMove);
            break;
        case ' ':
        case 'space':
            onPlaceBomb && onPlaceBomb();
            break;
    }
}

/**
 * Get consistent player number (1-4) based on player ID
 */
function getPlayerNumber(playerId, allPlayers) {
    // Create a consistent mapping of player IDs to numbers 1-4
    const sortedPlayerIds = allPlayers.map(p => p.id).sort();
    const playerIndex = sortedPlayerIds.indexOf(playerId);
    return playerIndex >= 0 ? playerIndex + 1 : 1; // Default to 1 if not found
}

/**
 * Get player color based on player number
 */
function getPlayerColor(playerNumber) {
    const colors = [
        '#00ff00', // Green (Robot)
        '#ff4444', // Red (Astronaut)
        '#4444ff', // Blue (Ninja)
        '#ffaa00'  // Orange (Mask)
    ];
    return colors[(playerNumber - 1) % colors.length] || '#00ff00';
}

/**
 * Get player emoji based on player number
 */
function getPlayerEmoji(playerNumber) {
    // Return empty string since we're using CSS ::before pseudo-elements for icons
    return '';
}

/**
 * Get power-up emoji based on type
 */
function getPowerUpEmoji(type) {
    switch (type) {
        case 'speed': return '👟'; // Speed Up
        case 'flames': return '🔥'; // Flame Range Up
        case 'bombs': return '💣'; // Bomb Count Up
        case 1: return '👟'; // Legacy SpeedUp
        case 2: return '🔥'; // Legacy FlameUp
        case 3: return '💣'; // Legacy BombUp
        default: return '⭐';
    }
}
