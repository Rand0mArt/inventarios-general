const STORAGE_KEY = "inventarios_general_v3";
const LEGACY_STORAGE_KEYS = ["inventarios_general_v2", "inventario_glass_v1"];
const DEFAULT_COLORS = ["#1f7a8c", "#2a9d8f", "#457b9d", "#e76f51", "#6a4c93", "#3d5a80"];
const DEFAULT_LABELS = {
  product: "Producto",
  sku: "SKU",
  quantity: "Cantidad",
  price: "Precio",
  total: "Total",
  actions: "Acciones",
};
const CLOUD_TABLE = "inventarios_general_states";
const OWNER_KEY_STORAGE = "inventarios_owner_key_v1";
const CLIENT_ID = crypto.randomUUID();
const APP_CONFIG = window.APP_CONFIG || {};

const state = {
  inventories: [],
  activeInventoryId: null,
  searchQuery: "",
  draggedItemId: null,
  draggedInventoryId: null,
  configDraftFields: [],
};

const cloudState = {
  client: null,
  ownerKey: getOrCreateOwnerKey(),
  isReady: false,
  saveTimer: null,
};

const refs = {
  inventoryForm: document.getElementById("inventoryForm"),
  inventoryName: document.getElementById("inventoryName"),
  inventoryColor: document.getElementById("inventoryColor"),
  inventoryImage: document.getElementById("inventoryImage"),
  inventoryPanelToggle: document.getElementById("inventoryPanelToggle"),
  inventoryPanelState: document.getElementById("inventoryPanelState"),
  mainLayout: document.getElementById("mainLayout"),
  inventoryList: document.getElementById("inventoryList"),
  editInventoryDialog: document.getElementById("editInventoryDialog"),
  editInventoryForm: document.getElementById("editInventoryForm"),
  editInventoryName: document.getElementById("editInventoryName"),
  editInventoryColor: document.getElementById("editInventoryColor"),
  editInventoryImage: document.getElementById("editInventoryImage"),
  removeInventoryImageBtn: document.getElementById("removeInventoryImageBtn"),
  cancelEditInventoryBtn: document.getElementById("cancelEditInventoryBtn"),
  activeInventoryName: document.getElementById("activeInventoryName"),
  deleteInventoryBtn: document.getElementById("deleteInventoryBtn"),
  searchInput: document.getElementById("searchInput"),
  addFieldBtnInline: document.getElementById("addFieldBtnInline"),
  manageFieldsBtn: document.getElementById("manageFieldsBtn"),
  openAddProductBtn: document.getElementById("openAddProductBtn"),
  addProductDialog: document.getElementById("addProductDialog"),
  addProductForm: document.getElementById("addProductForm"),
  addItemName: document.getElementById("addItemName"),
  addItemSku: document.getElementById("addItemSku"),
  addItemQty: document.getElementById("addItemQty"),
  addItemPrice: document.getElementById("addItemPrice"),
  addDynamicFieldsContainer: document.getElementById("addDynamicFieldsContainer"),
  cancelAddProductBtn: document.getElementById("cancelAddProductBtn"),
  skuPreview: document.getElementById("skuPreview"),
  itemsTableBody: document.getElementById("itemsTableBody"),
  thProduct: document.getElementById("thProduct"),
  thSku: document.getElementById("thSku"),
  thQuantity: document.getElementById("thQuantity"),
  thPrice: document.getElementById("thPrice"),
  thTotal: document.getElementById("thTotal"),
  thActions: document.getElementById("thActions"),
  kpiWidgets: document.getElementById("kpiWidgets"),
  inventoryItemTemplate: document.getElementById("inventoryItemTemplate"),
  editProductDialog: document.getElementById("editProductDialog"),
  editProductForm: document.getElementById("editProductForm"),
  editProductId: document.getElementById("editProductId"),
  editItemName: document.getElementById("editItemName"),
  editItemSku: document.getElementById("editItemSku"),
  editItemQty: document.getElementById("editItemQty"),
  editItemPrice: document.getElementById("editItemPrice"),
  editDynamicFieldsContainer: document.getElementById("editDynamicFieldsContainer"),
  deleteProductBtn: document.getElementById("deleteProductBtn"),
  cancelEditProductBtn: document.getElementById("cancelEditProductBtn"),
  tableConfigDialog: document.getElementById("tableConfigDialog"),
  tableConfigForm: document.getElementById("tableConfigForm"),
  cfgProduct: document.getElementById("cfgProduct"),
  cfgSku: document.getElementById("cfgSku"),
  cfgQuantity: document.getElementById("cfgQuantity"),
  cfgPrice: document.getElementById("cfgPrice"),
  cfgTotal: document.getElementById("cfgTotal"),
  cfgActions: document.getElementById("cfgActions"),
  newFieldName: document.getElementById("newFieldName"),
  newFieldType: document.getElementById("newFieldType"),
  addFieldBtn: document.getElementById("addFieldBtn"),
  fieldsList: document.getElementById("fieldsList"),
  cancelConfigBtn: document.getElementById("cancelConfigBtn"),
  dashboardInventoryTitle: document.getElementById("dashboardInventoryTitle"),
  valueChart: document.getElementById("valueChart"),
  unitsChart: document.getElementById("unitsChart"),
  topProductsChart: document.getElementById("topProductsChart"),
  movementSummary: document.getElementById("movementSummary"),
  movementHistory: document.getElementById("movementHistory"),
  globalMovementHistory: document.getElementById("globalMovementHistory"),
};

init();

function init() {
  loadState();
  bindEvents();
  applyInventoryBackground(null);
  renderAll();
  initCloudSync();
}

