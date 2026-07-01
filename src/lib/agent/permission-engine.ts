import type { AgentContextSnapshot, AgentTool, AgentToolRisk } from './types'

export interface PermissionDecision {
  allowed: boolean
  requiresApproval: boolean
  reason?: string
  canApproveForSession?: boolean
  sessionApprovalType?: 'write' | 'runtime-script-skill'
  sessionApprovalSkillId?: string
}

const READ_RISKS = new Set<AgentToolRisk>(['read'])
const SESSION_APPROVABLE_RISKS = new Set<AgentToolRisk>([
  'editor-write',
  'file-create',
  'file-update',
  'medium',
])

const SAFE_EXTERNAL_TOOL_PATTERN = /^(get|list|read|search|find|fetch|query|lookup|describe|inspect|show)(_|-|[A-Z]|$)/i
const RISKY_EXTERNAL_TOOL_PATTERN = /(write|update|create|delete|remove|rename|move|copy|send|post|publish|deploy|execute|run|install|merge|close|open_pr|approve)/i
const READ_ONLY_INTENT_PATTERN = /(不要|别|无需|禁止|不需要).{0,8}(修改|改动|编辑|写入|保存|创建|新建|删除|插入|添加|替换|更新)|只读|仅(总结|解释|分析|回答|查看|读取)|只(总结|解释|分析|回答|查看|读取)|do not (modify|edit|write|save|create|delete|insert|update)|don't (modify|edit|write|save|create|delete|insert|update)|without (modifying|editing|writing|saving)|read[- ]only/i
const SCOPED_PRESERVE_INTENT_PATTERN = /(不要|别|无需|禁止|不需要).{0,12}(改动|修改|编辑|写入|替换|更新).{0,12}(其他|其它|其余|剩余|选区外|范围外|之外|以外|其他部分|其它部分|其余内容)|不(改动|修改|编辑).{0,12}(其他|其它|其余|剩余|选区外|范围外|之外|以外|其他部分|其它部分|其余内容)|keep .{0,20}(the rest|other parts|outside|unchanged)|do not (modify|edit|change).{0,20}(the rest|other parts|outside)/i
const CURRENT_MARKDOWN_PRESERVE_PATTERN = /(不要|别|无需|禁止|不需要).{0,12}(修改|改动|编辑|写入|保存|替换|更新).{0,12}(当前|这个|此).{0,8}(Markdown|md|笔记|文件|文档)|do not (modify|edit|write|save|update).{0,24}(current|open).{0,12}(markdown|note|file|document)/i
const WRITE_INTENT_PATTERN = /(修改|改写|编辑|润色|替换|插入|追加|添加|补充|删除|移除|创建|新建|保存|写入|更新|重命名|移动|复制|生成.{0,8}文件|整理(成|到|为|进)|记住|记录|应用|发布|发送|执行|运行|安装|部署|改(成|为|得|好|一下)|把.{0,20}(改|换|替换|写成|变成|调整|优化|润色|翻译(成|为|到)?)|将.{0,20}翻译(成|为|到)?|(?:当前|这篇|本文|笔记|文件|文档|内容|全文|全部|整篇).{0,16}翻译(成|为|到)?|让.{0,20}更(正式|专业|清晰|自然|流畅|简洁|准确)|调整|优化|完善|提升|modify|edit|change|rewrite|replace|insert|append|add|delete|remove|create|save|write|update|rename|move|copy|translate(?: .{0,20})? (?:to|into)|remember|record|apply|publish|send|execute|run|install|deploy)/i
const OUTPUT_FILE_INTENT_PATTERN = /(生成|创建|新建|输出).{0,16}(pptx|docx|xlsx|pdf|图片|图像|文件|演示文稿|幻灯片|deck|slides|presentation)|create.{0,16}(pptx|docx|xlsx|pdf|image|file|deck|slides|presentation)|generate.{0,16}(pptx|docx|xlsx|pdf|image|file|deck|slides|presentation)/i

