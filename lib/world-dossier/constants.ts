// 世界卷宗（角色与世界系统）共享常量。
// T6 决议：角色世界归属的唯一真相源是 CharacterWorldGroup.memberIds，
// 不在 Character 上新增持久化 worldId 字段；本文件仅收口 world-dossier
// 视角的命名 alias，避免在多处复制同一字符串字面量。
//
// 注意：本常量属于「世界卷宗 / 角色世界」系统，与「世界书 (worldbook)」
// 严格分离，不要在世界书 schema 或其消费点引用本 alias。

import { DEFAULT_CHARACTER_WORLD_ID } from "@/lib/character-world-storage";

/** 默认世界 id；与 CharacterWorldGroup 体系保持同值。 */
export const DEFAULT_WORLD_ID = DEFAULT_CHARACTER_WORLD_ID;

/** 默认世界的展示名（仅用于 UI 兜底展示，世界真实名称以 group.name 为准）。 */
export const DEFAULT_WORLD_NAME = "默认世界";

export default DEFAULT_WORLD_ID;
