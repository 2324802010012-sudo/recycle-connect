export const AREA_OPTIONS = [
  { value: 'KHU_VUC_1', label: 'Thuận An' },
  { value: 'KHU_VUC_2', label: 'Thủ Dầu Một' },
]

export const WASTE_TYPES = ['GIAY', 'NHUA', 'KIM_LOAI', 'THUY_TINH', 'KHAC']
export const REQUEST_STATUSES = ['CHO_NHAN', 'DA_NHAN', 'HOAN_THANH']

const vietnamCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function vietnamDate(date) {
  const fields = Object.fromEntries(vietnamCalendar.formatToParts(date).map(({ type, value }) => [type, value]))
  return [fields.year, fields.month, fields.day].join('-')
}
