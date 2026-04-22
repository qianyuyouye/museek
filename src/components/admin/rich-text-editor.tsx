'use client'

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { useEffect } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

/**
 * 管理端 CMS 富文本编辑器。基于 TipTap：
 * - starter-kit：段落、标题、粗体、斜体、删除、引用、列表、代码块等
 * - image：插入图片（URL 粘贴，后续可接 /api/upload/token）
 *
 * value / onChange 使用 HTML 字符串（服务端 sanitizeHtml 净化后存 DB）。
 */
export function RichTextEditor({ value, onChange, placeholder, minHeight = 200 }: Props) {
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

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-white">
      <Toolbar editor={editor} />
      <div className="border-t border-[var(--border)]">
        <EditorContent editor={editor} placeholder={placeholder} />
      </div>
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return <div className="h-9 bg-[#fafbff]" />

  const btn = (active: boolean) =>
    `px-2 py-0.5 rounded text-xs font-medium border cursor-pointer transition-colors ${
      active
        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
        : 'bg-white text-[var(--text2)] border-[var(--border)] hover:bg-[#f4f7fe]'
    }`

  function promptImage() {
    if (!editor) return
    const url = window.prompt('请输入图片 URL')
    if (url && /^https?:\/\//.test(url.trim())) {
      editor.chain().focus().setImage({ src: url.trim() }).run()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-[#fafbff]">
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
      <button type="button" className={btn(false)} onClick={promptImage}>
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
