const PEER_PREFIX = "bor_room_";
const HOST_CODE_LENGTH = 4;
const HOST_CREATE_RETRIES = 8;

const state = {
  role: null,
  roomCode: "",
  name: "",
  clientId: getOrCreateClientId(),
  peer: null,
  hostConn: null,
  connections: new Map(),
  players: {},
  roundId: "",
  currentQuestion: "",
  selectedChoice: "",
  roundAnswers: {},
  choiceSaving: false
};

const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");

const showHostBtn = document.getElementById("showHostBtn");
const showJoinBtn = document.getElementById("showJoinBtn");
const hostForm = document.getElementById("hostForm");
const joinForm = document.getElementById("joinForm");

const hostNameInput = document.getElementById("hostNameInput");
const joinNameInput = document.getElementById("joinNameInput");
const roomCodeInput = document.getElementById("roomCodeInput");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const startMessage = document.getElementById("startMessage");

const roomCodeLabel = document.getElementById("roomCodeLabel");
const playerNameLabel = document.getElementById("playerNameLabel");
const roleLabel = document.getElementById("roleLabel");
const copyRoomBtn = document.getElementById("copyRoomBtn");
const gameMessage = document.getElementById("gameMessage");

const playerList = document.getElementById("playerList");
const currentQuestionEl = document.getElementById("currentQuestion");

const choiceSection = document.getElementById("choiceSection");
const blackBtn = document.getElementById("blackBtn");
const redBtn = document.getElementById("redBtn");
const choiceStatus = document.getElementById("choiceStatus");

const hostPanel = document.getElementById("hostPanel");
const questionInput = document.getElementById("questionInput");
const askQuestionBtn = document.getElementById("askQuestionBtn");
const calculateBtn = document.getElementById("calculateBtn");

const resultBox = document.getElementById("resultBox");
const blackCountEl = document.getElementById("blackCount");
const redCountEl = document.getElementById("redCount");
const totalCountEl = document.getElementById("totalCount");

function getOrCreateClientId() {
  let id = localStorage.getItem("bor_client_id");
  if (!id) {
    id = makeId("u");
    localStorage.setItem("bor_client_id", id);
  }
  return id;
}

function makeId(prefix) {
  if (window.crypto && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function sanitizeName(name) {
  return name.trim().slice(0, 30);
}

function sanitizeRoomCode(value) {
  return value.replace(/\D/g, "").slice(0, HOST_CODE_LENGTH);
}

function setStartMessage(message, isError = false) {
  startMessage.textContent = message;
  startMessage.style.color = isError ? "#fca5a5" : "#9ca3af";
}

function setGameMessage(message, isError = false) {
  gameMessage.textContent = message;
  gameMessage.style.color = isError ? "#fca5a5" : "#9ca3af";
}

function showScreen(screen) {
  if (screen === "start") {
    startScreen.classList.remove("hidden");
    startScreen.classList.add("active");
    gameScreen.classList.add("hidden");
  } else {
    startScreen.classList.add("hidden");
    startScreen.classList.remove("active");
    gameScreen.classList.remove("hidden");
  }
}

function resetResults() {
  resultBox.classList.add("hidden");
  blackCountEl.textContent = "0";
  redCountEl.textContent = "0";
  totalCountEl.textContent = "0";
}

function renderPlayers(players) {
  playerList.innerHTML = "";

  if (!players || !players.length) {
    const li = document.createElement("li");
    li.textContent = "No players yet";
    playerList.appendChild(li);
    return;
  }

  const sorted = [...players].sort((a, b) => {
    if (a.role === "host" && b.role !== "host") return -1;
    if (a.role !== "host" && b.role === "host") return 1;
    return a.name.localeCompare(b.name);
  });

  sorted.forEach((player) => {
    const li = document.createElement("li");
    li.textContent = `${player.name}${player.role === "host" ? " (Host)" : ""}`;
    playerList.appendChild(li);
  });
}

function renderQuestion() {
  currentQuestionEl.textContent =
    state.currentQuestion || "Waiting for host to ask a question...";
}

function renderChoiceButtons() {
  blackBtn.classList.toggle("selected", state.selectedChoice === "black");
  redBtn.classList.toggle("selected", state.selectedChoice === "red");

  const playerConnected =
    state.role === "player" && state.hostConn && state.hostConn.open;
  const canChoose =
    state.role === "player" && !!state.roundId && playerConnected && !state.choiceSaving;

  blackBtn.disabled = !canChoose;
  redBtn.disabled = !canChoose;

  if (state.role !== "player") {
    choiceStatus.textContent = "";
    return;
  }

  if (!playerConnected) {
    choiceStatus.textContent = "Disconnected from host.";
    return;
  }

  if (!state.roundId) {
    choiceStatus.textContent = "Waiting for host to ask a question.";
    return;
  }

  if (state.choiceSaving) {
    choiceStatus.textContent = "Saving your choice...";
    return;
  }

  if (state.selectedChoice) {
    choiceStatus.textContent = `Your saved choice: ${state.selectedChoice.toUpperCase()}`;
  } else {
    choiceStatus.textContent = "Choose Black or Red.";
  }
}

function teardownConnections() {
  if (state.hostConn) {
    try {
      state.hostConn.close();
    } catch {
      // ignore
    }
    state.hostConn = null;
  }

  if (state.connections.size) {
    state.connections.forEach((conn) => {
      try {
        conn.close();
      } catch {
        // ignore
      }
    });
    state.connections.clear();
  }

  if (state.peer) {
    try {
      state.peer.destroy();
    } catch {
      // ignore
    }
    state.peer = null;
  }
}

function resetSessionState() {
  state.players = {};
  state.roundAnswers = {};
  state.roundId = "";
  state.currentQuestion = "";
  state.selectedChoice = "";
  state.choiceSaving = false;
  resetResults();
}

function enterRoom() {
  roomCodeLabel.textContent = state.roomCode;
  playerNameLabel.textContent = state.name;
  roleLabel.textContent = state.role === "host" ? "Host" : "Player";

  hostPanel.classList.toggle("hidden", state.role !== "host");
  choiceSection.classList.toggle("hidden", state.role !== "player");

  renderQuestion();
  renderChoiceButtons();
  renderPlayers(Object.values(state.players));

  showScreen("game");
}

function requirePeerJs() {
  if (typeof window.Peer !== "function") {
    throw new Error("PeerJS failed to load. Refresh the page and try again.");
  }
}

function waitForPeerOpen(peer) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out while creating connection."));
    }, 12000);

    peer.once("open", (id) => {
      clearTimeout(timer);
      resolve(id);
    });

    peer.once("error", (error) => {
      clearTimeout(timer);
      reject(error || new Error("Peer connection failed."));
    });
  });
}

