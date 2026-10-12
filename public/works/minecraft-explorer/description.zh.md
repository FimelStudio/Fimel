# Minecraft Explorer

把散落在多个启动器、整合包和游戏目录中的 Minecraft Java 内容集中到一个本地窗口：查找存档、资源包、模组、光影包和数据包，查看它们属于哪个游戏目录，分析空间占用，并在确认后进行备份和文件管理。

## 下载与运行

点击页面上方“下载”，取得单个 **MinecraftExplorer-1.0-win-x64.exe**，双击运行，无需解压或安装。可放在任意可读取的文件夹，不必放进 Minecraft 目录。更新前请退出旧版。

面向 Windows 10/11 x64；不需要 Rust、Java 或外置图标来运行这个工具。系统需具备 Microsoft Visual C++ x64 运行库；若提示缺少 `VCRUNTIME140.dll`，安装 [Microsoft 官方运行库](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)。尚未在干净的 Windows 10/11 虚拟机验证。HMCL JAR 启动器自身另需 Java。

## 第一次使用

1. 打开 **设置 → 添加 Minecraft 根目录**，选择含有 `versions` 的目录。例如 `D:\PCL2\MinecraftPcl`，而不是单独选择其 `versions` 子目录。自定义游戏目录可单独添加并指定所属根目录。
2. 添加完成后自动进入 **空间分析**：先刷新索引，再分析刚添加的目录。可取消；取消会保留目录关联和已读取结果，并停止后续自动分析。
3. 在 **全部存档 / 资源包 / 模组 / 光影包 / 数据包** 中搜索名称、实例或路径，筛选游戏目录，按大小或时间排序。单击查看归属、图标及元信息，双击或按 Enter 在资源管理器中定位。
4. 用收藏与标签整理常用内容；按 **F5** 刷新索引。目录变化监控默认开启，可在设置关闭。
5. 在设置切换 **中文 / English** 与 **深色 / 浅色**，立即生效并自动保存。

## 空间分析与备份

空间分析用矩形面积表示逻辑文件大小，双击目录钻取，“上一级”返回。共享及重叠来源只统计一次；未读取内容会标注大小下限，逻辑大小不等于磁盘实际分配空间。已有分析是快照，内容变化后点击“重新分析”。

勾选内容后可重命名、复制、移动、备份或移入回收站。先生成预览，核对真实路径，再勾选确认执行。复制和移动会校验内容；不覆盖同名文件，不提供永久删除兜底。备份目标必须在已添加的游戏目录之外，恢复时会验证校验清单。请先退出 Minecraft，运行中的世界不能用本工具做热备份。

## 启动器关联

设置可添加 **PCL2、PCL CE、HMCL**。在条目详情中关联启动器和目标版本，“打开所选启动器”会打开原启动器，随后由你选择并启动游戏。

如希望从这里运行具体版本，可另外绑定原启动器导出的该版本 **BAT / CMD** 及工作目录，再点“启动关联脚本”。原生指定实例的外部接口尚未经过验证，不能把“打开启动器”当作已经启动该版本。脚本可能包含登录信息，请自行保管，不要上传或分享。

PCL2 / PCL CE 可自动识别已有脚本：先在原启动器启动目标版本一次，打开“设置关联”时会检查上次脚本的版本与游戏目录，只有两者准确匹配才会自动填写。程序把脚本保存为数据目录 `launch-scripts/` 中的独立副本，随后启动其他版本不会覆盖此关联。核对后点“保存关联”。可点击“自动识别”重试；不匹配或格式无法判断时仍可手动选择脚本。副本可能保留原登录参数，请勿分享；登录失效时先在原启动器启动该版本，再重新识别。

## 数据与许可

缓存、收藏、标签及配置默认保存在 `%LOCALAPPDATA%\MinecraftExplorer\`。扫描、图标读取及空间分析不修改游戏内容、不上传存档或文件清单；文件管理操作需要你预览并确认。“移除目录”只移除程序关联。

项目为 MIT 许可；第三方许可原文和 Slint 署名已嵌入 EXE。可在 **设置 → 关于 → 导出第三方许可** 中导出到程序数据目录，双击查看。

[GitHub 源码](https://github.com/Ylong4004/Minecraft-Explorer) · [完整使用说明](https://github.com/Ylong4004/Minecraft-Explorer/blob/main/README.md) · [问题反馈](https://github.com/Ylong4004/Minecraft-Explorer/issues)

## 界面展示

以下为程序实际界面，使用生成的演示存档和文件；展示数值不代表真实整合包大小。

![Minecraft Explorer · 中文深色存档列表](../../assets/images/works/minecraft-explorer/gallery-01.png)
![Minecraft Explorer · 中文深色空间分析](../../assets/images/works/minecraft-explorer/gallery-02.png)
![Minecraft Explorer · 英文浅色空间分析](../../assets/images/works/minecraft-explorer/gallery-03.png)
