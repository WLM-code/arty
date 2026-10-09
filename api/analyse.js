const { ANALYSE_PROMPT, callGemini, parseJson, guard, fail } = require("./_ai");

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec((req.body && req.body.image) || "");
    if (!m) return res.status(400).json({ error: "Bad image" });
    const text = await callGemini([
      { inline_data: { mime_type: m[1], data: m[2] } },
      { text: ANALYSE_PROMPT },
    ]);
    return res.status(200).json(parseJson(text));
  } catch (e) { return fail(res, e); }
};
