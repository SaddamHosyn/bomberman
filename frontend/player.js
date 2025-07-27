// Player logic for Bomberman frontend
// No UI, just core logic

class Player {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.lives = 3;
        this.position = { x: 0, y: 0 };
        this.bombsPlaced = 0;
        this.alive = true;
        this.score = 0;
        this.speed = 1;
        this.bombCount = 1;
        this.flameRange = 1;
    }

    move(dx, dy) {
        this.position.x += dx;
        this.position.y += dy;
    }

    placeBomb() {
        if (this.bombsPlaced < this.bombCount) {
            this.bombsPlaced++;
            return true;
        }
        return false;
    }

    die() {
        this.lives--;
        if (this.lives <= 0) {
            this.alive = false;
        }
    }

    addPowerUp(type) {
        switch (type) {
            case 'SpeedUp':
                this.speed++;
                break;
            case 'FlameUp':
                this.flameRange++;
                break;
            case 'BombUp':
                this.bombCount++;
                break;
        }
    }
}

// Export for use in other frontend modules
if (typeof module !== 'undefined') {
    module.exports = Player;
}
