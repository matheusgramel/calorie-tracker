const STORAGE_KEY = "calorie-tracker-v1";
const ACCESS_TOKEN_KEY = "calorie-tracker-access-token";
const API_ENABLED = window.location.protocol !== "file:";

const defaultIngredients = [
  { id: makeId(), name: "Chicken breast", serving: 100, unit: "g", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: makeId(), name: "White rice, cooked", serving: 100, unit: "g", calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: makeId(), name: "Olive oil", serving: 15, unit: "ml", calories: 119, protein: 0, carbs: 0, fat: 13.5 },
  { id: makeId(), name: "Broccoli", serving: 100, unit: "g", calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4 }
];

let state = loadLocalState();
let builderItems = [];
let activeDate = toDateInput(new Date());
let editingMeal = null;
let editingBuilderItemId = null;
let saveTimer = null;

const els = {
  activeDate: document.querySelector("#active-date"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  consumedDayMacros: document.querySelector("#consumed-day-macros"),
  plannedDayMacros: document.querySelector("#planned-day-macros"),
  consumedMacros: document.querySelector("#consumed-macros"),
  mealMacros: document.querySelector("#meal-macros"),
  syncPanel: document.querySelector("#sync-panel"),
  syncStatus: document.querySelector("#sync-status"),
  syncDetail: document.querySelector("#sync-detail"),
  syncNow: document.querySelector("#sync-now"),
  resetAccessCode: document.querySelector("#reset-access-code"),
  exportBackup: document.querySelector("#export-backup"),
  importBackup: document.querySelector("#import-backup"),
  uploadLocal: document.querySelector("#upload-local"),
  consumedSummaryTitle: document.querySelector("#consumed-summary-title"),
  consumedSummaryStatus: document.querySelector("#consumed-summary-status"),
  plannedSummaryTitle: document.querySelector("#planned-summary-title"),
  plannedSummaryStatus: document.querySelector("#planned-summary-status"),
  ingredientSearch: document.querySelector("#ingredient-search"),
  ingredientOptions: document.querySelector("#ingredient-options"),
  ingredientSelect: document.querySelector("#ingredient-select"),
  ingredientPicker: document.querySelector("#ingredient-picker"),
  ingredientAmount: document.querySelector("#ingredient-amount"),
  ingredientSubmit: document.querySelector("#ingredient-submit"),
  builderList: document.querySelector("#builder-list"),
  builderEmpty: document.querySelector("#builder-empty"),
  mealName: document.querySelector("#meal-name"),
  editBanner: document.querySelector("#edit-banner"),
  editBannerText: document.querySelector("#edit-banner-text"),
  cancelEdit: document.querySelector("#cancel-edit"),
  mealTotalTitle: document.querySelector("#meal-total-title"),
  savePlanned: document.querySelector("#save-planned"),
  saveConsumed: document.querySelector("#save-consumed"),
  clearBuilder: document.querySelector("#clear-builder"),
  customMealForm: document.querySelector("#custom-meal-form"),
  customName: document.querySelector("#custom-name"),
  customCalories: document.querySelector("#custom-calories"),
  customProtein: document.querySelector("#custom-protein"),
  customCarbs: document.querySelector("#custom-carbs"),
  customFat: document.querySelector("#custom-fat"),
  customPlanned: document.querySelector("#custom-planned"),
  customConsumed: document.querySelector("#custom-consumed"),
  plannedMeals: document.querySelector("#planned-meals"),
  consumedMeals: document.querySelector("#consumed-meals"),
  historyList: document.querySelector("#history-list"),
  ingredientForm: document.querySelector("#ingredient-form"),
  ingredientList: document.querySelector("#ingredient-list")
};

els.activeDate.value = activeDate;

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((item) => item.classList.toggle("active", item === tab));
    els.views.forEach((view) => view.classList.toggle("active", view.id === `${tab.dataset.view}-view`));
  });
});

