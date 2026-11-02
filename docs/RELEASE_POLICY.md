# Plot Architect — Work-budget release policy

## Active Site release — 2026-11-02

**v4 is now live privately** on the existing Site: version `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce~appgver_9fab684372648191b91af6756baf76b5`, succeeded deployment `appgdep_6ae8284035b48191a6603d203cd6def5`. The previous v3 deployment is historical, not active. Owner-only access, production `authenticated:true`, D1 logical binding `DB` with two tables, and six registered MCP tools were confirmed. UI browser QA, an application-layer anonymous 401 and live MCP JSON-RPC roundtrip are **not yet verified**. No manual production D1 write or migration was performed. Reference: [PA_RELEASE_A_V4_RELEASE_RESULT.md](./PA_RELEASE_A_V4_RELEASE_RESULT.md).

Statements below describing v4 as unpublished are historical; do not use the save-only or deployment instructions again.

## Постоянный сценарий выпуска обычного патча — canonical

**Этот раздел — единственный актуальный маршрут для следующих патчей**. Предыдущие `PA_RELEASE_A_*` описывают историю первого запуска и не должны автоматически воспроизводиться. Принцип: **пользуемся документированными функциями GitHub и ChatGPT Sites; не изобретаем собственный деплой, авторизацию, preflight или резервный Site.**

1. **Начало.** Прочитать `AGENTS.md`, эту политику и актуальную официальную документацию затронутой платформы. Проверить `main` GitHub и текущие *метаданные* опубликованной версии Sites. GitHub — разрабатываемый код, а не автоматическое побайтовое зеркало hosted Site. Определить узкий состав изменений (UI / backend-MCP / D1 / Plugin Skill), не изучая старые сюжеты.
2. **Разработка и CI.** Отдельная ветка → минимальный diff → Pull Request → штатные GitHub Actions (проверки исходников, локальные тесты и сборка) → merge в `main`. Проверить изменённые взаимодействия локально, насколько это поддерживается. Не повторять исторические 43/46-файловые сверки и анализ первой миграции, если исходная hosted-версия не изменилась непредвиденно.
3. **Подготовка Site-кандидата.** Использовать **существующий Site**, сравнить только релевантные hosted-файлы с текущей рабочей версией и перенести утверждённый патч, сохраняя hosted-only REST, auth, D1, MCP и миграции. Применять официальный Sites/Vite-инструментарий и штатный **Save version**. Записать ID версии. **Нельзя деплоить GitHub-репозиторий целиком вслепую**, создавать второй Site или заменять host-managed D1 тестовой конфигурацией Wrangler.
4. **Приватная публикация — только с разрешения владельца.** В штатных настройках Sites сверить выбранную сохранённую версию, проект, owner-only доступ, именованную привязку существующей `DB`, релевантные MCP-контракты и реальные предупреждения о миграции/замене хранилища. Если нет конкретного несовпадения/опасного предупреждения, выполнить **Sites → Deploy version** один раз. **Не требовать внутренний preflight, которого Sites не предоставляет**, и не обходить защиту через Wrangler, заголовки или mock-login. Отдельное согласие на реальные миграции D1 и изменения MCP/плагина обязательно.
5. **Приёмка.** Получить `succeeded`, новый deployment ID и URL. Проверить реальную идентификацию владельца, owner-only режим, UI затронутого патча, доступность `DB`, MCP discovery/инструменты при соответствующем типе изменений. Если что-то проверить не удалось, записать **непроверено**, а не **пройдено**. Никаких чтений старых сюжетов и записей в production D1 без явного разрешения; не запускать автоматический rollback. Откат кода **не откатывает D1**.
6. **Завершение.** Обновить в этом документе и Library `CURRENT_STATE.md` / `DEVELOPMENT_LEDGER.md` действующую версию, ссылку, deployment ID и только фактически проверенные результаты. Закрыть релиз; следующему патчу нужен **новый diff, а не восстановление всей истории Release A**.

**Экономия Work:** здесь и в GitHub выполняем подготовку и CI; Work используем только для реальных действий со штатным интерфейсом Sites, недоступных в этом чате. По возможности один ограниченный проход; не тратить Work на перенос/восстановление старых сюжетов.

**Отдельные исключения:** изменения схемы D1, серверной семантики MCP или Plugin Skill — самостоятельные релизные контуры со своей согласованной проверкой и разрешением. Для обычного UI-патча не добавлять эти операции «заодно». Официальный локальный Vite mock-login не подтверждает production owner identity.

