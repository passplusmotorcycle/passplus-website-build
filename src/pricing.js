/** Single source of truth for public prices (HKD). */
export const pricing = {
  phoneDisplay: '6366 2640',
  phoneTel: '+85263662640',
  whatsappNumber: '85263662640',
  email: 'passplusmotorcyclehk@gmail.com',
  learnerLicence: 548,
  roadTestForm: 510,
  corePackage: 4700,
  corePackageList: 5100,
  mockUpgrade: 100,
  instructorLesson: 850,
  selfPractice: 400,
  mockTest: 950,
  examRental: 500,
  academies: [
    { id: 'island', fee: 3460 },
    { id: 'kwunTong', fee: 3410 },
    { id: 'shaTin', fee: 3390 },
  ],
  packageIncludes: {
    instructor: 4,
    self: 3,
    examRental: 1,
  },
};

export function formatHkd(value) {
  return `$${Math.round(value).toLocaleString('en-HK')}`;
}

export function packageSaving() {
  return pricing.corePackageList - pricing.corePackage;
}
