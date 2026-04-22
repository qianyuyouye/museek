'use client'

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { useEffect, useState } from 'react'
import { AdminModal } from '@/components/ui/modal'
import { FileUploader } from '@/components/admin/file-uploader'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

/**
 * 管理端 CMS 富文本编辑器。基于 TipTap：
 * - starter-kit：段落、标题、粗体、斜体、删除、引用、列表、代码块等
 * - image：插入图片（支持上传，走 /api/upload/token）
 *
 * value / onChange 使用 HTML 字符串（服务端 sanitizeHtml 净化后存 DB）。
 */
export function RichTextEditor({ value, onChange, placeholder, minHeight = 200 }: Props) {
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({ inline: false, HTMLAttributes: { class: 'rte-image' } }),
    ],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-3 py-2 text-[13.5px]',
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // 外部 value 重置（打开编辑模态框时）
  useEffect(() => {
    if (!editor) return
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value])

  // 上传完成后插入图片
  useEffect(() => {
    if (pendingImageUrl && editor) {
      editor.chain().focus().setImage({ src: pendingImageUrl }).run()
      setPendingImageUrl(null)
    }
  }, [pendingImageUrl, editor])

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg3)]">
      <Toolbar editor={editor} onInsertImage={() => setImageModalOpen(true)} />
      <div className="border-t border-[var(--border)]">
        <EditorContent editor={editor} placeholder={placeholder} />
      </div>

      <AdminModal open={imageModalOpen} onClose={() => setImageModalOpen(false)} title="插入图片" width={480}>
        <div className="py-2">
          <FileUploader
            type="image"
            value={null}
            onChange={(url) => {
              if (url) {
                setPendingImageUrl(`/api/files/${url}`)
                setImageModalOpen(false)
              }
            }}
            placeholder="点击或拖拽上传图片"
          />
          <div className="mt-3 text-xs text-[var(--text3)] text-center">上传完成后图片将自动插入到编辑器</div>
        </div>
      </AdminModal>
    </div>
  )
}

function Toolbar({ editor, onInsertImage }: { editor: Editor | null; onInsertImage: () => void }) {
  if (!editor) return <div className="h-9 bg-[var(--bg4)]" />

  const btn = (active: boolean) =>
    `px-2 py-0.5 rounded text-xs font-medium border cursor-pointer transition-colors ${
      active
        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
        : 'bg-[var(--bg3)] text-[var(--text2)] border-[var(--border)] hover:bg-[var(--bg4)]'
    }`

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-[var(--bg4)]">
      <button type="button" className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}>
        B
      </button>
      <button type="button" className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}>
        I
      </button>
      <button type="button" className={btn(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()}>
        S
      </button>
      <span className="mx-1 h-4 w-px bg-[var(--border)]" />
      <button type="button" className={btn(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        H1
      </button>
      <button type="button" className={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </button>
      <button type="button" className={btn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </button>
      <span className="mx-1 h-4 w-px bg-[var(--border)]" />
      <button type="button" className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        • List
      </button>
      <button type="button" className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1. List
      </button>
      <button type="button" className={btn(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        “ ”
      </button>
      <button type="button" className={btn(editor.isActive('codeBlock'))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        &lt;/&gt;
      </button>
      <span className="mx-1 h-4 w-px bg-[var(--border)]" />
      <button type="button" className={btn(false)} onClick={onInsertImage}>
        图片
      </button>
      <button type="button" className={btn(false)} onClick={() => editor.chain().focus().undo().run()}>
        撤销
      </button>
      <button type="button" className={btn(false)} onClick={() => editor.chain().focus().redo().run()}>
        重做
      </button>
    </div>
  )
}