function bindEvents() {
  refs.inventoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = refs.inventoryName.value.trim();
    if (!name) return;
    const imageDataUrl = await readFileAsDataURL(refs.inventoryImage.files?.[0]);

    const inventory = {
      id: crypto.randomUUID(),
      name,
      color: normalizeColor(refs.inventoryColor.value || pickColor()),
      imageDataUrl: sanitizeImageDataUrl(imageDataUrl),
      items: [],
      movementLog: [],
      nextSku: 1,
      labels: { ...DEFAULT_LABELS },
      customFields: [],
      createdAt: new Date().toISOString(),
    };

    state.inventories.unshift(inventory);
    state.activeInventoryId = inventory.id;
    refs.inventoryName.value = "";
    refs.inventoryColor.value = pickColor();
    refs.inventoryImage.value = "";
    persist();
    renderAll();
  });

  refs.editInventoryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    closeDialog(refs.editInventoryDialog);
  });

  refs.editInventoryName.addEventListener("input", () => {
    const active = getActiveInventory();
    if (!active) return;

    const nextName = refs.editInventoryName.value.trim();
    if (!nextName) return;
    active.name = nextName;
    refs.activeInventoryName.textContent = active.name;
    renderInventoryList();
    renderWidgets();
    renderDashboard();
    persist();
  });

  refs.editInventoryColor.addEventListener("input", () => {
    const active = getActiveInventory();
    if (!active) return;
    active.color = normalizeColor(refs.editInventoryColor.value || active.color);
    applyTheme(active.color);
    renderInventoryList();
    renderWidgets();
    renderDashboard();
    persist();
  });

  refs.editInventoryImage.addEventListener("change", async () => {
    const active = getActiveInventory();
    if (!active) return;

    const imageDataUrl = await readFileAsDataURL(refs.editInventoryImage.files?.[0]);
    if (!imageDataUrl) return;
    active.imageDataUrl = sanitizeImageDataUrl(imageDataUrl);
    refs.editInventoryImage.value = "";
    persist();
    renderAll();
  });

  refs.removeInventoryImageBtn.addEventListener("click", () => {
    const active = getActiveInventory();
    if (!active) return;
    active.imageDataUrl = null;
    refs.editInventoryImage.value = "";
    persist();
    renderAll();
  });

  refs.cancelEditInventoryBtn.addEventListener("click", () => closeDialog(refs.editInventoryDialog));

  refs.deleteInventoryBtn.addEventListener("click", () => {
    const active = getActiveInventory();
    if (!active) return;

    const ok = confirm(`¿Eliminar "${active.name}" y todos sus productos?`);
    if (!ok) return;

    state.inventories = state.inventories.filter((inv) => inv.id !== active.id);
    state.activeInventoryId = state.inventories[0]?.id ?? null;
    persist();
    renderAll();
  });

  refs.searchInput.addEventListener("input", () => {
    state.searchQuery = refs.searchInput.value.trim().toLowerCase();
    renderActiveInventory();
  });

  refs.inventoryPanelToggle.addEventListener("click", () => {
    refs.mainLayout.classList.toggle("inventory-collapsed");
    const isCollapsed = refs.mainLayout.classList.contains("inventory-collapsed");
    refs.inventoryPanelState.textContent = isCollapsed ? "" : "Expandido";
  });

  refs.addFieldBtnInline.addEventListener("click", openConfigDialog);
  refs.manageFieldsBtn.addEventListener("click", openConfigDialog);

  refs.tableConfigForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const active = getActiveInventory();
    if (!active) return;

    active.labels = {
      product: keepText(refs.cfgProduct.value, DEFAULT_LABELS.product),
      sku: keepText(refs.cfgSku.value, DEFAULT_LABELS.sku),
      quantity: keepText(refs.cfgQuantity.value, DEFAULT_LABELS.quantity),
      price: keepText(refs.cfgPrice.value, DEFAULT_LABELS.price),
      total: keepText(refs.cfgTotal.value, DEFAULT_LABELS.total),
      actions: keepText(refs.cfgActions.value, DEFAULT_LABELS.actions),
    };

    active.customFields = state.configDraftFields.map((field) => ({ ...field }));
    for (const item of active.items) {
      const nextValues = {};
      for (const field of active.customFields) {
        nextValues[field.id] = item.dynamicValues?.[field.id] ?? "";
      }
      item.dynamicValues = nextValues;
    }

    closeDialog(refs.tableConfigDialog);
    persist();
    renderAll();
  });

  refs.addFieldBtn.addEventListener("click", () => {
    const name = refs.newFieldName.value.trim();
    const type = normalizeFieldType(refs.newFieldType.value);
    if (!name) return;

    state.configDraftFields.push({ id: crypto.randomUUID(), name, type });
    refs.newFieldName.value = "";
    renderFieldsList();
  });

  refs.fieldsList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove-id]");
    if (!button) return;

    const id = button.dataset.removeId;
    state.configDraftFields = state.configDraftFields.filter((field) => field.id !== id);
    renderFieldsList();
  });

  refs.cancelConfigBtn.addEventListener("click", () => closeDialog(refs.tableConfigDialog));

  refs.openAddProductBtn.addEventListener("click", () => {
    const active = getActiveInventory();
    if (!active) return;
    prepareAddProductDialog(active);
    openDialog(refs.addProductDialog);
  });

  refs.addProductForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const active = getActiveInventory();
    if (!active) return;

    const name = refs.addItemName.value.trim();
    const sku = refs.addItemSku.value.trim();
    const quantity = Number.parseInt(refs.addItemQty.value, 10);
    const price = parseAccountingNumber(refs.addItemPrice.value);

    if (!name || Number.isNaN(quantity) || Number.isNaN(price)) return;

    const dynamicValues = collectDynamicValues(active.customFields, refs.addDynamicFieldsContainer, "add");
    const now = new Date().toISOString();

    active.items.unshift({
      id: crypto.randomUUID(),
      name,
      sku: sku || generateSku(active),
      quantity: Math.max(0, quantity),
      price: Math.max(0, price),
      dynamicValues,
      movements: [{ date: now, delta: Math.max(0, quantity) }],
      createdAt: now,
    });
    active.movementLog = Array.isArray(active.movementLog) ? active.movementLog : [];
    active.movementLog.push({ itemName: name, delta: Math.max(0, quantity), date: now });

    closeDialog(refs.addProductDialog);
    persist();
    renderAll();
  });

  refs.cancelAddProductBtn.addEventListener("click", () => {
    closeDialog(refs.addProductDialog);
    renderWidgets();
    renderDashboard();
  });
  refs.addProductDialog.addEventListener("close", () => {
    renderWidgets();
    renderDashboard();
  });

  refs.addProductForm.addEventListener("input", () => {
    renderDashboardPreview("add");
  });

  refs.itemsTableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const active = getActiveInventory();
    if (!active) return;

    const itemId = button.dataset.id;
    if (!itemId || button.dataset.action !== "edit") return;

    const item = active.items.find((entry) => entry.id === itemId);
    if (!item) return;

    openEditProductDialog(active, item);
  });

  refs.editProductForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const active = getActiveInventory();
    if (!active) return;

    const item = active.items.find((entry) => entry.id === refs.editProductId.value);
    if (!item) return;

    const name = refs.editItemName.value.trim();
    const sku = refs.editItemSku.value.trim();
    const quantity = Number.parseInt(refs.editItemQty.value, 10);
    const price = parseAccountingNumber(refs.editItemPrice.value);

    if (!name || Number.isNaN(quantity) || Number.isNaN(price)) {
      alert("Completa todos los campos del producto con valores válidos.");
      return;
    }

    const previousQuantity = item.quantity;
    item.name = name;
    item.sku = sku || generateSku(active);
    item.quantity = Math.max(0, quantity);
    item.price = Math.max(0, price);
    item.dynamicValues = collectDynamicValues(active.customFields, refs.editDynamicFieldsContainer, "edit");

    const delta = item.quantity - previousQuantity;
    if (delta !== 0) {
      item.movements = Array.isArray(item.movements) ? item.movements : [];
      item.movements.push({ date: new Date().toISOString(), delta });
      active.movementLog = Array.isArray(active.movementLog) ? active.movementLog : [];
      active.movementLog.push({ itemName: item.name, delta, date: new Date().toISOString() });
    }

    closeDialog(refs.editProductDialog);
    persist();
    renderAll();
  });

  refs.deleteProductBtn.addEventListener("click", () => {
    const active = getActiveInventory();
    if (!active) return;

    const itemId = refs.editProductId.value;
    const item = active.items.find((entry) => entry.id === itemId);
    if (!item) return;

    const ok = confirm(`¿Quitar "${item.name}" de este inventario?`);
    if (!ok) return;

    active.movementLog = Array.isArray(active.movementLog) ? active.movementLog : [];
    if (item.quantity > 0) {
      active.movementLog.push({ itemName: item.name, delta: -item.quantity, date: new Date().toISOString() });
    }
    active.items = active.items.filter((entry) => entry.id !== itemId);
    closeDialog(refs.editProductDialog);
    persist();
    renderAll();
  });

  refs.cancelEditProductBtn.addEventListener("click", () => closeDialog(refs.editProductDialog));
  refs.editProductDialog.addEventListener("close", () => {
    renderWidgets();
    renderDashboard();
  });
  refs.editProductForm.addEventListener("input", () => renderDashboardPreview("edit"));
  refs.editItemPrice.addEventListener("blur", () => {
    const numeric = parseAccountingNumber(refs.editItemPrice.value);
    refs.editItemPrice.value = Number.isNaN(numeric) ? "0.00" : toAccountingNumber(numeric);
  });
  refs.addItemPrice.addEventListener("blur", () => {
    const numeric = parseAccountingNumber(refs.addItemPrice.value);
    refs.addItemPrice.value = Number.isNaN(numeric) ? "0.00" : toAccountingNumber(numeric);
  });

  refs.itemsTableBody.addEventListener("dragstart", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (!row) return;
    state.draggedItemId = row.dataset.id;
    row.classList.add("is-dragging");
  });

  refs.itemsTableBody.addEventListener("dragover", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (!row || !state.draggedItemId || row.dataset.id === state.draggedItemId) return;
    event.preventDefault();
    row.classList.add("drop-target");
  });

  refs.itemsTableBody.addEventListener("dragleave", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (!row) return;
    row.classList.remove("drop-target");
  });

  refs.itemsTableBody.addEventListener("drop", (event) => {
    const targetRow = event.target.closest("tr[data-id]");
    const sourceId = state.draggedItemId;
    if (!targetRow || !sourceId) return;

    event.preventDefault();
    targetRow.classList.remove("drop-target");
    moveItem(sourceId, targetRow.dataset.id);
    state.draggedItemId = null;
  });

  refs.itemsTableBody.addEventListener("dragend", () => {
    state.draggedItemId = null;
    refs.itemsTableBody.querySelectorAll("tr").forEach((row) => row.classList.remove("is-dragging", "drop-target"));
  });

  refs.inventoryList.addEventListener("dragstart", (event) => {
    const row = event.target.closest("li[data-id]");
    if (!row) return;
    state.draggedInventoryId = row.dataset.id;
    row.classList.add("is-dragging");
  });

  refs.inventoryList.addEventListener("dragover", (event) => {
    const row = event.target.closest("li[data-id]");
    if (!row || !state.draggedInventoryId || row.dataset.id === state.draggedInventoryId) return;
    event.preventDefault();
    row.classList.add("drop-target");
  });

  refs.inventoryList.addEventListener("dragleave", (event) => {
    const row = event.target.closest("li[data-id]");
    if (!row) return;
    row.classList.remove("drop-target");
  });

  refs.inventoryList.addEventListener("drop", (event) => {
    const targetRow = event.target.closest("li[data-id]");
    if (!targetRow || !state.draggedInventoryId) return;

    event.preventDefault();
    targetRow.classList.remove("drop-target");
    moveInventory(state.draggedInventoryId, targetRow.dataset.id);
    state.draggedInventoryId = null;
  });

  refs.inventoryList.addEventListener("dragend", () => {
    state.draggedInventoryId = null;
    refs.inventoryList.querySelectorAll("li").forEach((row) => row.classList.remove("is-dragging", "drop-target"));
  });
}

