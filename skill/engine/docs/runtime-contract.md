# 运行契约

所有命令通过 `skill/scripts/run-project.sh` 执行。脚本负责初始化工作区、加载 `.env`、安装锁定依赖并进入工作区。

~~~mermaid
sequenceDiagram
  participant U as 用户或 Agent
  participant R as run-project.sh
  participant C as CLI
  participant E as Engine
  U->>R: command + arguments
  R->>R: 初始化 ~/.knowledge-explainer
  R->>C: 在工作区执行命令
  C->>E: 校验、合成、对齐或渲染
  E-->>U: JSON 结果或成片
~~~

## 环境变量

| 变量 | 用途 |
| --- | --- |
| `KNOWLEDGE_EXPLAINER_WORKSPACE` | 覆盖默认工作区 `~/.knowledge-explainer` |
| `KNOWLEDGE_EXPLAINER_ENGINE_ROOT` | 覆盖内置引擎位置 |
| `KNOWLEDGE_EXPLAINER_PNPM_BINARY` | 覆盖 PNPM 命令 |
| `KNOWLEDGE_EXPLAINER_TEMPLATE_DESIGNER_PORT` | 模板调试器端口，默认 4173 |
| `CARTESIA_API_KEY` / `VOLCENGINE_TTS_API_KEY` | 可选云端 TTS 凭据 |

## 生产命令

~~~bash
RUNNER="skill/scripts/run-project.sh"

"$RUNNER" synthesize-knowledge-explainer --account config/accounts/example.yaml \
  --plan episodes/demo/plan.yaml --output assets/audio/demo.wav

"$RUNNER" align-knowledge-explainer --plan episodes/demo/plan.yaml \
  --audio audio/demo.wav --output episodes/demo/timing.json

"$RUNNER" compose-knowledge-explainer --account config/accounts/example.yaml \
  --plan episodes/demo/plan.yaml --audio audio/demo.wav \
  --timing-map episodes/demo/timing.json --view portrait-3x4 \
  --output episodes/demo/production.json

"$RUNNER" validate --project episodes/demo/production.json
"$RUNNER" render --project episodes/demo/production.json --output artifacts/demo.mp4
~~~

`--output assets/audio/...` 是工作区文件路径；`--audio audio/...` 是相对 `assets/` 的公开资源路径。不要向生产文件写绝对路径。

开发校验统一运行：

~~~bash
skill/scripts/run-project.sh check
~~~
