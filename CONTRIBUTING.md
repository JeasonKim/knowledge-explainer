# 贡献指南

欢迎提交 Issue 和 Pull Request。请让改动保持在知识讲解视频这一条创作链路内，不引入其他创作方法或跨仓库运行时依赖。

## 本地开发

~~~bash
corepack enable
pnpm --dir skill/engine install --frozen-lockfile
pnpm --dir skill/engine check
pnpm --dir skill/engine --filter @knowledge-explainer/template-designer exec vite build
~~~

涉及有分支的业务行为时，先用 Vitest 写失败用例，再实现行为。静态文案和 CSS 不做实现细节断言。

修改契约或内置预览后，提交生成结果：

~~~bash
pnpm --dir skill/engine generate:contracts
pnpm --dir skill/engine generate:studio-preview
~~~

提交信息使用中文 Conventional Commits，例如 `fix: 修正字幕卡时间边界`。不要提交密钥、私人音色 ID、个人素材、工作区文件或来源不清晰的媒体。
