import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const p = new PrismaClient();

try {
  const hash = await bcrypt.hash("dev-winterfell", 12);
  const result = await p.user.update({
    where: { email: 'ned.stark.dev@winterfell.local' },
    data: { passwordHash: hash },
    select: { email: true },
  });
  console.log("Password reset for:", result.email);

  const user = await p.user.findUnique({
    where: { email: 'ned.stark.dev@winterfell.local' },
    select: { passwordHash: true },
  });
  const verify = await bcrypt.compare("dev-winterfell", user.passwordHash);
  console.log("Verify:", verify);
} catch (e) {
  console.error("ERROR:", e.message);
} finally {
  await p.$disconnect();
}
