# Supabase Download Counts

这个站点用 Supabase 记录非基岩版作品的下载次数。当前已接入：

- `minecraft-obj-cubizer`：Minecraft OBJ Cubizer 插件

基岩版地图继续使用网易资源中心的静态下载量，不写入 Supabase。

## 1. 创建 Supabase 项目

在 Supabase 新建项目后，打开 SQL Editor，把下面这个文件的 SQL 内容复制进去并执行：

```sql
supabase/migrations/20260514000000_create_work_download_counts.sql
```

这会创建两个表：

- `work_download_targets`：允许统计的作品白名单
- `work_downloads`：每个作品的累计下载次数

网页只拥有公开读取权限；下载按钮通过 `increment_work_download(p_slug)` 这个受控函数递增计数。

## 2. 本地预览环境变量

复制 `.env.example` 为 `.env.local`，填入 Supabase 项目设置里的 Project URL 和 Publishable key：

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

然后运行：

```powershell
npm run dev
```

如果没有配置环境变量，页面仍可正常打开，只会显示“连接 Supabase 后显示下载次数”。

## 3. GitHub Pages 部署

在 GitHub 仓库的 Settings > Secrets and variables > Actions 里新增：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

`deploy.yml` 会在构建时读取这些 secrets。

## 4. 新增需要统计的作品

新增非基岩作品时需要做两处改动：

1. 在 SQL 里把作品加入 `work_download_targets`。
2. 在前端作品数据里加 `downloadSlug`，并把 slug 放进 `DOWNLOAD_TRACKED_WORKS`。

不要给基岩版地图添加 `downloadSlug`。
