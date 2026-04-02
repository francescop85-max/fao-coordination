import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  const projects = await prisma.project.findMany({ orderBy: { symbol: 'asc' } });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const data = await req.json();
  const { id: _id, createdAt: _c, updatedAt: _u, ...fields } = data;
  const project = await prisma.project.create({ data: fields });
  return NextResponse.json(project);
}