function waitForConnectionOpen(conn) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Could not connect to host."));
    }, 12000);

    conn.once("open", () => {
      clearTimeout(timer);
      resolve();
    });

    conn.once("error", (error) => {
      clearTimeout(timer);
      reject(error || new Error("Connection failed."));
    });

    conn.once("close", () => {
      clearTimeout(timer);
      reject(new Error("Host is unavailable."));
    });
  });
}

function generateRoomCode() {
  return String(Math.floor(Math.random() * 10000)).padStart(HOST_CODE_LENGTH, "0");
}

function safeErrorMessage(error, fallback) {
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function publicPlayers() {
  return Object.values(state.players).map((player) => ({
    id: player.id,
    name: player.name,
    role: player.role
  }));
}

function sendMessage(conn, payload) {
  if (!conn || !conn.open) return;
  conn.send(payload);
}

function sendRoomStateToPlayer(conn, playerId) {
  const yourChoice = state.roundAnswers[playerId] || "";
  sendMessage(conn, {
    type: "room_state",
    players: publicPlayers(),
    question: state.currentQuestion,
    roundId: state.roundId,
    yourChoice
  });
}

function broadcastRoomState() {
  const players = publicPlayers();

  state.connections.forEach((conn, playerId) => {
    sendMessage(conn, {
      type: "room_state",
      players,
      question: state.currentQuestion,
      roundId: state.roundId,
      yourChoice: state.roundAnswers[playerId] || ""
    });
  });

  renderPlayers(players);
  renderQuestion();
}

function attachRuntimePeerHandlers(peer) {
  peer.on("error", (error) => {
    console.error(error);
    if (state.role) {
      setGameMessage(safeErrorMessage(error, "Network error."), true);
    } else {
      setStartMessage(safeErrorMessage(error, "Network error."), true);
    }
  });

  peer.on("disconnected", () => {
    if (state.role === "player") {
      setGameMessage("Connection interrupted.", true);
      renderChoiceButtons();
    }
  });
}

function removePlayerConnection(conn) {
  const playerId = conn.playerId;
  if (!playerId) return;

  if (state.connections.get(playerId) === conn) {
    state.connections.delete(playerId);
  }

  delete state.players[playerId];
  delete state.roundAnswers[playerId];

  broadcastRoomState();
  setGameMessage("A player left the room.");
}

function handleHostIncomingConnection(conn) {
  conn.on("data", (payload) => {
    if (!payload || typeof payload !== "object") return;

    if (payload.type === "join") {
      const playerId = String(payload.playerId || conn.peer || makeId("p"));
      const playerName = sanitizeName(payload.name || "Player") || "Player";

      const existingConn = state.connections.get(playerId);
      if (existingConn && existingConn !== conn) {
        try {
          existingConn.close();
        } catch {
          // ignore
        }
      }

      conn.playerId = playerId;
      state.connections.set(playerId, conn);
      state.players[playerId] = {
        id: playerId,
        name: playerName,
        role: "player"
      };

      sendRoomStateToPlayer(conn, playerId);
      broadcastRoomState();
      setGameMessage(`${playerName} joined the room.`);
      return;
    }

    if (payload.type === "choice") {
      const playerId = conn.playerId;
      if (!playerId || !state.players[playerId]) return;

      if (!state.roundId || payload.roundId !== state.roundId) {
        sendMessage(conn, {
          type: "choice_rejected",
          reason: "Question changed. Choose again."
        });
        return;
      }

      const choice = payload.choice === "black" ? "black" : payload.choice === "red" ? "red" : "";
      if (!choice) return;

      state.roundAnswers[playerId] = choice;
      sendMessage(conn, {
        type: "choice_ack",
        roundId: state.roundId,
        choice
      });
      return;
    }
  });

  conn.on("close", () => {
    removePlayerConnection(conn);
  });

  conn.on("error", (error) => {
    console.error(error);
    removePlayerConnection(conn);
  });
}

function handlePlayerHostMessage(payload) {
  if (!payload || typeof payload !== "object") return;

  if (payload.type === "room_state") {
    const prevRoundId = state.roundId;

    state.currentQuestion = payload.question || "";
    state.roundId = payload.roundId || "";
    state.selectedChoice = payload.yourChoice || "";

    state.players = {};
    if (Array.isArray(payload.players)) {
      payload.players.forEach((player) => {
        if (!player || !player.id) return;
        state.players[player.id] = {
          id: player.id,
          name: player.name || "Player",
          role: player.role === "host" ? "host" : "player"
        };
      });
    }

    if (prevRoundId !== state.roundId) {
      resetResults();
    }

    renderPlayers(publicPlayers());
    renderQuestion();
    renderChoiceButtons();
    return;
  }

  if (payload.type === "choice_ack") {
    if (payload.roundId === state.roundId) {
      state.selectedChoice = payload.choice;
      renderChoiceButtons();
    }
    return;
  }

  if (payload.type === "choice_rejected") {
    setGameMessage(payload.reason || "Could not save choice.", true);
    return;
  }
}

async function createHostPeer() {
  requirePeerJs();

  let lastError = null;

  for (let i = 0; i < HOST_CREATE_RETRIES; i += 1) {
    const roomCode = generateRoomCode();
    const peerId = `${PEER_PREFIX}${roomCode}`;
    const peer = new Peer(peerId);

    try {
      await waitForPeerOpen(peer);
      return { peer, roomCode };
    } catch (error) {
      lastError = error;
      try {
        peer.destroy();
      } catch {
        // ignore
      }

      const unavailable =
        (error && error.type === "unavailable-id") ||
        safeErrorMessage(error, "").toLowerCase().includes("unavailable");

      if (!unavailable) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Could not create room. Please try again.");
}

async function createRoom() {
  try {
    const name = sanitizeName(hostNameInput.value);

    if (!name) {
      setStartMessage("Please enter host name.", true);
      return;
    }

    createRoomBtn.disabled = true;
    setStartMessage("Creating room...");

    teardownConnections();
    resetSessionState();

    const { peer, roomCode } = await createHostPeer();

    state.role = "host";
    state.name = name;
    state.roomCode = roomCode;
    state.peer = peer;
    state.hostConn = null;
    state.players = {
      [state.clientId]: {
        id: state.clientId,
        name,
        role: "host"
      }
    };

    attachRuntimePeerHandlers(peer);
    peer.on("connection", handleHostIncomingConnection);

    enterRoom();
    setGameMessage("Room is live. Share the code and start asking questions.");
  } catch (error) {
    console.error(error);
    setStartMessage(safeErrorMessage(error, "Failed to create room."), true);
  } finally {
    createRoomBtn.disabled = false;
  }
}

async function connectToHost(roomCode) {
  requirePeerJs();

  const peer = new Peer();
  await waitForPeerOpen(peer);

  const hostPeerId = `${PEER_PREFIX}${roomCode}`;
  const conn = peer.connect(hostPeerId, {
    reliable: true
  });

  await waitForConnectionOpen(conn);
  return { peer, conn };
}

async function joinRoom() {
  try {
    const name = sanitizeName(joinNameInput.value);
    const roomCode = sanitizeRoomCode(roomCodeInput.value);

    if (!name) {
      setStartMessage("Please enter your name.", true);
      return;
    }

    if (roomCode.length !== HOST_CODE_LENGTH) {
      setStartMessage("Please enter a 4-digit room code.", true);
      return;
    }

    joinRoomBtn.disabled = true;
    setStartMessage("Joining room...");

    teardownConnections();
    resetSessionState();

    const { peer, conn } = await connectToHost(roomCode);

    state.role = "player";
    state.name = name;
    state.roomCode = roomCode;
    state.peer = peer;
    state.hostConn = conn;

    attachRuntimePeerHandlers(peer);

    conn.on("data", handlePlayerHostMessage);
    conn.on("close", () => {
      setGameMessage("Disconnected from host.", true);
      renderChoiceButtons();
    });
    conn.on("error", (error) => {
      console.error(error);
      setGameMessage(safeErrorMessage(error, "Connection error."), true);
      renderChoiceButtons();
    });

    enterRoom();
    sendMessage(conn, {
      type: "join",
      playerId: state.clientId,
      name
    });
    setGameMessage("Connected. Waiting for host.");
  } catch (error) {
    console.error(error);
    setStartMessage(safeErrorMessage(error, "Failed to join room."), true);
    teardownConnections();
  } finally {
    joinRoomBtn.disabled = false;
  }
}

async function askQuestion() {
  try {
    if (state.role !== "host") return;

    const question = questionInput.value.trim();
    if (!question) {
      setGameMessage("Please enter a question.", true);
      return;
    }

    askQuestionBtn.disabled = true;
    setGameMessage("");

    state.roundId = makeId("round");
    state.currentQuestion = question;
    state.roundAnswers = {};
    state.selectedChoice = "";

    questionInput.value = "";
    resetResults();

    broadcastRoomState();
    setGameMessage("Question sent.");
  } catch (error) {
    console.error(error);
    setGameMessage(safeErrorMessage(error, "Failed to ask question."), true);
  } finally {
    askQuestionBtn.disabled = false;
  }
}

async function submitChoice(choice) {
  try {
    if (state.role !== "player") return;
    if (!state.roundId) return;
    if (!state.hostConn || !state.hostConn.open) {
      setGameMessage("You are not connected to the host.", true);
      return;
    }
    if (state.choiceSaving) return;

    state.choiceSaving = true;
    renderChoiceButtons();

    sendMessage(state.hostConn, {
      type: "choice",
      roundId: state.roundId,
      choice
    });

    state.selectedChoice = choice;
    setGameMessage("");
  } catch (error) {
    console.error(error);
    setGameMessage(safeErrorMessage(error, "Failed to save choice."), true);
  } finally {
    state.choiceSaving = false;
    renderChoiceButtons();
  }
}

async function calculateResults() {
  try {
    if (state.role !== "host") return;
    if (!state.roundId) {
      setGameMessage("Ask a question first.", true);
      return;
    }

    calculateBtn.disabled = true;
    setGameMessage("");

    let black = 0;
    let red = 0;

    Object.values(state.players).forEach((player) => {
      if (player.role !== "player") return;
      const choice = state.roundAnswers[player.id];
      if (choice === "black") black += 1;
      if (choice === "red") red += 1;
    });

    blackCountEl.textContent = String(black);
    redCountEl.textContent = String(red);
    totalCountEl.textContent = String(black + red);
    resultBox.classList.remove("hidden");

    const playerCount = Object.values(state.players).filter(
      (player) => player.role === "player"
    ).length;

    setGameMessage(`Counted ${black + red} of ${playerCount} player choices.`);
  } catch (error) {
    console.error(error);
    setGameMessage(safeErrorMessage(error, "Failed to calculate results."), true);
  } finally {
    calculateBtn.disabled = false;
  }
}

showHostBtn.addEventListener("click", () => {
  hostForm.classList.remove("hidden");
  joinForm.classList.add("hidden");
  setStartMessage("");
});

showJoinBtn.addEventListener("click", () => {
  joinForm.classList.remove("hidden");
  hostForm.classList.add("hidden");
  setStartMessage("");
});

createRoomBtn.addEventListener("click", createRoom);
joinRoomBtn.addEventListener("click", joinRoom);

askQuestionBtn.addEventListener("click", askQuestion);
calculateBtn.addEventListener("click", calculateResults);

blackBtn.addEventListener("click", () => submitChoice("black"));
redBtn.addEventListener("click", () => submitChoice("red"));

copyRoomBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(state.roomCode);
    setGameMessage("Room code copied.");
  } catch {
    setGameMessage("Could not copy room code.", true);
  }
});

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = sanitizeRoomCode(roomCodeInput.value);
});

window.addEventListener("beforeunload", () => {
  teardownConnections();
});

showScreen("start");
renderChoiceButtons();
setStartMessage("Ready. Host creates a room code, players join with that code.");