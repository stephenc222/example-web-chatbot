const chatIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="icon">
<path d="M2 15V5c0-1.1.9-2 2-2h16a2 2 0 0 1 2 2v15a1 1 0 0 1-1.7.7L16.58 17H4a2 2 0 0 1-2-2z"/>
<path  d="M6 7h12a1 1 0 0 1 0 2H6a1 1 0 1 1 0-2zm0 4h8a1 1 0 0 1 0 2H6a1 1 0 0 1 0-2z"/>
</svg>
`

const closeIcon = `
<svg xmlns="http://www.w3.org/2000/svg" style="display: block; margin: auto; transform: scale(1.5, 1.5);" viewBox="0 0 24 24" class="icon">
  <path transform="translate(0.5,0)" fill-rule="evenodd" d="M15.78 14.36a1 1 0 0 1-1.42 1.42l-2.82-2.83-2.83 2.83a1 1 0 1 1-1.42-1.42l2.83-2.82L7.3 8.7a1 1 0 0 1 1.42-1.42l2.83 2.83 2.82-2.83a1 1 0 0 1 1.42 1.42l-2.83 2.83 2.83 2.82z"/>
</svg>
`

const TOKEN_LIMIT = 1000 // Adjust this value as needed
const SPECIAL_TOKEN_BUFFER = 10

class ChatBot extends HTMLElement {
  constructor() {
    super()

    // Attach a shadow root to the element.
    this.attachShadow({ mode: "open" })
    this.isOpen = false // To track the chat window's state
    this.messages = [] // To store chat messages
    this.thinkingTimeout = null // For handling the minimum display time of "thinking..."
    this.apiPending = false // To track the API call's state
    this.totalTokens = 0 // To track the total number of tokens
  }

  get styles() {
    return `
    :host {
      display: block;
      position: fixed; /* Change to fixed position */
      bottom: 25px; /* Adjust the distance from the bottom */
      right: 25px; /* Adjust the distance from the right */
      z-index: 9999; /* Ensure the chat bot appears above other content */
    }

    .icon {
      fill: white;
    }

    button {
      width: 60px; 
      height: 60px; 
      padding: 10px;
      background-color: #0070f3;
      border-radius: 50%; /* Makes the button circular */
      color: white;
      border: none;
      cursor: pointer;
      transition: background-color 0.3s;
    }

    button:hover {
      background-color: #0051bb;
    }


    .close-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      background-color: #ccc;
      border: none;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .close-btn:hover {
      background-color: #aaa;
    }

    .chat-log {
      flex-grow: 1; /* Allow chat-log to take up available space */
      overflow-y: auto; /* Enable vertical scrolling */
      padding: 10px;
      border-bottom: 1px solid #ccc;
    }

    .chat-log .message {
      margin-bottom: 10px;
    }

    .chat-log .message.user {
      color: black;
    }
    .chat-log .message.assistant {
      color: #0070f3;
    }

    .chat-log .message.assistant-thinking {
      font-style: italic;
      color: #0070f3;
    }

    .chat-input {
      display: flex;
      padding: 5px; /* Reduced padding */
      background-color: #f7f7f7; /* Optional: Different background for clarity */
      border-bottom-left-radius:8px;
      border-bottom-right-radius:8px;
    }

    .chat-input input {
      flex-grow: 1;
      padding: 5px 10px; /* Reduced padding */
      border: 1px solid #ccc;
      border-radius: 5px;
      font-size: 14px; /* Reduced font size */
    }

    .chat-input button {
      margin-left: 5px; /* Reduced margin */
      padding: 5px 10px; /* Reduced padding */
      font-size: 14px; /* Reduced font size */
    }

    .send-btn {
      padding: 5px 15px; /* Adjusted padding for better appearance */
      background-color: #0070f3; /* Color to match the theme */
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      transition: background-color 0.3s;
      font-size: 14px; /* Consistent with the input field */
    }

    .send-btn[disabled] {
      background-color: #b3b3b3; /* Grayed out color */
      cursor: not-allowed;
    }

    .send-btn:hover {
      background-color: #0051bb; /* Darker shade on hover */
    }

    .chat-window {
      display: ${this.isOpen ? "flex" : "none"};
      width: 300px;
      height: 400px;
      position: absolute;
      bottom: 80px;
      right: 0%;
      /* background-color: #fff; */
      background-color: #fff;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      flex-direction: column; /* Stack children vertically */
    }

    `
  }

  estimateTokens(message) {
    // Simple estimation: count words and add some buffer for special tokens
    return message.split(/\s+/).length + SPECIAL_TOKEN_BUFFER
  }

  connectedCallback() {
    this.render()
    this.addEventListeners()
  }

  disconnectedCallback() {
    if (this.thinkingTimeout) {
      clearTimeout(this.thinkingTimeout)
    }
  }

  toggleChat() {
    this.isOpen = !this.isOpen
    this.render()
    this.addEventListeners() // Re-attach event listeners after rendering
  }

  async sendMessage(message) {
    this.totalTokens += this.estimateTokens(message)

    this.messages.push({ role: "user", content: message })
    this.render()
    this.addEventListeners()

    // Add a "thinking..." message
    const thinkingMessage = {
      role: "assistant-thinking",
      content: "thinking...",
    }
    this.messages.push(thinkingMessage)
    this.render()
    this.addEventListeners()

    this.apiPending = true // API call starts
    this.updateSendButtonState()

    // Set a minimum display time for "thinking..."
    this.thinkingTimeout = setTimeout(async () => {
      // Remove the "thinking..." message
      this.messages = this.messages.filter((msg) => msg !== thinkingMessage)

      // Send the user's message to the server
      try {
        const response = await fetch("http://localhost:3000/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages: this.messages.slice(-10) }), // Assuming the server expects a JSON payload with a "message" key
        })

        if (!response.ok) {
          throw new Error("Network response was not ok")
        }

        const data = await response.json()

        this.totalTokens += this.estimateTokens(
          data.content || "Sorry, I didn't understand that."
        )

        // Assuming the server returns a JSON object with a "content" key for the bot's reply
        this.messages.push({
          role: "assistant",
          content: data.content || "Sorry, I didn't understand that.",
        })
      } catch (error) {
        console.error("There was a problem with the fetch operation:", error)
        this.messages.push({
          role: "assistant",
          content: "Sorry, there was an error processing your message.",
        })
      }

      // Check if the total number of tokens exceeds the limit
      while (this.totalTokens > TOKEN_LIMIT && this.messages.length > 0) {
        const removedMessage = this.messages.shift()
        this.totalTokens -= this.estimateTokens(removedMessage.content)
      }

      this.apiPending = false
      this.render()
      this.addEventListeners()

      // Return focus to the input field
      const inputField = this.shadowRoot.querySelector(".chat-input input")
      if (inputField) {
        inputField.focus()
      }
      // Scroll to the newest message
      const chatLog = this.shadowRoot.querySelector(".chat-log")
      if (chatLog) {
        chatLog.scrollTop = chatLog.scrollHeight
      }
    }, 1000) // Display "thinking..." for at least 1 second
  }

  render() {
    this.shadowRoot.innerHTML = `
    <style>${this.styles}</style>
      <button class="toggle-chat-btn">${
        this.isOpen ? closeIcon : chatIcon
      }</button>
      <div class="chat-window">
        <button class="close-btn">×</button>
        <div class="chat-log">
          ${this.messages
            .map(
              (msg) => `<div class="message ${msg.role}">${msg.content}</div>`
            )
            .join("")}
        </div>
        <div class="chat-input">
          <input type="text" placeholder="Type a message...">
          <button class="send-btn" ${
            this.apiPending ? "disabled" : ""
          }>Send</button>
        </div>
      </div>
    `
  }

  handleToggleChatClick(event) {
    event.stopPropagation()
    this.toggleChat()
  }

  handleCloseButtonClick(event) {
    event.stopPropagation()
    this.toggleChat()
  }

  handleSendButtonClick() {
    const inputField = this.shadowRoot.querySelector(".chat-input input")
    if (inputField.value.trim()) {
      this.sendMessage(inputField.value.trim())
      this.clearAndFocusInput(inputField)
    }
  }

  handleInputKeydown(e) {
    const inputField = e.target
    if (e.key === "Enter" && inputField.value.trim()) {
      this.sendMessage(inputField.value.trim())
      this.clearAndFocusInput(inputField)
    }
  }

  clearAndFocusInput(inputField) {
    inputField.value = ""
    inputField.focus()
  }

  updateSendButtonState() {
    const sendButton = this.shadowRoot.querySelector(".send-btn")
    if (this.apiPending) {
      sendButton.setAttribute("disabled", "disabled")
    } else {
      sendButton.removeAttribute("disabled")
    }
  }

  addEventListeners() {
    this.shadowRoot
      .querySelector(".toggle-chat-btn")
      .addEventListener("click", this.handleToggleChatClick.bind(this))
    this.shadowRoot
      .querySelector(".close-btn")
      .addEventListener("click", this.handleCloseButtonClick.bind(this))
    this.shadowRoot
      .querySelector(".send-btn")
      .addEventListener("click", this.handleSendButtonClick.bind(this))
    this.shadowRoot
      .querySelector(".chat-input input")
      .addEventListener("keydown", this.handleInputKeydown.bind(this))
  }
}

// Define the new element
if (!customElements.get("chat-bot")) {
  customElements.define("chat-bot", ChatBot)
}
