import { levelMap, powerUpMap } from "./game.js";
import { Player } from "./player.js";
import { BombUp, FlameUp } from "./powerup.js";
import { SolidWall, WeakWall } from "./walls.js";
import { state } from "../shared/state.js";
import { gridStep, halfStep, mult } from "../shared/config.js";

export function setUpGame(playerName, multiplier) {
    const playerSpeed = 4.5 * multiplier;
    const playerSize = 55 * multiplier;
    const playerX = halfStep - (playerSize / 2); // put player to top left
    const playerY = halfStep - (playerSize / 2);

    const player = new Player(playerSize, playerSpeed, playerX, playerY, playerName);

    return player;
};

export function makeLevelMap() {
    // 11 rows and 13 columns
    let map = new Array(11);
    for (let i = 0; i < map.length; i++)  map[i] = new Array(13);
    return map;
};

export function makeWalls(level) {

    // place 6 * 5 solid walls inside play area
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 5; j++) {
            const mapX = (1 + i * 2);
            const mapY = (1 + j * 2);
            const x = gridStep * mapX;
            const y = gridStep * mapY;
            // Create SolidWall instance with level passed
            const newSolid = new SolidWall(x, y, gridStep, level);      // 6 * 5 solid walls
            state.solidWalls.push(newSolid);

            levelMap[mapY][mapX] = 'solidWall';
        };
    };

    // put solid walls around play area
    const yVals = [-1, 11];
    for (let i = 0; i < 15; i++) {
        for (const yVal of yVals) {
            const mapX = i - 1;
            const mapY = yVal;
            const x = gridStep * mapX;
            const y = gridStep * mapY;
            const newSolid = new SolidWall(x, y, gridStep, level);
            state.surroundingWalls.push(newSolid)
        }
    };
    const xVals = [-1, 13];
    for (let i = 0; i < 11; i++) {
        for (const xVal of xVals) {
            const mapX = xVal
            const mapY = i;
            const x = gridStep * mapX;
            const y = gridStep * mapY;
            const newSolid = new SolidWall(x, y, gridStep, level);
            state.surroundingWalls.push(newSolid)
        }
    };

    // place weak walls randomly
    while (state.weakWalls.size < 45) {
        const mapX = Math.floor(Math.random() * 13);
        const mapY = Math.floor(Math.random() * 11);

        // don't replace content or put anything in the top left and bottom right corners
        if (levelMap[mapY][mapX] || (mapX < 2 && mapY < 2) || (mapX > 10 && mapY > 8)) {
            continue;
        };

        const x = gridStep * mapX;
        const y = gridStep * mapY;
        const name = `weakWall${String(mapX).padStart(2, '0')}${String(mapY).padStart(2, '0')}`;
        const newWeak = new WeakWall(x, y, gridStep, level, name);    

        state.weakWalls.set(name, newWeak);   
        levelMap[mapY][mapX] = name;
    };

    // place bomb powerups inside weak walls
    while (state.powerups.size < 5) {
        const mapX = Math.floor(Math.random() * 13);
        const mapY = Math.floor(Math.random() * 11);

        if (levelMap[mapY][mapX] &&
            typeof levelMap[mapY][mapX] == 'string' &&
            levelMap[mapY][mapX].startsWith('weakWall') &&
            !powerUpMap[mapY][mapX]
        ) {
            const x = gridStep * mapX;
            const y = gridStep * mapY;
            const name = `bombUp${String(mapX).padStart(2, '0')}${String(mapY).padStart(2, '0')}`;  // use as id to DOM element?
            const newBombUp = new BombUp(x, y, gridStep * 1.0, name, mapY, mapX);
            state.powerups.set(name, newBombUp)
            powerUpMap[mapY][mapX] = [name, newBombUp];
        };
    }

    // place flame powerups inside weak walls
    while (state.powerups.size < 10) {
        const mapX = Math.floor(Math.random() * 13);
        const mapY = Math.floor(Math.random() * 11);

        if (levelMap[mapY][mapX] &&
            typeof levelMap[mapY][mapX] == 'string' &&
            levelMap[mapY][mapX].startsWith('weakWall') &&
            !powerUpMap[mapY][mapX]
        ) {
            const x = gridStep * mapX;
            const y = gridStep * mapY;
            const name = `flameUp${String(mapX).padStart(2, '0')}${String(mapY).padStart(2, '0')}`;  // use as id to DOM element?
            const newFlameUp = new FlameUp(x, y, gridStep * 1.0, name, mapY, mapX);
            state.powerups.set(name, newFlameUp)
            powerUpMap[mapY][mapX] = [name, newFlameUp];
        };
    }
};