function getActiveInventory() {
  return state.inventories.find((inv) => inv.id === state.activeInventoryId) ?? null;
}

function renderAll() {
  renderInventoryList();
  renderActiveInventory();
  renderWidgets();
  renderDashboard();
}

function renderInventoryList() {
  refs.inventoryList.innerHTML = "";

  if (state.inventories.length === 0) {
    refs.inventoryList.innerHTML = '<li class="empty">Aún no hay inventarios.</li>';
    return;
  }

  for (const inventory of state.inventories) {
    const fragment = refs.inventoryItemTemplate.content.cloneNode(true);
    const li = fragment.querySelector("li");
    const button = fragment.querySelector(".inventory-pill");
    const editButton = fragment.querySelector(".inventory-edit-btn");
    const name = fragment.querySelector(".name");
    const meta = fragment.querySelector(".meta");

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    if (inventory.imageDataUrl) {
      swatch.style.backgroundImage = `url(${inventory.imageDataUrl})`;
      swatch.style.backgroundColor = "transparent";
    } else {
      swatch.style.backgroundImage = "none";
      swatch.style.backgroundColor = inventory.color;
    }

    name.textContent = inventory.name;
    meta.textContent = `${inventory.items.length} producto(s)`;
    button.prepend(swatch);
    li.classList.add("inventory-item");
    li.dataset.id = inventory.id;
    li.draggable = true;

    if (inventory.id === state.activeInventoryId) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      state.activeInventoryId = inventory.id;
      persist();
      renderAll();
    });

    editButton.addEventListener("click", () => {
      state.activeInventoryId = inventory.id;
      openEditInventoryDialog(inventory);
    });

    refs.inventoryList.appendChild(fragment);
  }
}

