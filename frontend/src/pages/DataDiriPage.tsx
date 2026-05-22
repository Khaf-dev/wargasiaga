// frontend/src/pages/DataDiriPage.tsx
// Phase 8.4: Halaman pendataan data diri WARGA (terpisah dari panic button).
// Optional diisi, tapi kalau diisi harus lengkap semua (Q-Data-2=a all-or-nothing).
// Design: Section 4 — card navy, Framer Motion, skeleton loading, toast, BI copy.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, IdCard, MapPin, CheckCircle2, User as UserIcon } from 'lucide-react';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { getDataDiri, updateDataDiri } from '@/services/user';
import type { DataDiriRequest, Gender } from '@/types/user';

// Tipe form state — semua string supaya gampang di-handle input (konversi saat submit)
interface FormState {
  nik: string;
  birth_place: string;
  birth_date: string;
  gender: Gender | '';
  address_block: string;
  rt_number: string;
  rw_number: string;
  kelurahan: string;
  kecamatan: string;
  phone: string;
}

const emptyForm: FormState = {
  nik: '',
  birth_place: '',
  birth_date: '',
  gender: '',
  address_block: '',
  rt_number: '',
  rw_number: '',
  kelurahan: '',
  kecamatan: '',
  phone: '',
};

// Hitung usia dari tanggal lahir (preview, BE juga compute)
const hitungUsia = (isoDate: string): number | null => {
  if (!isoDate) return null;
  const lahir = new Date(isoDate);
  if (Number.isNaN(lahir.getTime())) return null;
  const now = new Date();
  let usia = now.getFullYear() - lahir.getFullYear();
  const belumUltah =
    now.getMonth() < lahir.getMonth() ||
    (now.getMonth() === lahir.getMonth() && now.getDate() < lahir.getDate());
  if (belumUltah) usia -= 1;
  return usia;
};

// Skeleton saat fetch data prefill
const FormSkeleton = () => (
  <div className="space-y-4">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="space-y-2">
        <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
        <div className="h-11 w-full bg-slate-200 rounded-xl animate-pulse" />
      </div>
    ))}
  </div>
);

