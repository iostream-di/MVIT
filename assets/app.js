const state = {
  aircraftList: [],
  categoryMap: {},
  quizItems: [],
  index: 0,
  score: 0,
  history: [],
  numChoices: 4,
  timePerQuestion: 4,
  timerSeconds: 0,
  timerInterval: null,
  lastChoice: null
};

const zipInput = document.getElementById("zipInput");
const startBtn = document.getElementById("startBtn");
const loadStatus = document.getElementById("loadStatus");
const numChoicesSelect = document.getElementById("numChoices");
const timePerQuestionSelect = document.getElementById("timePerQuestion");

const setupSection = document.getElementById("setupSection");
const quizSection = document.getElementById("quizSection");
const summarySection = document.getElementById("summarySection");

const progressText = document.getElementById("progressText");
const timerEl = document.getElementById("timer");
const scoreText = document.getElementById("scoreText");
const aircraftImage = document.getElementById("aircraftImage");
const choicesContainer = document.getElementById("choices");

const finalScoreEl = document.getElementById("finalScore");
const summaryList = document.getElementById("summaryList");
const restartBtn = document.getElementById("restartBtn");

let previewIndex = 0;
let previewAircraft = null;


zipInput.addEventListener("change", handleZipSelection);
startBtn.addEventListener("click", startQuiz);
restartBtn.addEventListener("click", restartApp);

function populateCategorySelector() {
  const container = document.getElementById("categoryCheckboxes");
  const wrapper = document.getElementById("categorySelector");

  container.innerHTML = "";

  const categories = Object.keys(state.categoryMap).sort();

  categories.forEach(cat => {
    const div = document.createElement("label");
    div.className = "categoryCheck";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = cat;
    cb.checked = true; // all selected by default

    div.appendChild(cb);
    div.appendChild(document.createTextNode(formatChoiceText(cat)));

    container.appendChild(div);
  });

  wrapper.classList.remove("hidden");
}

function updatePreviewImage() {
  if (!previewAircraft || previewAircraft.images.length === 0) return;

  const img = document.getElementById("previewImage");
  img.src = previewAircraft.images[previewIndex];

  document.getElementById("previewCounter").textContent =
    `Image ${previewIndex + 1} of ${previewAircraft.images.length}`;
}


function handleZipSelection(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) {
    startBtn.disabled = true;
    loadStatus.textContent = "No files selected.";
    return;
  }

  resetData();
  loadStatus.textContent = "Loading hotlists...";
  startBtn.disabled = true;

  parseZipFiles(files).then(() => {
    if (state.aircraftList.length === 0) {
        loadStatus.textContent = "No aircraft found in selected ZIPs.";
        startBtn.disabled = true;
    } else {
        loadStatus.textContent = `Loaded ${state.aircraftList.length} aircraft.`;
        populateCategorySelector();

        startBtn.disabled = false;
    }
  }).catch(err => {
    console.error(err);
    loadStatus.textContent = "Error loading hotlists.";
    startBtn.disabled = true;
  });
}

function populatePreviewDropdown(hotlist) {
    const sel = document.getElementById("previewAircraftSelect");
    sel.innerHTML = "";

    hotlist.forEach(ac => {
        const opt = document.createElement("option");
        opt.value = ac.name;
        opt.textContent = ac.name;
        sel.appendChild(opt);
    });

    if (hotlist.length > 0) {
        sel.value = hotlist[0].name;
        renderPreviewAircraft(hotlist[0]);
    }
}

function renderPreviewAircraft(ac) {
  previewAircraft = ac;
  previewIndex = 0;

  document.getElementById("previewCategory").textContent =
    "Category: " + ac.category.toUpperCase();

  updatePreviewImage();
}