function stripPathLiterals(userInput: string) {
  return userInput
    .replace(/(?:^|[\s"'`：:，,（(])(?:[\w.-]+\/)+[\w.-]+(?:\.[\w.-]+)?(?=$|[\s"'`。；;，,）)])/g, ' ')
    .replace(/(?:^|[\s"'`：:，,（(])[\w.-]+\.md(?=$|[\s"'`。；;，,）)])/g, ' ')
}

export function hasReadOnlyIntent(userInput: string) {
  if (CURRENT_MARKDOWN_PRESERVE_PATTERN.test(userInput) && OUTPUT_FILE_INTENT_PATTERN.test(userInput)) {
    return false
  }

  if (SCOPED_PRESERVE_INTENT_PATTERN.test(userInput) && WRITE_INTENT_PATTERN.test(userInput)) {
    return false
  }

  return READ_ONLY_INTENT_PATTERN.test(userInput)
}

export function hasExplicitWriteIntent(userInput: string) {
  return WRITE_INTENT_PATTERN.test(stripPathLiterals(userInput)) && !hasReadOnlyIntent(userInput)
}

export class AgentPermissionEngine {
  evaluate(
    tool: AgentTool,
    input: Record<string, unknown>,
    context?: AgentContextSnapshot
  ): PermissionDecision {
    if (READ_RISKS.has(tool.risk)) {
      return {
        allowed: true,
        requiresApproval: false,
      }
    }

    if (tool.risk === 'delete') {
      const writeIntentDecision = this.evaluateWriteIntent(context)
      if (writeIntentDecision) {
        return writeIntentDecision
      }

      return {
        allowed: true,
        requiresApproval: true,
        canApproveForSession: false,
      }
    }

    if (tool.risk === 'script') {
      const skillId = typeof input.skill_id === 'string'
        ? input.skill_id
        : typeof input.skillId === 'string'
          ? input.skillId
          : undefined

      return {
        allowed: true,
        requiresApproval: true,
        canApproveForSession: Boolean(skillId),
        sessionApprovalType: 'runtime-script-skill',
        sessionApprovalSkillId: skillId,
      }
    }

    if (tool.risk === 'external') {
      const externalToolName = typeof input.toolName === 'string' ? input.toolName : ''
      if (externalToolName && SAFE_EXTERNAL_TOOL_PATTERN.test(externalToolName) && !RISKY_EXTERNAL_TOOL_PATTERN.test(externalToolName)) {
        return {
          allowed: true,
          requiresApproval: false,
        }
      }

      const writeIntentDecision = this.evaluateWriteIntent(context)
      if (writeIntentDecision) {
        return writeIntentDecision
      }

      return {
        allowed: true,
        requiresApproval: true,
        canApproveForSession: false,
      }
    }

    const writeIntentDecision = this.evaluateWriteIntent(context)
    if (writeIntentDecision) {
      return writeIntentDecision
    }

    return {
      allowed: true,
      requiresApproval: true,
      canApproveForSession: SESSION_APPROVABLE_RISKS.has(tool.risk),
      sessionApprovalType: SESSION_APPROVABLE_RISKS.has(tool.risk) ? 'write' : undefined,
    }
  }

  private evaluateWriteIntent(context?: AgentContextSnapshot): PermissionDecision | null {
    const userInput = context?.userInput?.trim() || ''

    if (!userInput) {
      return null
    }

    if (hasReadOnlyIntent(userInput)) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: '用户明确要求不要修改内容。本次请求只能使用只读工具或直接回答。',
      }
    }

    if (!hasExplicitWriteIntent(userInput)) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: '用户没有明确要求写入、修改、创建或删除。本次请求只能使用只读工具或直接回答。',
      }
    }

    return null
  }
}

export function isWriteLikeRisk(risk: AgentToolRisk) {
  return SESSION_APPROVABLE_RISKS.has(risk)
}
