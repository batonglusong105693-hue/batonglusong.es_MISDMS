import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse, notFoundResponse, forbiddenResponse } from "@/lib/api-responses";

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  const { userId } = await params;
  const isOwnProfile = session.user.id === userId;
  if (!isOwnProfile && !hasPermission(session.user.role as Role, "user:manage")) {
    return forbiddenResponse("You can only view your own profile");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        phoneNumber: true,
        image: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Session user no longer exists. Please sign in again." }, { status: 401 });
    }
    return NextResponse.json(user);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  const { userId } = await params;
  const isOwnProfile = session.user.id === userId;

  if (!isOwnProfile && !hasPermission(session.user.role as Role, "user:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, phone, bio, avatar } = body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existingUser) {
      return NextResponse.json({ error: "Session user no longer exists. Please sign in again." }, { status: 401 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(phone && { phoneNumber: phone }),
        ...(bio && { bio }),
        ...(avatar && { image: avatar }),
      },
      select: { id: true, name: true, email: true, role: true, phoneNumber: true, bio: true, image: true },
    });

    return NextResponse.json(user);
  } catch (err) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
