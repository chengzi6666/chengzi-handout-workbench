Page({
  data: { grades: [], selectedGrade: "0l1" },
  onLoad(options) {
    this.setData({ grades: getApp().globalData.grades, selectedGrade: options.grade || "0l1" });
  },
  openGrade(event) { this.setData({ selectedGrade: event.currentTarget.dataset.grade }); },
  onShareAppMessage() {
    const grade = this.data.selectedGrade;
    const item = this.data.grades.find((row) => row.code === grade);
    return { title: (item ? item.label : "小学") + "读写综合能力提升", path: "/pages/grade/index?grade=" + grade };
  }
});
