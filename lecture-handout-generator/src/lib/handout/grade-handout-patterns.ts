export type GradeHandoutPattern = { grade: string; audience: string; languageRule: string; learningProgression: string; lessonRules: string[]; readingRules: string[]; practiceRules: string[]; answerRules: string[]; parentManualRules: string[]; layoutRules: string[]; };

const shared = {
  lessonRules: ["每讲固定形成五个功能页面：①本讲要学什么与课后路径；②家长交流话题；③精读原文与批注；④主讲老师课堂·真题带练；⑤我是小老师口头表达。", "第1页必须把书名/篇名、方法名、可观察学习目标和课后任务说清；目标写成孩子能做到的动作，不写空泛口号。", "交流话题不少于4题；按‘事实回忆→证据/词句理解→人物/方法判断→迁移表达’递进，每题都有能直接给家长使用的参考答案。", "第5页不是总结口号，而是可直接开口的句式支架；必须包含方法名、至少一个证据或细节、结论/感受。"],
  readingRules: ["阅读文段只能逐字使用主讲文件原文；不能由模型补写、缩写、改标点或混入讲解文字。", "精读题优先问‘哪句话/哪个词说明什么、为什么、如何证明’，不能只问故事大意；题目数量以3—4题为主。", "精读后的批注必须把原文证据连接到本讲方法，形成‘读原文—找证据—用方法’闭环。"],
  practiceRules: ["真题带练必须把方法拆成看得见的步骤、填空或选择支架，再给一个开放迁移任务；有原题图时优先保留原图，不得擅自造题图。", "学生版只给作答空间、提示和评价方向；参考答案给一种完整示例，并明确开放题不要求与示例完全一致。", "主讲老师卡通仅出现在第4页‘真题带练’，不出现在其他功能页面。"],
  answerRules: ["独立答案每讲固定三段：一、精读/方法题参考；二、真题带练/书面练习示例；三、我是小老师口头表达示例。", "客观题答案必须回扣原文证据；开放题提供一份完整、通顺、符合方法的示例，并补充‘答案不唯一，重点看是否使用本讲方法’。", "答案语言要比学生版完整一层，但不能替代学生的独立思考或把开放题写成唯一标准。"],
  parentManualRules: ["家长手册先呈现主讲/双师陪伴，再用‘讲次、课程名称、讲次技法、具体学习内容’四列表格呈现五讲能力地图。", "随后说明本年级基础、阅读、表达的阶段性变化，并把五讲分别如何支撑这些能力说清。", "每讲给‘忙碌时5分钟口头复述’与‘学有余力书面练习’二选一路径；表达克制、可执行，不夸大承诺。"],
  layoutRules: ["学生讲义每讲默认5页；普通同背景页面用分页符，背景切换或进入下一讲用下一页分节符；原文过长时允许第6页，绝不删减原文。", "每页使用对应功能背景，内容放在安全边距内；标题、二级标题、正文、作答区层级固定，正文默认微软雅黑。", "第4页是唯一放置主讲老师课堂卡通的位置，卡通必须为浮于文字上方、可拖动缩放；其余页面不重复出现。", "参考答案单独成册，每讲从新页开始；家长手册包含封面、主讲介绍、双师说明、能力地图和阶段建议。"]
};

export const gradeHandoutPatterns: Record<string, GradeHandoutPattern> = {
  "0升1": { ...shared, grade: "0升1", audience: "识字起步、刚进入小学的孩子", languageRule: "短句、口语化、每题只承载一个动作；避免抽象术语，必要术语先用例子解释。", learningProgression: "从看图/听故事、识字词、说清一句话，走向能按顺序说出人物、事情和感受。" },
  "1升2": { ...shared, grade: "1升2", audience: "一升二，正在从会认字走向会在语境中用字词的孩子", languageRule: "低年级友好、具体、有画面；每个方法控制在3—4步，题干短，示例完整。", learningProgression: "读懂人物和事情→找原文证据→学会一个口语/写话方法→说完整、写完整。", lessonRules: [...shared.lessonRules, "每讲可自然嵌入一个字族或偏旁积累，但必须服务于当课语境，不单独堆砌生字。"], practiceRules: [...shared.practiceRules, "看图写话须给观察顺序、动作/语言/心情支架与足够书写空间；故事续编须先定结局再补过程。"] },
  "2升3": { ...shared, grade: "2升3", audience: "二升三，开始从读懂故事走向用证据说明想法的孩子", languageRule: "可使用‘证据、理由、观点、情节’等术语，但每个术语必须对应一项明确动作。", learningProgression: "词句放回语境理解→人物/情节有证据地判断→按方法组织口头或书面表达。", lessonRules: [...shared.lessonRules, "鼓励在精读中把词语放回句子和故事中理解，并在人物介绍、复述或写话中迁移使用。"] },
  "3升4": { ...shared, grade: "3升4", audience: "三升四，需要由概括内容进阶到用证据分析人物与表达中心的孩子", languageRule: "题目可以设置比较、概括、赏析，但每题要给出思考抓手，如语言、动作、神态、心理、情节。", learningProgression: "理解关键词句→梳理情节→用人物描写和具体事件证明特点→围绕中心选择材料表达。", practiceRules: [...shared.practiceRules, "写作类练习优先提供‘人设/中心—材料选择—细节描写—检查’支架；比较阅读可使用双气泡图或证据对照。"] },
  "4升5": { ...shared, grade: "4升5", audience: "四升五，进入深度阅读与有依据表达阶段的孩子", languageRule: "允许更完整的分析性表达；答案必须区分‘概括内容’与‘解释为什么’，避免只有结论。", learningProgression: "概括内容→抓关键词句、人物描写与情节证据→解释写法和主旨→迁移到有细节的习作。", lessonRules: [...shared.lessonRules, "第4页可把方法明确包装为工具箱：步骤、证据类型、常见误区和迁移任务依次出现。"], practiceRules: [...shared.practiceRules, "主旨、人物评价、借物抒情等题目必须要求‘概事/证据—人物/情感—道理/主旨’链条，不能只给抽象结论。"] }
};

export function patternForGrade(grade: string) { return gradeHandoutPatterns[grade] ?? gradeHandoutPatterns["1升2"]; }
export function patternPrompt(grade: string) { const pattern = patternForGrade(grade); return [`【${pattern.grade}年级讲义范式】受众：${pattern.audience}。语言：${pattern.languageRule}。能力进阶：${pattern.learningProgression}`, `【每讲结构】${pattern.lessonRules.join("\n")}`, `【阅读原文】${pattern.readingRules.join("\n")}`, `【真题带练】${pattern.practiceRules.join("\n")}`, `【参考答案】${pattern.answerRules.join("\n")}`, `【家长手册】${pattern.parentManualRules.join("\n")}`, `【版式规则】${pattern.layoutRules.join("\n")}`].join("\n\n"); }
