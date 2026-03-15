const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORMSPREE_ENDPOINT";
const FORMSPREE_DASHBOARD_LINK = "https://formspree.io/forms/YOUR_FORM_ID/submissions";

const state = {
  role: null,
  hostName: "",
  playerName: "",
  roomCode: "",
  question: "",
  selectedChoice: ""
};

const startScreen = document.getElementById("startScreen");
const hostScreen = document.getElementById("hostScreen");
const playerScreen = document.getElementById("playerScreen");

const hostModeBtn = document.getElementById("hostModeBtn");
const joinModeBtn = document.getElementById("joinModeBtn");

const hostForm = document.getElementById("hostForm");
const joinForm = document.getElementById("joinForm");

const hostNameInput = document.getElementById("hostNameInput");
const playerNameInput = document.getElementById("playerNameInput");
const joinRoomCodeInput = document.getElementById("joinRoomCodeInput");
const joinQuestionInput = document.getElementById("joinQuestionInput");

const createHostSessionBtn = document.getElementById("createHostSessionBtn");
const joinSessionBtn = document.getElementById("joinSessionBtn");
const startMessage = document.getElementById("startMessage");

const hostNameLabel = document.getElementById("hostNameLabel");
const hostRoomCodeLabel = document.getElementById("hostRoomCodeLabel");
const hostQuestionInput = document.getElementById("hostQuestionInput");
const saveQuestionBtn = document.getElementById("saveQuestionBtn");
const copyHostInfoBtn = document.getElementById("copyHostInfoBtn");
const hostCurrentQuestion = document.getElementById("hostCurrentQuestion");
const hostQuestionStatus = document.getElementById("hostQuestionStatus");
const formspreeDashboardLink = document.getElementById("formspreeDashboardLink");

const playerNameLabel = document.getElementById("playerNameLabel");
const playerRoomCodeLabel = document.getElementById("playerRoomCodeLabel");
const playerQuestionText = document.getElementById("playerQuestionText");

const blackBtn = document.getElementById("blackBtn");
const redBtn = document.getElementById("redBtn");
const choiceStatus = document.getElementById("choiceStatus");

const voteForm = document.getElementById("voteForm");
const formPlayerName = document.getElementById("formPlayerName");
const formRoomCode = document.getElementById("formRoomCode");
const formQuestion = document.getElementById("formQuestion");
const formChoice = document.getElementById("formChoice");
const submitVoteBtn = document.getElementById("submitVoteBtn");
const submitStatus = document.getElementById("submitStatus");

function showMessage(text, isError = false) {
  startMessage.textContent = text;
  startMessage.style.color = isError ? "#fca5a5" : "#9ca3af";
}

function sanitizeName(name) {
  return name.trim().slice(0, 30);
}

function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function showScreen(type) {
  startScreen.classList.add("hidden");
  hostScreen.classList.add("hidden");
  playerScreen.classList.add("hidden");

  if (type === "start") startScreen.classList.remove("hidden");
  if (type === "host") hostScreen.classList.remove("hidden");
  if (type === "player") playerScreen.classList.remove("hidden");
}

function updateChoiceUI() {
  blackBtn.classList.toggle("selected", state.selectedChoice === "black");
  redBtn.classList.toggle("selected", state.selectedChoice === "red");

  if (state.selectedChoice) {
    choiceStatus.textContent = `Selected: ${state.selectedChoice.toUpperCase()}`;
  } else {
    choiceStatus.textContent = "Choose Black or Red.";
  }
}

function fillPlayerFormFields() {
  formPlayerName.value = state.playerName;
  formRoomCode.value = state.roomCode;
  formQuestion.value = state.question;
  formChoice.value = state.selectedChoice;
}

hostModeBtn.addEventListener("click", () => {
  hostForm.classList.remove("hidden");
  joinForm.classList.add("hidden");
  showMessage("");
});

