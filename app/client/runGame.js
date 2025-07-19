import { startSequence } from "../server/game.js";
import { state } from "../shared/state.js";
import { finishLevel, menuMusic, walkingSound } from "./sounds.js";
import { makeTextBar, resizeGameContainer } from "./initializeClient.js";
import { drawSolidWalls, drawWeakWalls, collapseWeakWall } from "./renderWalls.js";
import { drawPowerUps, pickUpItem, burnItem } from "./renderItems.js";
import { drawBombs, clearBombs } from "./renderBombs.js";
import { drawFlames } from "./renderFlames.js"
import { addPlayers, updatePlayers } from "./renderPlayers.js";
import { listenPlayerInputs } from "./inputListeners.js";
import { Timer } from "./timerClient.js";
import { levelMusic, gameLost1, gameLost2 } from "./sounds.js";
import { congrats, crowdClapCheer } from "./sounds.js";

export const playerName = "Player1";
export let thisPlayer;
let levelinfo;
let livesinfo;
let oldlives;
let finished = false;
export const clientEvents = new Map();
let timedCount = 0;
let currentMusic;
let isMoving = false;
let wasMoving = false;

// update local player info (for lives mostly)
export function setThisPlayer(player) {
    thisPlayer = player;
}

// Walking sounds controlled from inputlisteners
export function setMoving(moving) {
    wasMoving = isMoving;
    isMoving = moving;

    if (isMoving && !wasMoving) {
        walkingSound.play();
    } else if (!isMoving && wasMoving) {
        walkingSound.pause();
        walkingSound.currentTime = 0;
    }
}

export function nextLevel() {

    if (state.level >= 5) {
        toggleEndScreen();
        congrats.play();
        congrats.onended = () => {
            crowdClapCheer.play();
        };
        return;
    }

    document.getElementById("game-container").replaceChildren();
    startSequence(playerName);  // this should be started with a websockets message containing info about the player
    startSequenceClient();
    updateLevelInfo(state.level);
    updateLivesInfo(thisPlayer.lives);
    toggleFinished();
};


export function restartGame() {
    location.reload();
};

export function toggleFinished() {
    finished = !finished;
    //scoreTime = window.performance.now() - timeToSubtract;
}

export function updateLivesInfo(lives) {
    oldlives = lives;
    let livesText = '';
    for (let i = 0; i < lives; i++) {
        livesText += `❤️`;
    };
    livesinfo.textContent = 'Lives: ' + livesText;
}

function updateLevelInfo(level) {
    levelinfo.textContent = `Level: ${level}`
}

function toggleEndScreen() {
    const victoryScreen = document.getElementById("victory");
    let msg = document.getElementById("victory-message");
    msg.textContent = `You finished with ${thisPlayer.lives} lives remaining, you absolute legend!`;
    victoryScreen.style.display == "flex" ? victoryScreen.style.display = "none" : victoryScreen.style.display = "flex";
}

function playMenuMusicOnInteraction() {
    menuMusic.play();
    // Remove the event listeners after the first interaction to avoid triggering play multiple times
    document.removeEventListener('click', playMenuMusicOnInteraction);
    document.removeEventListener('keydown', playMenuMusicOnInteraction);
}

export function startSequenceClient() {
    const gameContainer = document.getElementById("game-container");
    gameContainer.style.visibility = "hidden";
    const startMenu = document.getElementById("start-menu");

    let tasks = [
        () => { resizeGameContainer() },
        () => {
            menuMusic.pause();
            menuMusic.currentTime = 0;
            startMenu.style.display = "none";
        },
        () => {
            [levelinfo, livesinfo] = makeTextBar();
            updateLivesInfo(thisPlayer.lives);
        },
        () => {
            if (currentMusic) { currentMusic.pause(); currentMusic.currentTime = 0; }
            currentMusic = levelMusic[state.level - 1]; currentMusic.play();
        },
        () => { document.body.classList.add("grey"); listenPlayerInputs(); },
        () => {
            const gameContainer = document.getElementById("game-container");
            gameContainer.style.visibility = "visible";
        },

        // Render dom elements
        () => { drawSolidWalls(state.solidWalls); drawSolidWalls(state.surroundingWalls), drawWeakWalls(state.weakWalls) },
        () => { drawPowerUps(state.powerups); addPlayers(state.players) },
        () => { runGame(); },
    ];

    function processNextTask() {
        if (tasks.length > 0) {
            let task = tasks.shift();
            task();
            requestAnimationFrame(processNextTask);
        }
    }

    requestAnimationFrame(processNextTask);
}

