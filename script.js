const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const secretInput = document.getElementById('secret-input');
const loginBtn = document.getElementById('login-btn');
const authError = document.getElementById('auth-error');
const form = document.getElementById('entry-form');
const formError = document.getElementById('form-error');
const list = document.getElementById('entry-list');
const loading = document.getElementById('loading');

// Token disimpan di sessionStorage saja (hilang saat tab ditutup) — bukan localStorage,
// supaya tidak "nempel" permanen di browser device bersama.
function getToken() {
  return sessionStorage.getItem('app_secret');
}

function formatRupiah(num) {
  return 'Rp' + Number(num).toLocaleString('id-ID');
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-app-secret': getToken() || '',
      ...(options.headers || {})
    }
  });

  if (res.status === 401) {
    sessionStorage.removeItem('app_secret');
    showAuthScreen('Sesi berakhir atau password salah. Coba lagi.');
    throw new Error('Unauthorized');
  }
  return res;
}

function showAuthScreen(errMsg = '') {
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
  authError.textContent = errMsg;
}

function showAppScreen() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  loadEntries();
}

loginBtn.addEventListener('click', async () => {
  const val = secretInput.value.trim();
  if (!val) return;
  sessionStorage.setItem('app_secret', val);

  // Validasi langsung dengan coba GET data
  try {
    const res = await apiFetch('/api/expenses');
    if (res.ok) {
      showAppScreen();
    }
  } catch (e) {
    // showAuthScreen sudah dipanggil di apiFetch kalau 401
  }
});

async function loadEntries() {
  loading.classList.remove('hidden');
  list.innerHTML = '';
  try {
    const res = await apiFetch('/api/expenses');
    const { data } = await res.json();
    renderEntries(data || []);
  } catch (e) {
    formError.textContent = 'Gagal memuat data.';
  } finally {
    loading.classList.add('hidden');
  }
}

function renderEntries(entries) {
  list.innerHTML = '';
  let income = 0, expense = 0;

  entries.forEach(entry => {
    if (entry.type === 'income') income += Number(entry.amount);
    else expense += Number(entry.amount);

    const li = document.createElement('li');
    li.innerHTML = `
      <div class="entry-info">
        <span>${escapeHtml(entry.description)}</span>
        <span class="entry-category">${escapeHtml(entry.category || '')}</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="entry-amount ${entry.type === 'income' ? 'income-text' : 'expense-text'}">
          ${entry.type === 'income' ? '+' : '-'}${formatRupiah(entry.amount)}
        </span>
        <button class="delete-btn" data-id="${entry.id}">✕</button>
      </div>
    `;
    list.appendChild(li);
  });

  document.getElementById('total-income').textContent = formatRupiah(income);
  document.getElementById('total-expense').textContent = formatRupiah(expense);
  document.getElementById('total-balance').textContent = formatRupiah(income - expense);

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteEntry(btn.dataset.id));
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';

  const description = document.getElementById('description').value.trim();
  const amount = Number(document.getElementById('amount').value);
  const category = document.getElementById('category').value;
  const type = document.getElementById('type').value;

  if (!description || !amount || amount <= 0) {
    formError.textContent = 'Isi deskripsi dan jumlah dengan benar.';
    return;
  }

  try {
    const res = await apiFetch('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({ description, amount, category, type })
    });

    if (!res.ok) {
      const err = await res.json();
      formError.textContent = err.error || 'Gagal menambah data.';
      return;
    }

    form.reset();
    loadEntries();
  } catch (e) {
    formError.textContent = 'Terjadi kesalahan jaringan.';
  }
});

async function deleteEntry(id) {
  try {
    await apiFetch(`/api/expenses?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadEntries();
  } catch (e) {
    formError.textContent = 'Gagal menghapus data.';
  }
}

// Cek apakah sudah ada token tersimpan di sesi ini
if (getToken()) {
  showAppScreen();
} else {
  showAuthScreen();
}
