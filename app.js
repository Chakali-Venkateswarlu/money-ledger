(() => {
  "use strict";

  // Change this to your local currency symbol.
  const CURRENCY_SYMBOL = "₹";

  // This order is just the dropdown/list display order — each category's color
  // comes from its own colorVar, not its position, so reordering here never
  // changes anyone's color. ids "food", "shopping", "travel", "bills", "others"
  // are reused from the original category set so existing transactions keep
  // their meaning after the rename.
  const CATEGORIES = [
    { id: "food", name: "🍱 Food", colorVar: "--cat-1" },
    { id: "rent", name: "🏠 Rent", colorVar: "--cat-9" },
    { id: "to_house", name: "🛒 To House", colorVar: "--cat-10" },
    { id: "travel", name: "🚌 Transport", colorVar: "--cat-3" },
    { id: "bills", name: "📱 Bills/Recharge", colorVar: "--cat-4" },
    { id: "clothing", name: "👕 Clothing", colorVar: "--cat-11" },
    { id: "shopping", name: "🛍️ Personal Shopping", colorVar: "--cat-2" },
    { id: "others", name: "📦 Others", colorVar: "--cat-7" },
    { id: "scheme", name: "🚨 Scheme", colorVar: "--cat-8" },
  ];

  // Retired categories — no longer offered for new expenses, but kept here so
  // old transactions still show their real name/color instead of "Others",
  // still count in the stats and chart, and don't get silently reassigned if
  // you open one of them to edit just the amount or note.
  const LEGACY_CATEGORIES = [
    { id: "entertainment", name: "🎬 Entertainment", colorVar: "--cat-5" },
    { id: "health", name: "🏥 Health", colorVar: "--cat-6" },
  ];

  const ALL_CATEGORIES = [...CATEGORIES, ...LEGACY_CATEGORIES];
  const CATEGORY_BY_ID = Object.fromEntries(ALL_CATEGORIES.map(c => [c.id, c]));

  // ---------- state ----------
  let transactions = [];
  let viewMonth = todayDate().slice(0, 7); // "YYYY-MM"
  let categoryFilter = "";
  let authMode = "signin"; // "signin" | "signup"

  function todayDate() {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
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

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  // ---------- DOM refs ----------
  const el = {
    authView: document.getElementById("authView"),
    appView: document.getElementById("appView"),
    authForm: document.getElementById("authForm"),
    authEmail: document.getElementById("authEmail"),
    authPassword: document.getElementById("authPassword"),
    authError: document.getElementById("authError"),
    authNotice: document.getElementById("authNotice"),
    authSubmit: document.getElementById("authSubmit"),
    authToggleText: document.getElementById("authToggleText"),
    authToggleBtn: document.getElementById("authToggleBtn"),
    accountEmail: document.getElementById("accountEmail"),
    signOutBtn: document.getElementById("signOutBtn"),

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
    saveBtn: document.getElementById("saveBtn"),
    exportJson: document.getElementById("exportJson"),
    exportCsv: document.getElementById("exportCsv"),
    importFile: document.getElementById("importFile"),
    clearAll: document.getElementById("clearAll"),
  };

  // ---------- Supabase setup ----------
  const config = window.SUPABASE_CONFIG || {};
  const isConfigured = config.url && config.anonKey && !config.url.includes("YOUR_SUPABASE_URL");

  if (!isConfigured) {
    el.authView.hidden = false;
    el.authView.innerHTML = `
      <div class="auth-card">
        <div class="brand auth-brand">
          <span class="brand-mark">💰</span>
          <span class="brand-name">Money Ledger</span>
        </div>
        <p class="auth-sub">Not configured yet.</p>
        <p class="auth-error" style="display:block">
          Edit <code>config.js</code> and set your Supabase project URL and anon key
          (Project Settings → API in your Supabase dashboard), then reload this page.
          Run <code>schema.sql</code> in the Supabase SQL editor first if you haven't.
        </p>
      </div>`;
    return;
  }

  const sb = window.supabase.createClient(config.url, config.anonKey);

  // ---------- init selects ----------
  function populateCategoryOptions() {
    // Add/edit dropdown only offers the current 9 categories.
    el.category.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  }

  function populateCategorySelects() {
    populateCategoryOptions();
    // The filter can still find old transactions filed under a retired category.
    el.categoryFilter.innerHTML =
      `<option value="">All categories</option>` +
      ALL_CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  }

  // If a transaction's category isn't in the current dropdown (a retired
  // category), add it as a one-off option so editing the transaction doesn't
  // silently reassign it to whatever option happens to be first.
  function ensureCategoryOption(id) {
    if (el.category.querySelector(`option[value="${CSS.escape(id)}"]`)) return;
    const cat = CATEGORY_BY_ID[id];
    const option = document.createElement("option");
    option.value = id;
    option.textContent = cat ? cat.name : id;
    el.category.prepend(option);
  }

  // ---------- derived data ----------
  function transactionsForMonth(ym) {
    return transactions.filter(t => t.date.startsWith(ym));
  }

  function categoryTotals(list) {
    const totals = Object.fromEntries(ALL_CATEGORIES.map(c => [c.id, 0]));
    for (const t of list) {
      totals[t.category] = (totals[t.category] || 0) + Number(t.amount);
    }
    return totals;
  }

  // ---------- rendering ----------
  function renderMonthLabel() {
    el.monthLabel.textContent = monthLabel(viewMonth);
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

    const rows = ALL_CATEGORIES
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
      const items = byDate[date].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      const dayTotal = items.reduce((s, t) => s + Number(t.amount), 0);
      const rows = items.map(t => {
        const cat = CATEGORY_BY_ID[t.category] || ALL_CATEGORIES[ALL_CATEGORIES.length - 1];
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

  function renderAll() {
    renderMonthLabel();
    renderStats();
    renderCategoryChart();
    renderTxList();
  }

  // ---------- data (Supabase) ----------
  async function fetchTransactions() {
    const { data, error } = await sb
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });
    if (error) {
      alert("Could not load your transactions: " + error.message);
      return;
    }
    transactions = data;
    renderAll();
  }

  async function createTransaction({ amount, category, date, note }) {
    const { data, error } = await sb
      .from("transactions")
      .insert({ amount, category, date, note: note || null })
      .select()
      .single();
    if (error) {
      alert("Could not save this expense: " + error.message);
      return;
    }
    transactions.push(data);
  }

  async function updateTransaction(id, { amount, category, date, note }) {
    const { data, error } = await sb
      .from("transactions")
      .update({ amount, category, date, note: note || null })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      alert("Could not update this expense: " + error.message);
      return;
    }
    const idx = transactions.findIndex(t => t.id === id);
    if (idx !== -1) transactions[idx] = data;
  }

  async function deleteTransaction(id) {
    const { error } = await sb.from("transactions").delete().eq("id", id);
    if (error) {
      alert("Could not delete this expense: " + error.message);
      return;
    }
    transactions = transactions.filter(t => t.id !== id);
  }

  // ---------- dialog ----------
  function openAddDialog() {
    populateCategoryOptions();
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
    populateCategoryOptions();
    ensureCategoryOption(tx.category);
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

  async function handleFormSubmit(e) {
    e.preventDefault();
    const id = el.editId.value;
    const amount = parseFloat(el.amount.value);
    const category = el.category.value;
    const date = el.date.value;
    const note = el.note.value.trim().slice(0, 120);

    if (!amount || amount <= 0 || !date) return;

    el.saveBtn.disabled = true;
    if (id) {
      await updateTransaction(id, { amount, category, date, note });
    } else {
      await createTransaction({ amount, category, date, note });
    }
    el.saveBtn.disabled = false;

    viewMonth = date.slice(0, 7);
    closeDialog();
    renderAll();
  }

  async function handleDelete() {
    const id = el.editId.value;
    if (!id) return;
    if (!confirm("Delete this transaction?")) return;
    await deleteTransaction(id);
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

  async function importJson(file) {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("Invalid file format");
    } catch (err) {
      alert("Could not import this file: " + err.message);
      return;
    }

    const valid = data.filter(t => t && t.amount && t.date && t.category);
    if (!confirm(`Import ${valid.length} transaction(s)? They'll be added to your account.`)) return;

    const rows = valid.map(t => ({
      amount: Number(t.amount),
      category: CATEGORY_BY_ID[t.category] ? t.category : "others",
      date: t.date,
      note: t.note || null,
    }));

    const { error } = await sb.from("transactions").insert(rows);
    if (error) {
      alert("Import failed: " + error.message);
      return;
    }
    await fetchTransactions();
  }

  async function clearAll() {
    if (!confirm("Delete ALL transactions? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? Consider exporting a backup first.")) return;
    const { error } = await sb.from("transactions").delete().gte("created_at", "1900-01-01");
    if (error) {
      alert("Could not clear data: " + error.message);
      return;
    }
    transactions = [];
    renderAll();
  }

  // ---------- auth ----------
  function setAuthMode(mode) {
    authMode = mode;
    el.authError.hidden = true;
    el.authNotice.hidden = true;
    if (mode === "signin") {
      el.authSubmit.textContent = "Sign in";
      el.authToggleText.textContent = "Don't have an account?";
      el.authToggleBtn.textContent = "Create one";
      el.authPassword.autocomplete = "current-password";
    } else {
      el.authSubmit.textContent = "Create account";
      el.authToggleText.textContent = "Already have an account?";
      el.authToggleBtn.textContent = "Sign in";
      el.authPassword.autocomplete = "new-password";
    }
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    el.authError.hidden = true;
    el.authNotice.hidden = true;
    el.authSubmit.disabled = true;

    const email = el.authEmail.value.trim();
    const password = el.authPassword.value;

    try {
      if (authMode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setAuthMode("signin");
          el.authNotice.hidden = false;
          el.authNotice.textContent = "Account created. Check your email to confirm it, then sign in.";
        }
      }
    } catch (err) {
      el.authError.hidden = false;
      el.authError.textContent = err.message || "Something went wrong.";
    }
    el.authSubmit.disabled = false;
  }

  async function handleSignOut() {
    await sb.auth.signOut();
  }

  function showAuthView() {
    el.appView.hidden = true;
    el.authView.hidden = false;
    transactions = [];
  }

  async function showAppView(session) {
    el.authView.hidden = true;
    el.appView.hidden = false;
    el.accountEmail.textContent = session.user.email;
    await fetchTransactions();
  }

  sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showAppView(session);
    } else {
      showAuthView();
    }
  });

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

  el.authForm.addEventListener("submit", handleAuthSubmit);
  el.authToggleBtn.addEventListener("click", () => setAuthMode(authMode === "signin" ? "signup" : "signin"));
  el.signOutBtn.addEventListener("click", handleSignOut);

  // ---------- boot ----------
  populateCategorySelects();
  setAuthMode("signin");
})();
