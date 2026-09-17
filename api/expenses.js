// api/expenses.js
// Vercel Serverless Function — jalan di server, aman untuk simpan credential.
const { createClient } = require('@supabase/supabase-js');

// Service Role Key HANYA dipakai di sini (server), TIDAK PERNAH dikirim ke browser.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APP_SECRET = process.env.APP_SECRET; // password sederhana untuk lindungi API-mu

function checkAuth(req) {
  const token = req.headers['x-app-secret'];
  return APP_SECRET && token === APP_SECRET;
}

function isValidEntry(body) {
  if (!body) return false;
  const { description, amount, type } = body;
  if (typeof description !== 'string' || description.trim().length === 0 || description.length > 100) return false;
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0 || amount > 1_000_000_000) return false;
  if (type !== 'income' && type !== 'expense') return false;
  return true;
}

module.exports = async (req, res) => {
  // Batasi origin sederhana (opsional, sesuaikan domain Vercel-mu setelah deploy)
  res.setHeader('Content-Type', 'application/json');

  // --- AUTH GATE ---
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing x-app-secret header' });
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ data });
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!isValidEntry(body)) {
        return res.status(400).json({ error: 'Data tidak valid. Cek description, amount, type.' });
      }

      const category = typeof body.category === 'string' ? body.category.slice(0, 50) : 'lainnya';

      const { data, error } = await supabase
        .from('expenses')
        .insert([{
          description: body.description.trim(),
          amount: body.amount,
          category,
          type: body.type,
        }])
        .select();

      if (error) throw error;
      return res.status(201).json({ data: data[0] });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID tidak valid' });
      }

      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