async function parseZipFiles(files) {
  const aircraftMap = {};

  for (const file of files) {
    const data = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(data);

    const entries = Object.keys(zip.files);
    for (const path of entries) {
      const entry = zip.files[path];
      if (entry.dir) continue;

      const parts = path.split("/");
      if (parts.length < 2) continue;

      const aircraftName = parts[0].trim();
      const filename = parts[1].trim();

      if (!aircraftMap[aircraftName]) {
        aircraftMap[aircraftName] = {
          name: aircraftName,
          category: null,
          images: []
        };
      }

      if (filename.toLowerCase().endsWith(".txt")) {
        const catName = filename.replace(/\.txt$/i, "").trim();
        aircraftMap[aircraftName].category = catName;
      } else {
        const blob = await entry.async("blob");
        const url = URL.createObjectURL(blob);
        aircraftMap[aircraftName].images.push(url);
      }
    }
  }

  // Build final list
  state.aircraftList = Object.values(aircraftMap).filter(a => a.images.length > 0);

  // Existing quiz logic
  buildCategoryMap();
  buildImagePools();
  populateCategorySelector();

  // -----------------------------------------
  // NEW: Populate preview dropdown
  // -----------------------------------------
  populatePreviewDropdown(state.aircraftList);

  // -----------------------------------------
  // NEW: Attach preview selector listener
  // -----------------------------------------
  document.getElementById("previewPrev").addEventListener("click", () => {
    if (!previewAircraft) return;
    previewIndex = (previewIndex - 1 + previewAircraft.images.length) % previewAircraft.images.length;
    updatePreviewImage();
  });

  document.getElementById("previewNext").addEventListener("click", () => {
    if (!previewAircraft) return;
    previewIndex = (previewIndex + 1) % previewAircraft.images.length;
    updatePreviewImage();
  });

  document.getElementById("previewAircraftSelect").addEventListener("change", e => {
    const name = e.target.value;
    const ac = state.aircraftList.find(a => a.name === name);
    if (ac) renderPreviewAircraft(ac);
  });


  // Auto‑select first aircraft for preview
  if (state.aircraftList.length > 0) {
    renderPreviewAircraft(state.aircraftList[0]);
  }

  // Fullscreen modal elements
  const fullscreenModal = document.getElementById("fullscreenModal");
  const fullscreenImage = document.getElementById("fullscreenImage");
  const fullscreenBackdrop = document.getElementById("fullscreenBackdrop");

  // Open fullscreen when clicking preview image
  document.getElementById("previewImage").addEventListener("click", () => {
    if (!previewAircraft) return;
    fullscreenImage.src = previewAircraft.images[previewIndex];
    fullscreenModal.classList.remove("hidden");
  });

  // Close fullscreen when clicking backdrop or image
  fullscreenBackdrop.addEventListener("click", () => {
    fullscreenModal.classList.add("hidden");
  });

  fullscreenImage.addEventListener("click", () => {
    fullscreenModal.classList.add("hidden");
  });

}


function formatChoiceText(name) {
  return name.replace(/_/g, " ").toUpperCase();
}


function buildCategoryMap() {
  state.categoryMap = {};
  for (const a of state.aircraftList) {
    const cat = a.category || "uncategorized";
    if (!state.categoryMap[cat]) state.categoryMap[cat] = [];
    state.categoryMap[cat].push(a);
  }
}

function buildImagePools() {
  state.imagePools = {};

  for (const a of state.aircraftList) {
    state.imagePools[a.name] = shuffle(a.images.slice());
  }
}


function startQuiz() {
  state.numChoices = parseInt(numChoicesSelect.value, 10);
  state.timePerQuestion = parseInt(timePerQuestionSelect.value, 10);

  state.selectedCategories = Array.from(
    document.querySelectorAll("#categoryCheckboxes input[type='checkbox']:checked")
    ).map(cb => cb.value);

  state.numQuestions = parseInt(document.getElementById("numQuestions").value, 10);

  buildQuizItems();

  state.index = 0;
  state.score = 0;
  state.history = [];

  setupSection.classList.add("hidden");
  summarySection.classList.add("hidden");
  quizSection.classList.remove("hidden");

  renderQuestion(state.quizItems[state.index]);
}

function buildQuizItems() {
  // Filter by selected categories
  const filtered = state.aircraftList.filter(a =>
    state.selectedCategories.includes(a.category)
  );

  if (filtered.length === 0) {
    alert("No aircraft available in the selected categories.");
    return;
  }

  // Shuffle aircraft for the first cycle
  let aircraftCycle = shuffle(filtered.slice());

  const quizItems = [];

  // Keep generating until we reach the requested number of questions
  while (quizItems.length < state.numQuestions) {

    // If we exhausted the current cycle, reshuffle for the next pass
    if (aircraftCycle.length === 0) {
      aircraftCycle = shuffle(filtered.slice());
    }

    const aircraft = aircraftCycle.pop();

    const q = buildQuestion(aircraft, state.numChoices);
    if (q) quizItems.push(q);
  }

  state.quizItems = quizItems;
}


