// =============== FIREBASE INIT ===============
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "YOUR_PROJECT_ID",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// =============== STATE ===============
let currentGameCode = null;
let currentPlayerName = null;
let isHost = false;
let currentGameData = null;

// =============== DOM ===============
const hostNameInput = document.getElementById("hostNameInput");
const createGameBtn = document.getElementById("createGameBtn");
const createdGameCodeP = document.getElementById("createdGameCode");

const joinGameCodeInput = document.getElementById("joinGameCodeInput");
const joinPlayerNameInput = document.getElementById("joinPlayerNameInput");
const joinGameBtn = document.getElementById("joinGameBtn");
const joinStatusP = document.getElementById("joinStatus");

const currentGameInfoP = document.getElementById("currentGameInfo");
const hostHintP = document.getElementById("hostHint");

const playersList = document.getElementById("playersList");
const rolesCard = document.getElementById("rolesCard");
const mafiaCountInput = document.getElementById("mafiaCount");
const doctorCountInput = document.getElementById("doctorCount");
const detectiveCountInput = document.getElementById("detectiveCount");
const assignRolesBtn = document.getElementById("assignRolesBtn");
const errorMsg = document.getElementById("errorMsg");

const assignmentsCard = document.getElementById("assignmentsCard");
const assignmentsTableBody = document.getElementById("assignmentsTableBody");

const gameEngine = document.getElementById("gameEngine");
const phaseLabel = document.getElementById("phaseLabel");
const nightPanel = document.getElementById("nightPanel");
const dayPanel = document.getElementById("dayPanel");
const hostKillSelect = document.getElementById("hostKillSelect");
const hostKillBtn = document.getElementById("hostKillBtn");
const startGameBtn = document.getElementById("startGameBtn");
const nextPhaseBtn = document.getElementById("nextPhaseBtn");
const logArea = document.getElementById("logArea");

const roleModal = document.getElementById("roleModal");
const modalPlayerName = document.getElementById("modalPlayerName");
const modalRoleName = document.getElementById("modalRoleName");
const closeModal = document.getElementById("closeModal");
const modalOkBtn = document.getElementById("modalOkBtn");

// =============== HELPERS ===============
function generateGameCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function gameRef(code) {
  return db.ref("games/" + code);
}

function addLog(message, type = "system") {
  if (!currentGameCode) return;
  const entryRef = gameRef(currentGameCode).child("log").push();
  entryRef.set({
    message,
    type,
    ts: Date.now()
  });
}

// =============== UI UPDATE ===============
function updateUIFromGameData() {
  if (!currentGameCode || !currentGameData) {
    currentGameInfoP.textContent = "Δεν είσαι συνδεδεμένος σε παιχνίδι.";
    playersList.innerHTML = "";
    assignmentsCard.style.display = "none";
    return;
  }

  currentGameInfoP.textContent =
    `Game Code: ${currentGameCode} | Φάση: ${currentGameData.phase || "lobby"}`;
  hostHintP.textContent = isHost
    ? "Είσαι Host αυτού του παιχνιδιού."
    : "Είσαι απλός παίκτης.";

  // players
  const players = currentGameData.players ? Object.keys(currentGameData.players) : [];
  playersList.innerHTML = "";
  players.forEach((name) => {
    const data = currentGameData.players[name];
    const li = document.createElement("li");
    li.textContent = name;
    if (data && data.alive === false) {
      li.classList.add("dead-row");
    }
    playersList.appendChild(li);
  });

  // show role config only for host & while phase = lobby
  rolesCard.style.display = isHost ? "block" : "none";

  // show assignments card if έχουμε players
  assignmentsCard.style.display = players.length ? "block" : "none";
  gameEngine.style.display = players.length ? "block" : "none";

  renderAssignmentsTable();
  updatePhaseUI();
  renderLog();
}

