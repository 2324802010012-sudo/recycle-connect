
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Recycle,
} from 'lucide-react'

const wasteTypes = [
  { value: 'GIAY', label: 'Giấy' },
  { value: 'NHUA', label: 'Nhựa' },
  { value: 'KIM_LOAI', label: 'Kim loại' },
  { value: 'THUY_TINH', label: 'Thủy tinh' },
  { value: 'KHAC', label: 'Khác' },
]

const initialForm = {
  WasteType: '',
  QuantityKg: '',
  Address: '',
  Area: '',
  PreferredDate: '',
  Note: '',
}

function TaoYeuCau() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')

  const today = new Date()
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')

  function updateField(field, value) {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }))
    setError('')
  }

  function validateStep() {
    if (step === 1) {
      const kg = Number(form.QuantityKg)

      if (!wasteTypes.some(item => item.value === form.WasteType)) {
        return 'Vui lòng chọn loại rác tái chế.'
      }

      if (
        !form.QuantityKg ||
        !Number.isFinite(kg) ||
        kg <= 0 ||
        kg > 1000
      ) {
        return 'Khối lượng phải lớn hơn 0 và không vượt quá 1000 kg.'
      }
    }

    if (step === 2) {
      const address = form.Address.trim()
      const area = form.Area.trim()

      if (address.length < 5 || address.length > 200) {
        return 'Địa chỉ phải có từ 5 đến 200 ký tự.'
      }

      if (!area) {
        return 'Vui lòng nhập khu vực thu gom.'
      }

      if (!form.PreferredDate) {
        return 'Vui lòng chọn ngày mong muốn.'
      }

      if (form.PreferredDate < localToday) {
        return 'Ngày mong muốn không được trước ngày hiện tại.'
      }

      if (form.Note.length > 500) {
        return 'Ghi chú không được vượt quá 500 ký tự.'
      }
    }

    return ''
  }

  function nextStep() {
    const message = validateStep()

    if (message) {
      setError(message)
      return
    }

    setError('')
    setStep(prev => Math.min(prev + 1, 3))
  }

  function previousStep() {
    setError('')
    setStep(prev => Math.max(prev - 1, 1))
  }

  function handleSubmit(e) {
    e.preventDefault()

    if (step < 3) {
      nextStep()
      return
    }

    // Chưa gọi API khi Backend tạo yêu cầu chưa triển khai.
    setError(
      'Giao diện đã hoàn tất. Chức năng gửi yêu cầu sẽ được kích hoạt sau khi kết nối API.'
    )
  }

  const selectedWaste = wasteTypes.find(
    item => item.value === form.WasteType
  )

  const inputClass =
    'w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-[#167D61]'

  return (
    <div className="min-h-screen bg-[#F8FAF9] px-4 py-8 text-[#253B35]">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/dan"
          className="inline-flex items-center gap-2 text-[#167D61] mb-6 hover:underline"
        >
          <ArrowLeft size={18} />
          Quay về trang người dân
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-[#EAF5EF] p-3">
              <Recycle size={28} className="text-[#167D61]" />
            </div>

            <div>
              <h1 className="text-2xl font-bold">
                Tạo yêu cầu thu gom
              </h1>
              <p className="text-gray-500 text-sm">
                Bước {step} / 3
              </p>
            </div>
          </div>

          <div
            className="grid grid-cols-3 gap-2 mb-8"
            aria-label={`Tiến độ: bước ${step} trên 3`}
          >
            {[1, 2, 3].map(number => (
              <div
                key={number}
                className={`h-2 rounded-full ${
                  number <= step
                    ? 'bg-[#167D61]'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-xl font-semibold">
                  Thông tin rác tái chế
                </h2>

                <div>
                  <label
                    htmlFor="wasteType"
                    className="block font-medium mb-2"
                  >
                    Loại rác
                  </label>

                  <select
                    id="wasteType"
                    value={form.WasteType}
                    onChange={e =>
                      updateField('WasteType', e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">-- Chọn loại rác --</option>
                    {wasteTypes.map(item => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="quantity"
                    className="block font-medium mb-2"
                  >
                    Khối lượng dự kiến (kg)
                  </label>

                  <input
                    id="quantity"
                    type="number"
                    min="0.01"
                    max="1000"
                    step="any"
                    value={form.QuantityKg}
                    onChange={e =>
                      updateField('QuantityKg', e.target.value)
                    }
                    placeholder="Ví dụ: 5"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-xl font-semibold">
                  Địa điểm và thời gian thu gom
                </h2>

                <div>
                  <label htmlFor="address" className="block font-medium mb-2">
                    Địa chỉ thu gom
                  </label>

                  <input
                    id="address"
                    type="text"
                    maxLength={200}
                    value={form.Address}
                    onChange={e =>
                      updateField('Address', e.target.value)
                    }
                    placeholder="Nhập địa chỉ thu gom"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="area" className="block font-medium mb-2">
                    Khu vực
                  </label>

                  <input
                    id="area"
                    type="text"
                    value={form.Area}
                    onChange={e =>
                      updateField('Area', e.target.value)
                    }
                    placeholder="Ví dụ: KHU_VUC_1"
                    className={inputClass}
                  />

                  <p className="text-xs text-gray-500 mt-2">
                    Khu vực cần trùng với mã khu vực được hệ thống quản lý.
                  </p>
                </div>

                <div>
                  <label htmlFor="date" className="block font-medium mb-2">
                    Ngày mong muốn thu gom
                  </label>

                  <input
                    id="date"
                    type="date"
                    min={localToday}
                    value={form.PreferredDate}
                    onChange={e =>
                      updateField('PreferredDate', e.target.value)
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="note" className="block font-medium mb-2">
                    Ghi chú (không bắt buộc)
                  </label>

                  <textarea
                    id="note"
                    rows={4}
                    maxLength={500}
                    value={form.Note}
                    onChange={e =>
                      updateField('Note', e.target.value)
                    }
                    placeholder="Thông tin bổ sung cho người thu gom"
                    className={inputClass}
                  />

                  <p className="text-right text-xs text-gray-500 mt-1">
                    {form.Note.length}/500 ký tự
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <ClipboardCheck
                    size={25}
                    className="text-[#167D61]"
                  />
                  <h2 className="text-xl font-semibold">
                    Xác nhận thông tin
                  </h2>
                </div>

                <p className="text-gray-500">
                  Vui lòng kiểm tra lại thông tin yêu cầu.
                </p>

                <dl className="rounded-xl bg-[#F8FAF9] p-5 space-y-4">
                  {[
                    ['Loại rác', selectedWaste?.label],
                    ['Khối lượng', `${form.QuantityKg} kg`],
                    ['Địa chỉ', form.Address],
                    ['Khu vực', form.Area],
                    ['Ngày mong muốn', form.PreferredDate],
                    ['Ghi chú', form.Note || 'Không có'],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="border-b border-gray-200 pb-3 last:border-0 last:pb-0"
                    >
                      <dt className="text-sm text-gray-500">
                        {label}
                      </dt>
                      <dd className="font-medium mt-1 break-words">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="text-sm text-amber-700">
                  Chế độ thiết kế giao diện: chưa gửi dữ liệu lên hệ thống.
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-5 bg-amber-50 text-amber-800 rounded-xl p-4 text-sm"
              >
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 mt-8">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={previousStep}
                  className="inline-flex justify-center items-center gap-2 border border-gray-300 px-6 py-3 rounded-xl font-medium"
                >
                  <ArrowLeft size={18} />
                  Quay lại
                </button>
              ) : (
                <span />
              )}

              {step < 3 ? (
                <button
                  type="submit"
                  className="inline-flex justify-center items-center gap-2 bg-[#167D61] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#11634D]"
                >
                  Tiếp tục
                  <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  type="submit"
                  className="inline-flex justify-center items-center gap-2 bg-[#167D61] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#11634D]"
                >
                  <Check size={19} />
                  Xác nhận yêu cầu
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default TaoYeuCau
