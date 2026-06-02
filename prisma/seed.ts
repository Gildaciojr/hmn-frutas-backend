import 'dotenv/config';

import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main(): Promise<void> {
  console.log('🌱 Iniciando seed...');

  const email = 'admin@melancias.com';

  const existingAdmin = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingAdmin) {
    console.log('ℹ️ Admin já existe:', email);

    return;
  }

  const senhaHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.create({
    data: {
      nome: 'Administrador',

      sobrenome: 'Sistema',

      email,

      senha: senhaHash,

      telefone: '64999999999',

      endereco: 'Sistema Interno',

      role: Role.ADMIN,
    },
  });

  console.log('✅ Admin criado:', admin.email);

  console.log('🌱 Seed finalizado.');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Erro no seed:', error);

    process.exit(1);
  })
  .finally(async (): Promise<void> => {
    await prisma.$disconnect();
  });
