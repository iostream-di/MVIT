console.log("manager.js loaded");

const state = {
  hotlist: {
    name: "NewHotlist",
    aircraft: []
  },
  selectedIndex: null
};

// -------------------------------
// UI EVENT BINDINGS
// -------------------------------

document.getElementById("hotlistName").addEventListener("input", e => {
  state.hotlist.name = e.target.value;
});

document.getElementById("newHotlistBtn").addEventListener("click", () => {
  state.hotlist = { name: "NewHotlist", aircraft: [] };
  state.selectedIndex = null;
  renderHotlistUI();
});

document.getElementById("addAircraftBtn").addEventListener("click", () => {
  state.hotlist.aircraft.push({
    name: "New Aircraft",
    category: "unknown",
    images: []
  });
  renderHotlistUI();
});

document.getElementById("exportHotlistBtn").addEventListener("click", exportHotlistZip);

document.getElementById("importZip").addEventListener("change", e => {
  if (e.target.files.length > 0) {
    console.log("IMPORT CLICKED");
    importHotlistZip(e.target.files[0]);
  }
});

// -------------------------------
// RENDER HOTLIST LIST
// -------------------------------

function renderHotlistUI() {
  document.getElementById("hotlistName").value = state.hotlist.name;

  const list = document.getElementById("aircraftList");
  list.innerHTML = "";

  state.hotlist.aircraft.forEach((ac, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${ac.name}</span>
      <div>
        <button onclick="editAircraft(${index})">Edit</button>
        <button onclick="deleteAircraft(${index})">Delete</button>
      </div>
    `;
    list.appendChild(li);
  });

  renderEditor();
}

function editAircraft(index) {
  state.selectedIndex = index;
  renderEditor();
}

function deleteAircraft(index) {
  state.hotlist.aircraft.splice(index, 1);
  if (state.selectedIndex === index) state.selectedIndex = null;
  renderHotlistUI();
}

// -------------------------------
// RENDER EDITOR PANEL
// -------------------------------

function renderEditor() {
  const panel = document.getElementById("editorPanel");
  const empty = document.getElementById("editorEmpty");

  if (state.selectedIndex === null) {
    panel.classList.add("hidden");
    empty.style.display = "block";
    return;
  }

  const ac = state.hotlist.aircraft[state.selectedIndex];

  panel.classList.remove("hidden");
  empty.style.display = "none";

  // Name
  const nameInput = document.getElementById("acNameInput");
  nameInput.value = ac.name;
  nameInput.oninput = e => {
    ac.name = e.target.value;
    renderHotlistUI();
  };

  // Category (TEXT FIELD)
  const catInput = document.getElementById("acCategoryInput");
  catInput.value = ac.category;
  catInput.oninput = e => {
    ac.category = e.target.value.trim();
  };

  // Images
  const imageList = document.getElementById("imageList");
  imageList.innerHTML = "";

  ac.images.forEach((img, i) => {
    const row = document.createElement("div");
    row.className = "imageRow";

    const thumb = document.createElement("img");
    thumb.src = img.url;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.onclick = () => {
      ac.images.splice(i, 1);
      renderEditor();
    };

    row.appendChild(thumb);
    row.appendChild(removeBtn);
    imageList.appendChild(row);
  });

  // Add images
  document.getElementById("imageUpload").onchange = e => {
    for (const file of e.target.files) {
      const url = URL.createObjectURL(file);
      ac.images.push({ url, filename: file.name });
    }
    renderEditor();
  };
}

// -------------------------------
// EXPORT HOTLIST ZIP
// -------------------------------

async function exportHotlistZip() {
  const zip = new JSZip();

  for (const ac of state.hotlist.aircraft) {
    const folderName = ac.name.replace(/[^a-z0-9_\-]/gi, "_");
    const acFolder = zip.folder(folderName);

    // Category filename = category
    const safeCat = ac.category.replace(/[^a-z0-9_\-]/gi, "_");
    acFolder.file(`${safeCat}.txt`, ac.category);

    // Images
    for (const img of ac.images) {
      const blob = await fetch(img.url).then(r => r.blob());
      acFolder.file(img.filename, blob);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${state.hotlist.name}.zip`);
}

// -------------------------------
// IMPORT HOTLIST ZIP
// -------------------------------

async function importHotlistZip(file) {
  console.log("IMPORT FUNCTION CALLED");

  const zip = await JSZip.loadAsync(file);
  console.log("ZIP LOADED:", Object.keys(zip.files));

  const hotlist = {
    name: file.name.replace(".zip", ""),
    aircraft: []
  };

  // STEP 1 — Extract all top-level folder names from file paths
  const aircraftFolders = new Set();

  for (const path of Object.keys(zip.files)) {
    if (path.includes("/")) {
      const folder = path.split("/")[0];
      if (folder !== "__MACOSX") {
        aircraftFolders.add(folder);
      }
    }
  }

  console.log("DETECTED AIRCRAFT FOLDERS:", aircraftFolders);

  // STEP 2 — Process each aircraft folder
  for (const folder of aircraftFolders) {
    const acFiles = Object.keys(zip.files).filter(p => p.startsWith(folder + "/"));

    // Find category file
    const categoryFile = acFiles.find(f => f.endsWith(".txt"));
    if (!categoryFile) continue;

    const category = categoryFile.split("/").pop().replace(".txt", "");

    // Load images
    const images = [];
    for (const f of acFiles) {
      const entry = zip.files[f];

      // Skip directories
      if (!entry || entry.dir) continue;

      // Skip category file
      if (f.endsWith(".txt")) continue;

      const blob = await entry.async("blob");
      const url = URL.createObjectURL(blob);

      images.push({
        url,
        filename: f.split("/").pop()
      });
    }


    hotlist.aircraft.push({
      name: folder,
      category,
      images
    });
  }

  state.hotlist = hotlist;
  state.selectedIndex = null;
  renderHotlistUI();
}


// Initial render
renderHotlistUI();
