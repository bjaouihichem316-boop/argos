/**
 * اختبارات مدير اتصال Neo4j (`bun test`).
 * لا تحتاج خادماً حقيقياً: إنشاء الـ Driver/الـ session لا يفتح اتصالاً،
 * و`verifyConnectivity` تُختبر بـ driver مزيّف عبر `__setDriverForTests`.
 */
import { afterEach, describe, expect, test } from "bun:test";
import type { Driver } from "neo4j-driver";
import {
  __setDriverForTests,
  closeDriver,
  DEFAULT_NEO4J_PASSWORD,
  DEFAULT_NEO4J_URI,
  DEFAULT_NEO4J_USER,
  getDriver,
  getSession,
  resolveNeo4jConfig,
  verifyConnectivity,
} from "./neo4j.js";

afterEach(async () => {
  await closeDriver();
});

describe("resolveNeo4jConfig", () => {
  test("يرجع الافتراضيات عند غياب البيئة والوسائط", () => {
    const saved = {
      uri: process.env.NEO4J_URI,
      user: process.env.NEO4J_USER,
      password: process.env.NEO4J_PASSWORD,
    };
    delete process.env.NEO4J_URI;
    delete process.env.NEO4J_USER;
    delete process.env.NEO4J_PASSWORD;
    try {
      expect(resolveNeo4jConfig()).toEqual({
        uri: DEFAULT_NEO4J_URI,
        user: DEFAULT_NEO4J_USER,
        password: DEFAULT_NEO4J_PASSWORD,
      });
      expect(DEFAULT_NEO4J_URI).toBe("bolt://localhost:7687");
    } finally {
      if (saved.uri !== undefined) process.env.NEO4J_URI = saved.uri;
      if (saved.user !== undefined) process.env.NEO4J_USER = saved.user;
      if (saved.password !== undefined) process.env.NEO4J_PASSWORD = saved.password;
    }
  });

  test("الأولوية للوسائط ثم البيئة", () => {
    process.env.NEO4J_URI = "bolt://env-host:7687";
    const fromEnv = resolveNeo4jConfig();
    expect(fromEnv.uri).toBe("bolt://env-host:7687");
    const fromArgs = resolveNeo4jConfig("bolt://arg-host:7687");
    expect(fromArgs.uri).toBe("bolt://arg-host:7687");
  });
});

describe("getDriver singleton", () => {
  test("يرجع نفس النسخة عند الاستدعاء المتكرر", () => {
    const a = getDriver();
    const b = getDriver();
    expect(a === b).toBe(true);
  });

  test("closeDriver يصفّر الـ singleton (نسخة جديدة بعده)", async () => {
    const before = getDriver();
    await closeDriver();
    const after = getDriver();
    expect((before === after) as boolean).toBe(false);
    await closeDriver();
  });

  test("closeDriver المتكرر آمن (لا يرمي)", async () => {
    await closeDriver();
    await closeDriver();
  });
});

describe("getSession", () => {
  test("يرجع session فيها run و close", async () => {
    const session = getSession();
    expect(typeof session.run).toBe("function");
    expect(typeof session.close).toBe("function");
    await session.close();
  });
});

describe("verifyConnectivity", () => {
  test("يرجع true عند نجاح الاتصال (driver مزيّف)", async () => {
    const fake = {
      verifyConnectivity: async () => undefined,
      close: async () => undefined,
    } as unknown as Driver;
    __setDriverForTests(fake);
    expect(await verifyConnectivity()).toBe(true);
  });

  test("يرجع false (لا يرمي) عند فشل الاتصال", async () => {
    const fake = {
      verifyConnectivity: async () => {
        throw new Error("connection refused");
      },
      close: async () => undefined,
    } as unknown as Driver;
    __setDriverForTests(fake);
    expect(await verifyConnectivity()).toBe(false);
  });
});