Официальные ориентиры: [Sites management](https://learn.chatgpt.com/docs/sites/managing-a-site), [Sites data and connections](https://learn.chatgpt.com/docs/sites/data-and-connections), [OpenAI Sites Vite plugin](https://github.com/openai/sites/tree/main/packages/sites-vite-plugin).

## Исторические свидетельства и решения Release A (не актуальный статус)

Следующие сведения о v3 и неопубликованной v4 сохранены для аудита. Текущий статус указан в начале документа, а дальнейшие релизы ведутся по постоянному сценарию выше.

## Version evidence

**Local:** v0.13.5-alpha / UX-016, reproducible ZIP in ChatGPT Library at `/Планировщик сюжета/Development/01_Current/PA_LOCAL_V0135_20261101/`.  
**Hosted:** authoritative capture of saved/deployed Site v3 (source `f4ab5397ea2ac7e5b1c6804ae5a169acc7468089`), 43/43 source SHA-256 verified, in Library `libfile_6c90d4394e2081919441b279325657cb`. Exact UI-only Release A patch prepared in `docs/PA_RELEASE_A_HOSTED_V3_EXACT_PATCH.md`; not deployed.  
**Backend:** P1/P2 v2 schema code and SQLite tests are only a spike; actual D1 gate remains `BLOCKED_D1_NOT_VERIFIED`.

**Release A update (2026-11-02):** an unpublished **saved Site v4 candidate** now exists; version ID `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce~appgver_9fab684372648191b91af6756baf76b5`. It has `deployment_id:null`; **v3 is still the active deployment**. Candidate source 46/46 SHA-256 checked, 7 approved changed/new paths, 39 unchanged. D1 host-managed deployment mapping and real owner authentication remain unverified. **Deployment is NOT authorized.** See `docs/PA_RELEASE_A_V4_PREDEPLOY_GATE.md` and Library report `libfile_7ccc2afe966881918b7170e05072e997`.

## Official Sites workflow: use the platform, don't reinvent it

**Rule:** Official product documentation and native Sites controls are the default source of truth for hosting operations. We develop with GitHub branch → PR → CI → merge; package with supported Vite/Sites tooling; use the **existing** project's `.openai/hosting.json` (project ID and named `DB` binding); release with native **Save version → Deploy version**. Never build a private alternative deployment framework, mock auth provider, D1 provisioner, Site clone, or nonstandard release workaround.

A predeploy review should check only actionable risks using supported controls: correct existing Site, saved version ID, owner-only audience, existing `DB` binding, unchanged MCP contracts, and **whether the publish operation proposes database migrations or a storage replacement**. The hosting service's undocumented internal UUID rewrite is not a separate deliverable. **A real warning, wrong binding, or non-no-op migration requires STOP before deployment.** This is not permission to guess that a dummy local Wrangler ID is safe: inspect the native deployment's actual binding plan if exposed, and never run a raw Wrangler deploy.

Postdeploy, use the real private Site (not a `terminal.local` mock login) to verify native owner authentication, UI/UX, MCP discovery and read-only DB health. Do not access old plot content. Sites explicitly warns that a failed publish may already have affected the database; code rollback is NOT database rollback.

**Owner instruction dated 2026-11-02:** proceed toward **private** deployment of the *already saved* Site v4 candidate `appgprj_6ae715d7cccc8191bc35fbcd5255d9ce~appgver_9fab684372648191b91af6756baf76b5` on the **existing** Site, keeping sharing owner-only. This is task-scoped authorization, not a permanent waiver of release preflight or permission for D1 writes/migrations, plugin changes or public sharing. See `docs/PA_RELEASE_A_V4_PREDEPLOY_GATE.md`.

Sources:
- https://learn.chatgpt.com/docs/sites/managing-a-site
- https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites

**Release A follow-up (2026-11-02):** Work stopped `DEPLOY_D1_UNSAFE` without calling Deploy because a self-imposed internal D1 preflight plan is unavailable in official Sites. No mismatch or migration warning was reported. This is **not** evidence that v4 is deployed, nor proof that the dummy Cloudflare UUID is ignored. Owner still authorizes one private native deployment of saved v4 with concrete audience/`DB` checks and stop on any actual replacement/migration warning. See `docs/PA_RELEASE_A_NATIVE_DEPLOY_V4.md`; it supersedes the former impossible preflight requirement for this release. Publishing can mutate real D1 and code rollback does not revert it.

## Release tracks

| Track | Allowed change | Work/Sites stage | Plugin step |
|---|---|---|---|
| A — UI | UX-013 menus, UX-015 semantic zoom, UX-016 drag; UX-014 only with verified persistence or feature flag | Compare actual Site source, minimal patch, owner-only preview/QA, explicit private deploy | None if tool schema unchanged |
| B — data & P5 | D1 additive tables, editorial drafts, prepared variants, new MCP semantics | Isolated synthetic real D1 tests, CAS, auth, hosted E2E, explicit deploy | Refresh/discovery if MCP schema changed |
| C — Skill | Prompt/routing/metadata without app binding changes | No Site deployment if only Skill content changes | Guarded update of existing private plugin using current release ID |

Do not combine the unverified D1 rewrite path with Track A just to reduce Work calls: a single huge risky task is not cost-effective.

## Work budget

Prepare tested local patch and exact file-level diff outside Work. Ask Work only to reconcile with the current hosted Source, verify security, save a candidate, run hosted tests, and deploy once if separately authorized. Avoid broad legacy history retrieval. Work is forbidden for legacy test-story preservation (`PA-WORK-GUARD-01`); old rows should remain untouched. No second Site or plugin.

## Release gates

1. `source_version`, `deployment_id`, access mode, Tool schema and DB migrations observed from current live Site.
2. Scope/diff reviewed; all unexplained drift stopped.
3. No schema loss of `eventRewrites[]`, editor notes, or visual fields; if unsupported, disable feature in hosted release rather than dropping data.
4. Local Node/build/browser tests pass; hosted auth and persistence tested with NEW synthetic data.
5. On private preview, owner-only identity confirmed; no cross-owner access, no auth weakening.
6. Migration apply is explicit, additive and tested for CAS=0 rollback. Deployment rollback is not a DB rollback.
7. Private deploy only after authorization; postdeploy tool discovery and read/write readback. Final report includes versions, changed files, test outcomes and blockers.