els.activeDate.addEventListener("change", () => {
  activeDate = els.activeDate.value || toDateInput(new Date());
  cancelEditMode();
  render();
});

els.ingredientForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const ingredient = {
    id: makeId(),
    name: valueOf("#new-name"),
    serving: numberValue("#new-serving"),
    unit: valueOf("#new-unit"),
    calories: numberValue("#new-calories"),
    protein: numberValue("#new-protein"),
    carbs: numberValue("#new-carbs"),
    fat: numberValue("#new-fat")
  };
  state.ingredients.push(ingredient);
  event.target.reset();
  document.querySelector("#new-serving").value = 100;
  document.querySelector("#new-unit").value = "g";
  saveState();
  render();
});

els.ingredientPicker.addEventListener("submit", (event) => {
  event.preventDefault();
  const ingredient = getSelectedIngredient();
  const amount = Number(els.ingredientAmount.value);
  if (!ingredient || amount <= 0) return;
  if (editingBuilderItemId) {
    builderItems = builderItems.map((item) => {
      if (item.id !== editingBuilderItemId) return item;
      return { ...item, ingredientId: ingredient.id, amount };
    });
    editingBuilderItemId = null;
  } else {
    builderItems.push({ id: makeId(), ingredientId: ingredient.id, amount });
  }
  els.ingredientAmount.value = "";
  els.ingredientSearch.value = "";
  renderBuilder();
});

els.ingredientSearch.addEventListener("change", syncIngredientSelectFromSearch);
els.ingredientSearch.addEventListener("input", syncIngredientSelectFromSearch);
els.ingredientSelect.addEventListener("change", () => {
  const ingredient = state.ingredients.find((item) => item.id === els.ingredientSelect.value);
  els.ingredientSearch.value = ingredient ? ingredient.name : "";
});

els.clearBuilder.addEventListener("click", () => {
  clearBuilder();
  clearCustomMeal();
  cancelEditMode();
});
els.cancelEdit.addEventListener("click", cancelEditMode);
els.savePlanned.addEventListener("click", () => saveMeal("planned"));
els.saveConsumed.addEventListener("click", () => saveMeal("consumed"));
els.customMealForm.addEventListener("submit", (event) => event.preventDefault());
els.customPlanned.addEventListener("click", () => saveCustomMeal("planned"));
els.customConsumed.addEventListener("click", () => saveCustomMeal("consumed"));
els.syncNow.addEventListener("click", () => loadRemoteState({ forcePrompt: false }));
els.resetAccessCode.addEventListener("click", () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  setSyncStatus("pending", "Access code cleared", "Click Sync now and enter the code again.");
});
els.exportBackup.addEventListener("click", exportBackup);
els.importBackup.addEventListener("change", importBackup);
els.uploadLocal.addEventListener("click", uploadLocalState);

function loadLocalState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return { ingredients: defaultIngredients, days: {} };
  try {
    return normalizeState(JSON.parse(stored));
  } catch {
    return { ingredients: defaultIngredients, days: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueRemoteSave();
}

function normalizeState(nextState) {
  return {
    ingredients: nextState?.ingredients?.length ? nextState.ingredients : defaultIngredients,
    days: nextState?.days || {}
  };
}

async function loadRemoteState() {
  if (!API_ENABLED) {
    setSyncStatus("local", "Local file mode", "Open the Vercel URL on every device to sync.");
    return;
  }
  setSyncStatus("pending", "Cloud sync checking...", "Loading server data");
  try {
    const response = await fetchWithAccessCode("/api/state");
    if (!response.ok) throw new Error(await getResponseError(response, "load"));
    const remoteState = normalizeState(await response.json());
    const localState = loadLocalState();
    if (isStateEmpty(remoteState) && hasTrackedData(localState)) {
      state = localState;
      setSyncStatus("error", "Cloud data is empty", "This device has data. Click Upload this device to make it the shared cloud data.");
      render();
      return;
    }
    state = remoteState;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSyncStatus("ok", "Cloud sync connected", "Loaded shared data from the server.");
    render();
  } catch (error) {
    setSyncStatus("error", "Cloud sync failed", error.message);
    console.warn("Using local browser data because server sync failed.", error);
  }
}

function queueRemoteSave() {
  if (!API_ENABLED) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      setSyncStatus("pending", "Cloud sync saving...", "Uploading this device's latest changes.");
      const response = await fetchWithAccessCode("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state)
      });
      if (!response.ok) throw new Error(await getResponseError(response, "save"));
      setSyncStatus("ok", "Cloud sync saved", "This device's changes were saved to the server.");
    } catch (error) {
      setSyncStatus("error", "Cloud sync failed", error.message);
      console.warn("Server sync failed. Changes remain saved in this browser.", error);
    }
  }, 250);
}

