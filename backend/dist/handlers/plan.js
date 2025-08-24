import { json, bad } from "../util/http.js";
import { scoreCandidates } from "../engine/score.js";
export const handler = async (event) => {
    if (!event.body)
        return bad("Missing body");
    let req;
    try {
        req = JSON.parse(event.body);
    }
    catch {
        return bad("Invalid JSON");
    }
    const { anchors, prefs, candidates = [], context } = req;
    const nowAnchor = anchors?.[0];
    const evals = scoreCandidates(nowAnchor, candidates, prefs, context?.crowdLevelHint ?? 0);
    const suggestions = evals.slice(0, 10).map((e) => {
        const found = candidates.find((c) => c.id === e.id);
        return {
            id: e.id,
            name: found.name,
            location: found.location,
            score: e.score,
            breakdown: e,
            reason: rationale(e.terms),
        };
    });
    const res = { suggestions, eval: evals };
    return json(200, res);
};
function rationale(terms) {
    if ((terms["openTerm"] ?? 0) > 0.5 && (terms["ratingTerm"] ?? 0) > 0.5) {
        return "Open now and highly rated";
    }
    if ((terms["distPenalty"] ?? 0) > -0.2)
        return "Nearby option with decent fit";
    return "Balanced tradeoff by preferences";
}
