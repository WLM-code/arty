const { ANALYSE_PROMPT, callGemini, parseJson, guard, fail } = require("./_ai");

module.exports = async (req, res) => {
  const g = await guard(req, res, "scan");
  if (!g) return;
  try {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec((req.body && req.body.image) || "");
    if (!m) {
      await require("./_ai").rpc("refund_usage", { p_user: g.user.id, p_kind: "scan" }).catch(() => {});
      return res.status(400).json({ error: "Bad image" });
    }
    const text = await callGemini([{ inline_data: { mime_type: m[1], data: m[2] } }, { text: ANALYSE_PROMPT }]);
    const result = parseJson(text);
    return res.status(200).json({ result, left: Math.max(0, g.claim.limit - g.claim.used), limit: g.claim.limit });
  } catch (e) {
    return fail(res, e, g, "scan");
  }
};
