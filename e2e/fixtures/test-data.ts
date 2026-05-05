import { test as base } from '@playwright/test';

export type TestUser = {
  email: string;
  password: string;
  name: string;
  role: 'OPERATOR' | 'SUPERVISOR' | 'ADMIN';
};

export type TestInfraction = {
  plate: string;
  makeModel: string;
  color: string;
  severity: 'CRÍTICA' | 'ALTA' | 'MEDIA' | 'BAJA';
  description: string;
};

type TestFixtures = {
  operatorUser: TestUser;
  supervisorUser: TestUser;
  sampleInfraction: TestInfraction;
};

export const test = base.extend<TestFixtures>({
  operatorUser: async ({}, use) => {
    const user: TestUser = {
      email: `operator-${Date.now()}@sentinel.local`,
      password: 'Test123!@#',
      name: 'Test Operator',
      role: 'OPERATOR',
    };
    // Setup: Create user in database (mocked in local dev)
    // await createTestUser(user);
    await use(user);
    // Teardown: Clean up user
    // await deleteTestUser(user.email);
  },

  supervisorUser: async ({}, use) => {
    const user: TestUser = {
      email: `supervisor-${Date.now()}@sentinel.local`,
      password: 'Test123!@#',
      name: 'Test Supervisor',
      role: 'SUPERVISOR',
    };
    await use(user);
  },

  sampleInfraction: async ({}, use) => {
    const infraction: TestInfraction = {
      plate: `TEST${Math.floor(Math.random() * 9999)}`,
      makeModel: 'Honda Civic 2020',
      color: 'Blanco',
      severity: 'ALTA',
      description: 'Semáforo en rojo, violación de regla de tránsito',
    };
    await use(infraction);
  },
});

export { expect } from '@playwright/test';
