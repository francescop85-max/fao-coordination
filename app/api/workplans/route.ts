import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  const workPlans = await prisma.workPlan.findMany({ orderBy: { lastUpdated: 'desc' } });
  return NextResponse.json(workPlans);
}

export async function POST(req: Request) {
  const data = await req.json();
  const { id: _id, createdAt: _c, updatedAt: _u, project: _p, ...fields } = data;
  const workPlan = await prisma.workPlan.create({ data: fields });
  return NextResponse.json(workPlan);
}
