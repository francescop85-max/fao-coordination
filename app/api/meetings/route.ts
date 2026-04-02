import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  const meetings = await prisma.meeting.findMany({ orderBy: { date: 'desc' } });
  return NextResponse.json(meetings);
}

export async function POST(req: Request) {
  const data = await req.json();
  const { id: _id, createdAt: _c, updatedAt: _u, project: _p, ...fields } = data;
  const meeting = await prisma.meeting.create({ data: fields });
  return NextResponse.json(meeting);
}