function renderActiveInventory() {
  const active = getActiveInventory();
  refs.itemsTableBody.innerHTML = "";

  if (!active) {
    applyTheme("#1f7a8c");
    applyInventoryBackground(null);
    renderTableHeaders(DEFAULT_LABELS);
    refs.activeInventoryName.textContent = "Selecciona un inventario";
    refs.openAddProductBtn.disabled = true;
    refs.deleteInventoryBtn.disabled = true;
    refs.manageFieldsBtn.disabled = true;
    refs.addFieldBtnInline.disabled = true;
    refs.removeInventoryImageBtn.disabled = true;
    refs.skuPreview.textContent = "Se generará al agregar.";
    refs.itemsTableBody.innerHTML = '<tr><td class="empty" colspan="6">No hay inventario activo.</td></tr>';
    return;
  }

  applyTheme(active.color);
  applyInventoryBackground(active.imageDataUrl || null);
  renderTableHeaders(active.labels || DEFAULT_LABELS);
  refs.openAddProductBtn.disabled = false;
  refs.deleteInventoryBtn.disabled = false;
  refs.manageFieldsBtn.disabled = false;
  refs.addFieldBtnInline.disabled = false;
  refs.removeInventoryImageBtn.disabled = !Boolean(active.imageDataUrl);

  refs.activeInventoryName.textContent = active.name;
  refs.editInventoryName.value = active.name;
  refs.editInventoryColor.value = normalizeColor(active.color);
  refs.editInventoryImage.value = "";
  refs.skuPreview.textContent = previewSku(active);
  if (!active.customFields || active.customFields.length === 0) {
    refs.skuPreview.textContent = "Sin columnas. Usa Agregar columna.";
  }

  const filteredItems = active.items.filter((item) => {
    if (!state.searchQuery) return true;
    const dynamicText = Object.values(item.dynamicValues || {}).join(" ").toLowerCase();
    return (
      item.name.toLowerCase().includes(state.searchQuery) ||
      item.sku.toLowerCase().includes(state.searchQuery) ||
      dynamicText.includes(state.searchQuery)
    );
  });

  if (filteredItems.length === 0) {
    refs.itemsTableBody.innerHTML = '<tr><td class="empty" colspan="6">Sin coincidencias.</td></tr>';
    return;
  }

  for (const item of filteredItems) {
    const tr = document.createElement("tr");
    const total = item.quantity * item.price;
    tr.dataset.id = item.id;
    tr.draggable = true;

    const dynamicPreview = summarizeDynamicFields(active.customFields, item.dynamicValues);
    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(item.name)}</strong>
        ${dynamicPreview ? `<div class="row-sub">${escapeHtml(dynamicPreview)}</div>` : ""}
      </td>
      <td class="table-sku">${escapeHtml(item.sku)}</td>
      <td>${item.quantity}</td>
      <td>${toCurrency(item.price)}</td>
      <td>${toCurrency(total)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="table-save" data-action="edit" data-id="${item.id}">Editar</button>
        </div>
      </td>
    `;

    refs.itemsTableBody.appendChild(tr);
  }
}

function renderWidgets(previewItems = null) {
  const active = getActiveInventory();
  const items = previewItems ?? active?.items ?? [];
  const totalValue = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const outOfStock = items.filter((item) => item.quantity === 0).length;
  const moved7d = items.filter((item) => calcItemMovement(item, 7) > 0).length;

  refs.kpiWidgets.innerHTML = `
    <article class="kpi-card">
      <strong>${toCurrency(totalValue)}</strong>
      <span>Valor total del stock</span>
    </article>
    <article class="kpi-card">
      <strong>${totalUnits}</strong>
      <span>Unidades en stock</span>
    </article>
    <article class="kpi-card">
      <strong>${outOfStock}</strong>
      <span>Productos agotados</span>
    </article>
    <article class="kpi-card">
      <strong>${moved7d}</strong>
      <span>Productos con movimiento (7d)</span>
    </article>
  `;
}

function renderDashboard(previewItems = null) {
  const active = getActiveInventory();
  refs.dashboardInventoryTitle.textContent = active
    ? `Métricas de: ${active.name}`
    : "Métricas del inventario seleccionado.";

  if (!active) {
    renderBarChart(refs.valueChart, [], (value) => toCurrency(value));
    renderBarChart(refs.unitsChart, [], (value) => `${value} uds`);
    renderBarChart(refs.topProductsChart, [], (value) => toCurrency(value));
    refs.movementSummary.innerHTML = "";
    refs.movementHistory.innerHTML = '<div class="empty">Sin movimientos aún.</div>';
    renderGlobalMovementHistory();
    return;
  }

  const items = previewItems ?? active.items;
  const valueRows = items.map((item) => ({
    label: item.name,
    value: item.quantity * item.price,
  }));

  const unitsRows = items.map((item) => ({
    label: item.name,
    value: item.quantity,
  }));

  const topProducts = items
    .map((item) => ({
      label: item.name,
      value: item.quantity * item.price,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  renderBarChart(refs.valueChart, valueRows, (value) => toCurrency(value));
  renderBarChart(refs.unitsChart, unitsRows, (value) => `${value} uds`);
  renderBarChart(refs.topProductsChart, topProducts, (value) => toCurrency(value));

  const movements = (active.movementLog || [])
    .map((move) => ({
      itemName: move.itemName || "Producto",
      delta: Number(move.delta) || 0,
      date: move.date || new Date().toISOString(),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalEntries = movements.reduce((sum, move) => sum + (move.delta > 0 ? move.delta : 0), 0);
  const totalExits = movements.reduce((sum, move) => sum + (move.delta < 0 ? Math.abs(move.delta) : 0), 0);
  refs.movementSummary.innerHTML = `
    <div class="movement-badge"><strong>Entradas:</strong> ${totalEntries}</div>
    <div class="movement-badge"><strong>Salidas:</strong> ${totalExits}</div>
  `;

  if (movements.length === 0) {
    refs.movementHistory.innerHTML = '<div class="empty">Sin movimientos aún.</div>';
  } else {
    refs.movementHistory.innerHTML = movements
      .slice(0, 12)
      .map((move) => {
        const sign = move.delta >= 0 ? "+" : "-";
        return `<div class="movement-item"><strong>${escapeHtml(move.itemName)}</strong> · ${sign}${Math.abs(move.delta)} · ${escapeHtml(
          formatDateTime(move.date),
        )}</div>`;
      })
      .join("");
  }

  renderGlobalMovementHistory();
}

function renderGlobalMovementHistory() {
  const rows = state.inventories
    .flatMap((inventory) =>
      (inventory.movementLog || []).map((move) => ({
        inventoryName: inventory.name,
        inventoryColor: inventory.color,
        inventoryImage: inventory.imageDataUrl,
        itemName: move.itemName || "Producto",
        delta: Number(move.delta) || 0,
        date: move.date || new Date().toISOString(),
      })),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (rows.length === 0) {
    refs.globalMovementHistory.innerHTML = '<div class="empty">Sin movimientos globales aún.</div>';
    return;
  }

  refs.globalMovementHistory.innerHTML = rows
    .slice(0, 20)
    .map((row) => {
      const sign = row.delta >= 0 ? "+" : "-";
      const dotStyle = row.inventoryImage
        ? `background-image:url(${row.inventoryImage}); background-color:transparent;`
        : `background-color:${row.inventoryColor};`;

      return `<div class="movement-item general"><span class="movement-dot" style="${dotStyle}"></span><div><strong>${escapeHtml(
        row.inventoryName,
      )}</strong> · ${escapeHtml(row.itemName)} · ${sign}${Math.abs(row.delta)} · ${escapeHtml(
        formatDateTime(row.date),
      )}</div></div>`;
    })
    .join("");
}

function renderDashboardPreview(mode) {
  const active = getActiveInventory();
  if (!active) return;

  const previewItems = active.items.map((item) => ({ ...item }));

  if (mode === "add") {
    const name = refs.addItemName.value.trim() || "Producto nuevo";
    const quantity = Number.parseInt(refs.addItemQty.value, 10);
    const price = parseAccountingNumber(refs.addItemPrice.value);
    if (!Number.isNaN(quantity) && !Number.isNaN(price)) {
      previewItems.unshift({
        id: "__preview_add__",
        name,
        quantity: Math.max(0, quantity),
        price: Math.max(0, price),
      });
    }
  } else if (mode === "edit") {
    const id = refs.editProductId.value;
    const idx = previewItems.findIndex((item) => item.id === id);
    if (idx !== -1) {
      const quantity = Number.parseInt(refs.editItemQty.value, 10);
      const price = parseAccountingNumber(refs.editItemPrice.value);
      previewItems[idx] = {
        ...previewItems[idx],
        name: refs.editItemName.value.trim() || previewItems[idx].name,
        quantity: Number.isNaN(quantity) ? previewItems[idx].quantity : Math.max(0, quantity),
        price: Number.isNaN(price) ? previewItems[idx].price : Math.max(0, price),
      };
    }
  }

  renderWidgets(previewItems);
  renderDashboard(previewItems);
}

function renderBarChart(container, rows, formatValue) {
  container.innerHTML = "";
  if (rows.length === 0) {
    container.innerHTML = '<div class="empty">Sin datos aún.</div>';
    return;
  }

  const max = Math.max(1, ...rows.map((row) => row.value));
  for (const row of rows) {
    const width = Math.max(4, Math.round((row.value / max) * 100));
    const div = document.createElement("div");
    div.className = "bar-row";
    div.innerHTML = `
      <div class="bar-label">
        <span>${escapeHtml(shorten(row.label, 28))}</span>
        <strong>${escapeHtml(formatValue(row.value))}</strong>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
    `;
    container.appendChild(div);
  }
}

function calcItemMovement(item, days) {
  const moves = Array.isArray(item.movements) ? item.movements : [];
  const from = Date.now() - days * 24 * 60 * 60 * 1000;
  return moves.reduce((sum, move) => {
    const date = new Date(move.date).getTime();
    if (Number.isNaN(date) || date < from) return sum;
    return sum + Math.abs(Number(move.delta) || 0);
  }, 0);
}

function openConfigDialog() {
  const active = getActiveInventory();
  if (!active) return;

  const labels = active.labels || { ...DEFAULT_LABELS };
  refs.cfgProduct.value = labels.product;
  refs.cfgSku.value = labels.sku;
  refs.cfgQuantity.value = labels.quantity;
  refs.cfgPrice.value = labels.price;
  refs.cfgTotal.value = labels.total;
  refs.cfgActions.value = labels.actions;

  state.configDraftFields = active.customFields.map((field) => ({ ...field }));
  refs.newFieldName.value = "";
  refs.newFieldType.value = "text";
  renderFieldsList();
  openDialog(refs.tableConfigDialog);
}

function renderFieldsList() {
  refs.fieldsList.innerHTML = "";
  if (state.configDraftFields.length === 0) {
    refs.fieldsList.innerHTML = '<li><span>Sin campos personalizados.</span></li>';
    return;
  }

  for (const field of state.configDraftFields) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${escapeHtml(field.name)} <small>(${escapeHtml(getFieldTypeLabel(field.type))})</small></span>
      <button type="button" class="danger" data-remove-id="${field.id}">Quitar</button>
    `;
    refs.fieldsList.appendChild(li);
  }
}

