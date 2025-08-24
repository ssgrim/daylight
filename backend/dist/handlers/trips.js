import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "../lib/dynamo.js";
import { json, bad } from "../util/http.js";
import { randomUUID } from "node:crypto";
const nowIso = () => new Date().toISOString();
export const handler = async (event) => {
    const { httpMethod, pathParameters } = event;
    if (httpMethod === "POST")
        return createTrip(event.body);
    const id = pathParameters?.tripId;
    if (!id)
        return bad("Missing tripId", 400);
    if (httpMethod === "GET")
        return getTrip(id);
    if (httpMethod === "PUT")
        return updateTrip(id, event.body);
    if (httpMethod === "DELETE")
        return deleteTrip(id);
    return bad("Unsupported method", 405);
};
async function createTrip(body) {
    if (!body)
        return bad("Missing body");
    let payload;
    try {
        payload = JSON.parse(body);
    }
    catch {
        return bad("Invalid JSON");
    }
    const tripId = randomUUID();
    const trip = {
        tripId,
        name: payload.name || "Untitled Trip",
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        anchors: payload.anchors || [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };
    await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: { pk: `TRIP#${tripId}`, sk: "META", ...trip },
    }));
    return json(201, { tripId });
}
async function getTrip(tripId) {
    const { Item } = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { pk: `TRIP#${tripId}`, sk: "META" },
    }));
    if (!Item)
        return bad("Not found", 404);
    const { pk, sk, ...trip } = Item;
    return json(200, trip);
}
async function updateTrip(tripId, body) {
    if (!body)
        return bad("Missing body");
    let payload;
    try {
        payload = JSON.parse(body);
    }
    catch {
        return bad("Invalid JSON");
    }
    const current = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { pk: `TRIP#${tripId}`, sk: "META" },
    }));
    if (!current.Item)
        return bad("Not found", 404);
    const merged = { ...current.Item, ...payload, updatedAt: nowIso() };
    await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: merged,
    }));
    const { pk, sk, ...trip } = merged;
    return json(200, trip);
}
async function deleteTrip(tripId) {
    await ddb.send(new DeleteCommand({
        TableName: TABLE,
        Key: { pk: `TRIP#${tripId}`, sk: "META" },
    }));
    return json(204, {});
}
