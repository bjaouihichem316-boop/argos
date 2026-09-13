import { fetchFeed, getSource } from "@argos/aggregator";
import { analyzeArticle } from "@argos/ollama";

const bbc = getSource("bbc-arabic")!;
const articles = await fetchFeed(bbc, 3);

for (const [i, art] of articles.entries()) {
  console.log(`\n═══ [${i + 1}/${articles.length}] ═══`);
  console.log("العنوان:", art.title);
  console.log("حجم:", art.body.length, "حرف");
  
  try {
    const analysis = await analyzeArticle(art);
    console.log("✅ JSON صالح");
    console.log("summary:", analysis.summary.length);
    console.log("entities:", 
      analysis.entities.organizations.length +
      analysis.entities.people.length +
      analysis.entities.places.length
    );
    const json = JSON.stringify(analysis);
    const cyrillic = json.match(/[\u0400-\u04FF]/g);
    const cjk = json.match(/[\u4E00-\u9FFF]/g);
    if (cyrillic || cjk) {
      console.log("⚠️ حروف أجنبية:");
      if (cyrillic) console.log("  Cyrillic:", cyrillic.slice(0, 5).join(","));
      if (cjk) console.log("  CJK:", cjk.slice(0, 5).join(","));
    } else {
      console.log("✅ بلا حروف أجنبية");
    }
  } catch (err) {
    console.log("❌ فشل:", err instanceof Error ? err.message : err);
  }
}
