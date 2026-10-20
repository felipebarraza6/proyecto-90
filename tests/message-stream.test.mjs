import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MESSAGES_STREAM_PATH,
  MESSAGES_STREAM_TOKEN_PATH,
  SSE_EVENT_CONNECTED,
  SSE_EVENT_HEARTBEAT,
  SSE_EVENT_MESSAGE,
  SSE_EVENT_MESSAGE_DELETED,
  SSE_EVENT_TIMEOUT,
  buildStreamUrl,
  mergeMessageThread,
  parseStreamMessageDeletedEvent,
  parseStreamMessageEvent,
  participantCanOpenMessages,
  removeMessagesFromThread,
  withStreamToken,
} from "../app/weekly-panel/messageStream.ts";
import {
  messageDeleteErrorMessage,
  messageDeleteKind,
  showMessageDelete,
} from "../app/weekly-panel/messageDelete.ts";

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

  it("withStreamToken agrega stream_token a stream_path sin query (evita 401)", () => {
    assert.equal(
      withStreamToken("/api/p90/panel/messages/stream", "abc123"),
      "/api/p90/panel/messages/stream?stream_token=abc123",
    );
    assert.equal(
      withStreamToken("/api/p90/panel/messages/stream?foo=1", "abc123"),
      "/api/p90/panel/messages/stream?foo=1&stream_token=abc123",
    );
    assert.equal(
      withStreamToken("/api/p90/panel/messages/stream?stream_token=old", "new"),
      "/api/p90/panel/messages/stream?stream_token=new",
    );
  });

  it("nombres de eventos SSE del contrato", () => {
    assert.equal(SSE_EVENT_CONNECTED, "connected");
    assert.equal(SSE_EVENT_MESSAGE, "message");
    assert.equal(SSE_EVENT_MESSAGE_DELETED, "message_deleted");
    assert.equal(SSE_EVENT_HEARTBEAT, "heartbeat");
    assert.equal(SSE_EVENT_TIMEOUT, "timeout");
  });

  it("removeMessagesFromThread quita por id y por broadcast_id", () => {
    const thread = [
      { id: 1, body: "a", created_at: "2026-10-01T10:00:00Z" },
      { id: 2, body: "b", broadcast_id: "bc-9", created_at: "2026-10-01T11:00:00Z" },
      { id: 3, body: "c", broadcast_id: "bc-9", created_at: "2026-10-01T12:00:00Z" },
      { id: 4, body: "d", created_at: "2026-10-01T13:00:00Z" },
    ];
    assert.deepEqual(
      removeMessagesFromThread(thread, { messageIds: [1] }).map((m) => m.id),
      [2, 3, 4],
    );
    assert.deepEqual(
      removeMessagesFromThread(thread, { broadcastId: "bc-9" }).map((m) => m.id),
      [1, 4],
    );
    assert.deepEqual(
      removeMessagesFromThread(thread, { messageIds: [4], broadcastId: "bc-9" }).map((m) => m.id),
      [1],
    );
  });

  it("parseStreamMessageDeletedEvent lee el shape #148 (client_ids, notice_ids)", () => {
    const raw = JSON.stringify({
      type: "message_deleted",
      branch_id: 1,
      client_ids: [42, 43],
      message_ids: [10, 11],
      notice_ids: [90],
      broadcast_id: "bc-1",
    });
    const payload = parseStreamMessageDeletedEvent(raw);
    assert.deepEqual(payload?.messageIds, [10, 11]);
    assert.deepEqual(payload?.noticeIds, [90]);
    assert.equal(payload?.broadcastId, "bc-1");
    assert.deepEqual(payload?.clientIds, [42, 43]);
    assert.equal(parseStreamMessageDeletedEvent(raw, 99), null);
    assert.equal(parseStreamMessageDeletedEvent(raw, 42)?.broadcastId, "bc-1");
  });

  it("parseStreamMessageDeletedEvent sin client_ids aplica en cualquier hilo (broadcast)", () => {
    const raw = JSON.stringify({
      type: "message_deleted",
      message_ids: [5],
      notice_ids: [],
      broadcast_id: "bc-2",
    });
    assert.equal(parseStreamMessageDeletedEvent(raw, 99)?.broadcastId, "bc-2");
  });

  it("parseStreamMessageDeletedEvent tolera aliases y un solo id", () => {
    const single = parseStreamMessageDeletedEvent(
      JSON.stringify({ type: "message_deleted", message_id: 7 }),
    );
    assert.deepEqual(single?.messageIds, [7]);
    assert.deepEqual(single?.noticeIds, []);
    const camel = parseStreamMessageDeletedEvent(
      JSON.stringify({ type: "message_deleted", messageIds: [8], broadcastId: 99 }),
    );
    assert.deepEqual(camel?.messageIds, [8]);
    assert.equal(camel?.broadcastId, 99);
    assert.equal(parseStreamMessageDeletedEvent(JSON.stringify({ type: "message" })), null);
    assert.equal(parseStreamMessageDeletedEvent(""), null);
  });

  it("removeMessagesFromThread también quita notice_ids", () => {
    const thread = [
      { id: 1, body: "a" },
      { id: 90, body: "aviso" },
      { id: 2, body: "b" },
    ];
    assert.deepEqual(
      removeMessagesFromThread(thread, { noticeIds: [90] }).map((m) => m.id),
      [1, 2],
    );
  });

  it("messageDeleteErrorMessage es amable si el backend aún no existe", () => {
    assert.match(messageDeleteErrorMessage(Object.assign(new Error("Not Found"), { status: 404 })), /aún no está disponible/i);
    assert.match(messageDeleteErrorMessage(Object.assign(new Error("Method Not Allowed"), { status: 405 })), /aún no está disponible/i);
    assert.equal(
      messageDeleteErrorMessage(
        Object.assign(new Error("Solo puedes borrar tus propios mensajes"), { status: 403 }),
      ),
      "Solo puedes borrar tus propios mensajes",
    );
    assert.equal(messageDeleteErrorMessage(Object.assign(new Error("falló"), { status: 500 })), "falló");
  });

  it("messageDeleteKind elige broadcast vs mensaje 1:1", () => {
    assert.equal(messageDeleteKind({ id: 1, broadcast_id: "bc-1" }), "broadcast");
    assert.equal(messageDeleteKind({ id: 2, broadcast_id: null }), "message");
    assert.equal(messageDeleteKind({ id: 3 }), "message");
  });

  it("showMessageDelete respeta can_delete y fallback API antigua", () => {
    const admin = { isAdmin: true, isNutrition: false, viewerUserId: 1 };
    const nutri = { isAdmin: false, isNutrition: true, viewerUserId: 7 };
    const coach = { isAdmin: false, isNutrition: false, viewerUserId: 3 };

    assert.equal(showMessageDelete({ id: 1, can_delete: true, author_role: "nutrition" }, nutri), true);
    assert.equal(showMessageDelete({ id: 2, can_delete: false, author_role: "nutrition", author_id: 7 }, nutri), false);
    assert.equal(showMessageDelete({ id: 3, can_delete: true, author_role: "admin", broadcast_id: 9 }, admin), true);

    // API antigua (sin can_delete): admin sí; nutri solo la suya; sin viewerId → hide
    assert.equal(showMessageDelete({ id: 4, author_role: "nutrition", author_id: 99 }, admin), true);
    assert.equal(showMessageDelete({ id: 5, author_role: "nutrition", author_id: 7 }, nutri), true);
    assert.equal(showMessageDelete({ id: 6, author_role: "nutrition", author_id: 8 }, nutri), false);
    assert.equal(
      showMessageDelete({ id: 7, author_role: "nutrition", author_id: 7 }, { ...nutri, viewerUserId: null }),
      false,
    );
    assert.equal(showMessageDelete({ id: 8, author_role: "nutrition", author_id: 7 }, coach), false);
    assert.equal(
      showMessageDelete({ id: 9, author_role: "participant", can_delete: true }, admin),
      false,
    );
  });

  it("participantCanOpenMessages no bloquea Mensajes durante el cuestionario", () => {
    assert.equal(participantCanOpenMessages("Mensajes", false), true);
    assert.equal(participantCanOpenMessages("Comentarios", false), true);
    assert.equal(participantCanOpenMessages("Inicio", false), false);
    assert.equal(participantCanOpenMessages("Inicio", true), true);
    assert.equal(participantCanOpenMessages("Progreso", false), false);
  });
});
