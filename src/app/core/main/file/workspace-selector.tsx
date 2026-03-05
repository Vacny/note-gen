'use client'

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { FolderOpen } from "lucide-react"
import useSettingStore from "@/stores/setting"
import useArticleStore from "@/stores/article"
import { useTranslations } from 'next-intl'
import { useMemo } from "react"

export function WorkspaceSelector() {
  const { workspacePath, workspaceHistory, setWorkspacePath } = useSettingStore()
  const { clearCollapsibleList, loadFileTree, setActiveFilePath, setCurrentArticle } = useArticleStore()
  const t = useTranslations('settings.file')

  // 获取文件夹名称
  const getWorkspaceName = (path: string) => {
    if (!path) return t('workspace.defaultPath')
    return path.split('/').pop() || path.split('\\').pop() || path
  }

  // 当前工作区名称
  const currentWorkspaceName = useMemo(() => {
    return getWorkspaceName(workspacePath)
  }, [workspacePath, t])

  // 切换工作区
  async function handleWorkspaceChange(path: string) {
    // 处理特殊的默认工作区值
    const targetPath = path === '__default__' ? '' : path
    if (targetPath === workspacePath) return
    
    try {
      await setWorkspacePath(targetPath)
      await clearCollapsibleList()
      setActiveFilePath('')
      setCurrentArticle('')
      await loadFileTree()
    } catch (error) {
      console.error('切换工作区失败:', error)
    }
  }

  return (
    <div className="border-t bg-muted/30 h-6 flex items-center">
      <Select value={workspacePath} onValueChange={handleWorkspaceChange}>
        <SelectTrigger className="h-6 border-0 bg-transparent hover:bg-transparent focus:ring-0 text-sm">
          <span className="truncate text-xs text-right">{currentWorkspaceName}</span>
        </SelectTrigger>
        <SelectContent>
          {/* 默认工作区 */}
          <SelectItem value="__default__">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              <span>{t('workspace.defaultPath')}</span>
            </div>
          </SelectItem>
          {/* 历史工作区 */}
          {workspaceHistory.map((path, index) => (
            <SelectItem key={index} value={path}>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                <span>{getWorkspaceName(path)}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
