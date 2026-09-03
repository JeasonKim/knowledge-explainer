# 工作区

默认工作区是 `~/.knowledge-explainer`。设置 `KNOWLEDGE_EXPLAINER_WORKSPACE` 可以使用另一绝对目录。

~~~mermaid
flowchart TD
  W["工作区"] --> C["config<br/>账号、语音、插画目录"]
  W --> A["assets<br/>图片与音频"]
  W --> E["episodes<br/>计划、时间图、生产文件"]
  W --> O["artifacts<br/>成片与验收结果"]
~~~

~~~text
~/.knowledge-explainer/
├── .env
├── config/
│   ├── accounts/example.yaml
│   ├── assets/subjects.yaml
│   ├── method/
│   │   ├── illustrations.yaml
│   │   └── media.yaml
│   └── narration/
├── assets/
│   ├── audio/
│   ├── imports/audio/
│   ├── method/illustrations/
│   └── shared/subjects/
├── episodes/
└── artifacts/
~~~

生产文件中的资源路径始终相对 `assets/`。运行脚本只补齐缺失的默认文件，不覆盖已有账号、素材或制作状态。

真实密钥只保存在 `.env` 或当前 Shell。账号文件只保存可公开的业务配置；私人音色 ID、未授权音乐和个人素材不要提交到源码仓库。
