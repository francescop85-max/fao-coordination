import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import projectsData from '../../../public/projects.json';

export async function POST() {
  const existing = await prisma.project.count();
  if (existing > 0) {
    return NextResponse.json({ message: 'Database already seeded', count: existing });
  }

  const projects = projectsData as {
    id: string; symbol: string; title: string; status: string;
    eod: string; nte: string; dwhBudget: number; availableBudget: number;
    hardCommitment: number; softCommitment: number; cashBalance: number;
    deliveryLastMonth: number; durationYears: number; ltoOfficer: string;
    alternateLto: string; operationModalities: string; donors: string;
    estimate2027: number; deliveryProgress: number; projectManager: string;
  }[];

  await prisma.project.createMany({
    data: projects.map(({ id: _id, ...p }) => p),
    skipDuplicates: true,
  });

  const count = await prisma.project.count();
  return NextResponse.json({ message: 'Seeded successfully', count });
}
