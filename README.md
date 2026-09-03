# Knowledge Explainer

把主题、资料或口播稿编译成“连续旁白 + 语义字幕 + 插画”的知识讲解视频。项目包含可安装的 Codex Skill、严格的数据契约、TTS/本地强制对齐、Remotion 渲染器和模板效果调试器。

![知识路径示例插画](skill/engine/apps/template-designer/public/cases/knowledge-learning-map.png)

## 核心能力

- 用 `creation-plan` 明确口播、字幕卡、插画选择和视觉线索切换。
- 支持 3:4、9:16、16:9 三种画幅，共享同一内容计划和实测时间轴。
- 支持 macOS 本地语音、Cartesia 与火山引擎 TTS。
- 通过 Whisper.cpp 强制对齐生成实测旁白时间图。
- 在渲染前检查字幕容量、素材摘要、时间轴与模板契约。
- 提供浏览器模板调试器，保存结果后由正式渲染器读取同一份 JSON。

## 工作流

~~~mermaid
flowchart TD
  A["主题与已核验材料"] --> B["知识讲解创作计划"]
  B --> C["旁白合成"]
  C --> D["本地强制对齐"]
  D --> E["编译生产文件"]
  E --> F["质量门禁"]
  F --> G["Remotion 渲染"]
~~~

## 快速开始

要求 Node.js 22+、PNPM 10+、FFmpeg。正式强制对齐还需要 Whisper.cpp；macOS 可直接使用内置 `say` 完成本地语音验证。

~~~bash
corepack enable
pnpm --dir skill/engine install --frozen-lockfile

# 类型检查与全部测试
skill/scripts/run-project.sh check

# 查看方法与模板
skill/scripts/run-project.sh describe-knowledge-explainer \
  --account config/accounts/example.yaml \
  --series learning-path

# 打开模板效果调试器
skill/scripts/run-project.sh template-designer

# 打开带内置预览数据的 Remotion Studio
pnpm --dir skill/engine dev
~~~

首次运行会初始化 `~/.knowledge-explainer`。源码、凭据、用户素材、制作过程和成片彼此分离；真实密钥只写入该工作区的 `.env`。

完整命令见 [运行契约](skill/engine/docs/runtime-contract.md)，工作区结构见 [工作区说明](skill/engine/docs/workspace.md)，Agent 创作规则见 [Skill](skill/SKILL.md)。

## 安装为 Codex Skill

~~~bash
git clone https://github.com/JeasonKim/knowledge-explainer.git
mkdir -p ~/.codex/skills
ln -s "$PWD/knowledge-explainer/skill" ~/.codex/skills/knowledge-explainer
~~~

重新打开 Codex 后，可以在任务中直接使用 `$knowledge-explainer`。

## 项目结构

~~~text
skill/
├── SKILL.md
├── references/                    # Agent 创作契约与模板规则
├── scripts/run-project.sh         # 唯一运行入口
└── engine/
    ├── apps/cli/                  # 编译、合成、对齐、渲染与验收
    ├── apps/template-designer/    # 模板效果调试器
    ├── packages/contracts/        # Zod 与 JSON Schema 契约
    ├── packages/knowledge-explainer/
    ├── packages/renderer/
    └── workspace-template/        # 中性开源默认配置与素材
~~~

## 开发

~~~bash
pnpm --dir skill/engine generate:studio-preview
pnpm --dir skill/engine check
~~~

有分支的业务逻辑由 Vitest 覆盖；模板静态样式不做文案或 CSS 实现断言。

## 许可证

[MIT](LICENSE)。仓库中的示例图片为本项目生成的原创中性素材，并随项目按 MIT 许可证发布。第三方依赖保留各自许可；Remotion 的单独使用条件见 [第三方软件说明](THIRD_PARTY_NOTICES.md)。
