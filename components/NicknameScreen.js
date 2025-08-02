/**
 * @fileoverview Nickname Screen Component for Bomberman DOM
 * @author Chan
 */

import { createElement } from "../mini-framework/VirtualDom.js";

// Store nickname value outside of component to persist across re-renders
let nicknameValue = "";

/**
 * Render the nickname input screen
 */
export function NicknameScreen(state, onJoinGame) {
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted with nickname:", nicknameValue); // Debug log
    if (nicknameValue.trim()) {
      onJoinGame(nicknameValue.trim());
    } else {
      console.log("Empty nickname, not submitting"); // Debug log
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      console.log("Enter pressed with nickname:", nicknameValue); // Debug log
      if (nicknameValue.trim()) {
        onJoinGame(nicknameValue.trim());
      }
    }
  };

  const handleInput = (e) => {
    nicknameValue = e.target.value;
    console.log("Input changed to:", nicknameValue); // Debug log
  };

  // Focus the input after render
  setTimeout(() => {
    const input = document.getElementById(".nickname-input");
    if (input) {
      input.focus();
      // Restore the value if it was lost due to re-render
      if (nicknameValue && input.value !== nicknameValue) {
        input.value = nicknameValue;
      }
      console.log("Input focused, current value:", input.value); // Debug log
    }
  }, 50);

  return createElement(
    "div",
    { className: "nickname-screen fade-in" },
    // Game title
    createElement("h1", { className: "game-title" }, "BOMBERMAN"),
    createElement(
      "p",
      { className: "game-subtitle" },
      "Multiplayer DOM Edition"
    ),

    // Nickname form
    createElement(
      "form",
      {
        className: "nickname-form",
        onsubmit: handleSubmit,
      },
      createElement("input", {
        type: "text",
        id: "nickname-input",
        name: "nickname",
        className: "nickname-input",
        placeholder: "Enter your nickname...",
        maxLength: 20,
        minLength: 2,
        required: true,
        onkeypress: handleKeyPress,
        oninput: handleInput,
        value: nicknameValue, // Set initial value
        disabled: state.isJoining,
      }),
      createElement("br"),
      createElement(
        "button",
        {
          type: "submit",
          className: "join-button",
          disabled: state.isJoining,
          onclick: (e) => {
            e.preventDefault();
            console.log("Button clicked with nickname:", nicknameValue); // Debug log
            if (nicknameValue.trim() && !state.isJoining) {
              onJoinGame(nicknameValue.trim());
            }
          },
        },
        ...(state.isJoining
          ? [createElement("span", { className: "loading" }), " Joining..."]
          : ["Join Game"])
      )
    ),

    // Error message
    state.error &&
      createElement(
        "div",
        {
          className: "status-message status-warning",
        },
        state.error
      ),

    // Connection status
    !state.isConnected &&
      !state.isJoining &&
      createElement(
        "div",
        {
          className: "status-message status-info",
        },
        "Ready to connect to game server"
      ),

    // Game instructions
    createElement(
      "div",
      {
        style: {
          marginTop: "30px",
          textAlign: "center",
          opacity: "0.7",
          fontSize: "0.9rem",
        },
      },
      createElement("p", {}, "Game Rules:"),
      createElement(
        "ul",
        {
          style: {
            listStyle: "none",
            marginTop: "10px",
          },
        },
        createElement("li", {}, "• 2-4 players per game"),
        createElement("li", {}, "• Each player has 3 lives"),
        createElement("li", {}, "• Last player standing wins!"),
        createElement("li", {}, "• Destroy blocks to find power-ups")
      )
    )
  );
}
