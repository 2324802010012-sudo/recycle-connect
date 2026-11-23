import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck, FileText, GlassWater, MapPin,
  Package, Recycle, Scale, Wrench,
} from 'lucide-react'

import { createRequest } from '../services/requestService'
import { AREA_OPTIONS, areaLabel, vietnamDate } from '../services/requestOptions'
import { useRetryCooldown } from '../hooks/useRetryCooldown'

const wasteTypes = [
  { value: 'GIAY', label: 'Giấy', Icon: FileText },
  { value: 'NHUA', label: 'Nhựa', Icon: Package },
  { value: 'KIM_LOAI', label: 'Kim loại', Icon: Wrench },
  { value: 'THUY_TINH', label: 'Thủy tinh', Icon: GlassWater },
  { value: 'KHAC', label: 'Khác', Icon: Recycle },
]

const steps = ['Loại rác', 'Lịch thu gom', 'Xác nhận']
const fieldTargets = {
  WasteType: 'input[name="wasteType"]',
  QuantityKg: '#quantity',
  Address: '#address',
  Area: '#area',
  PreferredDate: '#date',
  Note: '#note',
}
const inputClass = 'min-w-0 w-full rounded-xl border bg-[#f8faf9] px-3.5 py-3 text-base text-[#153e31] focus:border-[#167d61] focus:bg-white aria-invalid:border-warning'
const labelClass = 'mb-2 block text-sm font-semibold text-[#153e31]'

