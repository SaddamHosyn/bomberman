/**
 * DOM Cleaner - Manually clear game board to prevent character footprints
 */

export function forceCleanGameBoard() {
    const gameBoard = document.querySelector('.game-board');
    if (gameBoard) {
        // Clear all cells that have players
        const playerCells = gameBoard.querySelectorAll('.has-player');
        playerCells.forEach(cell => {
            cell.className = 'game-cell'; // Reset to base class
            cell.innerHTML = ''; // Clear content
        });
        
        // Also clear any orphaned player elements
        const playerElements = gameBoard.querySelectorAll('.player');
        playerElements.forEach(el => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
    }
}

export function initializeGameBoardCleaner() {
    // Set up mutation observer to clean board when content changes
    const gameBoard = document.querySelector('.game-board');
    if (gameBoard && !gameBoard._cleanerInitialized) {
        const observer = new MutationObserver(() => {
            // Clean up any duplicate player elements
            setTimeout(() => {
                const playerElements = gameBoard.querySelectorAll('.player');
                const seenPositions = new Set();
                
                playerElements.forEach(playerEl => {
                    const cell = playerEl.closest('.game-cell');
                    if (cell) {
                        const x = cell.dataset.x;
                        const y = cell.dataset.y;
                        const position = `${x}-${y}`;
                        
                        if (seenPositions.has(position)) {
                            // Duplicate player at this position - remove it
                            if (playerEl.parentNode) {
                                playerEl.parentNode.removeChild(playerEl);
                            }
                        } else {
                            seenPositions.add(position);
                        }
                    }
                });
            }, 10);
        });
        
        observer.observe(gameBoard, { 
            childList: true, 
            subtree: true 
        });
        
        gameBoard._cleanerInitialized = true;
    }
}
