import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
import { db } from './index';
import {
  organizations,
  facilities,
  doctors,
  patients,
  insurances,
  visits,
} from './schema';

const REASONS = [
  'Consultation générale',
  'Douleurs thoraciques',
  'Fièvre et toux',
  'Bilan annuel',
  'Douleurs articulaires',
  'Maux de tête persistants',
  'Problèmes digestifs',
  'Contrôle tension',
  'Vaccination',
  'Suivi grossesse',
  'Dermatologie',
  'Fatigue chronique',
  'Allergie',
  'Blessure sportive',
  'Anxiété',
  'Insomnie',
  'Mal de gorge',
  'Douleurs dorsales',
];

const DIAGNOSES = [
  'En bonne santé',
  'Anxiété généralisée',
  'Infection virale des voies respiratoires',
  'Hypertension artérielle à surveiller',
  'Gastrite légère',
  'Migraine',
  'Entorse cheville',
  'Rhinite allergique',
  'Syndrome grippal',
  'Troubles du sommeil',
  'Dermatite de contact',
  'Lombalgie',
  'Pharyngite',
  'État grippal',
  'Contusion',
  'Reflux gastro-œsophagien',
  'Crise d\'angoisse',
  'Tension musculaire',
];

const NOTES = [
  'Patient coopératif. À revoir dans 3 mois.',
  'Ordonnance délivrée. Repos conseillé.',
  'Bilan sanguin prescrit pour le prochain rendez-vous.',
  'Traitement symptomatique. Si pas d\'amélioration sous 5 jours, reconsulter.',
  'Évolution favorable. Poursuivre le traitement.',
  'Conseils hygiène de vie donnés.',
  'Imagerie non nécessaire pour l\'instant.',
  'Référence spécialiste si persistance des symptômes.',
  'Contrôle dans 1 mois.',
  'Pas d\'allergie connue. Traitement bien toléré.',
  'Activité physique modérée recommandée.',
  'Régime alimentaire à adapter.',
  'Suivi cardiologique programmé.',
  'Antibiothérapie non indiquée (viral).',
  'Arrêt de travail 3 jours.',
  'Kinésithérapie prescrite.',
  'Patient informé des signes d\'alerte.',
  'Discussion sur le mode de vie et le stress.',
];

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length]!;
}