function ReviewGroup({ icon: Icon, title, fields, onEdit, disabled }) {
  return (
    <section className="rounded-2xl border bg-[#f6faf7] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#153e31]">
          <Icon size={18} className="text-[#167d61]" aria-hidden="true" />
          {title}
        </h3>
        <button type="button" disabled={disabled} onClick={onEdit}
          className="rounded-lg px-2 py-1 text-sm font-semibold text-[#12644e] hover:bg-[#e7f3ec] disabled:opacity-50">
          Sửa<span className="sr-only"> {title.toLowerCase()}</span>
        </button>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value, wide]) => (
          <div key={label} className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
            <dt className="text-xs text-slate-600">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-[#153e31]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

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
  const [invalidField, setInvalidField] = useState('')

  const navigate = useNavigate()
  const [localToday] = useState(() => vietnamDate(new Date()))
  const [submitting, setSubmitting] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const cooldown = useRetryCooldown()
  const pending = useRef(false)
  const lastAttempt = useRef({ key: null, payload: null })
  const formElement = useRef(null)
  const stepHeading = useRef(null)
  const [focusTarget, setFocusTarget] = useState(null)

  useEffect(() => {
    if (!focusTarget) return
    const field = focusTarget.field
      ? formElement.current?.querySelector(fieldTargets[focusTarget.field])
      : null
    const target = field ?? stepHeading.current
    target?.focus()
  }, [focusTarget])

  function showValidationError(failure) {
    setInvalidField(failure.field)
    setError(failure.message)
    setFocusTarget({ field: failure.field })
  }

  function updateField(field, value) {
    if (uncertain) return
    setForm(prev => ({
      ...prev,
      [field]: value,
    }))
    setError('')
    setInvalidField('')
  }

  function validateStep(targetStep = step) {
    if (targetStep === 1) {
      const kg = Number(form.QuantityKg)

      if (!wasteTypes.some(item => item.value === form.WasteType)) {
        return { field: 'WasteType', message: 'Vui lòng chọn loại rác tái chế.' }
      }

      if (
        !form.QuantityKg ||
        !Number.isFinite(kg) ||
        kg <= 0 ||
        kg > 1000
      ) {
        return { field: 'QuantityKg', message: 'Khối lượng phải lớn hơn 0 và không vượt quá 1000 kg.' }
      }
    }

    if (targetStep === 2) {
      const address = form.Address.trim()
      const area = form.Area.trim()

      if (address.length < 5 || address.length > 200) {
        return { field: 'Address', message: 'Địa chỉ phải có từ 5 đến 200 ký tự.' }
      }

      if (!AREA_OPTIONS.some(option => option.value === area)) {
        return { field: 'Area', message: 'Vui lòng chọn khu vực thu gom.' }
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.PreferredDate) || Number.isNaN(Date.parse(`${form.PreferredDate}T00:00:00Z`))) {
        return { field: 'PreferredDate', message: 'Vui lòng chọn ngày mong muốn.' }
      }

      if (form.PreferredDate < vietnamDate(new Date())) {
        return { field: 'PreferredDate', message: 'Ngày mong muốn không được trước ngày hiện tại.' }
      }

      if (form.Note.length > 500) {
        return { field: 'Note', message: 'Ghi chú không được vượt quá 500 ký tự.' }
      }
    }

    return null
  }

  function nextStep() {
    const failure = validateStep()

    if (failure) {
      showValidationError(failure)
      return
    }

    goToStep(step + 1)
  }

  function goToStep(target) {
    if (pending.current || uncertain) return
    setError('')
    setInvalidField('')
    setStep(target)
    setFocusTarget({ field: null })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (pending.current || cooldown.blocked) return
    if (step < 3) {
      nextStep()
      return
    }

    // Kiểm tra lại hai bước vì ngày hẹn có thể đã qua khi form mở lâu.
    for (const targetStep of uncertain ? [] : [1, 2]) {
      const failure = validateStep(targetStep)
      if (failure) {
        setStep(targetStep)
        showValidationError(failure)
        return
      }
    }

    pending.current = true
    setSubmitting(true)
    setError('')
    try {
      const payload = uncertain ? JSON.parse(lastAttempt.current.payload) : {
        wasteType: form.WasteType,
        quantityKg: Number(form.QuantityKg),
        address: form.Address.trim(),
        area: form.Area,
        preferredDate: form.PreferredDate,
        note: form.Note.trim(),
      }
      const normalized = JSON.stringify(payload)
      if (lastAttempt.current.payload !== normalized) {
        lastAttempt.current = { key: crypto.randomUUID(), payload: normalized }
      }
      // Mất phản hồi vẫn gửi lại cùng key để không tạo đơn trùng.
      await createRequest(payload, lastAttempt.current.key)
      navigate('/dan', { replace: true, state: { requestCreated: true } })
    } catch (error) {
      cooldown.defer(error)
      if (error.status === 401) {
        navigate('/login', { replace: true, state: { from: '/dan/tao-yeu-cau' } })
        return
      }
      if (error.unknownOutcome) {
        setUncertain(true)
        setError('Chưa thể xác nhận yêu cầu đã được lưu. Thông tin được giữ nguyên; chọn “Gửi lại an toàn” để kiểm tra và gửi lại cùng mã thao tác.')
      } else setError(error.message || 'Không thể gửi yêu cầu.')
    } finally {
      pending.current = false
      setSubmitting(false)
    }
  }

  const selectedWaste = wasteTypes.find(
    item => item.value === form.WasteType
  )

  function fieldError(field) {
    return {
      'aria-invalid': invalidField === field,
      'aria-describedby': invalidField === field ? 'request-error' : undefined,
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f8f6] px-4 py-6 text-[#253b35] sm:py-9">
      <div className="mx-auto max-w-3xl">
        <Link to="/dan" className="mb-4 inline-flex items-center gap-2 rounded-lg py-2 text-sm font-semibold text-[#12644e] hover:underline">
          <ArrowLeft size={17} aria-hidden="true" />
          Về trang người dân
        </Link>

        <header className="rounded-3xl bg-gradient-to-br from-[#143e32] to-[#1c7056] px-5 py-6 text-white sm:px-7 sm:py-8">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15 sm:size-12">
              <Recycle size={24} aria-hidden="true" />
            </span>
            <h1 className="text-xl font-bold tracking-tight sm:text-3xl">Tạo yêu cầu thu gom</h1>
          </div>
        </header>

        <div className="mt-4 overflow-hidden rounded-3xl border bg-white shadow-sm">
          <ol aria-label="Tiến độ tạo yêu cầu" className="grid grid-cols-3 gap-1.5 border-b bg-[#f8faf9] px-3 py-4 sm:gap-3 sm:px-6">
            {steps.map((label, index) => {
              const current = step === index + 1
              const completed = step > index + 1
              return (
                <li key={label} aria-current={current ? 'step' : undefined}
                  className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center text-[11px] font-semibold sm:flex-row sm:gap-2.5 sm:px-3 sm:text-sm ${current ? 'bg-[#e7f3ec] text-[#12644e]' : 'text-slate-600'}`}>
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs ${current ? 'bg-[#167d61] text-white' : completed ? 'bg-[#e7f3ec] text-[#167d61]' : 'bg-[#edf1ef] text-slate-600'}`}>
                    {completed ? <Check size={15} aria-hidden="true" /> : index + 1}
                  </span>
                  {label}
                </li>
              )
            })}
          </ol>

          <form ref={formElement} onSubmit={handleSubmit} noValidate>
            <div className="p-4 sm:p-7">
              {step === 1 && (
                <div className="space-y-5">
                  <h2 ref={stepHeading} tabIndex={-1} className="w-fit rounded-sm text-lg font-bold text-[#153e31] sm:text-xl">Thông tin rác tái chế</h2>
                  <fieldset {...fieldError('WasteType')} className="min-w-0">
                    <legend className={labelClass}>Loại rác</legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {wasteTypes.map(({ value, label, Icon }) => (
                        <label key={value} className="relative min-w-0 cursor-pointer">
                          <input type="radio" name="wasteType" value={value} checked={form.WasteType === value} {...fieldError('WasteType')}
                            onChange={() => updateField('WasteType', value)} className="peer sr-only" />
                          <span className="flex min-h-14 items-center gap-2 rounded-xl border bg-[#f8faf9] px-2.5 py-3 text-sm font-semibold text-[#153e31] transition peer-checked:border-[#167d61] peer-checked:bg-[#e7f3ec] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#167d61] sm:px-3">
                            <Icon size={18} className="shrink-0 text-[#167d61]" aria-hidden="true" />
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="max-w-xs">
                    <label htmlFor="quantity" className={labelClass}>Khối lượng dự kiến</label>
                    <div className="relative">
                      <input id="quantity" {...fieldError('QuantityKg')} type="number" min="0" max="1000" step="any"
                        value={form.QuantityKg} onChange={event => updateField('QuantityKg', event.target.value)}
                        placeholder="Ví dụ: 5" className={`${inputClass} pr-16`} />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1 text-sm text-slate-600">
                        <Scale size={15} aria-hidden="true" /> kg
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <h2 ref={stepHeading} tabIndex={-1} className="w-fit rounded-sm text-lg font-bold text-[#153e31] sm:text-xl">Địa điểm và thời gian thu gom</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="min-w-0 sm:col-span-2">
                      <label htmlFor="address" className={labelClass}>Địa chỉ thu gom</label>
                      <input id="address" {...fieldError('Address')} type="text" maxLength={200} value={form.Address}
                        onChange={event => updateField('Address', event.target.value)}
                        placeholder="Nhập địa chỉ thu gom" className={inputClass} />
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="area" className={labelClass}>Khu vực</label>
                      <select id="area" {...fieldError('Area')} value={form.Area}
                        onChange={event => updateField('Area', event.target.value)} className={inputClass}>
                        <option value="">Chọn khu vực</option>
                        {AREA_OPTIONS.map(area => <option key={area.value} value={area.value}>{area.label}</option>)}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="date" className={labelClass}>Ngày mong muốn</label>
                      <input id="date" {...fieldError('PreferredDate')} type="date" min={localToday} value={form.PreferredDate}
                        onChange={event => updateField('PreferredDate', event.target.value)} className={inputClass} />
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <label htmlFor="note" className={labelClass}>Ghi chú <span className="font-normal text-slate-600">(không bắt buộc)</span></label>
                      <textarea id="note" {...fieldError('Note')} rows={3} maxLength={500} value={form.Note}
                        onChange={event => updateField('Note', event.target.value)}
                        placeholder="Thông tin bổ sung cho người thu gom" className={`${inputClass} resize-y`} />
                      <p className="mt-1 text-right text-xs tabular-nums text-slate-600">{form.Note.length}/500 ký tự</p>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <h2 ref={stepHeading} tabIndex={-1} className="mb-4 flex w-fit items-center gap-2 rounded-sm text-lg font-bold text-[#153e31] sm:text-xl">
                    <ClipboardCheck size={21} className="text-[#167d61]" aria-hidden="true" />
                    Xác nhận thông tin
                  </h2>
                  <ReviewGroup icon={Recycle} title="Thông tin rác" disabled={submitting || uncertain} onEdit={() => goToStep(1)}
                    fields={[
                      ['Loại rác', selectedWaste?.label],
                      ['Khối lượng', `${form.QuantityKg} kg`],
                    ]} />
                  <ReviewGroup icon={MapPin} title="Lịch thu gom" disabled={submitting || uncertain} onEdit={() => goToStep(2)}
                    fields={[
                      ['Khu vực', areaLabel(form.Area)],
                      ['Ngày mong muốn', form.PreferredDate.split('-').reverse().join('/')],
                      ['Địa chỉ', form.Address.trim(), true],
                      ['Ghi chú', form.Note.trim() || 'Không có', true],
                    ]} />
                </div>
              )}

              {error && (
                <p id="request-error" role="alert" className="mt-5 rounded-xl border border-warning bg-warning/15 p-4 text-sm text-amber-900">
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t bg-[#f8faf9] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              {step > 1 && (
                <button type="button" onClick={() => goToStep(step - 1)} disabled={submitting || uncertain}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-[#153e31] transition hover:bg-[#eef4f1] disabled:opacity-50">
                  <ArrowLeft size={17} aria-hidden="true" />
                  Quay lại
                </button>
              )}

              <button type="submit" disabled={submitting || cooldown.blocked} aria-busy={submitting}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#167d61] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#11634d] disabled:opacity-60 sm:ml-auto">
                {cooldown.blocked ? 'Vui lòng chờ để thử lại' : step === 3 ? (submitting ? 'Đang gửi…' : uncertain ? 'Gửi lại an toàn' : 'Xác nhận yêu cầu') : 'Tiếp tục'}
                {step === 3 ? <Check size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

export default TaoYeuCau
