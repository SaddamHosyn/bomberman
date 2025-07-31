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
export function GameScreen({ state, onMove, onPlaceBomb, onLeaveGame }) {
    // Add demo game state if none provided
    const gameState = ensureGameState(state);
    
    return createElement('div', { className: 'game-screen' },
        // Game header with player info and controls
        renderGameHeader(gameState, onLeaveGame),
        
        // Main game area
        createElement('div', { className: 'game-area' },
            // Game board
            renderGameBoard(gameState, onMove, onPlaceBomb),
            
            // Game sidebar with stats and mini-map
            renderGameSidebar(gameState)
        ),
        
        // Game controls help
        renderGameControls()
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
        score: 0,
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
        score: player.score || 0,
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
            // Inner grid walls
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
 * Render game header with player stats and leave button
 */
function renderGameHeader(state, onLeaveGame) {
    return createElement('div', { className: 'game-header' },
        createElement('div', { className: 'game-title' },
            createElement('h2', {}, '💣 BOMBERMAN'),
            createElement('div', { className: 'game-status' }, 
                (state.gameStatus === 'countdown' || state.timerPhase === 'countdown') ? `Starting in ${state.countdown || state.timeLeft || '?'}...` : 
                (state.gameStatus === 'in_progress' || state.currentScreen === 'game') ? 'GAME IN PROGRESS' :
                (state.gameStatus === 'finished') ? `Game Over - Winner: ${state.winner?.name || 'Draw'}` : 'Waiting...'
            )
        ),
        
        // Player stats
        createElement('div', { className: 'players-stats' },
            ...state.players.map(player => renderPlayerStat(player, state.currentPlayer, state.players))
        ),
        
        // Leave game button
        createElement('div', { className: 'game-actions' },
            createElement('button', {
                className: 'leave-button',
                onclick: onLeaveGame
            }, '🚪 Leave Game')
        )
    );
}

/**
 * Render individual player stats
 */
function renderPlayerStat(player, currentPlayer, allPlayers) {
    const isCurrentPlayer = player.id === currentPlayer?.id;
    const playerNumber = getPlayerNumber(player.id, allPlayers || []);
    
    return createElement('div', { 
        className: `player-stat ${isCurrentPlayer ? 'current-player' : ''} ${!player.alive ? 'dead' : ''}`,
        style: {
            border: `2px solid ${getPlayerColor(playerNumber)}`,
            background: isCurrentPlayer ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
    },
        createElement('div', { className: 'player-name' }, 
            `${getPlayerEmoji(playerNumber)} ${player.name || player.nickname || 'Unknown'}`
        ),
        createElement('div', { className: 'player-stats-row' },
            createElement('span', { className: 'stat' }, `❤️ ${player.lives || 3}`),
            createElement('span', { className: 'stat' }, `💰 ${player.score || 0}`),
            createElement('span', { className: 'stat' }, `💣 ${player.bombCount || 1}`),
            createElement('span', { className: 'stat' }, `🔥 ${player.flameRange || 1}`)
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
    
    return createElement('div', { 
        className: 'game-board-container',
        tabindex: '0',
        onkeydown: (e) => handleKeyDown(e, onMove, onPlaceBomb),
        onclick: () => {
            // Focus the container when clicked to ensure keyboard events work
            document.querySelector('.game-board-container').focus();
        }
    },
        createElement('div', { 
            className: 'game-board',
            // FORCE COMPLETE RE-RENDER: Add key that changes when players move
            key: `board-${players.map(p => `${p.id}-${p.position?.x || 0}-${p.position?.y || 0}`).join('-')}`,
            style: {
                gridTemplateColumns: `repeat(${gameMap.width || 15}, 1fr)`,
                gridTemplateRows: `repeat(${gameMap.height || 13}, 1fr)`
            }
        },
            // Render all board cells
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
    const cellKey = `cell-${x}-${y}`;
    let cellClass = 'game-cell';
    
    // IMPORTANT: Only render ONE item per cell in priority order
    // Priority: Player > Bomb > Flame > Power-up > Block > Wall > Empty
    
    // Check for players FIRST (highest priority)
    const playersHere = players?.filter(p => 
        p && p.position && p.position.x === x && p.position.y === y && p.alive
    );
    
    if (playersHere && playersHere.length > 0) {
        const player = playersHere[0]; // Only render first player if multiple
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
    
    // Check for bomb (second priority)
    const bomb = bombs?.find(b => b && b.position && b.position.x === x && b.position.y === y);
    if (bomb) {
        return createElement('div', {
            key: cellKey,
            className: `${cellClass} has-bomb`,
            'data-x': x,
            'data-y': y
        }, createElement('div', { 
            className: `bomb ${bomb.timer <= 1 ? 'exploding' : ''}` 
        }, '💣'));
    }
    
    // Check for flame (third priority)
    const flame = flames?.find(f => f && f.position && f.position.x === x && f.position.y === y);
    if (flame) {
        return createElement('div', {
            key: cellKey,
            className: `${cellClass} has-flame`,
            'data-x': x,
            'data-y': y
        }, createElement('div', { className: 'flame' }, '🔥'));
    }
    
    // Check for power-up (fourth priority)
    const powerUp = powerUps?.find(p => p && p.position && p.position.x === x && p.position.y === y);
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
 * Render game sidebar with additional info
 */
function renderGameSidebar(state) {
    return createElement('div', { className: 'game-sidebar' },
        // Mini-map
        createElement('div', { className: 'mini-map-container' },
            createElement('h4', {}, '🗺️ Mini Map'),
            renderMiniMap(state)
        ),
        
        // Power-ups guide
        createElement('div', { className: 'power-ups-guide' },
            createElement('h4', {}, '⚡ Power-ups'),
            createElement('div', { className: 'power-up-list' },
                createElement('div', { className: 'power-up-item' }, '👟 Speed Up'),
                createElement('div', { className: 'power-up-item' }, '🔥 Flame Up'),
                createElement('div', { className: 'power-up-item' }, '💣 Bomb Up')
            )
        ),
        
        // Game info
        createElement('div', { className: 'game-info' },
            createElement('h4', {}, 'ℹ️ Game Info'),
            createElement('div', { className: 'info-item' }, 
                `Map: ${state.gameMap?.width || 15}x${state.gameMap?.height || 13}`
            ),
            createElement('div', { className: 'info-item' }, 
                `Players: ${state.players?.filter(p => p.alive).length || 0} alive`
            ),
            createElement('div', { className: 'info-item' }, 
                `Bombs: ${state.bombs?.length || 0} active`
            )
        )
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
                createElement('kbd', {}, 'SPACE'), 
                createElement('span', {}, 'Place Bomb')
            ),
            createElement('div', { className: 'control-item' }, 
                createElement('kbd', {}, 'ESC'), 
                createElement('span', {}, 'Pause/Menu')
            )
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
    
    switch (key) {
        case 'w':
        case 'arrowup':
            onMove && onMove('up');
            break;
        case 's':
        case 'arrowdown':
            onMove && onMove('down');
            break;
        case 'a':
        case 'arrowleft':
            onMove && onMove('left');
            break;
        case 'd':
        case 'arrowright':
            onMove && onMove('right');
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