// Field label + input wrapper (konsisten styling)
const Field = ({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) => (
  <div className="space-y-1.5">
    <label className="block text-sm font-semibold text-slate-700">{label}</label>
    {children}
    {hint && <p className="text-xs text-slate-400">{hint}</p>}
  </div>
);

const inputClass =
  'w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 ' +
  'placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-navy-900/20 ' +
  'focus:border-navy-900 transition-all';

export default function DataDiriPage() {
  const navigate = useNavigate();
  const { userProfile } = useAuthStore();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  // Prefill dari data existing (edit mode)
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const data = await getDataDiri();
        setAlreadyCompleted(data.data_completed);
        setForm({
          nik: data.nik ?? '',
          birth_place: data.birth_place ?? '',
          birth_date: data.birth_date ?? '',
          gender: data.gender ?? '',
          address_block: data.address_block ?? '',
          rt_number: data.rt_number ?? '',
          rw_number: data.rw_number ?? '',
          kelurahan: data.kelurahan ?? '',
          kecamatan: data.kecamatan ?? '',
          phone: data.phone ?? '',
        });
      } catch {
        // Belum ada data / error fetch — biarkan form kosong, bukan error fatal
      } finally {
        setLoading(false);
      }
    };
    fetchExisting();
  }, []);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Validasi ringan di frontend (BE tetap validasi otoritatif)
  const validate = (): string | null => {
    const nikDigits = form.nik.trim();
    if (!/^\d{16}$/.test(nikDigits)) return 'NIK harus tepat 16 digit angka.';
    if (!form.birth_place.trim()) return 'Tempat lahir wajib diisi.';
    if (!form.birth_date) return 'Tanggal lahir wajib diisi.';
    if (new Date(form.birth_date) > new Date()) return 'Tanggal lahir tidak boleh di masa depan.';
    if (form.gender !== 'L' && form.gender !== 'P') return 'Pilih jenis kelamin.';
    if (!form.address_block.trim()) return 'Alamat rumah wajib diisi.';
    if (!form.rt_number.trim()) return 'Nomor RT wajib diisi.';
    if (!form.rw_number.trim()) return 'Nomor RW wajib diisi.';
    if (!form.kelurahan.trim()) return 'Kelurahan wajib diisi.';
    if (!form.kecamatan.trim()) return 'Kecamatan wajib diisi.';
    if (form.phone.replace(/[\s-]/g, '').replace(/^\+/, '').length < 8)
      return 'Nomor telepon tidak valid.';
    return null;
  };

  const handleSubmit = async () => {
    const errMsg = validate();
    if (errMsg) {
      toast.error(errMsg);
      return;
    }
    setSubmitting(true);
    try {
      const payload: DataDiriRequest = {
        nik: form.nik.trim(),
        birth_place: form.birth_place.trim(),
        birth_date: form.birth_date,
        gender: form.gender as Gender,
        address_block: form.address_block.trim(),
        rt_number: form.rt_number.trim(),
        rw_number: form.rw_number.trim(),
        kelurahan: form.kelurahan.trim(),
        kecamatan: form.kecamatan.trim(),
        phone: form.phone.trim(),
      };
      const res = await updateDataDiri(payload);
      toast.success(res.message || 'Data diri berhasil disimpan!', {
        icon: '✅',
      });
      setAlreadyCompleted(true);
      // Kasih jeda biar user baca toast, lalu balik ke beranda
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 409) {
        toast.error(err.response.data?.detail || 'NIK sudah terdaftar di akun lain.');
      } else if (err instanceof AxiosError && err.response?.status === 422) {
        toast.error('Ada data yang belum valid. Periksa kembali isian Anda.');
      } else {
        toast.error('Gagal menyimpan data. Periksa koneksi internet Anda.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const usiaPreview = hitungUsia(form.birth_date);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-slate-50 min-h-screen"
    >
      <div className="max-w-md mx-auto pb-10">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 py-3">
          <div className="flex items-center">
            <motion.button
              onClick={() => navigate(-1)}
              whileTap={{ scale: 0.9 }}
              className="p-2 -ml-2 mr-2"
            >
              <ChevronLeft size={24} className="text-slate-700" />
            </motion.button>
            <div>
              <h1 className="font-bold text-lg text-slate-900 leading-tight">Data Diri</h1>
              <p className="text-xs text-slate-500">
                {alreadyCompleted ? 'Perbarui datamu kapan saja' : 'Lengkapi biar tetangga makin kenal 👋'}
              </p>
            </div>
          </div>
        </header>

        <main className="p-4 space-y-5">
          {loading ? (
            <FormSkeleton />
          ) : (
            <>
              {/* Banner status kelengkapan */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl p-4 flex items-start gap-3 ${
                  alreadyCompleted
                    ? 'bg-green-50 border-l-4 border-success'
                    : 'bg-navy-900/5 border-l-4 border-navy-900'
                }`}
              >
                <span className="text-xl">{alreadyCompleted ? '✅' : '📋'}</span>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">
                    {alreadyCompleted ? 'Data sudah lengkap' : 'Pendataan Warga'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {alreadyCompleted
                      ? 'Terima kasih! Kamu bisa memperbarui data ini kapan saja.'
                      : 'Data ini membantu RT/RW mengenali warga & mempercepat respons darurat. Bersifat opsional.'}
                  </p>
                </div>
              </motion.div>

              {/* SECTION: Identitas */}
              <div className="rounded-2xl bg-white shadow-sm p-4 space-y-4">
                <div className="flex items-center gap-2 text-navy-900">
                  <IdCard size={18} />
                  <h2 className="font-bold text-sm">Identitas</h2>
                </div>

                <Field label="Nama Lengkap">
                  <input
                    type="text"
                    value={userProfile?.full_name ?? ''}
                    disabled
                    className={`${inputClass} bg-slate-50 text-slate-500 cursor-not-allowed`}
                  />
                  <p className="text-xs text-slate-400">Dari akun Google, tidak bisa diubah di sini</p>
                </Field>

                <Field label="NIK" hint={`${form.nik.length}/16 digit`}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={16}
                    value={form.nik}
                    onChange={(e) => setField('nik', e.target.value.replace(/\D/g, ''))}
                    placeholder="16 digit Nomor Induk Kependudukan"
                    className={inputClass}
                  />
                </Field>

                <Field label="Tempat Lahir">
                  <input
                    type="text"
                    value={form.birth_place}
                    onChange={(e) => setField('birth_place', e.target.value)}
                    placeholder="Contoh: Jakarta"
                    className={inputClass}
                  />
                </Field>

                <Field
                  label="Tanggal Lahir"
                  hint={usiaPreview !== null ? `Usia: ${usiaPreview} tahun` : undefined}
                >
                  <input
                    type="date"
                    value={form.birth_date}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setField('birth_date', e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Jenis Kelamin">
                  <div className="flex gap-3">
                    {(
                      [
                        { val: 'L' as Gender, label: 'Laki-laki' },
                        { val: 'P' as Gender, label: 'Perempuan' },
                      ]
                    ).map((opt) => (
                      <motion.button
                        key={opt.val}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setField('gender', opt.val)}
                        className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all border ${
                          form.gender === opt.val
                            ? 'bg-navy-900 text-white border-navy-900'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {opt.label}
                      </motion.button>
                    ))}
                  </div>
                </Field>

                <Field label="Nomor Telepon">
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className={inputClass}
                  />
                </Field>
              </div>

              {/* SECTION: Alamat */}
              <div className="rounded-2xl bg-white shadow-sm p-4 space-y-4">
                <div className="flex items-center gap-2 text-navy-900">
                  <MapPin size={18} />
                  <h2 className="font-bold text-sm">Alamat Tinggal</h2>
                </div>

                <Field label="Alamat Rumah / Blok">
                  <input
                    type="text"
                    value={form.address_block}
                    onChange={(e) => setField('address_block', e.target.value)}
                    placeholder="Contoh: Jl. Merdeka No. 17, Blok C"
                    className={inputClass}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="RT">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.rt_number}
                      onChange={(e) => setField('rt_number', e.target.value)}
                      placeholder="Contoh: 03"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="RW">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.rw_number}
                      onChange={(e) => setField('rw_number', e.target.value)}
                      placeholder="Contoh: 05"
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Field label="Kelurahan">
                  <input
                    type="text"
                    value={form.kelurahan}
                    onChange={(e) => setField('kelurahan', e.target.value)}
                    placeholder="Contoh: Gambir"
                    className={inputClass}
                  />
                </Field>

                <Field label="Kecamatan">
                  <input
                    type="text"
                    value={form.kecamatan}
                    onChange={(e) => setField('kecamatan', e.target.value)}
                    placeholder="Contoh: Gambir"
                    className={inputClass}
                  />
                </Field>
              </div>

              {/* Submit */}
              <motion.button
                onClick={handleSubmit}
                disabled={submitting}
                whileHover={{ scale: submitting ? 1 : 1.02 }}
                whileTap={{ scale: submitting ? 1 : 0.97 }}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-navy-900 text-white font-semibold rounded-full shadow-md disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-block"
                    >
                      <CheckCircle2 size={18} />
                    </motion.span>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <UserIcon size={18} />
                    {alreadyCompleted ? 'Perbarui Data' : 'Simpan Data Diri'}
                  </>
                )}
              </motion.button>

              <p className="text-center text-xs text-slate-400 leading-relaxed px-4">
                Data kamu hanya digunakan untuk verifikasi warga oleh RT/RW setempat
                dan tidak dibagikan ke publik.
              </p>
            </>
          )}
        </main>
      </div>
    </motion.div>
  );
}