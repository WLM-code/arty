const { challengePrompt, callGemini, parseJson, guard, fail } = require("./_ai");

module.exports = async (req, res) => {
  if (!guard(req, res)) return;
  try {
    const text = await callGemini([{ text: challengePrompt(req.body || {}) }]);
    return res.status(200).json(parseJson(text));
  } catch (e) { return fail(res, e); }
};
