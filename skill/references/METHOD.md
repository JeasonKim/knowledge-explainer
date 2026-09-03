# 知识讲解

`knowledge-explainer` 用连续口播推进一个观点、故事、方法或知识点。画面同时承担两件事：语义字幕提炼当前一句话，插画帮助观众理解这一段。适合需要“讲明白”的内容；不适合依靠强节奏文字或连续绘制过程本身取胜的内容。

## 完整创作链路

```mermaid
flowchart LR
  A["主题与已核验材料"] --> B["连续口播"]
  B --> C["字幕卡与插画线索"]
  C --> D["creation-plan"]
  D --> E["TTS 与 ASR 实测时间"]
  E --> F["engine 编译 production"]
  F --> G["插画字幕成片"]
```

1. 围绕一个核心判断写自然、连续的口播。开头给问题、场景或收益；中段只推进一个论点；结尾给出可记住的结论或下一步。
2. 按完整语义拆成 `cards`。每张卡的 `spokenText` 是口播切片，`caption` 是同一句去除标点后的展示文字，可按语义换成一至两行。
3. 选择已审核插画，或者先生成并登记新插画。连续两至四张卡表达同一视觉意图时，使用同一个 `illustrationCueId`；切换论点、案例或视觉隐喻时才更换。
4. 将计划交给引擎完成旁白、强制对齐、生产文件编译和渲染。不要手写时间、字幕槽位或插画坐标。

## 创作数据契约

只输出并保存符合 [creation-plan](creation-plan.schema.json) 的 YAML 或 JSON。它是本方法唯一由 Agent 负责的数据模型。

| 字段 | Agent 的判断责任 | 画面结果 |
| --- | --- | --- |
| `episode` | 确认账号、系列、标题和语言 | 引擎加载该系列的声音、品牌与模板选择 |
| `narration.script.text` | 一整段带自然标点、不换行的口播 | TTS 与 ASR 的唯一文本来源 |
| `cards[].spokenText` | 按完整语义切片，连接后必须等于完整口播 | 决定各段的实测时间边界 |
| `cards[].caption` | 同一句无标点展示文字，一至两行 | 进入当前模板的字幕槽 |
| `cards[].illustrationAssetId` | 选择可表达当前语义的已审核插画 | 进入当前模板的插画槽 |
| `cards[].illustrationCueId` | 显式声明哪些相邻卡共享同一视觉线索 | 决定插画的持有与切换节奏 |

计划中没有坐标、字体、字号、颜色、帧号或布局 ID。这些视觉实现由模板和 engine 管理。

## 模板

当前模板是 [插画字幕](templates/illustrated-caption.md)。创作计划完成后读取它，确认字幕容量、插画准入和首尾帧规则；不要把模板中的视觉参数抄回计划。

## 生成与验收

```bash
RUNNER="<skill-root>/scripts/run-project.sh"
PLAN="episodes/<episode-id>/knowledge-explainer.plan.yaml"
TIMING="episodes/<episode-id>/narration.timing.json"
PRODUCTION="episodes/<episode-id>/knowledge-explainer.vertical-9x16.production.json"

"$RUNNER" synthesize-knowledge-explainer \
  --account config/accounts/<account>.yaml \
  --plan "$PLAN" \
  --output assets/audio/<episode-id>.wav

"$RUNNER" align-knowledge-explainer \
  --plan "$PLAN" \
  --audio audio/<episode-id>.wav \
  --output "$TIMING"

"$RUNNER" compose-knowledge-explainer \
  --account config/accounts/<account>.yaml \
  --plan "$PLAN" \
  --audio audio/<episode-id>.wav \
  --timing-map "$TIMING" \
  --view vertical-9x16 \
  --output "$PRODUCTION"

"$RUNNER" render --project "$PRODUCTION" \
  --output artifacts/<episode-id>/<episode-id>.vertical-9x16.mp4
```

`--output assets/audio/...` 是工作区文件路径；`--audio audio/...` 是相对 `assets/` 的资源 ID。实测时长偏离用户目标时，改写口播和卡片后重新生成，而不是修改生产文件时间轴。
