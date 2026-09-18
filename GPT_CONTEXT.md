# LinH Pocket — 项目全局上下文（GPT_CONTEXT）

> 用途：供 AI 助手（ChatGPT / 其他 LLM）快速理解本项目的架构、核心文件、设计系统与开发规则。
> 最后更新：v0.6.2（2026-09-18）

---

## 1. 项目架构简介

**LinH Pocket** 是一个「模拟 AI 手机」的 PWA 应用：启动后依次经过开屏动画 → 锁屏 → 桌面，桌面内可打开设置、聊天、音乐、日历、日记本、游戏大厅、世界构建器（3D）等 20+ 个子 App。

- **技术栈**：Next.js 15（App Router）+ React 19 + TypeScript + Tailwind CSS v4，部署在 Vercel。
- **数据层**：浏览器端 IndexedDB（自研 `kv-db` 封装），服务端走 `app/api/*`（Supabase 账号体系）。
- **产品约束**：必须支持 PWA（manifest、全屏/standalone、safe-area 适配），桌面宽屏显示为「手机壳样机」，移动端（≤500px 触屏）全屏铺满。
- **重依赖隔离**：three.js / @react-three/fiber / @react-three/drei / @react-three/postprocessing / @gltf-transform 仅存在于 `app/world-builder/` 独立路由，**不在首页 bundle 中**。

### 核心文件夹职责

| 目录 | 职责 |
|---|---|
| `app/` | Next.js App Router：`layout.tsx`（根布局/viewport/PWA meta）、`page.tsx`（首页，仅渲染 `<MainApp/>`）、`api/`（后端路由，**禁止改动**）、`world-builder/`（3D 独立路由）、`manifest.webmanifest/`（动态 PWA manifest） |
| `components/` | 全部 React 组件。根目录是手机外壳与核心 App（desktop-shell、锁屏、设置等）；子目录按业务域划分（`chat/`、`music/`、`settings/`、`ui/`、`world-builder/` 等） |
| `lib/` | 业务逻辑层：存储（`*-storage.ts` / `kv-db.ts`）、引擎（`chat-engine`、`calendar-engine` 等）、主题（`theme-*`、`color-utils`）、自定义 App 运行时（`custom-app-*`）。**组件不直接操作 IndexedDB，一律走 lib** |
| `styles/` | 全部全局 CSS（非 CSS Module），由 `app/globals.css` 统一按序 import |
| `public/` | 静态资源：`manifest.json`、图标、字体、音效 |
| `scripts/` | 本地工具：`local-next-server.mjs`（dev server，端口 **3001**）、模型缩略图生成 |
| `docs/` | Supabase SQL 建表脚本与设计调研文档 |
| `android-shell/` | Android 壳工程（APK 打包），与前端主体独立 |
| `assets/glass-icons/` | 设置页玻璃图标 SVG |

---

## 2. 核心文件清单（按重要性排序）

### 外壳与生命周期
| 文件 | 作用 |
|---|---|
| `components/main-app.tsx` | 应用根状态机：`boot → locked → passcode → home` 四阶段切换；挂载 ThemeAccentStyle、AccountGate、各种后台 Scheduler；首帧背景兜底 |
| `components/desktop-shell.tsx` | **最核心文件（约 5000 行）**：手机桌面外壳，含桌面分页/Dock/Widget 渲染、全部子 App 的路由分发（`renderAppBody()`）、主题 CSS 覆盖注入、壁纸、状态栏采样。20+ 子 App 已用 `next/dynamic({ssr:false})` 懒加载 |
| `components/boot-splash.tsx` | 纯黑底玻璃 Logo 呼吸开屏动画 |
| `components/ios-korean-lock-screen.tsx` | 仿 iOS 锁屏：超大纤细时钟、上滑解锁、通知卡片、主色 tint 层 |
| `components/passcode-screen.tsx` | 锁屏密码数字键盘页 |
| `components/ui/page-shell.tsx` | 子 App 通用页面壳：固定 header（含 safe-area）+ 滚动 body，设置类页面都用它 |

