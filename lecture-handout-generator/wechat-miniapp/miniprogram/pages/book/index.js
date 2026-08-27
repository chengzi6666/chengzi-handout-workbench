function blocks(page) {
  return ((page && page.sharedPage && page.sharedPage.blocks) || []).filter((item) => item && item.text);
}
Page({
  data: { loading:true, error:"", book:null, pages:[], index:0, current:null, blocks:[], landscape:false, shareImageUrl:"" },
  onLoad(options) {
    this.slug=options.slug||""; this.grade=options.grade||"";
    const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();
    this.setData({landscape:info.windowWidth>info.windowHeight});
    if(!this.slug){this.setData({loading:false,error:"缺少书籍编号"});return}
    this.loadBook();
  },
  async loadBook() {
    try {
      const response=await wx.cloud.callFunction({name:"getBook",data:{slug:this.slug}});
      if(!response.result||!response.result.ok) throw new Error((response.result&&response.result.error)||"电子书读取失败");
      const book=response.result.book,pages=book.pages||[];
      this.setData({loading:false,book:book,pages:pages,current:pages[0]||null,blocks:blocks(pages[0])});
      wx.setNavigationBarTitle({title:book.title||"电子翻页书"});
      this.prepareShareImage(book.shareCoverUrl||book.coverUrl||"");
    } catch(error) { this.setData({loading:false,error:error.message||"电子书读取失败"}); }
  },
  showPage(index) { const next=Math.max(0,Math.min(index,this.data.pages.length-1)),page=this.data.pages[next];this.setData({index:next,current:page,blocks:blocks(page)}); },
  previous(){this.showPage(this.data.index-(this.data.landscape?2:1))},
  next(){this.showPage(this.data.index+(this.data.landscape?2:1))},
  prepareShareImage(fileID){if(!fileID||!fileID.startsWith("cloud://"))return;wx.cloud.downloadFile({fileID,success:(result)=>this.setData({shareImageUrl:result.tempFilePath}),fail:(error)=>console.warn("分享封面下载失败",error)})},
  onShareAppMessage(){return{title:(this.data.book&&this.data.book.title)||"读写综合能力提升电子书",path:"/pages/book/index?grade="+this.grade+"&slug="+this.slug,imageUrl:this.data.shareImageUrl||""}}
});
