/**
 * @fileoverview Simple Game State Manager for Bomberman DOM UI Demo
 * @author Chan
 */

/**
 * GameState class - manages the UI state (demo mode - no backend)
 */
export class GameState {
    constructor() {
        this.state = {
            currentScreen: 'nickname',
            nickname: '',
            playerId: null,
            players: [],
            messages: [],
            waitingTimer: null,
            gameTimer: null,
            maxPlayers: 4,
            minPlayers: 2,
            waitingTime: 20, // seconds to wait for players
            gameStartTime: 10, // seconds before game starts
            error: null,
            chatError: null,
            isJoining: false,
            isConnected: false
        };
        
        this.listeners = [];
        this.timers = {
            waiting: null,
            gameStart: null
        };
    }
    
    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(listener => listener !== callback);
        };
    }
    
    /**
     * Update state and notify listeners
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notifyListeners();
    }
    
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Notify all listeners of state change
     */
    notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this.state);
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        });
    }
    
    /**
     * Simulate joining game (UI demo)
     */
    simulateJoinGame(nickname) {
        console.log('simulateJoinGame called with:', nickname); // Debug log
        
        this.setState({
            currentScreen: 'waiting',
            nickname: nickname,
            playerId: 'demo_player_' + Date.now(),
            isJoining: false,
            error: null,
            isConnected: true
        });
        
        console.log('State updated to waiting screen'); // Debug log
        
        // Add demo players
        this.addDemoPlayers(nickname);
    }
    
    /**
     * Add demo players to show the waiting room
     */
    addDemoPlayers(userNickname) {
        const demoPlayers = [
            { id: 'demo_player_' + Date.now(), nickname: userNickname, joinedAt: new Date() }
        ];
        
        // Add some demo players after a delay
        setTimeout(() => {
            demoPlayers.push({ 
                id: 'demo_player_2', 
                nickname: 'DemoPlayer2', 
                joinedAt: new Date() 
            });
            this.setState({ players: [...demoPlayers] });
            this.handlePlayerCountChange(demoPlayers.length);
        }, 2000);
        
        setTimeout(() => {
            demoPlayers.push({ 
                id: 'demo_player_3', 
                nickname: 'BomberMan', 
                joinedAt: new Date() 
            });
            this.setState({ players: [...demoPlayers] });
            this.handlePlayerCountChange(demoPlayers.length);
        }, 5000);
        
        this.setState({ players: demoPlayers });
        this.handlePlayerCountChange(demoPlayers.length);
    }
    
    /**
     * Add demo chat message
     */
    addDemoChatMessage(text, author = 'DemoPlayer2') {
        const newMessage = {
            id: Date.now() + Math.random(),
            author: author,
            text: text,
            timestamp: new Date()
        };
        
        this.setState({
            messages: [...this.state.messages, newMessage],
            chatError: null
        });
    }
    
    /**
     * Simulate sending a chat message
     */
    simulateSendMessage(message) {
        if (!message || message.trim().length === 0) {
            return;
        }
        
        this.addDemoChatMessage(message.trim(), this.state.nickname);
        
        // Simulate responses from other players
        setTimeout(() => {
            const responses = [
                "Nice to meet you!",
                "Ready to play!",
                "Let's go!",
                "Good luck everyone!"
            ];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            this.addDemoChatMessage(randomResponse);
        }, 1000 + Math.random() * 2000);
    }
    
    /**
     * Handle player count changes and timer logic
     */
    handlePlayerCountChange(playerCount) {
        // Clear existing timers
        this.clearTimers();
        
        if (playerCount >= this.state.maxPlayers) {
            // Start game immediately if we have max players
            this.startGameCountdown();
        } else if (playerCount >= this.state.minPlayers) {
            // Start waiting timer if we have enough players but not max
            this.startWaitingTimer();
        } else {
            // Not enough players, clear timers
            this.setState({
                waitingTimer: null,
                gameTimer: null
            });
        }
    }
    
    /**
     * Start the waiting timer (20 seconds to wait for more players)
     */
    startWaitingTimer() {
        let timeLeft = this.state.waitingTime;
        
        this.setState({
            waitingTimer: timeLeft,
            gameTimer: null
        });
        
        this.timers.waiting = setInterval(() => {
            timeLeft--;
            
            if (timeLeft <= 0) {
                this.clearWaitingTimer();
                this.startGameCountdown();
            } else {
                this.setState({
                    waitingTimer: timeLeft
                });
            }
        }, 1000);
    }
    
    /**
     * Start the game countdown timer (10 seconds before game starts)
     */
    startGameCountdown() {
        let timeLeft = this.state.gameStartTime;
        
        this.setState({
            waitingTimer: null,
            gameTimer: timeLeft
        });
        
        this.timers.gameStart = setInterval(() => {
            timeLeft--;
            
            if (timeLeft <= 0) {
                this.clearGameTimer();
                this.startGame();
            } else {
                this.setState({
                    gameTimer: timeLeft
                });
            }
        }, 1000);
    }
    
    /**
     * Clear waiting timer
     */
    clearWaitingTimer() {
        if (this.timers.waiting) {
            clearInterval(this.timers.waiting);
            this.timers.waiting = null;
        }
    }
    
    /**
     * Clear game timer
     */
    clearGameTimer() {
        if (this.timers.gameStart) {
            clearInterval(this.timers.gameStart);
            this.timers.gameStart = null;
        }
    }
    
    /**
     * Clear all timers
     */
    clearTimers() {
        this.clearWaitingTimer();
        this.clearGameTimer();
        this.setState({
            waitingTimer: null,
            gameTimer: null
        });
    }
    
    /**
     * Start the actual game (demo)
     */
    startGame() {
        this.setState({
            currentScreen: 'game',
            waitingTimer: null,
            gameTimer: null
        });
        
        console.log('Demo: Game would start here with players:', this.state.players);
        alert('Demo Complete! Game would start here.');
    }
    
    /**
     * Reset to nickname screen
     */
    resetToNickname() {
        this.clearTimers();
        this.setState({
            currentScreen: 'nickname',
            nickname: '',
            playerId: null,
            players: [],
            messages: [],
            waitingTimer: null,
            gameTimer: null,
            error: null,
            chatError: null,
            isJoining: false,
            isConnected: false
        });
    }
    
    /**
     * Clean up when destroyed
     */
    destroy() {
        this.clearTimers();
        this.listeners = [];
    }
}
