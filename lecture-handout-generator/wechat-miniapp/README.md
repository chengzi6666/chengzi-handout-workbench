# 橙子读写电子书微信小程序

AppID: wx74f32380b07542e4

原始 ID: gh_1c9dc4506356

云开发环境 ID: cloudbase-d2gsqgec34c3a6ab4

一个小程序承载五个年级；每本书由 grade 和 slug 唯一定位。小程序通过云函数读取 Railway 的公开书籍接口，家长手机不直接访问 Railway。

部署步骤：

1. 在微信开发者工具导入本目录，环境选择 `cloudbase-d2gsqgec34c3a6ab4`。
2. 在云开发数据库新建集合 `published_flipbooks`，权限设为“仅云函数可读写”。
3. 上传并部署云函数 `getBook`。云函数仅从讲义系统白名单域名读取已发布电子书，并把封面、分享封面、背景和正文图片同步到微信云存储。
4. 同一本电子书按 `updatedAt` 缓存；内容更新后会自动生成新版本的云存储资源。
