import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await req.json();
  const { id: _id, createdAt: _c, updatedAt: _u, project: _p, ...fields } = data;
  const workPlan = await prisma.workPlan.update({ where: { id }, data: fields });
  return NextResponse.json(workPlan);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.workPlan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
