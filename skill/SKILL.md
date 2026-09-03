---
name: knowledge-explainer
description: 将主题、资料、文章或既有口播制作成连续旁白、语义字幕与插画协同的知识讲解视频。用于规划字幕卡和插画线索、生成旁白、实测对齐、编译、渲染或验收 Knowledge Explainer 项目。
---

# 知识讲解视频

用本 Skill 生成 `knowledge-explainer` 创作计划，并通过项目引擎得到可复现的生产文件与成片。

## 必读资源

开始创作前依次读取：

1. [创作方法](references/METHOD.md)
2. [创作计划 JSON Schema](references/creation-plan.schema.json)
3. [插画字幕模板](references/templates/illustrated-caption.md)

## 工作边界

- Agent 负责口播、字幕卡、插画选择、相邻卡片的视觉线索关系。
- 模板负责槽位、坐标、字体、颜色、画幅和逐帧表现。
- 不在创作计划中生成像素坐标、帧号或动画参数。
- 正式时长以 TTS 音频和本地强制对齐结果为准；偏离目标时修改口播与卡片，不能手改生产时间轴。
- 新插画必须无文字、无品牌，完成审核并登记到 `config/method/illustrations.yaml` 后才能使用。

## 执行流程

1. 确认主题、事实依据、目标受众、账号系列、画幅和期望时长。
2. 按 Schema 生成计划，确保所有 `cards[].spokenText` 顺序连接后等于完整口播，字幕只做同义换行。
3. 从插画目录选择已批准素材；相邻卡片表达同一视觉意图时共享 `illustrationCueId`。
4. 在工作区保存计划，然后依次生成旁白、强制对齐、编译生产文件。
5. 运行质量门禁并渲染；检查开场、字幕切换、插画切换和真实末帧。

统一入口：

~~~bash
RUNNER="<skill-root>/scripts/run-project.sh"

"$RUNNER" synthesize-knowledge-explainer \
  --account config/accounts/example.yaml \
  --plan episodes/<episode-id>/plan.yaml \
  --output assets/audio/<episode-id>.wav

"$RUNNER" align-knowledge-explainer \
  --plan episodes/<episode-id>/plan.yaml \
  --audio audio/<episode-id>.wav \
  --output episodes/<episode-id>/timing.json

"$RUNNER" compose-knowledge-explainer \
  --account config/accounts/example.yaml \
  --plan episodes/<episode-id>/plan.yaml \
  --audio audio/<episode-id>.wav \
  --timing-map episodes/<episode-id>/timing.json \
  --view portrait-3x4 \
  --output episodes/<episode-id>/production.json

"$RUNNER" render \
  --project episodes/<episode-id>/production.json \
  --output artifacts/<episode-id>.mp4
~~~

需要修改固定视觉参数时运行 `"$RUNNER" template-designer`，只调整调试器已经公开的能力。