async function seed() {
  const [org1] = await db
    .insert(organizations)
    .values({
      name: 'City Health Network',
      address: '100 Main St, Paris',
      phone: '+33123456789',
    })
    .returning({ id: organizations.id });

  const org1Id = org1!.id;

  const [fac1, fac2] = await db
    .insert(facilities)
    .values([
      { organizationId: org1Id, name: 'Central Clinic', address: '50 Rue de la Paix', phone: '+33111111111' },
      { organizationId: org1Id, name: 'North Clinic', address: '75 Boulevard Nord', phone: '+33122222222' },
    ])
    .returning({ id: facilities.id });

  const fac1Id = fac1?.id ?? 1;
  const fac2Id = fac2?.id ?? 2;

  const docRows = await db
    .insert(doctors)
    .values([
      { facilityId: fac1Id, firstName: 'Jean', lastName: 'Dupont', email: 'j.dupont@clinic.fr', specialty: 'Médecine générale' },
      { facilityId: fac1Id, firstName: 'Marie', lastName: 'Martin', email: 'm.martin@clinic.fr', specialty: 'Cardiologie' },
      { facilityId: fac1Id, firstName: 'Sophie', lastName: 'Lefebvre', email: 's.lefebvre@clinic.fr', specialty: 'Pédiatrie' },
      { facilityId: fac1Id, firstName: 'Thomas', lastName: 'Moreau', email: 't.moreau@clinic.fr', specialty: 'Dermatologie' },
      { facilityId: fac2Id, firstName: 'Pierre', lastName: 'Bernard', email: 'p.bernard@clinic.fr', specialty: 'Pédiatrie' },
      { facilityId: fac2Id, firstName: 'Isabelle', lastName: 'Petit', email: 'i.petit@clinic.fr', specialty: 'Médecine générale' },
      { facilityId: fac2Id, firstName: 'Nicolas', lastName: 'Roux', email: 'n.roux@clinic.fr', specialty: 'Traumatologie' },
      { facilityId: fac2Id, firstName: 'Céline', lastName: 'Simon', email: 'c.simon@clinic.fr', specialty: 'Psychiatrie' },
    ])
    .returning({ id: doctors.id });

  const patRows = await db
    .insert(patients)
    .values([
      { facilityId: fac1Id, firstName: 'Alice', lastName: 'Leroy', email: 'alice@mail.fr', dateOfBirth: '1990-05-15' },
      { facilityId: fac1Id, firstName: 'Bob', lastName: 'Moreau', email: 'bob@mail.fr', dateOfBirth: '1985-11-20' },
      { facilityId: fac1Id, firstName: 'Claire', lastName: 'Petit', email: 'claire@mail.fr', dateOfBirth: '1992-03-08' },
      { facilityId: fac1Id, firstName: 'David', lastName: 'Martin', email: 'david.m@mail.fr', dateOfBirth: '1988-07-22' },
      { facilityId: fac1Id, firstName: 'Emma', lastName: 'Bernard', email: 'emma@mail.fr', dateOfBirth: '1995-09-14' },
      { facilityId: fac1Id, firstName: 'François', lastName: 'Dubois', email: 'francois@mail.fr', dateOfBirth: '1982-12-30' },
      { facilityId: fac2Id, firstName: 'Giselle', lastName: 'Laurent', email: 'giselle@mail.fr', dateOfBirth: '1991-06-05' },
      { facilityId: fac2Id, firstName: 'Henri', lastName: 'Simon', email: 'henri@mail.fr', dateOfBirth: '1987-02-18' },
      { facilityId: fac2Id, firstName: 'Inès', lastName: 'Michel', email: 'ines@mail.fr', dateOfBirth: '1998-04-11' },
      { facilityId: fac2Id, firstName: 'Julien', lastName: 'Garcia', email: 'julien.g@mail.fr', dateOfBirth: '1979-08-25' },
      { facilityId: fac2Id, firstName: 'Léa', lastName: 'Robert', email: 'lea@mail.fr', dateOfBirth: '1993-01-17' },
      { facilityId: fac2Id, firstName: 'Marc', lastName: 'Richard', email: 'marc.r@mail.fr', dateOfBirth: '1984-10-03' },
    ])
    .returning({ id: patients.id });

  await db.insert(insurances).values([
    { patientId: patRows[0]!.id, providerName: 'Mutuelle A', policyNumber: 'POL-001', groupNumber: 'G1', effectiveDate: '2020-01-01', expirationDate: '2025-12-31' },
    { patientId: patRows[1]!.id, providerName: 'Mutuelle B', policyNumber: 'POL-002', groupNumber: 'G2', effectiveDate: '2021-06-01', expirationDate: '2026-05-31' },
    { patientId: patRows[2]!.id, providerName: 'Mutuelle A', policyNumber: 'POL-003', groupNumber: 'G1', effectiveDate: '2022-01-15', expirationDate: '2026-01-14' },
    { patientId: patRows[3]!.id, providerName: 'AXA Santé', policyNumber: 'AXA-100', groupNumber: 'G3', effectiveDate: '2021-03-01', expirationDate: '2025-12-31' },
    { patientId: patRows[4]!.id, providerName: 'Mutuelle B', policyNumber: 'POL-004', groupNumber: 'G2', effectiveDate: '2023-06-01', expirationDate: '2027-05-31' },
    { patientId: patRows[5]!.id, providerName: 'Harmonie', policyNumber: 'HAR-200', groupNumber: 'G4', effectiveDate: '2020-09-01', expirationDate: '2025-08-31' },
    { patientId: patRows[6]!.id, providerName: 'Mutuelle A', policyNumber: 'POL-005', groupNumber: 'G1', effectiveDate: '2022-11-01', expirationDate: '2026-10-31' },
    { patientId: patRows[7]!.id, providerName: 'AXA Santé', policyNumber: 'AXA-101', groupNumber: 'G3', effectiveDate: '2021-07-01', expirationDate: '2025-12-31' },
    { patientId: patRows[8]!.id, providerName: 'Mutuelle B', policyNumber: 'POL-006', groupNumber: 'G2', effectiveDate: '2024-01-01', expirationDate: '2027-12-31' },
  ]);

  const now = new Date();
  const visitRows: { doctorId: number; patientId: number; visitDate: Date; reason: string; diagnosis: string; notes: string }[] = [];

  for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
    const visitDate = new Date(now);
    visitDate.setDate(visitDate.getDate() - dayOffset);
    if (visitDate.getDay() === 0 || visitDate.getDay() === 6) continue;

    const numVisits = 2 + Math.floor(Math.random() * 4);
    for (let v = 0; v < numVisits; v++) {
      const doc = pick(docRows, dayOffset * 3 + v);
      const pat = pick(patRows, dayOffset * 7 + v * 2);
      const i = dayOffset * 5 + v;
      const slot = new Date(visitDate);
      slot.setHours(8 + (v % 6), (v * 17) % 60, 0, 0);
      visitRows.push({
        doctorId: doc.id,
        patientId: pat.id,
        visitDate: slot,
        reason: pick(REASONS, i),
        diagnosis: pick(DIAGNOSES, i + 10),
        notes: pick(NOTES, i + 20),
      });
    }
  }

  for (let i = 0; i < visitRows.length; i += 50) {
    const chunk = visitRows.slice(i, i + 50);
    await db.insert(visits).values(chunk);
  }

  console.log(
    `Seed completed: 1 org, 2 facilities, ${docRows.length} doctors, ${patRows.length} patients, insurances, ${visitRows.length} visits.`
  );
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
