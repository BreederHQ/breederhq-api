const fs = require("fs");
const path = require("path");
const target = path.join("C:","Users","Aaron","Documents","Projects","breederhq-api","src","routes","breeding-discovery-listings.ts");
const b64 = fs.readFileSync(path.join("C:","Users","Aaron","Documents","Projects","breederhq-api","_b64.txt"), "utf-8").trim();
const content = Buffer.from(b64, "base64").toString("utf-8");
fs.writeFileSync(target, content);
console.log("Written " + content.length + " bytes to " + target);