async function fetchWithAccessCode(url, options = {}) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const headers = { ...(options.headers || {}) };
  if (token) headers["x-access-code"] = token;
  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    const nextToken = window.prompt("Enter the app access code");
    if (!nextToken) {
      setSyncStatus("error", "Access code needed", "Sync cannot start until you enter the app access code.");
      return response;
    }
    localStorage.setItem(ACCESS_TOKEN_KEY, nextToken);
    response = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), "x-access-code": nextToken }
    });
  }

  return response;
}

async function uploadLocalState() {
  if (!API_ENABLED) {
    setSyncStatus("local", "Local file mode", "Open the Vercel URL before uploading.");
    return;
  }

  const confirmed = window.confirm("Upload this device's current data to the cloud? This replaces the shared cloud data.");
  if (!confirmed) return;

  try {
    setSyncStatus("pending", "Cloud sync saving...", "Uploading this device's current data.");
    const response = await fetchWithAccessCode("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state)
    });
    if (!response.ok) throw new Error(await getResponseError(response, "upload"));
    setSyncStatus("ok", "Cloud sync saved", "This device is now the shared cloud data.");
  } catch (error) {
    setSyncStatus("error", "Cloud sync failed", error.message);
  }
}

function exportBackup() {
  const backup = {
    exportedAt: new Date().toISOString(),
    app: "calorie-tracker",
    state
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `calorie-tracker-backup-${toDateInput(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setSyncStatus("ok", "Backup exported", "Use Import backup on the Vercel app, then Upload this device.");
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedState = normalizeState(parsed.state || parsed);
    if (!hasTrackedData(importedState)) {
      throw new Error("This backup does not contain tracked meals or custom ingredients.");
    }

    const confirmed = window.confirm("Import this backup onto this device? You can upload it to cloud after import.");
    if (!confirmed) return;

    state = importedState;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
    setSyncStatus("ok", "Backup imported", "Review the data, then click Upload this device to make it cloud data.");
  } catch (error) {
    setSyncStatus("error", "Import failed", error.message);
  }
}

function isStateEmpty(nextState) {
  return !hasTrackedData(nextState);
}

function hasTrackedData(nextState) {
  const hasMeals = Object.values(nextState.days || {}).some((day) => {
    return (day.planned || []).length > 0 || (day.consumed || []).length > 0;
  });
  if (hasMeals) return true;

  const ingredientNames = (nextState.ingredients || []).map((ingredient) => ingredient.name).sort().join("|");
  const defaultNames = defaultIngredients.map((ingredient) => ingredient.name).sort().join("|");
  return ingredientNames !== defaultNames;
}

async function getResponseError(response, action) {
  try {
    const payload = await response.json();
    return payload.detail || payload.error || `${action} failed with status ${response.status}`;
  } catch {
    return `${action} failed with status ${response.status}`;
  }
}

function setSyncStatus(kind, status, detail) {
  els.syncPanel.classList.toggle("sync-ok", kind === "ok");
  els.syncPanel.classList.toggle("sync-error", kind === "error");
  els.syncStatus.textContent = status;
  els.syncDetail.textContent = detail;
}

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toDateInput(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function valueOf(selector) {
  return document.querySelector(selector).value.trim();
}

function numberValue(selector) {
  return Number(document.querySelector(selector).value);
}

function ensureDay(date) {
  if (!state.days[date]) state.days[date] = { planned: [], consumed: [] };
  return state.days[date];
}

function calculateItems(items) {
  return items.reduce((totals, item) => {
    const ingredient = state.ingredients.find((entry) => entry.id === item.ingredientId);
    if (!ingredient) return totals;
    const multiplier = item.amount / ingredient.serving;
    totals.calories += ingredient.calories * multiplier;
    totals.protein += ingredient.protein * multiplier;
    totals.carbs += ingredient.carbs * multiplier;
    totals.fat += ingredient.fat * multiplier;
    return totals;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function calculateMeals(meals) {
  return meals.reduce((totals, meal) => {
    const mealTotals = calculateMealTotals(meal);
    totals.calories += mealTotals.calories;
    totals.protein += mealTotals.protein;
    totals.carbs += mealTotals.carbs;
    totals.fat += mealTotals.fat;
    return totals;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function calculateMealTotals(meal) {
  if (meal.totals) {
    return {
      calories: Number(meal.totals.calories) || 0,
      protein: Number(meal.totals.protein) || 0,
      carbs: Number(meal.totals.carbs) || 0,
      fat: Number(meal.totals.fat) || 0
    };
  }
  return calculateItems(meal.items || []);
}

function formatMacros(totals) {
  return [
    ["Calories", `${Math.round(totals.calories)} kcal`],
    ["Protein", `${roundOne(totals.protein)} g`],
    ["Carbs", `${roundOne(totals.carbs)} g`],
    ["Fat", `${roundOne(totals.fat)} g`]
  ];
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function renderMacroGrid(container, totals) {
  container.innerHTML = "";
  formatMacros(totals).forEach(([label, value]) => {
    const node = document.querySelector("#macro-template").content.cloneNode(true);
    node.querySelector("span").textContent = label;
    node.querySelector("strong").textContent = value;
    container.append(node);
  });
}

function renderIngredients() {
  els.ingredientSelect.innerHTML = "";
  els.ingredientOptions.innerHTML = "";
  state.ingredients
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((ingredient) => {
      const option = document.createElement("option");
      option.value = ingredient.id;
      option.textContent = `${ingredient.name} (${ingredient.serving}${ingredient.unit})`;
      els.ingredientSelect.append(option);

      const searchOption = document.createElement("option");
      searchOption.value = ingredient.name;
      searchOption.label = `${ingredient.serving}${ingredient.unit} - ${ingredient.calories} kcal`;
      els.ingredientOptions.append(searchOption);
    });

  els.ingredientList.innerHTML = "";
  if (!state.ingredients.length) {
    els.ingredientList.innerHTML = '<div class="empty-state">No ingredients yet.</div>';
    return;
  }

  state.ingredients.forEach((ingredient) => {
    const card = document.createElement("article");
    card.className = "ingredient-card";
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(ingredient.name)}</strong>
        <p class="item-meta">${ingredient.calories} kcal, ${ingredient.protein}g protein, ${ingredient.carbs}g carbs, ${ingredient.fat}g fat per ${ingredient.serving}${escapeHtml(ingredient.unit)}</p>
      </div>
      <button class="icon-button" type="button" title="Delete ingredient" aria-label="Delete ${escapeHtml(ingredient.name)}">x</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      state.ingredients = state.ingredients.filter((item) => item.id !== ingredient.id);
      builderItems = builderItems.filter((item) => item.ingredientId !== ingredient.id);
      saveState();
      render();
    });
    els.ingredientList.append(card);
  });
}

function getSelectedIngredient() {
  const typedMatch = matchIngredientQuery(els.ingredientSearch.value);
  if (typedMatch) return typedMatch;
  return state.ingredients.find((item) => item.id === els.ingredientSelect.value);
}

function syncIngredientSelectFromSearch() {
  const typedMatch = matchIngredientQuery(els.ingredientSearch.value);
  if (typedMatch) els.ingredientSelect.value = typedMatch.id;
}

function matchIngredientQuery(query) {
  const searchText = query.trim().toLocaleLowerCase();
  if (!searchText) return null;
  return state.ingredients.find((item) => item.name.toLocaleLowerCase() === searchText)
    || state.ingredients.find((item) => item.name.toLocaleLowerCase().includes(searchText));
}

function renderBuilder() {
  const totals = calculateItems(builderItems);
  renderMacroGrid(els.mealMacros, totals);
  els.mealTotalTitle.textContent = `${Math.round(totals.calories)} kcal`;
  els.builderEmpty.style.display = builderItems.length ? "none" : "block";
  els.builderList.innerHTML = "";

  builderItems.forEach((item) => {
    const ingredient = state.ingredients.find((entry) => entry.id === item.ingredientId);
    if (!ingredient) return;
    const itemTotals = calculateItems([item]);
    const row = document.createElement("article");
    row.className = "line-item";
    row.classList.toggle("editing", item.id === editingBuilderItemId);
    row.title = "Click to edit this ingredient amount";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(ingredient.name)}</strong>
        <p class="item-meta">${item.amount}${escapeHtml(ingredient.unit)} - ${Math.round(itemTotals.calories)} kcal - P ${roundOne(itemTotals.protein)}g - C ${roundOne(itemTotals.carbs)}g - F ${roundOne(itemTotals.fat)}g</p>
      </div>
      <button class="icon-button" type="button" title="Remove item" aria-label="Remove ${escapeHtml(ingredient.name)}">x</button>
    `;
    row.addEventListener("click", () => loadBuilderItemForEdit(item));
    row.querySelector("button").addEventListener("click", (event) => {
      event.stopPropagation();
      builderItems = builderItems.filter((entry) => entry.id !== item.id);
      if (editingBuilderItemId === item.id) editingBuilderItemId = null;
      renderBuilder();
    });
    els.builderList.append(row);
  });

  const hasMeal = builderItems.length > 0;
  els.savePlanned.disabled = !hasMeal;
  els.saveConsumed.disabled = !hasMeal;
  els.ingredientSubmit.textContent = editingBuilderItemId ? "Update" : "Add";
  setEditingState();
}

