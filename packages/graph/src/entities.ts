/**
 * @argos/graph — تطبيع الكيانات (Phase 3).
 *
 * يحوّل مخرجات `analyzeArticle` (قوائم `organizations`/`people`/`places`)
 * إلى كيانات موحّدة صالحة للتخزين في Neo4j:
 * - تنظيف: `trim` + `lowercase` للمفتاح، مع بقاء الاسم الأصلي في `nameAr`
 * - معرّف حتمي: `kind:key` (مثال: `org:apple` أو `org:أبل`)
 * - دمج المكررات: كل الصيغ المختلفة لنفس المفتاح تُدمج في كيان واحد
 *   والصيغ البديلة تُحفظ في `aliases`
 *
 * ملاحظة: نوع `ArticleAnalysis` معرّف هنا بنيوياً (مطابق لمخرجات
 * `@argos/ollama`) عمداً — فصل الـ concerns يمنع الاعتماد على حزمة ollama.
 */
import { EntitySchema } from "@argos/core";
import { z } from "zod";

/** أنواع الكيانات المدعومة في الرسم المعرفي. */
export const NormalizedEntityKindSchema = z.enum(["org", "person", "place"]);
/** نوع الكيان المطبّع. */
export type NormalizedEntityKind = z.infer<typeof NormalizedEntityKindSchema>;

/**
 * مخطط الكيان المطبّع — يوسّع `EntitySchema` من `@argos/core`
 * مع تضييق `kind` على الأنواع الثلاثة المستعملة في الرسم.
 */
export const NormalizedEntitySchema = EntitySchema.extend({
  kind: NormalizedEntityKindSchema,
  /** الاسم الأصلي كما ورد في النص (بالعربية غالباً، يُحفظ كما هو). */
  nameAr: z.string().min(1),
});

/** كيان مطبّع جاهز للتخزين في Neo4j. */
export type NormalizedEntity = z.infer<typeof NormalizedEntitySchema>;

/**
 * مخطط نتيجة تحليل المقال (متوافق بنيوياً مع `ArticleAnalysis` في `@argos/ollama`).
 * معرّف محلياً لتفادي الاعتماد على حزمة ollama من طبقة الرسم.
 */
export const ArticleAnalysisSchema = z.object({
  summary: z.array(z.string()).default([]),
  facts: z.array(z.string()).default([]),
  analysis: z.array(z.string()).default([]),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  entities: z
    .object({
      organizations: z.array(z.string()).default([]),
      people: z.array(z.string()).default([]),
      places: z.array(z.string()).default([]),
    })
    .default({ organizations: [], people: [], places: [] }),
});

/** نتيجة تحليل المقال كما تستهلكها طبقة الرسم. */
export type ArticleAnalysis = z.infer<typeof ArticleAnalysisSchema>;

/**
 * يولّد المعرّف الحتمي لكيان من نوعه واسمه الخام.
 * نفس المدخلات تعطي دائماً نفس المعرّف (شرط `MERGE` الصحيح).
 *
 * @example
 * ```ts
 * entityIdFor("org", "  Apple ") // "org:apple"
 * entityIdFor("org", "أبل")      // "org:أبل"
 * ```
 */
export function entityIdFor(kind: NormalizedEntityKind, rawName: string): string {
  return `${kind}:${rawName.trim().toLowerCase()}`;
}

/**
 * يطبّع كيانات التحليل: تنظيف + توحيد + دمج المكررات.
 * - تُهمل الأسماء الفارغة (بعد `trim`)
 * - المفتاح `lowercase` (لا أثر له على العربية) والاسم الأصلي يُحفظ في `nameAr`
 * - أول صيغة ترد تُصبح `nameAr`، والصيغ المختلفة عنها تُجمع في `aliases` (بلا تكرار)
 *
 * @param analysis نتيجة `analyzeArticle` (تُتحقق بـ Zod، والمدخل غير الصالح يرمي `Error`)
 */
export function normalizeEntities(analysis: ArticleAnalysis): NormalizedEntity[] {
  const parsed = ArticleAnalysisSchema.safeParse(analysis);
  if (!parsed.success) {
    throw new Error(`normalizeEntities: تحليل غير صالح (${parsed.error.message})`);
  }
  const groups: Array<{ kind: NormalizedEntityKind; names: string[] }> = [
    { kind: "org", names: parsed.data.entities.organizations },
    { kind: "person", names: parsed.data.entities.people },
    { kind: "place", names: parsed.data.entities.places },
  ];

  const byId = new Map<string, NormalizedEntity>();
  for (const { kind, names } of groups) {
    for (const raw of names) {
      const original = raw.trim();
      if (!original) continue; // إهمال الفارغ
      const key = original.toLowerCase();
      const id = `${kind}:${key}`;
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, { id, kind, name: key, nameAr: original, aliases: [] });
      } else if (original !== existing.nameAr && !existing.aliases.includes(original)) {
        existing.aliases.push(original); // صيغة بديلة جديدة
      }
    }
  }
  return [...byId.values()];
}