function renderAssignmentsTable() {
  assignmentsTableBody.innerHTML = "";
  if (!currentGameData || !currentGameData.players) return;

  const players = Object.keys(currentGameData.players);
  players.forEach((name) => {
    const pData = currentGameData.players[name];
    const tr = document.createElement("tr");
    if (pData.alive === false) tr.classList.add("dead-row");

    const tdName = document.createElement("td");
    tdName.textContent = name;

    const tdStatus = document.createElement("td");
    tdStatus.textContent = pData.alive === false ? "Νεκρός" : "Ζωντανός";

    const tdRole = document.createElement("td");
    let roleText = "";
    const assignments = currentGameData.assignments || {};
    if (name === currentPlayerName && assignments[name]) {
      roleText = assignments[name] + " (δικός σου ρόλος)";
    } else if (isHost && assignments[name]) {
      // Ο Host βλέπει όλους
      roleText = assignments[name];
    } else {
      roleText = "-";
    }
    tdRole.textContent = roleText;

    tr.appendChild(tdName);
    tr.appendChild(tdStatus);
    tr.appendChild(tdRole);
    assignmentsTableBody.appendChild(tr);
  });
}

function updatePhaseUI() {
  const phase = currentGameData ? currentGameData.phase : "lobby";
  phaseLabel.textContent = "Φάση: " + phase;

  nightPanel.style.display = phase === "night" ? "block" : "none";
  dayPanel.style.display = phase === "day" ? "block" : "none";

  // Host μόνο μπορεί να ελέγχει τα κουμπιά
  startGameBtn.disabled = !isHost || phase !== "lobby";
  nextPhaseBtn.disabled = !isHost || (phase !== "night" && phase !== "day");

  // γέμισε select για kill
  hostKillSelect.innerHTML = "";
  if (isHost && currentGameData && currentGameData.players) {
    const players = Object.keys(currentGameData.players);
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "-- κανένας --";
    hostKillSelect.appendChild(opt0);

    players.forEach((name) => {
      const pData = currentGameData.players[name];
      if (pData.alive === false) return;
      const o = document.createElement("option");
      o.value = name;
      o.textContent = name;
      hostKillSelect.appendChild(o);
    });
  }
}

function renderLog() {
  logArea.innerHTML = "";
  if (!currentGameData || !currentGameData.log) return;

  const entries = Object.values(currentGameData.log).sort((a, b) => a.ts - b.ts);
  entries.forEach((entry) => {
    const div = document.createElement("div");
    div.className = "log-entry " + (entry.type || "system");
    div.textContent = entry.message;
    logArea.appendChild(div);
  });
  logArea.scrollTop = logArea.scrollHeight;
}

// =============== CREATE / JOIN ===============
createGameBtn.addEventListener("click", async () => {
  const hostName = hostNameInput.value.trim();
  if (!hostName) {
    alert("Βάλε όνομα Host.");
    return;
  }

  const code = generateGameCode();
  const ref = gameRef(code);

  await ref.set({
    createdAt: Date.now(),
    phase: "lobby",
    players: {
      [hostName]: { alive: true }
    },
    assignments: {}
  });

  currentGameCode = code;
  currentPlayerName = hostName;
  isHost = true;

  createdGameCodeP.textContent = "Game Code: " + code;
  joinStatusP.textContent = "";
  attachGameListener();
  addLog(`Ο Host ${hostName} δημιούργησε το παιχνίδι.`, "system");
});

joinGameBtn.addEventListener("click", async () => {
  const code = joinGameCodeInput.value.trim().toUpperCase();
  const name = joinPlayerNameInput.value.trim();
  if (!code || !name) {
    joinStatusP.textContent = "Πρέπει να συμπληρώσεις Game Code και όνομα.";
    return;
  }

  const ref = gameRef(code);
  const snapshot = await ref.get();
  if (!snapshot.exists()) {
    joinStatusP.textContent = "Το παιχνίδι με αυτό το code δεν υπάρχει.";
    return;
  }

  // προσθήκη παίκτη
  await ref.child("players").child(name).set({ alive: true });

  currentGameCode = code;
  currentPlayerName = name;
  isHost = false;
  joinStatusP.textContent = "Μπήκες στο παιχνίδι!";
  attachGameListener();
  addLog(`Ο παίκτης ${name} μπήκε στο παιχνίδι.`, "system");
});

