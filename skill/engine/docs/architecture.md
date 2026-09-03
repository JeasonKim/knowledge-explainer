# 架构

Knowledge Explainer 是一个单方法 PNPM workspace。Agent 只产出创作计划，运行时把账号、素材和实测时间编译成不可猜测的生产文件。

~~~mermaid
flowchart TD
  A["Skill 与 creation-plan"] --> B["contracts<br/>校验业务语义"]
  B --> C["knowledge-explainer<br/>解析账号、字幕与插画"]
  C --> D["narration / tts<br/>旁白与实测时间"]
  D --> E["production lock<br/>冻结素材和逐帧结果"]
  E --> F["renderer<br/>Remotion 成片"]
  E --> G["CLI 质量门禁<br/>检查与验收帧"]
~~~

## 模块职责

| 模块 | 职责 |
| --- | --- |
| `packages/contracts` | Zod 运行时契约、JSON Schema、跨字段约束 |
| `packages/knowledge-explainer` | 字幕分段、插画解析、生产编译、质量检查 |
| `packages/narration` | 比例预览时间与本地强制对齐 |
| `packages/tts` | 统一语音业务契约及各供应商适配 |
| `packages/template-design` | 插画字幕模板的唯一视觉事实源 |
| `packages/renderer` | 只消费已冻结的生产文件 |
| `apps/cli` | 命令编排、素材边界、渲染与验收 |
| `apps/template-designer` | 调试模板已公开的样例和视觉参数 |

## 不变量

- 创作计划不包含坐标、字体、颜色、动画或帧号。
- 正式生产文件必须使用实测旁白时间图。
- 插画 ID 必须解析到已批准目录项，生产文件同时冻结资源路径。
- 工作区是配置与素材的唯一事实源，源码目录不承载用户状态。
- 历史状态被忽略、素材缺失或摘要不一致时必须记录决策依据。