function openEditProductDialog(inventory, item) {
  refs.editProductId.value = item.id;
  refs.editItemName.value = item.name;
  refs.editItemSku.value = item.sku;
  refs.editItemQty.value = String(item.quantity);
  refs.editItemPrice.value = toAccountingNumber(item.price);

  renderDynamicFields(inventory.customFields, refs.editDynamicFieldsContainer, item.dynamicValues || {}, "edit");
  openDialog(refs.editProductDialog);
}

function openEditInventoryDialog(inventory) {
  refs.editInventoryName.value = inventory.name;
  refs.editInventoryColor.value = normalizeColor(inventory.color);
  refs.editInventoryImage.value = "";
  refs.removeInventoryImageBtn.disabled = !Boolean(inventory.imageDataUrl);
  openDialog(refs.editInventoryDialog);
}

function prepareAddProductDialog(inventory) {
  refs.addItemName.value = "";
  refs.addItemSku.value = previewSku(inventory);
  refs.addItemQty.value = "0";
  refs.addItemPrice.value = "0.00";
  renderDynamicFields(inventory.customFields, refs.addDynamicFieldsContainer, {}, "add");
}

function renderDynamicFields(fields, container, values, mode) {
  container.innerHTML = "";
  if (!fields || fields.length === 0) return;

  for (const field of fields) {
    const wrapper = document.createElement("div");
    wrapper.className = "field-box";
    const inputType = field.type === "duration" ? "time" : field.type === "textarea" ? "textarea" : field.type;
    const value = values?.[field.id] ?? "";

    if (inputType === "textarea") {
      wrapper.innerHTML = `
        <label>${escapeHtml(field.name)}</label>
        <textarea data-dyn-mode="${mode}" data-field-id="${field.id}">${escapeHtml(String(value))}</textarea>
      `;
    } else {
      wrapper.innerHTML = `
        <label>${escapeHtml(field.name)}</label>
        <input type="${inputType}" data-dyn-mode="${mode}" data-field-id="${field.id}" value="${escapeHtml(String(value))}" />
      `;
    }

    container.appendChild(wrapper);
  }
}