// =============== LISTENER ΣΤΟ GAME ===============
let gameListenerAttached = false;
function attachGameListener() {
  if (!currentGameCode || gameListenerAttached) return;
  gameListenerAttached = true;

  gameRef(currentGameCode).on("value", (snapshot) => {
    currentGameData = snapshot.val() || null;
    updateUIFromGameData();

    // Αν έχουν μοιραστεί ρόλοι, και έχω τον δικό μου, δείξ' τον σε modal (μια φορά)
    if (currentGameData && currentGameData.assignments) {
      const myRole = currentGameData.assignments[currentPlayerName];
      if (myRole && !localStorage.getItem("roleShown_" + currentGameCode + "_" + currentPlayerName)) {
        showRoleModal(currentPlayerName, myRole);
        localStorage.setItem(
          "roleShown_" + currentGameCode + "_" + currentPlayerName,
          "1"
        );
      }
    }
  });
}

// =============== ROLE ASSIGNMENT (HOST) ===============
assignRolesBtn.addEventListener("click", async () => {
  if (!isHost || !currentGameCode || !currentGameData) return;

  const players = currentGameData.players ? Object.keys(currentGameData.players) : [];
  if (!players.length) {
    errorMsg.textContent = "Δεν υπάρχουν παίκτες.";
    return;
  }

  const mafiaCount = parseInt(mafiaCountInput.value, 10) || 0;
  const doctorCount = parseInt(doctorCountInput.value, 10) || 0;
  const detectiveCount = parseInt(detectiveCountInput.value, 10) || 0;
  const totalSpecial = mafiaCount + doctorCount + detectiveCount;

  if (totalSpecial > players.length) {
    errorMsg.textContent = "Περισσότεροι ειδικοί ρόλοι από παίκτες.";
    return;
  }
  if (mafiaCount < 1) {
    errorMsg.textContent = "Χρειάζεται τουλάχιστον 1 Μαφία.";
    return;
  }
  errorMsg.textContent = "";

  const roles = [];
  for (let i = 0; i < mafiaCount; i++) roles.push("Μαφία");
  for (let i = 0; i < doctorCount; i++) roles.push("Γιατρός");
  for (let i = 0; i < detectiveCount; i++) roles.push("Ντετέκτιβ");
  const remaining = players.length - roles.length;
  for (let i = 0; i < remaining; i++) roles.push("Πολίτης");

  // shuffle
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  const assignments = {};
  players.forEach((name, idx) => (assignments[name] = roles[idx]));

  await gameRef(currentGameCode).child("assignments").set(assignments);
  addLog("Οι ρόλοι μοιράστηκαν.", "system");
});

// =============== START GAME + PHASE CHANGE (HOST) ===============
startGameBtn.addEventListener("click", async () => {
  if (!isHost || !currentGameCode || !currentGameData) return;

  if (!currentGameData.assignments || !Object.keys(currentGameData.assignments).length) {
    alert("Μοίρασε πρώτα ρόλους.");
    return;
  }

  await gameRef(currentGameCode).child("phase").set("night");
  addLog("Το παιχνίδι ξεκινά. Πέφτει η νύχτα...", "system");
});

nextPhaseBtn.addEventListener("click", async () => {
  if (!isHost || !currentGameCode || !currentGameData) return;
  const phase = currentGameData.phase || "lobby";

  if (phase === "night") {
    await gameRef(currentGameCode).child("phase").set("day");
    addLog("Ξημέρωσε. Οι παίκτες συζητούν και ψηφίζουν.", "system");
  } else if (phase === "day") {
    await gameRef(currentGameCode).child("phase").set("night");
    addLog("Πέφτει ξανά η νύχτα...", "system");
  }
});

// =============== HOST KILL (για απλό management) ===============
hostKillBtn.addEventListener("click", async () => {
  if (!isHost || !currentGameCode || !currentGameData) return;
  const targetName = hostKillSelect.value;
  if (!targetName) return;

  const playerPath = gameRef(currentGameCode).child("players").child(targetName);
  await playerPath.update({ alive: false });
  addLog(`Ο/Η ${targetName} πέθανε.`, "dead");
});

// =============== MODAL ΡΟΛΟΥ (για κάθε παίκτη) ===============
function showRoleModal(name, role) {
  modalPlayerName.textContent = name;
  modalRoleName.textContent = role;
  roleModal.style.display = "flex";
}

function closeRoleModal() {
  roleModal.style.display = "none";
}
closeModal.addEventListener("click", closeRoleModal);
modalOkBtn.addEventListener("click", closeRoleModal);
roleModal.addEventListener("click", (e) => {
  if (e.target === roleModal) closeRoleModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && roleModal.style.display === "flex") closeRoleModal();
});