function runGame() {
    requestAnimationFrame(gameLoop);

    function gameLoop(timestamp) {
        if (state.finishing) finishLevel.play();

        if (state.finished === true) {
            state.finished = false;     // client should not write to state: handle with ws
            nextLevel();
            return
        };

        updatePlayers(state.players);
        if (oldlives !== thisPlayer.lives) {
            updateLivesInfo(thisPlayer.lives);
            if (thisPlayer.lives === 0) {
                loserScreen();
            }
        }

        if (state.collapsingWalls.length > 0) {
            state.collapsingWalls.forEach(id => collapseWeakWall(id))
            state.collapsingWalls.length = 0;     // client should not write to state: handle with ws
        }

        if (state.pickedItems.length > 0) {
            state.pickedItems.forEach(name => pickUpItem(name))
            state.pickedItems.length = 0;     // client should not write to state: handle with ws
        }

        if (state.burningItems.length > 0) {
            state.burningItems.forEach(name => burnItem(name))
            state.burningItems.length = 0;     // client should not write to state: handle with ws
        }

        if (state.newFlames.size > 0) {
            drawFlames(state.newFlames);
            state.newFlames.clear();     // client should not write to state: handle with ws
        }

        if (state.newBombs.size > 0) {
            drawBombs(state.newBombs);
            state.newBombs.clear();     // client should not write to state: handle with ws
        }

        if (state.removedBombs.size > 0) {
            clearBombs(state.removedBombs);
            state.removedBombs.clear();     // client should not write to state: handle with ws
        }

        // requestAnimationFrame() always runs callback with 'timestamp' argument (milliseconds since the page loaded)
        requestAnimationFrame(gameLoop);
    }
};

function loserScreen() {
    const countNow = timedCount;
    const timedResurrection = new Timer(() => {

        const gameOverMenu = document.getElementById("game-over-menu");
        const gifs = ["app/client/images/loser1.gif", "app/client/images/loser2.gif"];
        const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
        gameOverMenu.style.background = `rgba(0, 0, 0, 0.8) url("${randomGif}") no-repeat center center`;
        gameOverMenu.style.backgroundSize = "cover";
        gameOverMenu.style.display = "block";

        levelMusic.forEach(track => {
            track.pause();
            track.currentTime = 0;
        });

        if (randomGif === "app/client/images/loser1.gif") {
            gameLost1.play(); // sad-trombone for loser1.gif
        } else {
            gameLost2.play(); // sinister-laugh for loser2.gif
        }

        clientEvents.delete(`resurrection${countNow}`)
    }, 2000)
    clientEvents.set(`resurrection${countNow}`, timedResurrection)
    timedCount++;
}

document.addEventListener("DOMContentLoaded", () => {
    // Start music on interaction to avoid errors
    document.addEventListener('click', playMenuMusicOnInteraction);
    document.addEventListener('keydown', playMenuMusicOnInteraction);

    // Start menu
    const startMenu = document.getElementById("start-menu");
    startMenu.style.display = "block";

    // Restart button
    document.getElementById("restart-btn-game-over").addEventListener("click", () => {
        document.getElementById("game-over-menu").style.display = "none";
        restartGame();
    });

    // Start button
    document.getElementById("start-btn").addEventListener("click", () => {
        startSequence(playerName);
        thisPlayer = state.players[0];
        startSequenceClient();
    });
});


