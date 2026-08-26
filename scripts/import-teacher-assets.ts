import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { objectStore } from "../src/lib/object-store";
import { safeFileName } from "../src/lib/storage-keys";

const defaultRoot = "D:\\物料\\【【【进校】】】】\\0元大阅读\\0转299\\主讲介绍+表情包等";
const records = [
  { formalName: "吴晨晨", folder: "0升1吴晨晨", portrait: "吴晨晨.png" },
  { formalName: "高远", folder: "1升2高远", portrait: "哈哈.png" },
  { formalName: "张驰", folder: "2升3张驰", portrait: "张驰.png" },
  { formalName: "唐润然", folder: "3升4大唐", portrait: "大唐.png" },
  { formalName: "陈超", folder: "4升5陈超", portrait: "陈超.png" },
] as const;

async function main() {
  const root = process.env.TEACHER_ASSET_ROOT?.trim() || defaultRoot;
  await access(root);
  let imported = 0;
  let skipped = 0;
  for (const record of records) {
    const teacher = await db.teacher.findFirst({ where: { formalName: record.formalName }, include: { assets: true } });
    if (!teacher) throw new Error(`教师资料不存在：${record.formalName}，请先运行 db:seed`);
    const files = [record.portrait, "1.png", "2.png", "3.png", "4.png", "5.png"];
    for (const [index, fileName] of files.entries()) {
      const kind = index === 0 ? "PORTRAIT" : "EXPRESSION";
      if (teacher.assets.some((asset) => asset.kind === kind && asset.label === fileName)) { skipped += 1; continue; }
      const sourcePath = join(root, record.folder, fileName);
      const body = await readFile(sourcePath);
      const key = `teachers/${teacher.id}/builtin-${kind.toLowerCase()}-${safeFileName(fileName)}`;
      await objectStore().put({ key, body, contentType: "image/png" });
      await db.teacherAsset.create({ data: { teacherId: teacher.id, kind, label: fileName, objectKey: key, sortOrder: index } });
      imported += 1;
    }
  }
  console.log(`教师素材导入完成：新增 ${imported} 项，跳过已有 ${skipped} 项。`);
}

main().finally(async () => db.$disconnect());