function loadBuilderItemForEdit(item) {
  const ingredient = state.ingredients.find((entry) => entry.id === item.ingredientId);
  if (!ingredient) return;
  editingBuilderItemId = item.id;
  els.ingredientSelect.value = ingredient.id;
  els.ingredientSearch.value = ingredient.name;
  els.ingredientAmount.value = item.amount;
  renderBuilder();
  els.ingredientAmount.focus();
}

function saveMeal(status) {
  if (!builderItems.length) return;
  const day = ensureDay(activeDate);
  const meal = {
    id: makeId(),
    name: els.mealName.value.trim() || "Untitled meal",
    items: builderItems.map(({ ingredientId, amount }) => ({ ingredientId, amount })),
    createdAt: new Date().toISOString()
  };

  if (editingMeal?.type === "ingredients" && editingMeal.status === status) {
    updateMeal(editingMeal.id, status, meal);
    clearBuilder();
    cancelEditMode();
    render();
    return;
  }

  day[status].push(meal);
  saveState();
  clearBuilder();
  render();
}

function saveCustomMeal(status) {
  if (!els.customMealForm.reportValidity()) return;
  const day = ensureDay(activeDate);
  const meal = {
    id: makeId(),
    name: els.customName.value.trim() || "Custom meal",
    items: [],
    totals: {
      calories: Number(els.customCalories.value) || 0,
      protein: Number(els.customProtein.value) || 0,
      carbs: Number(els.customCarbs.value) || 0,
      fat: Number(els.customFat.value) || 0
    },
    source: "custom",
    createdAt: new Date().toISOString()
  };

  if (editingMeal?.type === "custom" && editingMeal.status === status) {
    updateMeal(editingMeal.id, status, meal);
    clearCustomMeal();
    cancelEditMode();
    render();
    return;
  }

  day[status].push(meal);
  saveState();
  clearCustomMeal();
  render();
}

