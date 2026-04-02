import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await req.json();
  const { id: _id, createdAt: _c, updatedAt: _u, ...fields } = data;
  const project = await prisma.project.update({ where: { id }, data: fields });
  return NextResponse.json(project);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
