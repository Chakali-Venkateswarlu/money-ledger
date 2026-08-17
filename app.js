(() => {
  "use strict";

  // Change this to your local currency symbol.
  const CURRENCY_SYMBOL = "₹";
  const STORAGE_KEY = "money-ledger-transactions";

  // Fixed order — do not reorder (keeps chart colors stable & CVD-safe adjacency).
  const CATEGORIES = [
    { id: "food", name: "Food", colorVar: "--cat-1" },
    { id: "shopping", name: "Shopping", colorVar: "--cat-2" },
    { id: "travel", name: "Travel", colorVar: "--cat-3" },
    { id: "bills", name: "Bills", colorVar: "--cat-4" },
    { id: "entertainment", name: "Entertainment", colorVar: "--cat-5" },
    { id: "health", name: "Health", colorVar: "--cat-6" },
    { id: "others", name: "Others", colorVar: "--cat-7" },
  ];
  const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

  // ---------- state ----------
  let transactions = loadTransactions();
  let viewMonth = todayDate().slice(0, 7); // "YYYY-MM"
  let categoryFilter = "";

  // ---------- storage ----------
  function loadTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to load transactions", e);
      return [];
    }
  }

  function saveTransactions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }

  function todayDate() {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- formatting ----------
  function formatMoney(amount) {
    const n = Number(amount) || 0;
    return CURRENCY_SYMBOL + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function monthLabel(ym) {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function groupDateLabel(dateStr) {
    const today = todayDate();
    const yesterday = new Date(Date.now() - 86400000);
    const tz = yesterday.getTimezoneOffset() * 60000;
    const yStr = new Date(yesterday - tz).toISOString().slice(0, 10);
    if (dateStr === today) return "Today";
    if (dateStr === yStr) return "Yesterday";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  }

  function startOfWeek(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDay(); // 0 = Sunday
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  }

  // ---------- DOM refs ----------
  const el = {
    monthLabel: document.getElementById("monthLabel"),
    prevMonth: document.getElementById("prevMonth"),
    nextMonth: document.getElementById("nextMonth"),
    statToday: document.getElementById("statToday"),
    statWeek: document.getElementById("statWeek"),
    statMonth: document.getElementById("statMonth"),
    statMonthLabel: document.getElementById("statMonthLabel"),
    statAvg: document.getElementById("statAvg"),
    categoryChart: document.getElementById("categoryChart"),
    chartEmpty: document.getElementById("chartEmpty"),
    categoryFilter: document.getElementById("categoryFilter"),
    txList: document.getElementById("txList"),
    txEmpty: document.getElementById("txEmpty"),
    addFab: document.getElementById("addFab"),
    addDialog: document.getElementById("addDialog"),
    addForm: document.getElementById("addForm"),
    dialogTitle: document.getElementById("dialogTitle"),
    editId: document.getElementById("editId"),
    amount: document.getElementById("amount"),
    category: document.getElementById("category"),
    date: document.getElementById("date"),
    note: document.getElementById("note"),
    deleteBtn: document.getElementById("deleteBtn"),
    cancelBtn: document.getElementById("cancelBtn"),
    exportJson: document.getElementById("exportJson"),
    exportCsv: document.getElementById("exportCsv"),
    importFile: document.getElementById("importFile"),
    clearAll: document.getElementById("clearAll"),
  };

  // ---------- init selects ----------
  function populateCategorySelects() {
    el.category.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    el.categoryFilter.innerHTML =
      `<option value="">All categories</option>` +
      CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  }

  // ---------- derived data ----------
  function transactionsForMonth(ym) {
    return transactions.filter(t => t.date.startsWith(ym));
  }

  function categoryTotals(list) {
    const totals = Object.fromEntries(CATEGORIES.map(c => [c.id, 0]));
    for (const t of list) {
      totals[t.category] = (totals[t.category] || 0) + Number(t.amount);
    }
    return totals;
  }

  // ---------- rendering ----------
  function renderMonthLabel() {
    el.monthLabel.textContent = monthLabel(viewMonth);
    const now = new Date();
    const isCurrent = viewMonth === todayDate().slice(0, 7);
    el.statMonthLabel.textContent = isCurrent ? "This month" : monthLabel(viewMonth);
  }

  function renderStats() {
    const today = todayDate();
    const weekStart = startOfWeek(today);

    const todayTotal = transactions
      .filter(t => t.date === today)
      .reduce((s, t) => s + Number(t.amount), 0);

    const weekTotal = transactions
      .filter(t => t.date >= weekStart && t.date <= today)
      .reduce((s, t) => s + Number(t.amount), 0);

    const monthList = transactionsForMonth(viewMonth);
    const monthTotal = monthList.reduce((s, t) => s + Number(t.amount), 0);

    const isCurrentMonth = viewMonth === today.slice(0, 7);
    const daysElapsed = isCurrentMonth
      ? Number(today.slice(8, 10))
      : new Date(Number(viewMonth.slice(0, 4)), Number(viewMonth.slice(5, 7)), 0).getDate();
    const avg = daysElapsed > 0 ? monthTotal / daysElapsed : 0;

    el.statToday.textContent = formatMoney(todayTotal);
    el.statWeek.textContent = formatMoney(weekTotal);
    el.statMonth.textContent = formatMoney(monthTotal);
    el.statAvg.textContent = formatMoney(avg);
  }

  function renderCategoryChart() {
    const monthList = transactionsForMonth(viewMonth);
    const totals = categoryTotals(monthList);
    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

    if (grandTotal === 0) {
      el.categoryChart.innerHTML = "";
      el.chartEmpty.hidden = false;
      return;
    }
    el.chartEmpty.hidden = true;

    const rows = CATEGORIES
      .map(c => ({ ...c, amount: totals[c.id] }))
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    el.categoryChart.innerHTML = rows.map(c => {
      const pct = Math.max((c.amount / grandTotal) * 100, 1.5);
      return `
        <div class="cat-row">
          <div class="cat-name">
            <span class="cat-swatch" style="background: var(${c.colorVar})"></span>
            ${c.name}
          </div>
          <div class="cat-track">
            <div class="cat-fill" style="width:${pct}%; background: var(${c.colorVar})"></div>
          </div>
          <div class="cat-amount">${formatMoney(c.amount)}</div>
        </div>`;
    }).join("");
  }

  function renderTxList() {
    let list = transactionsForMonth(viewMonth);
    if (categoryFilter) list = list.filter(t => t.category === categoryFilter);

    if (list.length === 0) {
      el.txList.innerHTML = "";
      el.txEmpty.hidden = false;
      return;
    }
    el.txEmpty.hidden = true;

    const byDate = {};
    for (const t of list) {
      (byDate[t.date] = byDate[t.date] || []).push(t);
    }
    const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));

    el.txList.innerHTML = dates.map(date => {
      const items = byDate[date].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const dayTotal = items.reduce((s, t) => s + Number(t.amount), 0);
      const rows = items.map(t => {
        const cat = CATEGORY_BY_ID[t.category] || CATEGORIES[CATEGORIES.length - 1];
        return `
          <div class="tx-item" data-id="${t.id}" role="button" tabindex="0">
            <span class="tx-dot" style="background: var(${cat.colorVar})"></span>
            <div class="tx-info">
              <div class="tx-category">${cat.name}</div>
              ${t.note ? `<div class="tx-note">${escapeHtml(t.note)}</div>` : ""}
            </div>
            <div class="tx-amount">${formatMoney(t.amount)}</div>
          </div>`;
      }).join("");

      return `
        <div class="tx-group">
          <div class="tx-group-label"><span>${groupDateLabel(date)}</span><span>${formatMoney(dayTotal)}</span></div>
          ${rows}
        </div>`;
    }).join("");
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function renderAll() {
    renderMonthLabel();
    renderStats();
    renderCategoryChart();
    renderTxList();
  }

  // ---------- dialog ----------
  function openAddDialog() {
    el.dialogTitle.textContent = "Add expense";
    el.editId.value = "";
    el.amount.value = "";
    el.category.value = CATEGORIES[0].id;
    el.date.value = todayDate();
    el.note.value = "";
    el.deleteBtn.hidden = true;
    el.addDialog.showModal();
    setTimeout(() => el.amount.focus(), 0);
  }

  function openEditDialog(tx) {
    el.dialogTitle.textContent = "Edit expense";
    el.editId.value = tx.id;
    el.amount.value = tx.amount;
    el.category.value = tx.category;
    el.date.value = tx.date;
    el.note.value = tx.note || "";
    el.deleteBtn.hidden = false;
    el.addDialog.showModal();
  }

  function closeDialog() {
    el.addDialog.close();
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const id = el.editId.value;
    const amount = parseFloat(el.amount.value);
    const category = el.category.value;
    const date = el.date.value;
    const note = el.note.value.trim().slice(0, 120);

    if (!amount || amount <= 0 || !date) return;

    if (id) {
      const tx = transactions.find(t => t.id === id);
      if (tx) {
        tx.amount = amount;
        tx.category = category;
        tx.date = date;
        tx.note = note;
      }
    } else {
      transactions.push({ id: uid(), amount, category, date, note, createdAt: new Date().toISOString() });
    }
    saveTransactions();
    viewMonth = date.slice(0, 7);
    closeDialog();
    renderAll();
  }

  function handleDelete() {
    const id = el.editId.value;
    if (!id) return;
    if (!confirm("Delete this transaction?")) return;
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();
    closeDialog();
    renderAll();
  }

  // ---------- export / import ----------
  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    downloadBlob("money-ledger.json", JSON.stringify(transactions, null, 2), "application/json");
  }

  function exportCsv() {
    const header = "date,category,amount,note";
    const rows = transactions
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map(t => [t.date, t.category, t.amount, (t.note || "").replace(/"/g, '""')].map(v => `"${v}"`).join(","));
    downloadBlob("money-ledger.csv", [header, ...rows].join("\n"), "text/csv");
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error("Invalid file format");
        const valid = data.filter(t => t && t.amount && t.date && t.category);
        if (!confirm(`Import ${valid.length} transaction(s)? This will be merged with existing data.`)) return;
        const existingIds = new Set(transactions.map(t => t.id));
        for (const t of valid) {
          transactions.push({
            id: existingIds.has(t.id) ? uid() : (t.id || uid()),
            amount: Number(t.amount),
            category: CATEGORY_BY_ID[t.category] ? t.category : "others",
            date: t.date,
            note: t.note || "",
            createdAt: t.createdAt || new Date().toISOString(),
          });
        }
        saveTransactions();
        renderAll();
      } catch (err) {
        alert("Could not import this file: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function clearAll() {
    if (!confirm("Delete ALL transactions? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? Consider exporting a backup first.")) return;
    transactions = [];
    saveTransactions();
    renderAll();
  }

  // ---------- events ----------
  el.prevMonth.addEventListener("click", () => {
    const [y, m] = viewMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    viewMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    renderAll();
  });

  el.nextMonth.addEventListener("click", () => {
    const [y, m] = viewMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    viewMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    renderAll();
  });

  el.categoryFilter.addEventListener("change", () => {
    categoryFilter = el.categoryFilter.value;
    renderTxList();
  });

  el.addFab.addEventListener("click", openAddDialog);
  el.cancelBtn.addEventListener("click", closeDialog);
  el.addForm.addEventListener("submit", handleFormSubmit);
  el.deleteBtn.addEventListener("click", handleDelete);

  el.txList.addEventListener("click", (e) => {
    const item = e.target.closest(".tx-item");
    if (!item) return;
    const tx = transactions.find(t => t.id === item.dataset.id);
    if (tx) openEditDialog(tx);
  });
  el.txList.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const item = e.target.closest(".tx-item");
    if (!item) return;
    e.preventDefault();
    const tx = transactions.find(t => t.id === item.dataset.id);
    if (tx) openEditDialog(tx);
  });

  el.exportJson.addEventListener("click", exportJson);
  el.exportCsv.addEventListener("click", exportCsv);
  el.importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importJson(file);
    e.target.value = "";
  });
  el.clearAll.addEventListener("click", clearAll);

  // ---------- boot ----------
  populateCategorySelects();
  renderAll();
})();
