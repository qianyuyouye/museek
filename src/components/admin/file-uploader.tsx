'use client'

import { useCallback, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface FileUploaderProps {
  type: 'image' | 'audio'
  accept?: string
  maxSizeMB?: number
  value: string | null
  onChange: (url: string | null) => void
  label?: string
  placeholder?: string
  compact?: boolean
}

export function FileUploader({
  type,
  accept,
  maxSizeMB = 5,
  value,
  onChange,
  label,
  placeholder,
  compact = false,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const defaultAccept = type === 'image' ? '.jpg,.jpeg,.png,.webp,image/*' : '.wav,.mp3,audio/*'
  const defaultPlaceholder = type === 'image' ? '上传封面图 (JPG/PNG, ≤5MB)' : '上传音频文件 (WAV/MP3, ≤50MB)'

  async function handleFile(file: File) {
    setError('')
    const maxBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxBytes) {
      setError(`文件超过 ${maxSizeMB}MB`)
      return
    }

    setUploading(true)
    try {
      const tokenRes = await fetch('/api/upload/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, type }),
      })
      const tokenJson = await tokenRes.json()
      if (tokenJson.code !== 200) {
        setError(tokenJson.message || '获取上传凭证失败')
        return
      }

      const { uploadUrl, key, headers: extraHeaders } = tokenJson.data

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: extraHeaders ? { ...extraHeaders } : { 'Content-Type': file.type },
      })

      if (!putRes.ok) {
        setError('文件上传失败')
        return
      }

      onChange(key)
    } catch (e: unknown) {
      setError(`上传出错: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setUploading(false)
    }
  }

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    // reset input so same file can be selected again
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }, [onChange])

  if (compact) {
    return (
      <div>
        {label && <label className="text-[13px] font-medium text-[var(--text2)] mb-1.5 block">{label}</label>}
        <input
          ref={inputRef}
          type="file"
          accept={accept || defaultAccept}
          className="hidden"
          onChange={handleChange}
        />
        {value ? (
          <div className="flex items-center gap-2">
            {type === 'image' && (
              <img src={`/api/files/${value}`} alt="" className="w-10 h-10 rounded object-cover border border-[var(--border)]" />
            )}
            <span className="text-xs text-[var(--green)] flex-1 truncate">{value}</span>
            <button
              type="button"
              className="text-xs text-[var(--red)] cursor-pointer bg-transparent border-0"
              onClick={handleRemove}
            >
              移除
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-xs text-[var(--accent)] cursor-pointer bg-transparent border-0"
            onClick={handleClick}
            disabled={uploading}
          >
            {uploading ? '上传中...' : '选择文件'}
          </button>
        )}
        {error && <p className="text-xs text-[var(--red)] mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      {label && <label className="text-[13px] font-medium text-[var(--text2)] mb-1.5 block">{label}</label>}
      <input
        ref={inputRef}
        type="file"
        accept={accept || defaultAccept}
        className="hidden"
        onChange={handleChange}
      />
      <div
        className={`border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
          compact ? 'p-4' : 'p-6'
        } ${
          value
            ? 'border-[var(--green)] bg-green-50/30'
            : 'border-[var(--border)] hover:border-[var(--accent)]'
        }`}
        onClick={handleClick}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div>
            <span className="text-[24px]">⏳</span>
            <p className="mt-1 text-xs text-[var(--accent)] font-medium">上传中...</p>
          </div>
        ) : value ? (
          <div>
            {type === 'image' ? (
              <img
                src={`/api/files/${value}`}
                alt=""
                className="mx-auto max-h-32 rounded object-cover mb-2"
              />
            ) : (
              <CheckCircle2 size={24} className="mx-auto text-[var(--green)]" />
            )}
            <p className="text-xs text-[var(--green)] font-medium truncate">{value}</p>
            <button
              type="button"
              className="text-xs text-[var(--red)] mt-1 bg-transparent border-0 cursor-pointer"
              onClick={handleRemove}
            >
              移除
            </button>
          </div>
        ) : (
          <div>
            <span className="text-[24px]">{type === 'image' ? '🖼️' : '🎵'}</span>
            <p className="text-xs text-[var(--text2)] mt-1">{placeholder || defaultPlaceholder}</p>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-[var(--red)] mt-1">{error}</p>}
    </div>
  )
}
