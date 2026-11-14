export class AppActionError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(message: string, status: number, body: Record<string, unknown>) {
    super(message);
    this.name = "AppActionError";
    this.status = status;
    this.body = body;
  }
}
