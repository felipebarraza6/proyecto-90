import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MESSAGES_STREAM_PATH,
  MESSAGES_STREAM_TOKEN_PATH,
  SSE_EVENT_CONNECTED,
  SSE_EVENT_HEARTBEAT,
  SSE_EVENT_MESSAGE,
  SSE_EVENT_TIMEOUT,
  buildStreamUrl,
  mergeMessageThread,
  parseStreamMessageEvent,
  participantCanOpenMessages,
} from "../app/weekly-panel/messageStream.ts";

describe("messageStream helpers (yggdra_infra #105)", () => {
  it("mergeMessageThread deduplica por id y ordena por fecha", () => {
    const merged = mergeMessageThread(
      [
        { id: 1, body: "a", created_at: "2026-10-01T10:00:00Z" },
        { id: 2, body: "b", created_at: "2026-10-01T11:00:00Z" },
      ],
      { id: 2, body: "b2", created_at: "2026-10-01T11:00:00Z" },
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[1].body, "b2");
    assert.deepEqual(
      merged.map((m) => m.id),
      [1, 2],
    );
  });

  it("parseStreamMessageEvent lee el shape del evento message", () => {
    const raw = JSON.stringify({
      type: "message",
      thread_id: 7,
      client_id: 42,
      branch_id: 1,
      message: { id: 99, body: "hola", created_at: "2026-10-13T12:00:00Z" },
    });
    const msg = parseStreamMessageEvent(raw);
    assert.equal(msg?.id, 99);
    assert.equal(msg?.body, "hola");
  });

  it("mergeMessageThread conserva mensajes SSE al mezclar un fetch posterior", () => {
    const live = parseStreamMessageEvent(
      JSON.stringify({
        type: "message",
        client_id: 42,
        message: { id: 50, body: "live", created_at: "2026-10-13T12:00:01Z" },
      }),
    );
    assert.ok(live);
    const fromFetch = [
      { id: 10, body: "old", created_at: "2026-10-13T11:00:00Z" },
    ];
    const merged = mergeMessageThread([live], fromFetch);
    assert.deepEqual(
      merged.map((m) => m.id),
      [10, 50],
    );
  });

  it("parseStreamMessageEvent filtra por client_id del hilo abierto", () => {
    const raw = JSON.stringify({
      type: "message",
      client_id: 42,
      message: { id: 1, body: "x" },
    });
    assert.equal(parseStreamMessageEvent(raw, 42)?.id, 1);
    assert.equal(parseStreamMessageEvent(raw, 99), null);
    assert.equal(parseStreamMessageEvent(raw, null)?.id, 1);
  });

  it("parseStreamMessageEvent ignora heartbeats y JSON inválido", () => {
    assert.equal(parseStreamMessageEvent(""), null);
    assert.equal(parseStreamMessageEvent("not-json"), null);
    assert.equal(parseStreamMessageEvent(JSON.stringify({ type: "heartbeat" })), null);
    assert.equal(
      parseStreamMessageEvent(JSON.stringify({ type: "message", message: { body: "sin id" } })),
      null,
    );
  });

  it("buildStreamUrl solo usa stream_token (nunca el token de sesión)", () => {
    const url = buildStreamUrl("tok-abc");
    assert.equal(url, `${MESSAGES_STREAM_PATH}?stream_token=tok-abc`);
    assert.doesNotMatch(url, /(?:^|[?&])token=/);
    assert.equal(MESSAGES_STREAM_TOKEN_PATH, "/api/p90/panel/messages/stream-token");
  });

  it("nombres de eventos SSE del contrato", () => {
    assert.equal(SSE_EVENT_CONNECTED, "connected");
    assert.equal(SSE_EVENT_MESSAGE, "message");
    assert.equal(SSE_EVENT_HEARTBEAT, "heartbeat");
    assert.equal(SSE_EVENT_TIMEOUT, "timeout");
  });

  it("participantCanOpenMessages no bloquea Mensajes durante el cuestionario", () => {
    assert.equal(participantCanOpenMessages("Mensajes", false), true);
    assert.equal(participantCanOpenMessages("Comentarios", false), true);
    assert.equal(participantCanOpenMessages("Inicio", false), false);
    assert.equal(participantCanOpenMessages("Inicio", true), true);
    assert.equal(participantCanOpenMessages("Progreso", false), false);
  });
});