joinModeBtn.addEventListener("click", () => {
  joinForm.classList.remove("hidden");
  hostForm.classList.add("hidden");
  showMessage("");
});

createHostSessionBtn.addEventListener("click", () => {
  const hostName = sanitizeName(hostNameInput.value);

  if (!hostName) {
    showMessage("Please enter host name.", true);
    return;
  }

  state.role = "host";
  state.hostName = hostName;
  state.roomCode = generateRoomCode();
  state.question = "";

  hostNameLabel.textContent = state.hostName;
  hostRoomCodeLabel.textContent = state.roomCode;
  hostCurrentQuestion.textContent = "No question set yet.";
  hostQuestionInput.value = "";
  hostQuestionStatus.textContent = "";
  formspreeDashboardLink.href = FORMSPREE_DASHBOARD_LINK;

  showScreen("host");
});

saveQuestionBtn.addEventListener("click", () => {
  const q = hostQuestionInput.value.trim();

  if (!q) {
    hostQuestionStatus.textContent = "Please enter a question.";
    return;
  }

  state.question = q;
  hostCurrentQuestion.textContent = q;
  hostQuestionStatus.textContent = "Question saved locally. Share it with players.";
});

copyHostInfoBtn.addEventListener("click", async () => {
  const text = `Room Code: ${state.roomCode}\nQuestion: ${state.question || "No question set yet"}`;

  try {
    await navigator.clipboard.writeText(text);
    hostQuestionStatus.textContent = "Copied room code and question.";
  } catch {
    hostQuestionStatus.textContent = "Could not copy automatically.";
  }
});

joinSessionBtn.addEventListener("click", () => {
  const playerName = sanitizeName(playerNameInput.value);
  const roomCode = joinRoomCodeInput.value.trim().toUpperCase();
  const question = joinQuestionInput.value.trim();

  if (!playerName) {
    showMessage("Please enter your name.", true);
    return;
  }

  if (!roomCode) {
    showMessage("Please enter room code.", true);
    return;
  }

  if (!question) {
    showMessage("Please enter the current question from the host.", true);
    return;
  }

  state.role = "player";
  state.playerName = playerName;
  state.roomCode = roomCode;
  state.question = question;
  state.selectedChoice = "";

  playerNameLabel.textContent = state.playerName;
  playerRoomCodeLabel.textContent = state.roomCode;
  playerQuestionText.textContent = state.question;
  submitStatus.textContent = "";
  updateChoiceUI();
  fillPlayerFormFields();

  showScreen("player");
});

blackBtn.addEventListener("click", () => {
  state.selectedChoice = "black";
  updateChoiceUI();
  fillPlayerFormFields();
});

redBtn.addEventListener("click", () => {
  state.selectedChoice = "red";
  updateChoiceUI();
  fillPlayerFormFields();
});

joinRoomCodeInput.addEventListener("input", () => {
  joinRoomCodeInput.value = joinRoomCodeInput.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
});

voteForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!state.selectedChoice) {
    submitStatus.textContent = "Please choose Black or Red first.";
    submitStatus.style.color = "#fca5a5";
    return;
  }

  fillPlayerFormFields();
  submitVoteBtn.disabled = true;
  submitStatus.textContent = "Submitting...";
  submitStatus.style.color = "#9ca3af";

  try {
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        role: "player",
        playerName: state.playerName,
        roomCode: state.roomCode,
        question: state.question,
        choice: state.selectedChoice
      })
    });

    if (response.ok) {
      submitStatus.textContent = "Vote submitted successfully.";
      submitStatus.style.color = "#86efac";
    } else {
      submitStatus.textContent = "Submission failed.";
      submitStatus.style.color = "#fca5a5";
    }
  } catch (error) {
    submitStatus.textContent = "Network error. Please try again.";
    submitStatus.style.color = "#fca5a5";
  } finally {
    submitVoteBtn.disabled = false;
  }
});

showScreen("start");