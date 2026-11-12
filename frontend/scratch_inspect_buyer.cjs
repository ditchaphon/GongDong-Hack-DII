const fs = require('fs');
const xml = fs.readFileSync('C:/Users/Vivobook/.gemini/antigravity/brain/158739b6-79b1-496d-a214-d9b11309e5b3/.system_generated/steps/58/output.txt', 'utf8');

function inspectFrame(frameName) {
  const startTag = `<frame id="`;
  const lines = xml.split('\n');
  let inside = false;
  let targetIndent = 0;
  const content = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inside && line.includes(`name="${frameName}`)) {
      inside = true;
      targetIndent = line.search(/\S/);
      content.push(line);
      continue;
    }
    if (inside) {
      const currentIndent = line.search(/\S/);
      if (line.trim().startsWith('<frame id="') && currentIndent <= targetIndent) {
        break;
      }
      content.push(line);
    }
  }
  return content.join('\n');
}

['B0 เปิดครั้งแรก (Onboarding)', 'B1 หน้าแรก / ค้นหา', 'B2 รายละเอียดหนังสือ', 'B3 ตะกร้า + เลือกวิธีรับ', 'B5 สถานะออเดอร์ (ผู้ซื้อ)'].forEach(name => {
  console.log(`=== ${name} ===`);
  const c = inspectFrame(name);
  console.log(c.slice(0, 1500));
});

