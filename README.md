# InkSaga 墨叙 · AI互动小说桌面游戏 · Claude / GPT / Gemini via OpenAI-Compatible API

> 软件名称：**InkSaga 墨叙**（不变）  
> 推荐 GitHub 仓库名：`inksaga-ai-interactive-novel-claude-gpt-gemini`  
> 备选仓库名：`inksaga-ai-game-interactive-fiction`

**InkSaga 墨叙** 是一款完整的 AI 互动小说桌面应用——不是单脚本 Demo，而是包含角色配置、模型接入、剧情/事件编辑、实时 AI 对话与存档的全流程工具。

Keywords: `AI互动小说` · `AI游戏` · `claude-opus-4-8` · `gpt-5.5` · `deepseek-v4-pro` · `glm-5.2` · `qwen3.7-max` · `OpenAI compatible` · `interactive fiction` · `electron`

---

## 预览

| 基本配置 | 模型配置 |
|:---:|:---:|
| ![基本配置](docs/screenshots/config-page.png) | ![模型配置](docs/screenshots/model-page.png) |

---

## 功能特性

- **基本配置** — 角色姓名、性别、剧情类别、人数与事件规模
- **模型配置** — 晴红API 一键接入，多模型切换
- **剧情配置** — 场景与世界观设定
- **事件配置** — 事件树与分支管理
- **开始游戏** — AI 实时生成剧情，支持对话记忆与存档

---

## 快速开始

```bash
git clone https://github.com/your-username/inksaga-ai-interactive-novel-claude-gpt-gemini.git
cd inksaga-ai-interactive-novel-claude-gpt-gemini
npm install
npm start
```

### 推荐工作流

1. **基本配置** → 填写角色与剧情描述  
2. **模型配置** → 选择晴红API，填入 API Key，测试连接  
3. **剧情配置 / 事件配置** → 完善场景与事件  
4. **开始游戏** → 进入 AI 互动叙事  

### 默认模型配置

```yaml
Provider: 晴红API
Base URL: https://www.qinghong.tech/v1
Model:    deepseek-v4-pro
```

| 模型 | 适用场景 |
|------|----------|
| `glm-5.2` | 中文叙事、角色对话 |
| `deepseek-v4-pro` | 复杂剧情推理（默认） |
| `qwen3.7-max` | 长文本、世界观构建 |
| `gpt-5.5` | 通用创意写作 |
| `claude-opus-4-8` | 细腻文风与人物刻画 |

也支持 **自定义 OpenAI 兼容接口** 和 **Ollama 本地模型**。

---

## 获取 API Key（晴红API · OpenAI 兼容）

| | 链接 |
|---|------|
| **注册** | https://www.qinghong.tech/sign-up |
| **API 文档 (Apifox)** | https://qinghongkeji.apifox.cn |
| **模型与定价** | https://www.qinghong.tech/pricing |

一个 Base URL 即可调用 Claude、GPT、Gemini、DeepSeek、GLM、Qwen — 只需切换模型名称。  
应用内「模型配置」页也提供 **注册晴红API** 按钮，可直接跳转注册。

---

## 与同类开源项目的区别

| | 脚本型 Demo（如 LHB 分析器） | InkSaga 墨叙 |
|---|:---:|:---:|
| 形态 | 命令行脚本 | 完整 Electron 桌面应用 |
| 交互 | 单次分析输出 | 多轮 AI 对话 + 记忆 |
| 配置 | YAML 文件 | 可视化 GUI 全流程 |
| 场景 | 垂直领域工具 | 通用 AI 互动小说引擎 |

引流思路参考 [china-stock-lhb-claude-gpt-gemini](https://github.com/liudong317/china-stock-lhb-claude-gpt-gemini)（Keywords + API 表格 + 免责声明），但 README 与功能展示按 **AI 互动小说** 产品形态单独编写。

---

## 打包

```bash
npm run build
```

输出目录：`dist/`

---

## 项目结构

```
src/
├── main.js
├── renderer.js
├── assets/icons/        # 应用图标
├── pages/               # 配置 / 模型 / 剧情 / 事件 / 游戏
├── services/            # AI 对话、故事生成
├── prompts/             # Prompt 模板
└── data/                # 本地配置与存档
docs/
└── screenshots/         # README 预览截图
```

---

## 免责声明

本仓库仅供 **个人学习、创意写作实验与 OpenAI 兼容 API 集成测试** 使用，**不构成任何投资建议或专业创作指导**。

- AI 生成内容可能存在偏差，请自行甄别。
- [晴红API](https://www.qinghong.tech) 为独立第三方服务，需自行注册并遵守其条款。
- **使用风险自负**。

---

## License

MIT — see [LICENSE](LICENSE).
