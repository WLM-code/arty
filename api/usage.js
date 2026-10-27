const { rpc, authUser, missingEnv, LIMITS } = require("./_ai");

module.exports = async (req, res) => {
  if (missingEnv().length) return res.status(500).json({ error: "Server not set up", detail: "Missing: " + missingEnv().join(", ") });
  const user = await authUser(req);
  if (!user) return res.status(401).json({ error: "Log in first" });
  try {
    const used = await rpc("peek_usage", { p_user: user.id, p_kind: "scan" });
    return res.status(200).json({ scan_limit: LIMITS().scan, scans_used: Number(used) || 0 });
  } catch (e) {
    console.error("Usage read failed:", e.message);
    return res.status(500).json({ error: "Usage read failed", detail: "Is supabase/setup.sql installed?" });
  }
};
