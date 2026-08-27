App({
  onLaunch() {
    if (wx.cloud) wx.cloud.init({ traceUser: true });
  },
  globalData: {
    grades: [
      { code: "0l1", label: "一年级", sourceGrade: "0升1", color: "#f6aa42" },
      { code: "1l2", label: "二年级", sourceGrade: "1升2", color: "#ff7650" },
      { code: "2l3", label: "三年级", sourceGrade: "2升3", color: "#63b99e" },
      { code: "3l4", label: "四年级", sourceGrade: "3升4", color: "#668fd7" },
      { code: "4l5", label: "五年级", sourceGrade: "4升5", color: "#a47bc1" }
    ]
  }
});