function buildQuestion(aircraft, numChoices) {
  const cat = aircraft.category || "uncategorized";
  const sameCategory = state.categoryMap[cat] || [];
  if (sameCategory.length < numChoices) {
    return null;
  }

  const distractors = sameCategory.filter(a => a.name !== aircraft.name);
  if (distractors.length < numChoices - 1) {
    return null;
  }

  const selected = shuffle(distractors).slice(0, numChoices - 1);
  const choices = shuffle([
    aircraft.name,
    ...selected.map(a => a.name)
  ]);

  return {
    aircraftName: aircraft.name,
    imageUrl: getNextImage(aircraft.name),
    choices
  };
}

function getNextImage(aircraftName) {
  let pool = state.imagePools[aircraftName];

  if (!pool || pool.length === 0) {
    // Refill pool
    const aircraft = state.aircraftList.find(a => a.name === aircraftName);
    pool = shuffle(aircraft.images.slice());
    state.imagePools[aircraftName] = pool;
  }

  return pool.pop(); // Use last image
}


function renderQuestion(question) {
  clearTimer();

  state.lastChoice = null;
  state.timerSeconds = state.timePerQuestion;

  progressText.textContent = `Question ${state.index + 1} / ${state.quizItems.length}`;
  scoreText.textContent = `Score: ${state.score}`;
  timerEl.textContent = `${state.timerSeconds}s`;

  const img = document.getElementById("aircraftImage");
  // Set up onload BEFORE changing src
  img.onload = () => {
    img.classList.remove("fade-out");  // reset only after new image is ready
    state.imageFaded = false;
  };
  aircraftImage.src = question.imageUrl;

  renderChoices(question.choices);

  state.timerInterval = setInterval(() => {
    state.timerSeconds--;

    // Fade-out at halfway point
    if (!state.imageFaded && state.timerSeconds <= state.timePerQuestion / 2) {
      const img = document.getElementById("aircraftImage");
      img.classList.add("fade-out");
      state.imageFaded = true;
    }


    if (state.timerSeconds <= 0) {
      timerEl.textContent = "0s";
      clearTimer();
      finalizeAnswer();
    } else {
      timerEl.textContent = `${state.timerSeconds}s`;
    }
  }, 1000);
}

function renderChoices(choices) {
  choicesContainer.innerHTML = "";
  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "choiceBtn";
    btn.textContent = formatChoiceText(choice);
    btn.onclick = () => handleChoiceClick(choice);
    choicesContainer.appendChild(btn);
  });
}

function handleChoiceClick(choice) {
  state.lastChoice = choice;
  highlightSelected(choice);
}

function highlightSelected(choice) {
  const buttons = choicesContainer.querySelectorAll(".choiceBtn");
  buttons.forEach(btn => {
    if (btn.textContent === formatChoiceText(choice)) {

      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
  });
}

function finalizeAnswer() {
  const question = state.quizItems[state.index];
  const correct = question.aircraftName;
  const user = state.lastChoice;

  const isCorrect = (user === correct);
  if (isCorrect) state.score++;

  state.history.push({
    imageUrl: question.imageUrl,
    correct,
    user: user || "No answer"
  });

  setTimeout(() => {
    nextQuestion();
  }, 300);
}

function nextQuestion() {
  state.index++;
  if (state.index >= state.quizItems.length) {
    showSummary();
  } else {
    renderQuestion(state.quizItems[state.index]);
  }
}

function showSummary() {
  clearTimer();
  quizSection.classList.add("hidden");
  summarySection.classList.remove("hidden");

  finalScoreEl.textContent = `Final score: ${state.score} / ${state.quizItems.length}`;

  summaryList.innerHTML = "";
  const wrong = state.history.filter(h => h.user !== h.correct);

  if (!wrong.length) {
    const div = document.createElement("div");
    div.textContent = "All correct. Nice work.";
    summaryList.appendChild(div);
    return;
  }

  wrong.forEach(item => {
    const div = document.createElement("div");
    div.className = "summaryItem";
    div.innerHTML = `
      <img src="${item.imageUrl}">
      <div class="summaryText">
        <div><strong>Your answer:</strong> ${formatChoiceText(item.user)}</div>
        <div><strong>Correct:</strong> ${formatChoiceText(item.correct)}</div>
      </div>
    `;
    summaryList.appendChild(div);
  });
}

function restartApp() {
  clearTimer();
  setupSection.classList.remove("hidden");
  quizSection.classList.add("hidden");
  summarySection.classList.add("hidden");
  scoreText.textContent = "";
  progressText.textContent = "";
  timerEl.textContent = "";
}

function clearTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function resetData() {
  clearTimer();
  state.aircraftList = [];
  state.categoryMap = {};
  state.quizItems = [];
  state.index = 0;
  state.score = 0;
  state.history = [];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
