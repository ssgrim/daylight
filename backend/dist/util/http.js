const CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization"
};
export const json = (statusCode, body) => ({
    statusCode,
    headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        ...CORS
    },
    body: JSON.stringify(body)
});
export const bad = (msg, statusCode = 400) => json(statusCode, { error: msg });