function clearBuilder() {
  builderItems = [];
  editingBuilderItemId = null;
  els.mealName.value = "";
  els.ingredientAmount.value = "";
  els.ingredientSearch.value = "";
  renderBuilder();
}

function clearCustomMeal() {
  els.customMealForm.reset();
}

function cancelEditMode() {
  editingMeal = null;
  setEditingState();
}

function renderDay() {
  const day = ensureDay(activeDate);
  const plannedTotals = calculateMeals(day.planned);
  const consumedTotals = calculateMeals(day.consumed);

  renderMacroGrid(els.consumedDayMacros, consumedTotals);
  renderMacroGrid(els.plannedDayMacros, plannedTotals);
  renderMacroGrid(els.consumedMacros, consumedTotals);
  els.consumedSummaryTitle.textContent = `${Math.round(consumedTotals.calories)} kcal consumed`;
  els.consumedSummaryStatus.textContent = "Officially consumed";
  els.plannedSummaryTitle.textContent = `${Math.round(plannedTotals.calories)} kcal planned`;
  els.plannedSummaryStatus.textContent = "Planned meals";
  renderMealList(els.plannedMeals, day.planned, "planned");
  renderMealList(els.consumedMeals, day.consumed, "consumed");
  renderMealList(els.historyList, day.consumed, "history");
}

