import { AREA_OPTIONS } from '../../../shared/request-options.mjs'

export { AREA_OPTIONS, vietnamDate } from '../../../shared/request-options.mjs'

export function areaLabel(value) {
  return AREA_OPTIONS.find(area => area.value === value)?.label ?? value
}
