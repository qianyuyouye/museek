import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePermission, ok, err, safeHandler} from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'

export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.assignments.view')
  if ('error' in auth) return auth.error

  const { id } = await params
  const assignmentId = parseInt(id, 10)
  if (isNaN(assignmentId)) return err('无效的作业 ID')

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { groupId: true },
  })
  if (!assignment) return err('作业不存在', 404)

  const fields = await prisma.formFieldConfig.findMany({
    where: { groupId: assignment.groupId },
    orderBy: { displayOrder: 'asc' },
  })

  return ok(fields)
})

export const PUT = safeHandler(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'admin.assignments.edit')
  if ('error' in auth) return auth.error

  const { id } = await params
  const assignmentId = parseInt(id, 10)
  if (isNaN(assignmentId)) return err('无效的作业 ID')

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { groupId: true },
  })
  if (!assignment) return err('作业不存在', 404)

  const body = await request.json()
  const { fields } = body

  if (!Array.isArray(fields)) return err('fields 必须是数组')

  // 先删除旧配置，再批量创建
  await prisma.$transaction([
    prisma.formFieldConfig.deleteMany({
      where: { groupId: assignment.groupId },
    }),
    prisma.formFieldConfig.createMany({
      data: fields.map((f: Record<string, unknown>, index: number) => ({
        groupId: assignment.groupId,
        fieldKey: f.fieldKey as string,
        fieldLabel: (f.fieldLabel as string) || null,
        fieldType: f.fieldType as 'text' | 'textarea' | 'multi_select',
        options: f.options !== undefined && f.options !== null
          ? (f.options as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        required: f.required !== undefined ? Boolean(f.required) : true,
        defaultValue: (f.defaultValue as string) || null,
        displayOrder: f.displayOrder !== undefined ? (f.displayOrder as number) : index,
      })),
    }),
  ])

  const updated = await prisma.formFieldConfig.findMany({
    where: { groupId: assignment.groupId },
    orderBy: { displayOrder: 'asc' },
  })

  await logAdminAction(request, {
    action: 'update_form_fields',
    targetType: 'assignment',
    targetId: assignmentId,
    detail: { groupId: assignment.groupId, fieldsCount: updated.length },
  })
  return ok(updated)
})