### 设置 / 主题
| 文件 | 作用 |
|---|---|
| `components/phone-settings-app.tsx` | 设置主 App（账号、数据管理、工具绑定等分组列表） |
| `components/phone-theme-app.tsx` | 主题 App：壁纸、字体、图标皮肤、`DisplayColorPage`（面板式取色器 + 桌面/锁屏实时迷你预览） |
| `components/settings/lock-passcode-settings.tsx` | 「锁屏密码」子页（密码位数/修改/关闭） |
| `components/ui/color-panel.tsx` | 取色器面板（格线/光谱/HSV 滑杆） |
| `components/theme-accent-style.tsx` | 全局主色 token 注入器：把持久化种子色以 `:root` CSS 变量下发，锁屏等 `.phone-shell` 之外的表面也能取到 |
| `lib/theme-accent.ts` | **统一主题单一事实源**：种子色 → accent / soft / surface / tint / lock-tint / contrast 等语义 token 的派生函数 |
| `lib/theme-storage.ts` | 主题档案持久化（IndexedDB key `ai_phone_theme_profile_v1`），更新时 dispatch 自定义事件 |
| `lib/theme-types.ts` | ThemeProfile 类型、迁移与规范化 |
| `lib/version-info.ts` | `APP_VERSION` 常量与 `RELEASE_NOTES` 更新日志数组（发版必改） |

### 配置 / 数据
| 文件 | 作用 |
|---|---|
| `app/layout.tsx` | 根布局：`viewport-fit=cover`、theme-color meta、apple status bar `black-translucent`、字体 |
| `app/globals.css` | 样式入口，按序 import tokens → base → pearl-glass → color-mode → components → phone-shell → 各业务 CSS |
| `next.config.mjs` | 含 `optimizePackageImports`（lucide-react 等 barrel 包按需编译）、gltf-transform 的 node: 前缀 webpack 兼容；**构建时跳过 TS/ESLint 检查** |
| `public/manifest.json` | 静态 PWA manifest（display: fullscreen，浅 theme_color/background_color） |
| `lib/kv-db.ts` | IndexedDB 统一 KV 封装（hydrate / kvGet / kvSet），全站数据层基础 |
| `lib/desktop-config.ts` | 桌面图标注册表 `ICONS`、Dock 默认布局、图标 ID 类型 |
| `lib/bg-tone.ts` | 采样当前页面背景色，动态写状态栏颜色与 meta theme-color |
| `lib/use-viewport-vh.ts` | visualViewport → `--vh` 动态变量（移动端 100dvh 兜底） |

---

## 3. 核心设计系统：Pearl Glass（珍珠玻璃）

项目存在两套互补的 token 体系：

