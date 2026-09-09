import { StudentData } from '../types';

/**
 * Memeriksa apakah calon murid sudah melengkapi isian formulir pendaftaran.
 * Terpenuhi jika status formulir sudah disubmit/lanjut, atau data biodata inti telah terisi.
 */
export function isStudentFormFilled(student: StudentData | null | undefined): boolean {
  if (!student) return false;

  const submittedStatuses: string[] = [
    'form_submitted',
    'form_verified',
    'scheduled_test',
    'test_completed',
    'passed',
    'passed_reserved',
    'failed',
    're_registration_paid',
    're_registered',
    'class_assigned',
    'completed'
  ];

  if (submittedStatuses.includes(student.status)) {
    return true;
  }

  // Cek kelengkapan data formulir jika status masih draft/filling_form
  const hasBasicInfo = Boolean(
    student.fullName &&
    (student.nik || student.birthDate || student.birthPlace) &&
    (student.address || student.fatherName || student.motherName || student.previousSchoolName)
  );

  return hasBasicInfo;
}

/**
 * Memeriksa apakah calon murid sudah mengunggah bukti transfer biaya formulir.
 * Terpenuhi jika URL bukti transfer tersedia atau status pembayaran formulir pending/verified.
 */
export function hasUploadedPaymentProof(student: StudentData | null | undefined): boolean {
  if (!student) return false;

  return Boolean(
    (student.formPaymentProofUrl && student.formPaymentProofUrl.trim().length > 0) ||
    student.formPaymentStatus === 'verified' ||
    student.formPaymentStatus === 'pending'
  );
}

/**
 * Memeriksa apakah fitur Download Formulir aktif untuk calon murid ini:
 * "jika calon murid sudah mengisi data formulir dan melakukan upload bukti transfer
 *  maka akan muncul fitur download formulir pada dashboard admin panitia"
 */
export function canDownloadStudentForm(student: StudentData | null | undefined): boolean {
  if (!student) return false;
  return isStudentFormFilled(student) && hasUploadedPaymentProof(student);
}

/**
 * Memberikan rincian status kesiapan pengunduhan formulir beserta pesan pemandu untuk admin panitia.
 */
export function getStudentFormStatus(student: StudentData | null | undefined): {
  isFormFilled: boolean;
  hasPaymentProof: boolean;
  canDownload: boolean;
  statusBadgeText: string;
  missingRequirements: string[];
} {
  const formFilled = isStudentFormFilled(student);
  const paymentProof = hasUploadedPaymentProof(student);
  const eligible = formFilled && paymentProof;

  const missingRequirements: string[] = [];
  if (!formFilled) {
    missingRequirements.push('Data Formulir belum diisi lengkap');
  }
  if (!paymentProof) {
    missingRequirements.push('Bukti Transfer Formulir belum diunggah');
  }

  let statusBadgeText = 'Belum Memenuhi Syarat Unduh';
  if (eligible) {
    statusBadgeText = 'Siap Unduh Formulir';
  } else if (formFilled && !paymentProof) {
    statusBadgeText = 'Menunggu Upload Bukti Transfer';
  } else if (!formFilled && paymentProof) {
    statusBadgeText = 'Menunggu Pengisian Formulir';
  }

  return {
    isFormFilled: formFilled,
    hasPaymentProof: paymentProof,
    canDownload: eligible,
    statusBadgeText,
    missingRequirements,
  };
}