function renderMealList(container, meals, status) {
  container.innerHTML = "";
  if (!meals.length) {
    container.innerHTML = `<div class="empty-state">No ${status === "consumed" || status === "history" ? "consumed" : "planned"} meals.</div>`;
    return;
  }

  meals.forEach((meal) => {
    const totals = calculateMealTotals(meal);
    const card = document.createElement("article");
    card.className = "meal-card";
    const mealDetails = getMealDetails(meal);
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(meal.name)}</strong>
        <p class="meal-meta">${escapeHtml(mealDetails)}</p>
      </div>
      <div class="mini-macros">
        <span>${Math.round(totals.calories)} kcal</span>
        <span>P ${roundOne(totals.protein)}g</span>
        <span>C ${roundOne(totals.carbs)}g</span>
        <span>F ${roundOne(totals.fat)}g</span>
      </div>
      <div class="meal-actions"></div>
    `;
    const actions = card.querySelector(".meal-actions");
    if (status === "planned") {
      const consume = document.createElement("button");
      consume.type = "button";
      consume.textContent = "Register consumed";
      consume.addEventListener("click", () => moveMeal(meal.id, "planned", "consumed"));
      actions.append(consume);
    }
    if (status === "planned" || status === "consumed" || status === "history") {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => startEditMeal(meal, status === "history" ? "consumed" : status));
      actions.append(edit);
    }
    const duplicate = document.createElement("button");
    duplicate.type = "button";
    duplicate.className = "secondary-button";
    duplicate.textContent = "Use again";
    duplicate.addEventListener("click", () => {
      cancelEditMode();
      editingBuilderItemId = null;
      document.querySelector('[data-view="planner"]').click();
      if (meal.totals) {
        builderItems = [];
        els.mealName.value = "";
        els.customName.value = meal.name;
        els.customCalories.value = roundOne(totals.calories);
        els.customProtein.value = roundOne(totals.protein);
        els.customCarbs.value = roundOne(totals.carbs);
        els.customFat.value = roundOne(totals.fat);
        renderBuilder();
      } else {
        clearCustomMeal();
        builderItems = (meal.items || []).map((item) => ({ ...item, id: makeId() }));
        els.mealName.value = meal.name;
        renderBuilder();
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    actions.append(duplicate);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost-button";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteMeal(meal.id, status === "history" ? "consumed" : status));
    actions.append(remove);
    container.append(card);
  });
}

function startEditMeal(meal, status) {
  const totals = calculateMealTotals(meal);
  const type = meal.totals ? "custom" : "ingredients";
  editingBuilderItemId = null;
  editingMeal = { id: meal.id, status, type };
  document.querySelector('[data-view="planner"]').click();

  if (type === "custom") {
    builderItems = [];
    els.mealName.value = "";
    els.customName.value = meal.name;
    els.customCalories.value = roundOne(totals.calories);
    els.customProtein.value = roundOne(totals.protein);
    els.customCarbs.value = roundOne(totals.carbs);
    els.customFat.value = roundOne(totals.fat);
    renderBuilder();
  } else {
    clearCustomMeal();
    builderItems = (meal.items || []).map((item) => ({ ...item, id: makeId() }));
    els.mealName.value = meal.name;
    renderBuilder();
  }

  setEditingState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setEditingState() {
  const isEditing = Boolean(editingMeal);
  const hasMeal = builderItems.length > 0;
  els.editBanner.hidden = !isEditing;
  els.editBannerText.textContent = isEditing ? `Editing ${editingMeal.status} meal` : "";

  if (!isEditing) {
    els.savePlanned.disabled = !hasMeal;
    els.saveConsumed.disabled = !hasMeal;
    els.customPlanned.disabled = false;
    els.customConsumed.disabled = false;
    els.savePlanned.textContent = "Plan meal";
    els.saveConsumed.textContent = "Register consumed";
    els.customPlanned.textContent = "Plan custom meal";
    els.customConsumed.textContent = "Register consumed";
    return;
  }

  const editingIngredients = editingMeal.type === "ingredients";
  const editingCustom = editingMeal.type === "custom";
  els.savePlanned.disabled = !editingIngredients || editingMeal.status !== "planned" || !hasMeal;
  els.saveConsumed.disabled = !editingIngredients || editingMeal.status !== "consumed" || !hasMeal;
  els.customPlanned.disabled = !editingCustom || editingMeal.status !== "planned";
  els.customConsumed.disabled = !editingCustom || editingMeal.status !== "consumed";
  els.savePlanned.textContent = editingIngredients && editingMeal.status === "planned" ? "Save changes" : "Plan meal";
  els.saveConsumed.textContent = editingIngredients && editingMeal.status === "consumed" ? "Save changes" : "Register consumed";
  els.customPlanned.textContent = editingCustom && editingMeal.status === "planned" ? "Save changes" : "Plan custom meal";
  els.customConsumed.textContent = editingCustom && editingMeal.status === "consumed" ? "Save changes" : "Register consumed";
}

function updateMeal(mealId, status, nextMeal) {
  const day = ensureDay(activeDate);
  day[status] = day[status].map((meal) => {
    if (meal.id !== mealId) return meal;
    return {
      ...nextMeal,
      id: meal.id,
      createdAt: meal.createdAt,
      updatedAt: new Date().toISOString()
    };
  });
  saveState();
}

function getMealDetails(meal) {
  if (meal.totals) return "Custom meal totals";
  return (meal.items || []).map((item) => {
    const ingredient = state.ingredients.find((entry) => entry.id === item.ingredientId);
    return ingredient ? `${item.amount}${ingredient.unit} ${ingredient.name}` : "Deleted ingredient";
  }).join(", ");
}

function moveMeal(mealId, from, to) {
  const day = ensureDay(activeDate);
  const meal = day[from].find((entry) => entry.id === mealId);
  if (!meal) return;
  day[from] = day[from].filter((entry) => entry.id !== mealId);
  day[to].push(meal);
  saveState();
  render();
}

function deleteMeal(mealId, status) {
  const day = ensureDay(activeDate);
  day[status] = day[status].filter((entry) => entry.id !== mealId);
  saveState();
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  renderIngredients();
  renderBuilder();
  renderDay();
  setEditingState();
}

render();
loadRemoteState();
