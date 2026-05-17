// list.ts
var import_genai = require("@google/genai");
async function run() {
  const ai = new import_genai.GoogleGenAI({});
  try {
    const res = await ai.models.list();
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
