import { exportWorkspace, EXPORT_MAX_ROWS, EXPORT_MAX_BYTES } from "../service";
import { getControlPool } from "../../platform/pool";
import { runWithTenant } from "../../tenancy/context";

jest.mock("../../platform/pool", () => ({ getControlPool: jest.fn() }));
const tenant = {
  id: "12345678-1234-1234-1234-123456789012",
  code: "A0000Z",
  name: "Export company",
  schemaName: "ez_t_1234567890abcdef",
  status: "ACTIVE" as const,
};
const actor = { id: "admin", sessionVersion: 2 };
const query = jest.fn(),
  release = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (getControlPool as jest.Mock).mockReturnValue({
    connect: jest.fn().mockResolvedValue({ query, release }),
  });
  query.mockImplementation(async (sql: string) => {
    if (sql.includes("AS count")) return { rows: [{ count: 0, bytes: "0" }] };
    if (sql.startsWith("SELECT id FROM")) return { rows: [{ id: actor.id }] };
    return { rows: [] };
  });
});

it("uses a read-only repeatable snapshot, literal validated schema and field allowlists", async () => {
  const result = await runWithTenant(tenant, () => exportWorkspace(actor));
  const data = JSON.parse(result.json);
  expect(data.format).toBe("ez-workspace-export/1");
  expect(data.workspace).toEqual({
    id: tenant.id,
    code: tenant.code,
    name: tenant.name,
  });
  expect(Object.keys(data.data)).toHaveLength(13);
  expect(query.mock.calls[0][0]).toBe(
    "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  );
  expect(query.mock.calls[4]).toEqual([
    expect.stringContaining('"sessionVersion"=$2'),
    [actor.id, 2],
  ]);
  const selected = query.mock.calls.map(([sql]) => sql).join("\n");
  for (const forbidden of [
    "passwordHash",
    "googleRefreshToken",
    "googleAccessToken",
    "storedFilename",
    "webContentLink",
    "webViewLink",
    "rawUpdates",
  ])
    expect(selected).not.toContain(forbidden);
  expect(selected).toContain('"ez_t_1234567890abcdef"."messages"');
  expect(selected).not.toContain("SELECT *");
  expect(query.mock.calls.at(-1)[1][3]).toEqual(
    JSON.stringify({
      userId: actor.id,
      totalRows: 0,
      bytes: Buffer.byteLength(result.json),
      format: "ez-workspace-export/1",
    }),
  );
  expect(release).toHaveBeenCalledTimes(1);
});

it.each(["company", "principal"])(
  "refuses export when current %s authorization is absent",
  async (missing) => {
    const original = query.getMockImplementation()!;
    query.mockImplementation(async (sql: string, ...args: unknown[]) => {
      if (
        (missing === "company" && sql.includes("ez_control.tenants")) ||
        (missing === "principal" && sql.includes("sessionVersion"))
      )
        return { rows: [] };
      return original(sql, ...args);
    });
    await expect(
      runWithTenant(tenant, () => exportWorkspace(actor)),
    ).rejects.toMatchObject({ status: 403, code: "EXPORT_ACCESS_CHANGED" });
    expect(query.mock.calls.at(-1)).toEqual(["ROLLBACK"]);
    expect(query.mock.calls.some(([sql]) => sql.includes("AS count"))).toBe(
      false,
    );
  },
);

it.each([
  { count: EXPORT_MAX_ROWS + 1, bytes: "1" },
  { count: 1, bytes: String(EXPORT_MAX_BYTES + 1) },
])(
  "rejects an oversized snapshot without fetching its content",
  async (size) => {
    const original = query.getMockImplementation()!;
    query.mockImplementation(async (sql: string, ...args: unknown[]) =>
      sql.includes("AS count") ? { rows: [size] } : original(sql, ...args),
    );
    await expect(
      runWithTenant(tenant, () => exportWorkspace(actor)),
    ).rejects.toMatchObject({ status: 413, code: "EXPORT_TOO_LARGE" });
    expect(
      query.mock.calls
        .filter(([sql]) => sql.includes('FROM "ez_t_'))
        .every(
          ([sql]) => sql.includes("AS count") || sql.includes("sessionVersion"),
        ),
    ).toBe(true);
    expect(query.mock.calls.at(-1)).toEqual(["ROLLBACK"]);
  },
);

it("releases an in-flight slot after a failed snapshot", async () => {
  query.mockRejectedValueOnce(new Error("Database unavailable"));
  await expect(
    runWithTenant(tenant, () => exportWorkspace(actor)),
  ).rejects.toThrow("Database unavailable");
  await expect(
    runWithTenant(tenant, () => exportWorkspace(actor)),
  ).resolves.toHaveProperty("json");
});

it("fails closed without tenant context and never opens a connection", async () => {
  await expect(exportWorkspace(actor)).rejects.toThrow(
    "Tenant context is required",
  );
  expect(getControlPool).not.toHaveBeenCalled();
});

it("bounds aggregate memory by refusing a second company while any export is opening", async () => {
  let ready: (client: unknown) => void = () => undefined;
  const waiting = new Promise((resolve) => {
    ready = resolve;
  });
  (getControlPool().connect as jest.Mock).mockReturnValueOnce(waiting);
  const first = runWithTenant(tenant, () => exportWorkspace(actor));
  await expect(
    runWithTenant({ ...tenant, id: "another-company" }, () =>
      exportWorkspace(actor),
    ),
  ).rejects.toMatchObject({ status: 429, code: "EXPORT_BUSY" });
  ready({ query, release });
  await expect(first).resolves.toHaveProperty("json");
  expect(release).toHaveBeenCalledTimes(1);
});

it("does not return generated content when the completion audit fails", async () => {
  const original = query.getMockImplementation()!;
  query.mockImplementation(async (sql: string, ...args: unknown[]) => {
    if (sql.startsWith("INSERT INTO ez_control.audit"))
      throw new Error("Audit unavailable");
    return original(sql, ...args);
  });
  await expect(
    runWithTenant(tenant, () => exportWorkspace(actor)),
  ).rejects.toThrow("Audit unavailable");
  expect(query.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(true);
  expect(query.mock.calls.some(([sql]) => sql === "ROLLBACK")).toBe(false);
  expect(release).toHaveBeenCalledTimes(1);
});