function collectDynamicValues(fields, container, mode) {
  const values = {};
  for (const field of fields) {
    const input = container.querySelector(`[data-dyn-mode="${mode}"][data-field-id="${field.id}"]`);
    if (!input) {
      values[field.id] = "";
      continue;
    }

    if (field.type === "number") {
      const numeric = Number.parseFloat(input.value);
      values[field.id] = Number.isNaN(numeric) ? "" : numeric;
    } else {
      values[field.id] = input.value.trim();
    }
  }
  return values;
}

function summarizeDynamicFields(fields, dynamicValues) {
  if (!fields || fields.length === 0) return "";

  const parts = [];
  for (const field of fields) {
    const value = dynamicValues?.[field.id];
    if (value === "" || value === undefined || value === null) continue;
    parts.push(`${field.name}: ${value}`);
  }

  return parts.slice(0, 2).join(" · ");
}

function renderTableHeaders(labels) {
  refs.thProduct.textContent = labels.product;
  refs.thSku.textContent = labels.sku;
  refs.thQuantity.textContent = labels.quantity;
  refs.thPrice.textContent = labels.price;
  refs.thTotal.textContent = labels.total;
  refs.thActions.textContent = labels.actions;
}

function moveItem(sourceId, targetId) {
  const active = getActiveInventory();
  if (!active || sourceId === targetId) return;

  const sourceIndex = active.items.findIndex((item) => item.id === sourceId);
  const targetIndex = active.items.findIndex((item) => item.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;

  const [sourceItem] = active.items.splice(sourceIndex, 1);
  active.items.splice(targetIndex, 0, sourceItem);
  persist();
  renderAll();
}

function moveInventory(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;

  const sourceIndex = state.inventories.findIndex((item) => item.id === sourceId);
  const targetIndex = state.inventories.findIndex((item) => item.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;

  const [source] = state.inventories.splice(sourceIndex, 1);
  state.inventories.splice(targetIndex, 0, source);
  persist();
  renderAll();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleCloudSave();
}

function loadState() {
  let loaded = loadFromKey(STORAGE_KEY);
  if (!loaded) {
    loaded = LEGACY_STORAGE_KEYS.map((key) => loadFromKey(key)).find((value) => Boolean(value));
  }
  if (!loaded) return;

  state.inventories = loaded.inventories.map((inventory, index) => normalizeInventory(inventory, index));
  state.activeInventoryId = loaded.activeInventoryId ?? state.inventories[0]?.id ?? null;
}

function loadFromKey(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.inventories)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function initCloudSync() {
  const hasCloudConfig = Boolean(APP_CONFIG.SUPABASE_URL && APP_CONFIG.SUPABASE_ANON_KEY);
  if (!hasCloudConfig || !window.supabase?.createClient) return;

  cloudState.client = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);

  await pullCloudState();
  subscribeCloudChanges();
  cloudState.isReady = true;
  scheduleCloudSave();
}

async function pullCloudState() {
  if (!cloudState.client) return;

  const { data, error } = await cloudState.client
    .from(CLOUD_TABLE)
    .select("payload,last_client_id")
    .eq("owner_key", cloudState.ownerKey)
    .maybeSingle();

  if (error) {
    console.error("Cloud pull error:", error.message);
    return;
  }

  if (!data?.payload) {
    return;
  }

  applyPayload(data.payload);
}

function subscribeCloudChanges() {
  if (!cloudState.client) return;

  cloudState.client
    .channel(`inventarios-${cloudState.ownerKey}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: CLOUD_TABLE,
        filter: `owner_key=eq.${cloudState.ownerKey}`,
      },
      (payload) => {
        const row = payload.new || payload.old;
        if (!row || row.last_client_id === CLIENT_ID) return;
        if (!row.payload) return;
        applyPayload(row.payload);
      },
    )
    .subscribe();
}

function scheduleCloudSave() {
  if (!cloudState.client || !cloudState.isReady) return;

  if (cloudState.saveTimer) {
    clearTimeout(cloudState.saveTimer);
  }

  cloudState.saveTimer = setTimeout(() => {
    upsertCloudState().catch((error) => {
      console.error("Cloud save error:", error?.message || error);
    });
  }, 250);
}

async function upsertCloudState() {
  if (!cloudState.client) return;

  const payload = buildPayload();
  const row = {
    owner_key: cloudState.ownerKey,
    payload,
    last_client_id: CLIENT_ID,
    updated_at: new Date().toISOString(),
  };

  const { error } = await cloudState.client.from(CLOUD_TABLE).upsert(row, { onConflict: "owner_key" });
  if (error) {
    throw error;
  }
}

function buildPayload() {
  return {
    inventories: state.inventories,
    activeInventoryId: state.activeInventoryId,
  };
}

function applyPayload(payload) {
  if (!payload || !Array.isArray(payload.inventories)) return;

  state.inventories = payload.inventories.map((inventory, index) => normalizeInventory(inventory, index));
  state.activeInventoryId = payload.activeInventoryId ?? state.inventories[0]?.id ?? null;
  renderAll();
}

function normalizeInventory(inventory, index) {
  const color = normalizeColor(inventory.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
  const labels = normalizeLabels(inventory.labels);
  const customFields = normalizeCustomFields(inventory.customFields);
  const items = Array.isArray(inventory.items) ? inventory.items : [];
  const nextSku = Number.isInteger(inventory.nextSku) ? inventory.nextSku : inferNextSku(items, inventory.name);

  return {
    id: inventory.id || crypto.randomUUID(),
    name: inventory.name || `Inventario ${index + 1}`,
    color,
    imageDataUrl: sanitizeImageDataUrl(inventory.imageDataUrl),
    movementLog: Array.isArray(inventory.movementLog)
      ? inventory.movementLog
          .map((move) => ({
            itemName: keepText(move.itemName, "Producto"),
            delta: Number(move.delta) || 0,
            date: move.date || new Date().toISOString(),
          }))
          .filter((move) => !Number.isNaN(new Date(move.date).getTime()))
      : [],
    labels,
    customFields,
    nextSku: Math.max(1, nextSku),
    items: items.map((item) => normalizeItem(item, inventory.name, customFields)),
    createdAt: inventory.createdAt || new Date().toISOString(),
  };
}

function normalizeItem(item, inventoryName, customFields) {
  const dynamicValues = {};
  for (const field of customFields) {
    dynamicValues[field.id] = item.dynamicValues?.[field.id] ?? "";
  }

  const qty = Math.max(0, Number(item.quantity) || 0);
  const createdAt = item.createdAt || new Date().toISOString();
  const movements = normalizeMovements(item.movements, qty, createdAt);

  return {
    id: item.id || crypto.randomUUID(),
    name: item.name || "Sin nombre",
    sku: item.sku || `${buildSkuPrefix(inventoryName)}-0000`,
    quantity: qty,
    price: Math.max(0, Number(item.price) || 0),
    dynamicValues,
    movements,
    createdAt,
  };
}

function normalizeMovements(movements, qty, createdAt) {
  if (Array.isArray(movements) && movements.length > 0) {
    return movements
      .map((move) => ({ date: move.date || createdAt, delta: Number(move.delta) || 0 }))
      .filter((move) => !Number.isNaN(new Date(move.date).getTime()));
  }
  return [{ date: createdAt, delta: qty }];
}

function normalizeCustomFields(fields) {
  if (!Array.isArray(fields)) return [];

  return fields
    .map((field) => ({
      id: field.id || crypto.randomUUID(),
      name: keepText(field.name, "Campo"),
      type: normalizeFieldType(field.type),
    }))
    .filter((field, index, arr) => arr.findIndex((entry) => entry.id === field.id) === index);
}

function normalizeFieldType(type) {
  const allowed = new Set(["text", "number", "date", "tel", "time", "duration", "textarea"]);
  return allowed.has(type) ? type : "text";
}

function getFieldTypeLabel(type) {
  switch (type) {
    case "number":
      return "Número";
    case "date":
      return "Fecha";
    case "tel":
      return "Teléfono";
    case "time":
      return "Hora";
    case "duration":
      return "Duración";
    case "textarea":
      return "Texto largo";
    default:
      return "Texto";
  }
}

function normalizeLabels(labels) {
  return {
    product: keepText(labels?.product, DEFAULT_LABELS.product),
    sku: keepText(labels?.sku, DEFAULT_LABELS.sku),
    quantity: keepText(labels?.quantity, DEFAULT_LABELS.quantity),
    price: keepText(labels?.price, DEFAULT_LABELS.price),
    total: keepText(labels?.total, DEFAULT_LABELS.total),
    actions: keepText(labels?.actions, DEFAULT_LABELS.actions),
  };
}

function inferNextSku(items, name) {
  const prefix = buildSkuPrefix(name);
  let max = 0;

  for (const item of items) {
    const match = String(item.sku || "").match(new RegExp(`^${prefix}-(\\d+)$`));
    if (!match) continue;
    const numeric = Number.parseInt(match[1], 10);
    if (numeric > max) max = numeric;
  }

  return max + 1;
}

function generateSku(inventory) {
  const sku = previewSku(inventory);
  inventory.nextSku += 1;
  return sku;
}

function previewSku(inventory) {
  const prefix = buildSkuPrefix(inventory.name);
  return `${prefix}-${String(inventory.nextSku).padStart(4, "0")}`;
}

function buildSkuPrefix(name) {
  const clean = String(name || "INV")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .toUpperCase();

  const letters = clean.replace(/\s+/g, "").slice(0, 4);
  return letters || "INV";
}

function pickColor() {
  return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
}

function normalizeColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "#1f7a8c";
}

function applyTheme(color) {
  const base = normalizeColor(color);
  const soft = mixHex(base, "#ffffff", 0.45);

  document.documentElement.style.setProperty("--accent", base);
  document.documentElement.style.setProperty("--accent-2", soft);
}

function applyInventoryBackground(imageDataUrl) {
  if (!imageDataUrl) {
    document.body.style.removeProperty("--inventory-image");
    document.body.classList.remove("has-inventory-image");
    return;
  }

  document.body.style.setProperty("--inventory-image", `url(${imageDataUrl})`);
  document.body.classList.add("has-inventory-image");
}

function mixHex(first, second, amount) {
  const a = first.replace("#", "");
  const b = second.replace("#", "");

  const ar = Number.parseInt(a.substring(0, 2), 16);
  const ag = Number.parseInt(a.substring(2, 4), 16);
  const ab = Number.parseInt(a.substring(4, 6), 16);

  const br = Number.parseInt(b.substring(0, 2), 16);
  const bg = Number.parseInt(b.substring(2, 4), 16);
  const bb = Number.parseInt(b.substring(4, 6), 16);

  const rr = Math.round(ar + (br - ar) * amount);
  const rg = Math.round(ag + (bg - ag) * amount);
  const rb = Math.round(ab + (bb - ab) * amount);

  return `#${toHex(rr)}${toHex(rg)}${toHex(rb)}`;
}

function toHex(value) {
  return value.toString(16).padStart(2, "0");
}

function toCurrency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    currencySign: "accounting",
    minimumFractionDigits: 2,
  }).format(value);
}

function toAccountingNumber(value) {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseAccountingNumber(value) {
  const clean = String(value || "")
    .replace(/\s/g, "")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\((.*)\)/, "-$1");
  const parsed = Number.parseFloat(clean);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function keepText(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function sanitizeImageDataUrl(value) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("data:image/")) return null;
  return value;
}

function readFileAsDataURL(file) {
  if (!file) return Promise.resolve(null);

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function getOrCreateOwnerKey() {
  const configured = String(APP_CONFIG.OWNER_KEY || "").trim();
  if (configured) {
    localStorage.setItem(OWNER_KEY_STORAGE, configured);
    return configured;
  }

  const existing = localStorage.getItem(OWNER_KEY_STORAGE);
  if (existing) return existing;

  const generated = crypto.randomUUID();
  localStorage.setItem(OWNER_KEY_STORAGE, generated);
  return generated;
}

function shorten(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function openDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "open");
  }
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
