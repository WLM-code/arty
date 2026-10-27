// Called once a day by the cron job in vercel.json. A small database request keeps a free Supabase project from pausing.
module.exports = async (req, res) => {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(200).json({ ok: false });
  try {
    const r = await fetch(url.replace(/\/$/, "") + "/rest/v1/lessons?select=id&limit=1", { headers: { apikey: key } });
    return res.status(200).json({ ok: r.ok });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
};
