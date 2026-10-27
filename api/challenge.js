const { challengePrompt, callGemini, parseJson, guard, fail } = require("./_ai");

module.exports = async (req, res) => {
  const g = await guard(req, res, "dare");
  if (!g) return;
  try {
    const text = await callGemini([{ text: challengePrompt(req.body || {}) }]);
    return res.status(200).json({ result: parseJson(text), left: Math.max(0, g.claim.limit - g.claim.used) });
  } catch (e) {
    return fail(res, e, g, "dare");
  }
};
