'use client'

import { useRef, useEffect } from 'react'
import { PERMISSION_TREE, ACTION_LABELS, PermissionPortal, PermissionNode } from '@/lib/constants'

// ── IndeterminateCheckbox ──────────────────────────────────────────

interface IndeterminateCheckboxProps {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
  className?: string
  style?: React.CSSProperties
}

function IndeterminateCheckbox({ checked, indeterminate, onChange, className, style }: IndeterminateCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className={className}
      style={{ accentColor: 'var(--accent2)', cursor: 'pointer', ...style }}
    />
  )
}

// ── PermissionTree ─────────────────────────────────────────────────

interface PermissionTreeProps {
  value: Record<string, boolean>
  onChange: (value: Record<string, boolean>) => void
}

export function PermissionTree({ value, onChange }: PermissionTreeProps) {
  const val = value || {}

  const isPortalChecked = (portal: PermissionPortal) =>
    portal.children.every((m) => m.actions.every((a) => val[`${m.key}.${a}`]))

  const isPortalIndet = (portal: PermissionPortal) =>
    !isPortalChecked(portal) && portal.children.some((m) => m.actions.some((a) => val[`${m.key}.${a}`]))

  const isMenuChecked = (menu: PermissionNode) =>
    menu.actions.every((a) => val[`${menu.key}.${a}`])

  const isMenuIndet = (menu: PermissionNode) =>
    !isMenuChecked(menu) && menu.actions.some((a) => val[`${menu.key}.${a}`])

  const togglePortal = (portal: PermissionPortal) => {
    const all = isPortalChecked(portal)
    const next = { ...val }
    portal.children.forEach((m) => m.actions.forEach((a) => { next[`${m.key}.${a}`] = !all }))
    onChange(next)
  }

  const toggleMenu = (menu: PermissionNode) => {
    const all = isMenuChecked(menu)
    const next = { ...val }
    menu.actions.forEach((a) => { next[`${menu.key}.${a}`] = !all })
    onChange(next)
  }

  const toggleAction = (menuKey: string, action: string) => {
    onChange({ ...val, [`${menuKey}.${action}`]: !val[`${menuKey}.${action}`] })
  }

  const selectAll = () => {
    const next: Record<string, boolean> = {}
    PERMISSION_TREE.forEach((p) => p.children.forEach((m) => m.actions.forEach((a) => { next[`${m.key}.${a}`] = true })))
    onChange(next)
  }

  const clearAll = () => onChange({})

  return (
    <div>
      {/* 全选 / 不全选 */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 12 }}>
        <span
          onClick={selectAll}
          style={{ fontSize: 13, color: 'var(--accent2)', cursor: 'pointer' }}
        >
          全选
        </span>
        <span
          onClick={clearAll}
          style={{ fontSize: 13, color: 'var(--accent2)', cursor: 'pointer' }}
        >
          不全选
        </span>
      </div>

      {PERMISSION_TREE.map((portal) => (
        <div key={portal.key} style={{ marginBottom: 16 }}>
          {/* Portal level */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
              borderBottom: '1px solid var(--border)',
              marginBottom: 8,
            }}
          >
            <IndeterminateCheckbox
              checked={isPortalChecked(portal)}
              indeterminate={isPortalIndet(portal)}
              onChange={() => togglePortal(portal)}
              style={{ width: 15, height: 15 }}
            />
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {portal.icon} {portal.portal}
            </span>
          </div>

          {/* Menu level */}
          <div style={{ paddingLeft: 20 }}>
            {portal.children.map((menu) => (
              <div key={menu.key} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <IndeterminateCheckbox
                    checked={isMenuChecked(menu)}
                    indeterminate={isMenuIndet(menu)}
                    onChange={() => toggleMenu(menu)}
                    style={{ width: 14, height: 14 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)' }}>
                    {menu.label}
                  </span>
                </div>

                {/* Action level */}
                <div
                  style={{
                    paddingLeft: 22,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px 16px',
                  }}
                >
                  {menu.actions.map((action) => (
                    <label
                      key={action}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                        color: 'var(--text3)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!val[`${menu.key}.${action}`]}
                        onChange={() => toggleAction(menu.key, action)}
                        style={{ width: 13, height: 13, accentColor: 'var(--accent2)' }}
                      />
                      {ACTION_LABELS[action] ?? action}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
