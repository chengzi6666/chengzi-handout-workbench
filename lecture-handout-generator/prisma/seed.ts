import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const teachers = [
  {
    formalName: "吴晨晨",
    nickname: "橙子老师",
    grade: "0升1",
    introduction: "毕业于加拿大英属哥伦比亚大学，拥有国内和国际教师资格双认证，长期从事儿童语言与读写教学。"
  },
  {
    formalName: "高远",
    nickname: "哈哈老师",
    grade: "1升2",
    introduction: "学而思网校读写课程主讲老师，毕业于哈佛大学，拥有4年语文读写教学经验，研究方向为儿童语言与读写能力发展。"
  },
  {
    formalName: "张驰",
    nickname: "驰哥",
    grade: "2升3",
    introduction: "北京大学中文系本科，保送北京大学心理学系并获发展与教育心理学硕士，曾任学而思小学语文教师培训负责人。"
  },
  {
    formalName: "唐润然",
    nickname: "大唐老师",
    grade: "3升4",
    introduction: "复旦大学硕士，深耕小学语文读写教学，教龄9年以上，课堂幽默风趣，注重帮助学生形成自主学习方法。"
  },
  {
    formalName: "陈超",
    nickname: "超帅老师",
    grade: "4升5",
    introduction: "北京大学中文系本科、古代文学专业保送硕士，拥有13年教学经验，长期参与语文课程与教辅产品研发。"
  }
];

async function main() {
  for (const teacher of teachers) {
    await prisma.teacher.upsert({
      where: { formalName_nickname: { formalName: teacher.formalName, nickname: teacher.nickname } },
      update: teacher,
      create: teacher
    });
  }
}

main()
  .finally(async () => prisma.$disconnect());
