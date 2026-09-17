const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const secretInput = document.getElementById("secret-input");
const loginBtn = document.getElementById("login-btn");
const authError = document.getElementById("auth-error");
const form = document.getElementById("entry-form");
const formError = document.getElementById("form-error");
const list = document.getElementById("entry-list");
const listEmpty = document.getElementById("list-empty");
const loading = document.getElementById("loading");
const currencySelect = document.getElementById("currency-select");
const rateInfo = document.getElementById("rate-info");
const categoryEmpty = document.getElementById("category-empty");

let trendChart = null;
let categoryChart = null;

function getToken() {
  return sessionStorage.getItem("app_secret");
}

const CURRENCY_META = {
  IDR: { symbol: "Rp", locale: "id-ID" },
  MYR: { symbol: "RM", locale: "ms-MY" },
  USD: { symbol: "$", locale: "en-US" },
  SGD: { symbol: "S$", locale: "en-SG" },
  CNY: { symbol: "¥", locale: "zh-CN" },
};

let currentRate = 1;
let currentCurrency = "IDR";

function getCachedRateKey(target) {
  const today = new Date().toISOString().slice(0, 10);
  return `fx_IDR_${target}_${today}`;
}

async function fetchRate(target) {
  if (target === "IDR") return 1;
  const cacheKey = getCachedRateKey(target);
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return Number(cached);

  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=IDR&symbols=${target}`,
    );
    const data = await res.json();
    const rate = data.rates[target];
    if (rate) {
      sessionStorage.setItem(cacheKey, rate);
      return rate;
    }
  } catch (e) {
    console.error("Gagal ambil kurs:", e);
  }
  return null;
}

async function updateCurrency() {
  const target = currencySelect.value;
  currentCurrency = target;

  if (target === "IDR") {
    currentRate = 1;
    rateInfo.textContent = "";
  } else {
    rateInfo.textContent = "Mengambil kurs...";
    const rate = await fetchRate(target);
    if (rate === null) {
      rateInfo.textContent = "Gagal ambil kurs, tetap Rp.";
      currentCurrency = "IDR";
      currentRate = 1;
      currencySelect.value = "IDR";
    } else {
      currentRate = rate;
      rateInfo.textContent = `1.000 Rp ≈ ${(rate * 1000).toFixed(2)} ${target}`;
    }
  }
  if (window.__lastEntries) renderEntries(window.__lastEntries);
}

currencySelect.addEventListener("change", updateCurrency);

function formatMoney(amountInIdr) {
  const converted = amountInIdr * currentRate;
  const meta = CURRENCY_META[currentCurrency];
  const decimals = currentCurrency === "IDR" ? 0 : 2;
  return (
    meta.symbol +
    converted.toLocaleString(meta.locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-app-secret": getToken() || "",
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    sessionStorage.removeItem("app_secret");
    showAuthScreen("Sesi berakhir atau password salah. Coba lagi.");
    throw new Error("Unauthorized");
  }
  return res;
}

function showAuthScreen(errMsg = "") {
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  authError.textContent = errMsg;
}

function showAppScreen() {
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  loadEntries();
}

loginBtn.addEventListener("click", async () => {
  const val = secretInput.value.trim();
  if (!val) return;
  sessionStorage.setItem("app_secret", val);
  try {
    const res = await apiFetch("/api/expenses");
    if (res.ok) showAppScreen();
  } catch (e) {
    /* handled in apiFetch */
  }
});

async function loadEntries() {
  loading.classList.remove("hidden");
  try {
    const res = await apiFetch("/api/expenses");
    const { data } = await res.json();
    renderEntries(data || []);
  } catch (e) {
    formError.textContent = "Gagal memuat data.";
  } finally {
    loading.classList.add("hidden");
  }
}

const CHART_COLORS = [
  "#ffb454",
  "#6ee7b7",
  "#8ab4ff",
  "#ff8585",
  "#c792ea",
  "#4fd1c5",
];

function renderEntries(entries) {
  window.__lastEntries = entries;
  list.innerHTML = "";
  let income = 0,
    expense = 0;

  const sorted = [...entries].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at),
  );

  sorted
    .slice()
    .reverse()
    .forEach((entry) => {
      const li = document.createElement("li");
      li.innerHTML = `
      <div class="entry-info">
        <span>${escapeHtml(entry.description)}</span>
        <span class="entry-category">${escapeHtml(entry.category || "")}</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="entry-amount ${entry.type === "income" ? "income-text" : "expense-text"}">
          ${entry.type === "income" ? "+" : "-"}${formatMoney(entry.amount)}
        </span>
        <button class="delete-btn" data-id="${entry.id}">✕</button>
      </div>
    `;
      list.appendChild(li);
    });
  listEmpty.classList.toggle("hidden", entries.length > 0);

  sorted.forEach((entry) => {
    if (entry.type === "income") income += Number(entry.amount);
    else expense += Number(entry.amount);
  });

  document.getElementById("total-income").textContent = formatMoney(income);
  document.getElementById("total-expense").textContent = formatMoney(expense);
  document.getElementById("total-balance").textContent = formatMoney(
    income - expense,
  );

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteEntry(btn.dataset.id));
  });

  renderTrendChart(sorted);
  renderCategoryChart(sorted);
}

function renderTrendChart(sortedEntries) {
  const ctx = document.getElementById("trend-chart");
  let running = 0;
  const labels = [];
  const values = [];

  sortedEntries.forEach((entry) => {
    running +=
      entry.type === "income" ? Number(entry.amount) : -Number(entry.amount);
    labels.push(
      new Date(entry.created_at).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      }),
    );
    values.push(running * currentRate);
  });

  if (values.length === 0) {
    labels.push("");
    values.push(0);
  }

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderColor: "#ffb454",
          backgroundColor: "rgba(255,180,84,0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: "#8a90a3", maxTicksLimit: 6 },
          grid: { display: false },
        },
        y: { ticks: { color: "#8a90a3" }, grid: { color: "#2a2f3c" } },
      },
    },
  });
}

function renderCategoryChart(sortedEntries) {
  const ctx = document.getElementById("category-chart");
  const byCategory = {};
  sortedEntries
    .filter((e) => e.type === "expense")
    .forEach((e) => {
      const cat = e.category || "lainnya";
      byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount);
    });

  const labels = Object.keys(byCategory);
  const values = labels.map((l) => byCategory[l] * currentRate);

  categoryEmpty.classList.toggle("hidden", labels.length > 0);

  if (categoryChart) categoryChart.destroy();
  if (labels.length === 0) return;

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: CHART_COLORS,
          borderColor: "#1a1d27",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#8a90a3", boxWidth: 10, font: { size: 11 } },
        },
      },
    },
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";

  const description = document.getElementById("description").value.trim();
  const amount = Number(document.getElementById("amount").value);
  const category = document.getElementById("category").value;
  const type = document.getElementById("type").value;

  if (!description || !amount || amount <= 0) {
    formError.textContent = "Isi deskripsi dan jumlah dengan benar.";
    return;
  }

  try {
    const res = await apiFetch("/api/expenses", {
      method: "POST",
      body: JSON.stringify({ description, amount, category, type }),
    });
    if (!res.ok) {
      const err = await res.json();
      formError.textContent = err.error || "Gagal menambah data.";
      return;
    }
    form.reset();
    loadEntries();
  } catch (e) {
    formError.textContent = "Terjadi kesalahan jaringan.";
  }
});

async function deleteEntry(id) {
  try {
    await apiFetch(`/api/expenses?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    loadEntries();
  } catch (e) {
    formError.textContent = "Gagal menghapus data.";
  }
}

if (getToken()) {
  showAppScreen();
} else {
  showAuthScreen();
}
