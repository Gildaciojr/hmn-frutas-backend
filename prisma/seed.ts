import 'dotenv/config';

import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

interface SeedUser {
  nome: string;
  sobrenome: string;
  username: string;
  email: string;
  senha: string;
  telefone: string;
  endereco: string;
  role: Role;
}

const users: SeedUser[] = [
  {
    nome: 'Administrador',
    sobrenome: 'Sistema',
    username: 'admin',
    email: 'admin@melancias.com',
    senha: 'admin123',
    telefone: '64999999999',
    endereco: 'Sistema Interno',
    role: Role.ADMIN,
  },
  {
    nome: 'Matheus',
    sobrenome: 'Alvarenga',
    username: 'matheus',
    email: 'matheus@gmail.com',
    senha: 'matheus123.',
    telefone: '62992425387',
    endereco: 'HMN Frutas',
    role: Role.ADMIN,
  },
  {
    nome: 'Joaquim',
    sobrenome: 'Kerdole',
    username: 'netinho',
    email: 'hmnfrutas@gmail.com',
    senha: 'netinho123.',
    telefone: '62999625436',
    endereco: 'HMN Frutas',
    role: Role.ADMIN,
  },
];

async function upsertUser(user: SeedUser): Promise<void> {
  const senhaHash = await bcrypt.hash(user.senha, 10);

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        {
          email: user.email,
        },
        {
          username: user.username,
        },
      ],
    },
  });

  if (existingUser) {
    await prisma.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        nome: user.nome,
        sobrenome: user.sobrenome,
        username: user.username,
        email: user.email,
        senha: senhaHash,
        telefone: user.telefone,
        endereco: user.endereco,
        role: user.role,
      },
    });

    console.log('♻️ Usuário atualizado:', user.username);

    return;
  }

  await prisma.user.create({
    data: {
      nome: user.nome,
      sobrenome: user.sobrenome,
      username: user.username,
      email: user.email,
      senha: senhaHash,
      telefone: user.telefone,
      endereco: user.endereco,
      role: user.role,
    },
  });

  console.log('✅ Usuário criado:', user.username);
}

async function main(): Promise<void> {
  console.log('🌱 Iniciando seed...');

  for (const user of users) {
    await upsertUser(user);
  }

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