### 3.1 语义色 token — `styles/tokens.css`
全站业务组件消费的 `--c-*` 变量，`:root` 亮色默认值，暗色由 `styles/color-mode.css` 重映射：
- 表面：`--c-page-body-bg`、`--c-header-bg`、`--c-card`、`--c-panel`、`--c-card-border`
- 文字：`--c-text-title` / `--c-text`
- 功能：`--c-success`(#34C759)、`--c-danger`(#FF3B30)、`--c-warning`、`--c-accent`（主色，默认未设置时走 fallback）
- 安全区：`--safe-area-top`、`--page-header-safe-top`

### 3.2 Pearl Glass 设计令牌 — `styles/pearl-glass.css`
定义位置即 `:root`，所有令牌带 **`--pg-` 前缀**（避免覆盖 Tailwind v4 `@theme` 同名令牌）：
- **玻璃面**：`--glass-bg-light/medium/soft/strong`（半透明珍珠白 0.36–0.74）、`--glass-highlight*`、发丝边框 `--color-border-soft`
- **模糊**：`--pg-blur-xs/sm/md/lg/xl` = 8/14/22/30/42px；配合 `--glass-saturate: 135%`、`--glass-brightness: 105%`
- **圆角**：`--pg-radius-xs..2xl` = 10/14/18/24/30/38px，`--pg-radius-pill: 999px`
- **阴影**：`--pg-shadow-xs/sm/md/lg` 与玻璃专用 `--pg-shadow-glass-inset/soft/raised/hover/pressed`
- **字体**：`--pg-font-sans`、字号阶梯 display 64 → micro 11px
- 视觉基调：Silver/pearl liquid glass、低饱和、quiet luxury、按压弹性反馈

### 3.3 统一主色（v0.6.2 起）
`lib/theme-accent.ts` 从用户选择的单一**种子色**用 rgba 透明度梯度派生：`--c-accent`、`--c-accent-soft`(14%)、`--c-accent-surface`(10%)、`--c-accent-tint`(6%)、`--c-lock-tint`(10%)、`--c-accent-contrast`（亮度自动反色文字）。桌面壁纸（`.phone-wallpaper-tint`）与锁屏（`.ios-lock-accent-tint`）只做轻度着色；夜间强度在 color-mode.css 用 color-mix 增强。

### 3.4 其它关键 CSS 文件
- `styles/base.css`：reset、html/body 背景链、锁屏/密码页移动端铺满规则、`.lock-passcode-settings` 双行 row 规范
- `styles/phone-shell.css`：手机壳/手机框/壁纸/Dock、移动端全屏媒体查询、`--vh` 动态视口
- `styles/components.css`：`.page-shell/.page-header/.menu-item/.menu-group/.settings-cell` 等通用组件
- 业务 CSS：chat/music/calendar/diary/game/checkphone/... 与组件目录一一对应

---

## 4. 开发规则摘要（源自 PROJECT_RULES.md）

### 4.1 架构红线
- 保持 Next.js 架构，不得改成纯 HTML 单页；**不得改动 `middleware.ts` 与 `app/api/*` 后端逻辑**。
- 不得删除/重命名现有核心 `class` 类名（会破坏全局样式系统）。
- 必须支持 PWA 与 safe-area-inset，视口高度用 `100dvh`，滑动区加 `-webkit-overflow-scrolling: touch`。

### 4.2 视觉准则
- Apple 极简 + 黑白韩系 ins + iOS 玻璃拟态；毛玻璃标准 `backdrop-filter: blur(20px) saturate(180%)`，半透明背景 + 发丝边框。
- 动效要有弹性曲线 `cubic-bezier(0.175, 0.885, 0.32, 1.275)`，点击缩放 0.98。
- 彩色（绿/红/蓝/紫）**只允许出现在更新日志与更新通知弹窗**，其余界面保持黑白拟态；用户自选主色除外。

### 4.3 版本号规则（改 `lib/version-info.ts`）
1. **常规升级**（含新增/大调整/整体 UI 大改）：主版本递增，如 0.1 → 0.2。
2. **补丁升级**（仅修复/微调）：末位递增，如 0.2.1 → 0.2.2。
3. 用户明确指定版本号时以用户指令为准。
4. 每次更新必须在 `RELEASE_NOTES` 头部插入新条目，所有用户（不区分新老）开屏必看到更新弹窗；日志四色固定：新增 `#34C759`、修复 `#FF3B30`、调整 `#0a84ff`、补丁 `#bf5af2`。

### 4.4 安全规则
- 推送前必须确认未提交 `.env`、密钥、API Key（仓库提供 `.env.example`）。
- 推送命令：`git add .` → `git commit -m "..."` → `git push origin main`；网络失败自动重试一次。
- 未获明确要求时不主动提交/推送（用户说「上线/推送/好了」时才执行自动推送流程）。

### 4.5 本地开发
- 安装：`npm ci`（项目仅用 npm，有 package-lock.json）。
- 启动：`npm run dev`（实际跑 `node --max-old-space-size=4096 scripts/local-next-server.mjs --dev`，端口 **3001**）。
- 已知限制：8GB 内存机器首次 dev 编译首页可能 OOM（exit 134）；CI/验收以 Vercel 远程构建为准。

---

## 5. 关键运行时链路速查

```
app/layout.tsx（meta/PWA）
└─ app/page.tsx
   └─ MainApp（main-app.tsx）
      ├─ boot:   <BootSplash/>
      ├─ locked: <IOSKoreanLockScreen/>（上滑）
      ├─ passcode: <PasscodeScreen/>
      └─ home:   <DesktopShell/>
                 ├─ 壁纸 + 主色 tint 层 + 状态栏
                 ├─ 桌面图标/Widget（WidgetRenderer）
                 └─ renderAppBody() → next/dynamic 懒加载各子 App（PageShell 包裹）
```

- 子 App 打开/关闭通过 desktop-shell 内部 `activeApp` state 控制；Dwelling/Xiaohongshu/Shopping 三个 App 用 `*Mounted` state 保持常驻（display:none 隐藏）以支持后台生成。
- 世界构建器（3D）通过 `window.open('/world-builder')` 在独立窗口打开，完全不进主 React 树。
